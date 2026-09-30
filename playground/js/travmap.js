// TravMap 생성: representation/features.py, traversability.py(GeometricTraversability), builder.py,
// sim/visibility.py를 옮긴 것. cost = max(경사, 턱, 거칠기 각각을 한계로 나눈 램프), 치명 셀 = cost >= 0.95.
import { avgPool, maxPool, grad, odd } from "./core.js";

export const TRAV = {
  maxSlope: 0.26, maxStep: 0.08, maxRough: 0.04, safeRatio: 0.3, unknownCost: 0.5,
  slopeWin: 0.35, stepWin: 0.30, trendWin: 1.0, roughWin: 0.25, inflate: 0.30,
  lethal: 0.95,
};

function ramp(v, limit) {
  const r = v / limit, s = TRAV.safeRatio;
  const x = (r - s) / (1 - s);
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function features(e, g) {
  const k = (m) => odd(Math.round(m / g.res));
  const [gx, gy] = grad(avgPool(e, g, k(TRAV.slopeWin)), g);
  const N = g.N, slope = new Float32Array(N);
  for (let i = 0; i < N; i++) slope[i] = Math.atan(Math.hypot(gx[i], gy[i]));

  const ks = k(TRAV.stepWin);
  const neg = new Float32Array(N);
  for (let i = 0; i < N; i++) neg[i] = -e[i];
  const mx = maxPool(e, g, ks), mn = maxPool(neg, g, ks);
  const [tx, ty] = grad(avgPool(e, g, k(TRAV.trendWin)), g);
  const step = new Float32Array(N);
  for (let i = 0; i < N; i++) step[i] = Math.max(0, mx[i] + mn[i] - Math.hypot(tx[i], ty[i]) * ks * g.res);

  const kr = k(TRAV.roughWin);
  const av = avgPool(e, g, kr), r2 = new Float32Array(N);
  for (let i = 0; i < N; i++) { const d = e[i] - av[i]; r2[i] = d * d; }
  const rough = avgPool(r2, g, kr);
  for (let i = 0; i < N; i++) rough[i] = Math.sqrt(Math.max(0, rough[i]));

  const ki = odd(Math.round((2 * TRAV.inflate) / g.res));
  return { gx, gy, slope: maxPool(slope, g, ki), step: maxPool(step, g, ki), rough: maxPool(rough, g, ki) };
}

function geomCost(f, i) {
  return Math.max(ramp(f.slope[i], TRAV.maxSlope), ramp(f.step[i], TRAV.maxStep), ramp(f.rough[i], TRAV.maxRough));
}

// NaN 칸을 이웃 평균으로 8번 번져 채운다(builder.fill_unknown).
function fillUnknown(elev, known, g) {
  const N = g.N, W = g.W, H = g.H;
  let e = new Float32Array(N), w = new Float32Array(N);
  for (let i = 0; i < N; i++) { e[i] = known[i] ? elev[i] : 0; w[i] = known[i] ? 1 : 0; }
  for (let it = 0; it < 8; it++) {
    const ne = Float32Array.from(e), nw = Float32Array.from(w);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (known[i]) continue;
      let num = 0, den = 0;
      for (let dr = -1; dr <= 1; dr++) { const rr = r + dr; if (rr < 0 || rr >= H) continue;
        for (let dc = -1; dc <= 1; dc++) { const cc = c + dc; if (cc < 0 || cc >= W) continue;
          const j = rr * W + cc; num += e[j] * w[j]; den += w[j]; } }
      if (den > 0) { ne[i] = num / den; nw[i] = Math.max(w[i], 1); }
    }
    e = ne; w = nw;
  }
  return e;
}

