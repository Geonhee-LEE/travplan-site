// 위에서 본 2.5D 지도. 배경 = GT 높이 음영 × 선택한 층(belief cost, GT cost, 높이).
import { TRAV } from "./travmap.js";

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

export function colorAt(layer, world, i, shade) {
  let rgb;
  if (layer === "height") rgb = ramp(HEIGHT_STOPS, world.terrain.z[i]);
  else {
    const m = layer === "gt" ? world.gt : world.belief;
    const c = m.cost[i];
    rgb = c >= TRAV.lethal ? LETHAL : ramp(COST_STOPS, c);
    if (layer === "belief" && !m.known[i]) {
      rgb = m.bounded[i] ? [150, 70, 150] : [24, 28, 32];     // 그림자 상한·prior로 채운 칸은 보라
      if (m.bounded[i] && c >= TRAV.lethal) rgb = [200, 60, 140];
    }
  }
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

  shade(world) {
    // GT 높이 힐셰이드(북서 광원), 지형이 바뀔 때만 다시 계산
    if (this._shadeFor === world.terrain && this._shadeVer === world.terrainVersion) return this._shade;
    const g = world.terrain.grid, z = world.terrain.z, sh = new Float32Array(g.N);
    for (let r = 0; r < g.H; r++) for (let c = 0; c < g.W; c++) {
      const i = r * g.W + c;
      const dx = (z[r * g.W + Math.min(g.W - 1, c + 1)] - z[r * g.W + Math.max(0, c - 1)]) / (2 * g.res);
      const dy = (z[Math.min(g.H - 1, r + 1) * g.W + c] - z[Math.max(0, r - 1) * g.W + c]) / (2 * g.res);
      const nx = -dx * 2.2, ny = -dy * 2.2, nz = 1, n = Math.hypot(nx, ny, nz);
      sh[i] = 0.62 + 0.48 * Math.max(0, (nx * -0.55 + ny * 0.55 + nz * 0.63) / n);
    }
    this._shade = sh; this._shadeFor = world.terrain; this._shadeVer = world.terrainVersion;
    return sh;
  }

  paintBase(world, layer) {
    const g = world.terrain.grid;
    if (this.off.width !== g.W) { this.off.width = g.W; this.off.height = g.H; this.img = this.octx.createImageData(g.W, g.H); }
    const d = this.img.data, sh = this.shade(world), vis = world.lastVis;
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
    const key = `${world.mapVersion}|${view.layer}|${world.terrainVersion}`;
    if (key !== this._baseKey) { this.paintBase(world, view.layer); this._baseKey = key; }
    ctx.imageSmoothingEnabled = true;
    const [x0, y0] = this.toScreen(0, L.Hm);
    ctx.drawImage(this.off, x0, y0, L.Wm * L.s, L.Hm * L.s);
    ctx.strokeStyle = css.line; ctx.lineWidth = 1; ctx.strokeRect(x0 - 0.5, y0 - 0.5, L.Wm * L.s + 1, L.Hm * L.s + 1);
    this.axes(css);

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

  // 로봇: 0.7 × 0.5 m 차체, 모듈 4개는 그 순간 모듈 속도 방향으로 조향한 바퀴로 그린다.
  robot(world, css) {
    const { ctx } = this, s = this.L.s, [x, y, yaw] = world.pose, [a, b] = this.toScreen(x, y);
    const u = world.twist, Lx = 0.35, Ly = 0.25;
    ctx.save(); ctx.translate(a, b); ctx.rotate(-yaw);
    ctx.fillStyle = "rgba(10,14,16,0.85)"; ctx.strokeStyle = css.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-Lx * s, -Ly * s, 2 * Lx * s, 2 * Ly * s, 4); ctx.fill(); ctx.stroke();
    for (const [mx, my] of [[0.25, 0.18], [0.25, -0.18], [-0.25, 0.18], [-0.25, -0.18]]) {
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
