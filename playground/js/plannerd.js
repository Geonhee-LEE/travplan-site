// Planner D를 브라우저에서(TP-0137). 원본: travplan/planners/learned/flow_planner.py, flow_model.py, obs.py.
//   TravMap 자기중심 crop(64×64, 0.1 m, cost·σ·경사·턱) + 경로 소목표(Guidance 4 m 앞) + 현재 twist
//     -> FlowPolicy가 제어 변화율 a[16, 40, 3]을 뽑는다(10스텝)
//     -> 적분해 twist, 스워브 모델로 rollout(그래서 운동학적으로 가능)
//     -> 지도 cost + 치명 + Guidance cost-to-go로 하나를 고른다(학습하지 않은 선택기). 이전 계획(한 칸 민 것)도 후보다.
// 가중치는 plannerd_weights.js(float16, 생성물)이고, Planner D를 고를 때만 불러온다.
//
// 샘플러 둘이 같은 속도망 v(x, t)를 쓴다(배경 0.6b의 환율: x̂₁ = x + (1 − t)·v, ε̂ = x − t·v).
//   flow      — ODE. Euler n스텝: x ← x + v/n. 지금 Planner D 그대로다.
//   diffusion — DDPM식 조상 샘플링. 선형(rectified flow) 일정 x_t = t·x₁ + (1 − t)·ε에서
//               q(x_s | x_t, x̂₁)의 평균과 분산(VDM 식)으로 한 걸음씩 노이즈를 새로 섞으며 간다. n = 1이면 둘 다 조건부 평균이다.
import { Rng } from "./core.js";
import { SWERVE, clampTwist, clampAccel, stepPose, sampleMap } from "./control.js";
import { TRAV } from "./travmap.js";

export const PD_SEL = { K: 16, wCost: 6.0, lethalPenalty: 1e3, wProgress: 4.0, keepPrevious: true, lookahead: 4.0 };
const OBS_SCALE = [1, 1, 1 / 0.3, 1 / 0.1];

let NET = null, LOADING = null;
export const plannerDReady = () => !!NET;
export function plannerDMeta() { return NET?.meta ?? null; }
// 가중치를 한 번만 불러 float32로 푼다. 여러 번 불러도 같은 Promise다.
export function loadPlannerD() {
  if (NET) return Promise.resolve(NET);
  LOADING ||= import("./plannerd_weights.js").then((m) => (NET = buildNet(m)));
  return LOADING;
}
// 가중치 모듈을 정적으로 가져온 쪽(검사·그림 페이지)이 동기로 넣는다.
export function setPlannerDWeights(m) { NET ||= buildNet(m); return NET; }

function half(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * f * 2 ** -24;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * 2 ** (e - 15);
}
function buildNet(m) {
  const bin = atob(m.PLANNER_D_F16), n = bin.length >> 1, all = new Float32Array(n);
  for (let i = 0; i < n; i++) all[i] = half(bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8));
  const W = {};
  for (const [name, shape, off] of m.PLANNER_D_LAYERS) W[name] = all.subarray(off, off + shape.reduce((a, b) => a * b, 1));
  const cfg = m.PLANNER_D_META.cfg;
  return { W, meta: m.PLANNER_D_META, T: cfg.horizon, dt: cfg.dt, D: 3 * cfg.horizon, H: cfg.hidden };
}

// 정확한 GELU(torch nn.GELU 기본) = x/2 · (1 + erf(x/√2)). erf는 Numerical Recipes erfcc(상대 오차 < 1.2e-7).
function erf(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
    t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - r : r - 1;
}
const gelu = (x) => 0.5 * x * (1 + erf(x * Math.SQRT1_2));

function conv(X, C, H, Wd, w, b, O, k, s, p) {
  const Ho = Math.floor((H + 2 * p - k) / s) + 1, Wo = Math.floor((Wd + 2 * p - k) / s) + 1, Y = new Float32Array(O * Ho * Wo);
  for (let o = 0; o < O; o++) for (let i = 0; i < Ho; i++) for (let j = 0; j < Wo; j++) {
    let acc = b[o];
    for (let c = 0; c < C; c++) for (let u = 0; u < k; u++) {
      const r = i * s - p + u; if (r < 0 || r >= H) continue;
      const wb = ((o * C + c) * k + u) * k, xb = (c * H + r) * Wd;
      for (let v = 0; v < k; v++) { const q = j * s - p + v; if (q >= 0 && q < Wd) acc += w[wb + v] * X[xb + q]; }
    }
    Y[(o * Ho + i) * Wo + j] = gelu(acc);
  }
  return [Y, Ho, Wo];
}
function linear(x, w, b, out, inN, act) {
  const y = new Float32Array(out);
  for (let o = 0; o < out; o++) { let acc = b[o]; const r = o * inN; for (let i = 0; i < inN; i++) acc += w[r + i] * x[i]; y[o] = act ? gelu(acc) : acc; }
  return y;
}

