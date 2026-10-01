// 위에서 본 2.5D 지도. 배경 = 높이 음영 × 선택한 층(LAYERS: 높이, elevation mapping, traversability, 차체 기준).
// 음영의 높이는 view.js drawHeights가 고른다(기본은 로봇이 본 지형, '둘 다'면 참 지형을 등고선으로 더 그린다).
import { TRAV } from "./travmap.js";
import { drawHeights, hillshade, contours, CONTOUR } from "./view.js";

// cost 색: 0 = 지면(음영만), 0.3~0.95 = 황토 -> 주황, 치명 = 빨강. 모르는 칸은 어둡게.
const COST_STOPS = [[0.0, [58, 72, 70]], [0.35, [98, 112, 84]], [0.6, [196, 152, 58]], [0.94, [232, 112, 46]]];
const LETHAL = [229, 62, 62];
const HEIGHT_STOPS = [[-0.15, [40, 60, 110]], [0.0, [70, 92, 88]], [0.2, [132, 142, 96]], [0.5, [196, 170, 110]], [1.0, [236, 226, 200]]];

function ramp(stops, v) {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a);
    return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
  }
  return stops[stops.length - 1][1];
}

// 특징 층(경사·턱·거칠기) 색: 한계의 비율로 칠한다. 0.3 아래(safe_ratio)는 지면, 1.0(한계)에서 빨강.
const FEAT_STOPS = [[0.0, [58, 72, 70]], [0.3, [98, 112, 84]], [0.65, [196, 152, 58]], [0.99, [232, 112, 46]], [1.0, [229, 62, 62]]];
const SIGMA_STOPS = [[0, [40, 120, 150]], [1, [80, 170, 160]], [3, [210, 190, 90]], [6, [232, 112, 46]]];   // cm
const UNKNOWN = [24, 28, 32];
const ERR_STOPS = [[-0.1, [70, 110, 230]], [-0.03, [80, 140, 170]], [0, [58, 72, 70]], [0.03, [200, 150, 60]], [0.1, [229, 62, 62]]];   // m
const gradCss = (stops, lo, hi) => `linear-gradient(90deg,${stops.map(([v, c]) => `rgb(${c.join(",")}) ${Math.round((100 * (v - lo)) / (hi - lo))}%`).join(",")})`;