// opts: { ceiling: Float32Array|null, shadowDepth: number|null, evidence: bool }
export function buildMap(elev, g, opts = {}) {
  const N = g.N, known = new Uint8Array(N);
  let allKnown = true;
  for (let i = 0; i < N; i++) { known[i] = Number.isFinite(elev[i]) ? 1 : 0; if (!known[i]) allKnown = false; }
  let e = allKnown ? elev : fillUnknown(elev, known, g);
  const bounded = new Uint8Array(N);
  const c = opts.ceiling;
  if (c && !allKnown) {
    e = Float32Array.from(e);
    for (let i = 0; i < N; i++) if (!known[i] && c[i] < e[i]) { bounded[i] = 1; e[i] = c[i]; }
    if (opts.shadowDepth != null) {
      const seen = new Float32Array(N);
      for (let i = 0; i < N; i++) seen[i] = known[i] ? -elev[i] : -Infinity;
      const ks = odd(Math.round(TRAV.stepWin / g.res));
      const ground = maxPool(seen, g, ks);                 // -(관측 최저 높이)
      const shadow = new Uint8Array(N);
      let neg = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        shadow[i] = !known[i] && Number.isFinite(c[i]) ? 1 : 0;
        neg[i] = shadow[i] && Number.isFinite(ground[i]) && c[i] < -ground[i] - 0.02 ? 1 : 0;
      }
      for (let it = 0; it < 2; it++) { const d = maxPool(neg, g, 3); for (let i = 0; i < N; i++) neg[i] = shadow[i] && d[i] > 0 ? 1 : 0; }
      let lo = null, sight = null;
      if (opts.evidence) {
        const ke = odd(Math.round(1.0 / g.res));
        lo = maxPool(seen, g, ke);
        const sc = new Float32Array(N);
        for (let i = 0; i < N; i++) sc[i] = shadow[i] ? -c[i] : -Infinity;
        sight = maxPool(sc, g, ke);
      }
      for (let i = 0; i < N; i++) {
        if (!neg[i]) continue;
        let floor = -ground[i] - opts.shadowDepth;
        if (lo && Number.isFinite(sight[i]) && Number.isFinite(lo[i]) && -sight[i] >= -lo[i] - 0.02) floor = -lo[i];
        e[i] = Math.min(e[i], floor);
        bounded[i] = 1;
      }
    }
  }
  const f = features(e, g);
  const cost = new Float32Array(N), sigma = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const gc = geomCost(f, i);
    if (known[i]) cost[i] = gc;
    else { cost[i] = bounded[i] ? Math.max(TRAV.unknownCost, gc) : TRAV.unknownCost; sigma[i] = 1; }
  }
  // TP-0101: 로봇 둘레(몸체 0.35 m ~ unknownNear) 미관측 칸은 최소 unknownNearCost
  if (opts.unknownNear && opts.robotXY) {
    const [rx, ry] = opts.robotXY, R = opts.unknownNear, rin = 0.35, cn = opts.unknownNearCost ?? 1.0;
    const r0 = Math.max(0, Math.floor((ry - R) / g.res)), r1 = Math.min(g.H - 1, Math.ceil((ry + R) / g.res));
    const c0 = Math.max(0, Math.floor((rx - R) / g.res)), c1 = Math.min(g.W - 1, Math.ceil((rx + R) / g.res));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * g.W + c, d2 = (c * g.res - rx) ** 2 + (r * g.res - ry) ** 2;
      if (!known[i] && d2 <= R * R && d2 > rin * rin && cost[i] < cn) cost[i] = cn;
    }
  }
  return { grid: g, elev: e, gx: f.gx, gy: f.gy, slope: f.slope, step: f.step, rough: f.rough, cost, sigma, known, bounded };
}

// 2.5D 시선 검사(수평선 스윕). -> { vis: Uint8Array, ceil: Float32Array(+inf = 제한 없음) }
export function lineOfSight(z, g, sx, sy, sz, range, eps = 0.02) {
  const res = g.res, step = 0.5 * res, S = Math.ceil(range / step), R = Math.ceil((4 * Math.PI * range) / res);
  const vis = new Uint8Array(g.N), ceil = new Float32Array(g.N).fill(Infinity);
  for (let k = 0; k < R; k++) {
    const th = (2 * Math.PI * k) / R, ct = Math.cos(th), st = Math.sin(th);
    let horizon = -Infinity;
    for (let s = 1; s <= S; s++) {
      const d = s * step, x = sx + ct * d, y = sy + st * d;
      const c = Math.round(x / res), r = Math.round(y / res);
      if (c < 0 || r < 0 || c >= g.W || r >= g.H) break;
      const i = r * g.W + c, h = z[i];
      if ((h + eps - sz) / d >= horizon) vis[i] = 1;
      else { const cl = sz + horizon * d; if (cl < ceil[i]) ceil[i] = cl; }
      const sl = (h - sz) / d;
      if (sl > horizon) horizon = sl;
    }
  }
  return { vis, ceil };
}