// 자기중심 crop: obs.py egocentric_crop + build_obs. grid_sample(bilinear, zeros, align_corners=True), 지도 밖은 1.
export function egocentricCrop(map, pose, S = 64, res = 0.1) {
  const g = map.grid, chans = [map.cost, map.sigma, map.slope, map.step], out = new Float32Array(4 * S * S);
  const half = ((S - 1) / 2) * res, c = Math.cos(pose[2]), s = Math.sin(pose[2]);
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
    const v = -half + (2 * half * i) / (S - 1), u = -half + (2 * half * j) / (S - 1);
    const fx = (pose[0] + c * u - s * v) / g.res, fy = (pose[1] + s * u + c * v) / g.res;
    const oob = fx < 0 || fy < 0 || fx > g.W - 1 || fy > g.H - 1;
    for (let ch = 0; ch < 4; ch++) {
      let val = 1;
      if (!oob) {
        const c0 = Math.floor(fx), r0 = Math.floor(fy), tx = fx - c0, ty = fy - r0, a = chans[ch];
        const at = (r, cc) => (r < g.H && cc < g.W ? a[r * g.W + cc] : 0);
        val = at(r0, c0) * (1 - tx) * (1 - ty) + at(r0, c0 + 1) * tx * (1 - ty) + at(r0 + 1, c0) * (1 - tx) * ty + at(r0 + 1, c0 + 1) * tx * ty;
      }
      out[(ch * S + i) * S + j] = val * OBS_SCALE[ch];
    }
  }
  return out;
}

export function goalBody(pose, goal, clip = 3.0) {
  const dx = goal[0] - pose[0], dy = goal[1] - pose[1], c = Math.cos(pose[2]), s = Math.sin(pose[2]);
  const gx = c * dx + s * dy, gy = -s * dx + c * dy, n = Math.max(Math.hypot(gx, gy), 1e-6), k = Math.min(1, clip / n);
  return [gx * k, gy * k];
}

// FlowPolicy.condition -> [320]
export function condition(net, crop, gBody, twistN) {
  const W = net.W;
  let [x, H, Wd] = conv(crop, 4, 64, 64, W["encoder.0.weight"], W["encoder.0.bias"], 32, 5, 2, 2);
  [x, H, Wd] = conv(x, 32, H, Wd, W["encoder.2.weight"], W["encoder.2.bias"], 64, 3, 2, 1);
  [x, H, Wd] = conv(x, 64, H, Wd, W["encoder.4.weight"], W["encoder.4.bias"], 64, 3, 2, 1);
  [x, H, Wd] = conv(x, 64, H, Wd, W["encoder.6.weight"], W["encoder.6.bias"], 128, 3, 2, 1);
  const enc = linear(x, W["encoder.9.weight"], W["encoder.9.bias"], 256, 2048, true);
  const cm = linear([gBody[0] / 3, gBody[1] / 3, ...twistN], W["cond_mlp.0.weight"], W["cond_mlp.0.bias"], 64, 5, true);
  const cond = new Float32Array(320); cond.set(enc, 0); cond.set(cm, 256);
  return cond;
}

function timeEmbedding(t) {
  const e = new Float32Array(32), L = Math.log(1000);
  for (let k = 0; k < 16; k++) { const a = t * Math.exp((L * k) / 15); e[k] = Math.sin(a); e[16 + k] = Math.cos(a); }
  return e;
}

// 첫 층의 cond 몫은 계획마다 한 번만 계산한다(속도망 입력 = [x 120, cond 320, 시간 32]).
export function velocityFn(net, cond) {
  const W = net.W, w0 = W["net.0.weight"], b0 = W["net.0.bias"], H = net.H, D = net.D, IN = D + 320 + 32;
  const base = new Float32Array(H);
  for (let o = 0; o < H; o++) { let acc = b0[o]; const r = o * IN + D; for (let i = 0; i < 320; i++) acc += w0[r + i] * cond[i]; base[o] = acc; }
  const tcache = new Map();
  return (x, t) => {
    let tb = tcache.get(t);
    if (!tb) {
      const te = timeEmbedding(t); tb = new Float32Array(H);
      for (let o = 0; o < H; o++) { let acc = base[o]; const r = o * IN + D + 320; for (let i = 0; i < 32; i++) acc += w0[r + i] * te[i]; tb[o] = acc; }
      tcache.set(t, tb);
    }
    const h = new Float32Array(H);
    for (let o = 0; o < H; o++) { let acc = tb[o]; const r = o * IN; for (let i = 0; i < D; i++) acc += w0[r + i] * x[i]; h[o] = gelu(acc); }
    const h2 = linear(h, W["net.2.weight"], W["net.2.bias"], H, H, true);
    const h3 = linear(h2, W["net.4.weight"], W["net.4.bias"], H, H, true);
    return linear(h3, W["net.6.weight"], W["net.6.bias"], D, H, false);
  };
}