// 지도 층. value가 null이면 '모르는 칸'으로 칠한다. legend는 범례 HTML.
export const LAYERS = {
  height: {
    group: "지형", label: "실제 높이", note: "시뮬레이터가 가진 참 지형. 로봇은 이것을 모른다.",
    color: (w, i) => ramp(HEIGHT_STOPS, w.terrain.z[i]),
    legend: () => `<span><i style="background:${gradCss(HEIGHT_STOPS, -0.15, 1.0)}"></i>높이 −0.15 → 1.0 m</span>`,
  },
  belief_elev: {
    group: "elevation mapping", label: "로봇이 본 높이", note: "관측을 칸마다 융합한 높이(elevation map). 못 본 칸은 비어 있다.",
    color: (w, i) => (w.belief.known && !w.belief.known[i] ? UNKNOWN : ramp(HEIGHT_STOPS, w.belief.elev[i])),
    legend: () => `<span><i style="background:${gradCss(HEIGHT_STOPS, -0.15, 1.0)}"></i>융합한 높이 −0.15 → 1.0 m</span><span><i style="background:#181c20;border:1px solid #444"></i>못 본 칸</span>`,
  },
  sigma: {
    group: "elevation mapping", label: "높이 분산 σ", note: "L1 간이에서는 칼만 융합의 표준편차. L0에서는 관측한 칸이 모두 잡음 1 cm다.",
    color: (w, i) => {
      if (w.opts.perception === "l1lite") { const v = w.emap.v[i]; return Number.isFinite(v) ? ramp(SIGMA_STOPS, 100 * Math.sqrt(v)) : UNKNOWN; }
      return w.belief.known && !w.belief.known[i] ? UNKNOWN : ramp(SIGMA_STOPS, 1);
    },
    legend: () => `<span><i style="background:${gradCss(SIGMA_STOPS, 0, 6)}"></i>σ 0 → 6 cm</span><span><i style="background:#181c20;border:1px solid #444"></i>못 본 칸</span>`,
  },
  ceiling: {
    group: "elevation mapping", label: "상한(upper bound)", note: "못 본 칸 위를 지나간 시선·레이의 가장 낮은 높이. 칸의 참 높이는 이 아래에 있다(TP-0044).",
    color: (w, i) => {
      const known = !w.belief.known || w.belief.known[i], c = w.beliefCeil ? w.beliefCeil[i] : Infinity;
      if (known) return [46, 54, 56];
      return Number.isFinite(c) ? ramp(HEIGHT_STOPS, c) : UNKNOWN;
    },
    legend: () => `<span><i style="background:${gradCss(HEIGHT_STOPS, -0.15, 1.0)}"></i>못 본 칸의 상한 −0.15 → 1.0 m</span><span><i style="background:#2e3638"></i>관측한 칸</span><span><i style="background:#181c20;border:1px solid #444"></i>상한도 없는 칸</span>`,
  },
  elev_err: {
    group: "elevation mapping", label: "높이 오차(본 − 실제)", note: "로봇이 본 높이에서 참 높이를 뺀 값. 몸체가 흔들리는데 매퍼가 자세를 모르면 먼 링일수록 크게 틀린다(pitch 1°면 4 m에서 7 cm).",
    color: (w, i) => (w.belief.known && !w.belief.known[i] ? UNKNOWN : ramp(ERR_STOPS, w.belief.elev[i] - w.terrain.z[i])),
    legend: () => `<span><i style="background:${gradCss(ERR_STOPS, -0.1, 0.1)}"></i>오차 −10 → +10 cm</span><span><i style="background:#181c20;border:1px solid #444"></i>못 본 칸</span>`,
  },
  slope: {
    group: "traversability", label: "경사", note: "몸체 크기(0.35 m)로 평활한 면의 기울기를 로봇 반폭(0.3 m)만큼 팽창했다. 한계 15°(0.26 rad).",
    color: (w, i) => (w.belief.known && !w.belief.known[i] ? UNKNOWN : ramp(FEAT_STOPS, w.belief.slope[i] / TRAV.maxSlope)),
    legend: () => `<span><i style="background:${gradCss(FEAT_STOPS, 0, 1)}"></i>경사 0 → ${Math.round(TRAV.maxSlope * 57.3)}°(한계)</span>`,
  },
  step: {
    group: "traversability", label: "턱", note: "0.30 m 창 안의 높이 범위에서 큰 경사로 설명되는 몫을 뺀 값. 한계 8 cm.",
    color: (w, i) => (w.belief.known && !w.belief.known[i] ? UNKNOWN : ramp(FEAT_STOPS, w.belief.step[i] / TRAV.maxStep)),
    legend: () => `<span><i style="background:${gradCss(FEAT_STOPS, 0, 1)}"></i>턱 0 → ${Math.round(TRAV.maxStep * 100)} cm(한계)</span>`,
  },
  rough: {
    group: "traversability", label: "거칠기", note: "0.25 m 창의 평활면에서 벗어난 높이의 RMS. 한계 4 cm.",
    color: (w, i) => (w.belief.known && !w.belief.known[i] ? UNKNOWN : ramp(FEAT_STOPS, w.belief.rough[i] / TRAV.maxRough)),
    legend: () => `<span><i style="background:${gradCss(FEAT_STOPS, 0, 1)}"></i>거칠기 0 → ${Math.round(TRAV.maxRough * 100)} cm(한계)</span>`,
  },
  belief: {
    group: "traversability", label: "로봇이 본 cost", note: "Planner와 Controller가 쓰는 지도. cost = max(경사, 턱, 거칠기 각각을 한계로 나눈 램프).",
    color: (w, i) => {
      const m = w.belief, c = m.cost[i];
      if (!m.known[i]) {
        if (c >= TRAV.lethal) return m.bounded[i] ? [200, 60, 140] : [120, 40, 60];
        return m.bounded[i] ? [150, 70, 150] : UNKNOWN;
      }
      return c >= TRAV.lethal ? LETHAL : ramp(COST_STOPS, c);
    },
    legend: () => `<span><i style="background:#3a4846"></i>지면(cost 0)</span><span><i style="background:${gradCss(COST_STOPS, 0, 0.94)}"></i>cost 0.3 → 0.95</span>`
      + `<span><i style="background:#e53e3e"></i>치명(≥ 0.95)</span><span><i style="background:#181c20;border:1px solid #444"></i>못 본 칸(0.5)</span>`
      + `<span><i style="background:#96469a"></i>상한·prior로 채운 칸</span><span><i style="background:#c83c8c"></i>상한·prior가 치명으로 본 칸</span><span><i style="background:#78283c"></i>근거리 미관측을 치명으로(TP-0101)</span>`,
  },
  gt: {
    group: "traversability", label: "실제 cost", note: "같은 cost 식을 참 지형에 적용한 것. 저장소의 'GT cost'가 이것이라 기하 추정기와 순환한다(TP-0082).",
    color: (w, i) => { const c = w.gt.cost[i]; return c >= TRAV.lethal ? LETHAL : ramp(COST_STOPS, c); },
    legend: () => `<span><i style="background:#3a4846"></i>지면(cost 0)</span><span><i style="background:${gradCss(COST_STOPS, 0, 0.94)}"></i>cost 0.3 → 0.95</span><span><i style="background:#e53e3e"></i>치명(≥ 0.95)</span>`,
  },
  chassis: {
    group: "traversability", label: "차체 기하 기준", note: "cost 식과 독립인 기준(TP-0082): 칸마다 방위각 8개로 AntBot 차체를 세워 자세·바퀴 들뜸·배 밑 간섭을 본다. 지상고 0.10 m(가정).",
    color: (w, i) => {
      const ch = w.chassis;
      if (!ch) return [46, 54, 56];
      if (ch.lethalAll[i]) return [[229, 62, 62], [200, 80, 220], [70, 130, 230], [240, 150, 40]][ch.reason[i]];
      if (ch.lethalAny[i]) return [150, 130, 70];
      return [58, 72, 70];
    },
    legend: () => `<span><i style="background:#3a4846"></i>모든 방향으로 들어감</span><span><i style="background:#968246"></i>일부 방향만 막힘</span>`
      + `<span><i style="background:#c850dc"></i>못 들어감: 자세(전복)</span><span><i style="background:#4682e6"></i>바퀴 들뜸(구멍)</span><span><i style="background:#f09628"></i>배 밑 간섭</span>`,
  },
};

export function colorAt(layer, world, i, shade) {
  const rgb = (LAYERS[layer] || LAYERS.belief).color(world, i);
  return [rgb[0] * shade, rgb[1] * shade, rgb[2] * shade];
}

export class Map2D {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext("2d");
    this.off = document.createElement("canvas"); this.octx = this.off.getContext("2d");
    this.hover = null;
  }

  // 화면 <-> 세계 좌표
  layout(world) {
    const g = world.terrain.grid, Wm = (g.W - 1) * g.res, Hm = (g.H - 1) * g.res;
    const dpr = window.devicePixelRatio || 1, cw = this.cv.clientWidth, ch = this.cv.clientHeight;
    if (this.cv.width !== Math.round(cw * dpr) || this.cv.height !== Math.round(ch * dpr)) { this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr); }
    const pad = 26;
    const s = Math.min((cw - 2 * pad) / Wm, (ch - 2 * pad) / Hm);
    this.L = { dpr, s, ox: (cw - s * Wm) / 2, oy: (ch + s * Hm) / 2, Wm, Hm };
  }
  toScreen(x, y) { const L = this.L; return [L.ox + x * L.s, L.oy - y * L.s]; }
  toWorld(px, py) { const L = this.L; return [(px - L.ox) / L.s, (L.oy - py) / L.s]; }

  // 높이 음영(북서 광원). 참 지형은 지형이 바뀔 때만, 로봇이 본 지형은 지도가 바뀔 때마다 다시 계산한다.
  shade(world, H, exag) {
    const k = this._shadeKey, mv = H.believed ? world.mapVersion : -1;
    if (k && k.src === H.fill && k.world === world && k.mv === mv && k.tv === world.terrainVersion && k.exag === exag) return this._shade;
    this._shade = hillshade(H.fill, world.terrain.grid, exag, this._shade?.length === world.terrain.grid.N ? this._shade : undefined);
    this._shadeKey = { src: H.fill, world, mv, tv: world.terrainVersion, exag };
    return this._shade;
  }

  // 참 지형 등고선(세계 좌표의 Path2D). 지형이 바뀔 때만 다시 만든다.
  contourPath(world, z) {
    if (this._ctFor === z && this._ctVer === world.terrainVersion) return this._ct;
    const { seg } = contours(z, world.terrain.grid), p = new Path2D();
    for (let i = 0; i < seg.length; i += 4) { p.moveTo(seg[i], seg[i + 1]); p.lineTo(seg[i + 2], seg[i + 3]); }
    this._ct = p; this._ctFor = z; this._ctVer = world.terrainVersion;
    return p;
  }

  paintBase(world, layer, H, exag) {
    const g = world.terrain.grid;
    if (this.off.width !== g.W) { this.off.width = g.W; this.off.height = g.H; this.img = this.octx.createImageData(g.W, g.H); }
    const d = this.img.data, sh = this.shade(world, H, exag), vis = world.lastVis;
    for (let r = 0; r < g.H; r++) for (let c = 0; c < g.W; c++) {
      const i = r * g.W + c, j = ((g.H - 1 - r) * g.W + c) * 4;   // 캔버스는 y가 아래로
      let k = sh[i];
      if (layer === "belief" && vis && vis[i]) k *= 1.12;
      const [R, G, B] = colorAt(layer, world, i, k);
      d[j] = R; d[j + 1] = G; d[j + 2] = B; d[j + 3] = 255;
    }
    this.octx.putImageData(this.img, 0, 0);
  }

  draw(world, view, css) {
    this.layout(world);
    const { ctx, L } = this, dpr = L.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.cv.clientWidth, this.cv.clientHeight);
    // view.geo가 없으면(옛 호출, robot_pose.html) 예전처럼 참 지형으로 그린다.
    const geo = view.geo || "true", exag = view.exag ?? 2, H = drawHeights(geo, world);
    const key = `${world.mapVersion}|${view.layer}|${world.terrainVersion}|${world.chassisVer ?? -1}|${geo}|${exag}`;
    if (key !== this._baseKey || world !== this._baseWorld) { this.paintBase(world, view.layer, H, exag); this._baseKey = key; this._baseWorld = world; }
    ctx.imageSmoothingEnabled = true;
    const [x0, y0] = this.toScreen(0, L.Hm);
    ctx.drawImage(this.off, x0, y0, L.Wm * L.s, L.Hm * L.s);
    ctx.strokeStyle = css.line; ctx.lineWidth = 1; ctx.strokeRect(x0 - 0.5, y0 - 0.5, L.Wm * L.s + 1, L.Hm * L.s + 1);
    this.axes(css);
    if (H.line) {   // '둘 다': 참 지형은 등고선으로만
      ctx.save(); ctx.translate(L.ox, L.oy); ctx.scale(L.s, -L.s);
      ctx.lineWidth = 1 / L.s; ctx.strokeStyle = CONTOUR.css; ctx.stroke(this.contourPath(world, H.line));
      ctx.restore();
    }

    const P = (p) => this.toScreen(p[0], p[1]);
    const poly = (pts, color, w, dash = []) => {
      if (!pts || pts.length < 2) return;
      ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = w;
      pts.forEach((p, i) => { const [a, b] = P(p); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
      ctx.stroke(); ctx.setLineDash([]);
    };

    // 센서 범위
    if (world.opts.perception !== "gt") {
      const [sx, sy] = P(world.pose);
      ctx.beginPath(); ctx.arc(sx, sy, world.opts.sensorRange * L.s, 0, 2 * Math.PI);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    }
    // MPPI 샘플: 비용 낮은 것일수록 밝게
    const c = world.ctrl;
    if (view.samples && c && c.samples && c.samples.length) {
      const ss = c.samples.map((s) => s.s).sort((a, b) => a - b), lo = ss[0], hi = ss[Math.floor(ss.length * 0.8)] || lo + 1;
      for (const s of c.samples) {
        const q = Math.min(1, (s.s - lo) / Math.max(1e-6, hi - lo));
        ctx.beginPath(); ctx.strokeStyle = `rgba(${Math.round(120 + 110 * (1 - q))},${Math.round(210 - 80 * q)},${Math.round(230 - 120 * q)},${0.08 + 0.32 * (1 - q)})`;
        ctx.lineWidth = 1;
        for (let t = 0; t <= c.T; t++) { const o = (s.k * (c.T + 1) + t) * 3, [a, b] = this.toScreen(s.P[o], s.P[o + 1]); t ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }
        ctx.stroke();
      }
    }
    // L1 간이: 마지막 스캔의 LiDAR 점(3점에 1개)
    if (view.points && world.opts.perception === "l1lite" && world.emap && world.emap.points.length) {
      ctx.fillStyle = "rgba(120,220,255,0.55)";
      const pts = world.emap.points;
      for (let k = 0; k < pts.length; k += 2) { const [a, b] = this.toScreen(pts[k], pts[k + 1]); ctx.fillRect(a - 0.8, b - 0.8, 1.6, 1.6); }
    }
    if (view.route && world.plan) poly(world.plan.path, css.route, 1.6, [6, 5]);
    poly(world.trail, "rgba(255,255,255,0.85)", 2);
    if (c && c.nominal) poly(c.nominal, css.accent, 3);

    // 보행자
    for (const p of world.peds) {
      const [a, b] = P([p.x, p.y]);
      for (let t = 1; t <= 4; t++) { const [u, v] = P([p.x + p.vx * t, p.y + p.vy * t]); ctx.beginPath(); ctx.arc(u, v, 2, 0, 7); ctx.fillStyle = "rgba(255,160,200,0.45)"; ctx.fill(); }
      ctx.beginPath(); ctx.arc(a, b, p.r * L.s, 0, 7); ctx.setLineDash([2, 3]); ctx.strokeStyle = "rgba(255,150,190,0.7)"; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(a, b, 0.22 * L.s, 0, 7); ctx.fillStyle = "#ff8fb8"; ctx.fill();
      const [u, v] = P([p.x + p.vx * 0.8, p.y + p.vy * 0.8]);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(u, v); ctx.strokeStyle = "#ff8fb8"; ctx.lineWidth = 2; ctx.stroke();
    }
    this.goal(world, css);
    this.robot(world, css);
    if (view.drag) { const [a, b] = P(view.drag.from), [u, v] = P(view.drag.to); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(u, v); ctx.strokeStyle = "#ff8fb8"; ctx.lineWidth = 2; ctx.stroke(); }
    if (view.cursor) this.cursor(view, css);
  }

  axes(css) {
    const { ctx, L } = this;
    ctx.fillStyle = css.muted; ctx.font = "10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let x = 0; x <= L.Wm + 1e-6; x += 2) { const [a, b] = this.toScreen(x, 0); ctx.fillText(`${x}`, a, b + 5); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let y = 0; y <= L.Hm + 1e-6; y += 2) { const [a, b] = this.toScreen(0, y); ctx.fillText(`${y}`, a - 5, b); }
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    const [a, b] = this.toScreen(L.Wm, 0); ctx.fillText("m", a + 6, b + 16);
  }

  goal(world, css) {
    const { ctx } = this, [a, b] = this.toScreen(world.goal[0], world.goal[1]);
    ctx.beginPath(); ctx.arc(a, b, 0.3 * this.L.s, 0, 7); ctx.strokeStyle = css.ok; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, b - 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a, b - 22); ctx.lineTo(a + 12, b - 18); ctx.lineTo(a, b - 14); ctx.closePath(); ctx.fillStyle = css.ok; ctx.fill();
  }

  // 로봇: 스워브는 0.7 × 0.5 m 차체와 그 순간 모듈 속도 방향으로 조향한 바퀴 4개. 사족은 몸통과 걸음새에 맞춰 흔드는 다리 4개.
  robot(world, css) {
    const { ctx } = this, s = this.L.s, [x, y, yaw] = world.pose, [a, b] = this.toScreen(x, y);
    const R = world.R || { kind: "wheel", body: [0.7, 0.5] }, u = world.twist, Lx = R.body[0] / 2, Ly = R.body[1] / 2;
    ctx.save(); ctx.translate(a, b); ctx.rotate(-yaw);
    if (R.kind !== "wheel") {
      // 다리: 대각선 쌍(트롯)이 번갈아 앞뒤로 흔든다. 바퀴 사족은 다리 끝에 바퀴.
      const ph = 2 * Math.PI * (R.gait?.freq || 1) * world.t, sp = Math.min(1, Math.hypot(u[0], u[1]) / 0.6);
      ctx.strokeStyle = "#d9dfdc"; ctx.lineWidth = Math.max(2, 0.05 * s); ctx.lineCap = "round";
      for (const [k, mx, my] of [[0, 0.26, 0.15], [1, 0.26, -0.15], [1, -0.26, 0.15], [0, -0.26, -0.15]]) {
        const sw = (R.kind === "legs" ? 0.09 : 0.03) * sp * Math.sin(ph + k * Math.PI), fx = mx + sw, fy = my + Math.sign(my) * 0.1;
        ctx.beginPath(); ctx.moveTo(mx * s, -my * s); ctx.lineTo(fx * s, -fy * s); ctx.stroke();
        if (R.kind === "wheellegs") { ctx.fillStyle = "#d9dfdc"; ctx.fillRect((fx - 0.06) * s, (-fy - 0.02) * s, 0.12 * s, 0.04 * s); }
        else { ctx.beginPath(); ctx.arc(fx * s, -fy * s, 0.025 * s, 0, 7); ctx.fillStyle = "#d9dfdc"; ctx.fill(); }
      }
    }
    ctx.fillStyle = "rgba(10,14,16,0.85)"; ctx.strokeStyle = css.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-Lx * s, -Ly * s, 2 * Lx * s, 2 * Ly * s, R.kind === "wheel" ? 4 : 10); ctx.fill(); ctx.stroke();
    if (R.kind === "wheel") for (const [mx, my] of [[0.25, 0.18], [0.25, -0.18], [-0.25, 0.18], [-0.25, -0.18]]) {
      const vx = u[0] - u[2] * my, vy = u[1] + u[2] * mx, ang = Math.hypot(vx, vy) > 0.02 ? Math.atan2(vy, vx) : 0;
      ctx.save(); ctx.translate(mx * s, -my * s); ctx.rotate(-ang);
      ctx.fillStyle = "#d9dfdc"; ctx.fillRect(-0.07 * s, -0.025 * s, 0.14 * s, 0.05 * s); ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(Lx * s - 2, 0); ctx.lineTo(Lx * s - 10, -5); ctx.lineTo(Lx * s - 10, 5); ctx.closePath(); ctx.fillStyle = css.accent; ctx.fill();
    ctx.restore();
    if (world.status === "failed") { ctx.beginPath(); ctx.moveTo(a - 9, b - 9); ctx.lineTo(a + 9, b + 9); ctx.moveTo(a + 9, b - 9); ctx.lineTo(a - 9, b + 9); ctx.strokeStyle = css.bad; ctx.lineWidth = 3; ctx.stroke(); }
  }

  cursor(view, css) {
    const { ctx } = this, [a, b] = view.cursor.px;
    ctx.beginPath();
    const r = view.tool === "pothole" ? 0.35 : view.tool === "box" ? 0.4 : view.tool === "erase" ? 0.6 : 0;
    if (r) { ctx.arc(a, b, r * this.L.s, 0, 7); ctx.setLineDash([3, 3]); ctx.strokeStyle = css.fg; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
  }
}