// 표본 K개. sampler = "flow"(ODE Euler) | "diffusion"(선형 일정의 DDPM 조상 샘플링). -> [K][D]
export function sample(vel, D, K, n, sampler, rng) {
  const xs = [];
  for (let k = 0; k < K; k++) {
    let x = Float32Array.from({ length: D }, () => rng.normal());
    for (let i = 0; i < n; i++) {
      const t = i / n, s = (i + 1) / n, v = vel(x, t);
      if (sampler === "flow") { for (let d = 0; d < D; d++) x[d] += v[d] / n; continue; }
      const x1 = new Float32Array(D); for (let d = 0; d < D; d++) x1[d] = x[d] + (1 - t) * v[d];   // x̂₁
      if (s >= 1) { x = x1; continue; }
      // x_t = α_t x₁ + σ_t ε, α = t, σ = 1 − t. 사후 q(x_s | x_t, x̂₁)의 평균·분산(Kingma 외 2021, VDM)
      const at = t, st = 1 - t, as = s, ss = 1 - s, ats = at / as, s2ts = st * st - ats * ats * ss * ss;
      const cx = (ats * ss * ss) / (st * st), c1 = (as * s2ts) / (st * st), sd = Math.sqrt(Math.max(0, (s2ts * ss * ss) / (st * st)));
      const nx = new Float32Array(D); for (let d = 0; d < D; d++) nx[d] = cx * x[d] + c1 * x1[d] + sd * rng.normal();
      x = nx;
    }
    xs.push(x);
  }
  return xs;
}

// cost-to-go 이중선형(Guidance.sample: 지도 밖은 최댓값)
function sampleField(field, g, x, y) {
  const fx = x / g.res, fy = y / g.res;
  if (fx < 0 || fy < 0 || fx > g.W - 1 || fy > g.H - 1) return field.big;
  const c0 = Math.min(g.W - 2, fx | 0), r0 = Math.min(g.H - 2, fy | 0), tx = fx - c0, ty = fy - r0, i = r0 * g.W + c0, a = field.ctg;
  return a[i] * (1 - tx) * (1 - ty) + a[i + 1] * tx * (1 - ty) + a[i + g.W] * (1 - tx) * ty + a[i + g.W + 1] * tx * ty;
}
function pointAt(route, dist) {   // _point_at: 누적 길이가 dist 이상인 첫 꼭짓점
  let s = 0;
  for (let i = 1; i < route.length; i++) { s += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]); if (s >= dist) return route[i]; }
  return route[route.length - 1];
}

// Planner 진입점. guide = { field, route }(Guidance), mem = World.planMem(난수, 이전 계획, twist, 스텝 수).
export function plannerDPlan(map, start, goal, mem, guide, sampler) {
  const t0 = performance.now(), net = NET;
  mem.pdRng ||= new Rng((mem.seed ?? 0) + 5003);
  const T = net.T, dt = net.dt, D = net.D, twist0 = mem.twist || [0, 0, 0], n = Math.max(1, mem.steps || net.meta.cfg.sample_steps);
  const sub = pointAt(guide.route, PD_SEL.lookahead);
  const crop = egocentricCrop(map, start, net.meta.obs.size_px, net.meta.obs.resolution);
  const cond = condition(net, crop, goalBody(start, sub, net.meta.obs.goal_clip_m), twist0.map((v, i) => v / SWERVE.vmax[i]));
  const xs = sample(velocityFn(net, cond), D, PD_SEL.K, n, sampler, mem.pdRng);
  // 변화율 -> twist(controls_from_rates) -> rollout. 이전 계획을 한 칸 민 것도 후보다(keep_previous).
  const cands = xs.map((a) => {
    const U = []; let u = twist0.slice();
    for (let t = 0; t < T; t++) { u = u.map((v, j) => v + a[t * 3 + j] * SWERVE.amax[j] * dt); U.push(u.slice()); }
    return U;
  });
  if (PD_SEL.keepPrevious && mem.pdPrevU) cands.push([...mem.pdPrevU.slice(1), mem.pdPrevU[mem.pdPrevU.length - 1]]);
  const m = [0, 0, 0, 0], g = map.grid;
  let best = 0, bestS = Infinity;
  const scored = cands.map((U, k) => {
    let [x, y, yaw] = start, prev = twist0, c = 0, lethal = false;
    const P = [[x, y]], applied = [];
    for (let t = 0; t < T; t++) {
      const u = clampAccel(clampTwist(U[t]), prev, dt);
      [x, y, yaw] = stepPose(x, y, yaw, u, dt); P.push([x, y]); applied.push(u); prev = u;
      sampleMap(map, x, y, m); c += m[0] * dt; if (m[0] >= TRAV.lethal) lethal = true;
    }
    const J = PD_SEL.wCost * c + PD_SEL.lethalPenalty * (lethal ? 1 : 0) + PD_SEL.wProgress * sampleField(guide.field, g, x, y);
    if (J < bestS) { bestS = J; best = k; }
    return { P, J, lethal, applied };
  });
  mem.pdPrevU = scored[best].applied;
  return {
    path: scored[best].P, ok: !scored[best].lethal, field: guide.field, ms: performance.now() - t0, sampler, steps: n, subgoal: sub,
    particles: scored.map((s) => ({ P: s.P, J: s.J, lethal: s.lethal })), best,
  };
}
