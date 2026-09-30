// sim/terrain.py를 옮긴 것. 규칙(크기, 높이, 난이도 표)은 같고, 난수 생성기만 달라 seed가 같아도
// Python 벤치마크와 지형이 똑같지는 않다.
import { Grid, Rng } from "./core.js";

export const RES = 0.05;

export const DIFFICULTY = {
  curb_ramp: { curb_h: [0.15, 0.18, 0.21, 0.24], ramp_w: [1.8, 1.5, 1.3, 1.1] },
  bumps_potholes: { potholes: [6, 9, 12, 15] },
  slope_crossfall: { crossfall: [0.005, 0.02, 0.035, 0.05], mound_sy: [1.3, 1.5, 1.7, 1.9] },
  random_mix: { extra: [0, 2, 4, 6] },
};

export const SCENARIOS = {
  curb_ramp: { label: "연석·경사로", note: "차도에서 연석 위 보도로. 오를 수 있는 곳은 연석 경사로뿐이다." },
  bumps_potholes: { label: "방지턱·포트홀", note: "과속방지턱은 지나갈 수 있지만 비싸고, 포트홀(-0.12 m)과 화분은 치명이다." },
  slope_crossfall: { label: "둔덕·횡경사", note: "정면으로 넘으면 경사·롤 한계를 넘는 둔덕. 완만한 우회로가 있다." },
  random_mix: { label: "무작위 혼합", note: "상자, 낮은 턱, 언덕을 무작위로 섞었다." },
  down_curb: { label: "내림 턱", note: "0.07 m 내림 턱(한계 0.08 m 아래). 깊이 prior 오탐을 보는 지형(TP-0048)." },
  down_ramp: { label: "하향 램프", note: "보도에서 차도로 내려가는 7° 램프." },
  drain_channel: { label: "배수로", note: "폭 0.4 m, 깊이 0.04 m의 V자 배수로 두 줄." },
};

export class Terrain {
  constructor(name, grid, z, start, goal) {
    this.name = name; this.grid = grid; this.z = z; this.base = Float32Array.from(z);
    this.start = start; this.goal = goal;
  }
  // 편집: 상자(높이 h), 포트홀(깊이), 지우기(원래 지형으로)
  editDisc(x, y, radius, fn) {
    const g = this.grid, r0 = Math.max(0, Math.floor((y - radius) / g.res)), r1 = Math.min(g.H - 1, Math.ceil((y + radius) / g.res));
    const c0 = Math.max(0, Math.floor((x - radius) / g.res)), c1 = Math.min(g.W - 1, Math.ceil((x + radius) / g.res));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const dx = c * g.res - x, dy = r * g.res - y;
      fn(r * g.W + c, dx, dy);
    }
  }
  addBox(x, y, s = 0.8, h = 0.4) {
    this.editDisc(x, y, s, (i, dx, dy) => { if (Math.abs(dx) <= s / 2 && Math.abs(dy) <= s / 2) this.z[i] = Math.max(this.z[i], h); });
  }
  addPothole(x, y, rad = 0.35, depth = 0.12) {
    this.editDisc(x, y, rad, (i, dx, dy) => { if (dx * dx + dy * dy < rad * rad) this.z[i] = -depth; });
  }
  erase(x, y, rad = 0.6) {
    this.editDisc(x, y, rad, (i, dx, dy) => { if (dx * dx + dy * dy < rad * rad) this.z[i] = this.base[i]; });
  }
}

function field(sizeX, sizeY) {
  const W = Math.round(sizeX / RES) + 1, H = Math.round(sizeY / RES) + 1;
  return new Grid(RES, W, H);
}

function roughness(rng, g, amp) {
  let n = new Float32Array(g.N);
  for (let i = 0; i < g.N; i++) n[i] = rng.normal();
  const W = g.W, H = g.H;
  for (let it = 0; it < 2; it++) {                       // np.roll 박스 블러 두 번(순환 경계)
    const m = new Float32Array(g.N);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c;
      m[i] = (n[i] + n[((r + 1) % H) * W + c] + n[((r - 1 + H) % H) * W + c] + n[r * W + (c + 1) % W] + n[r * W + (c - 1 + W) % W]) / 5;
    }
    n = m;
  }
  let mx = 1e-9;
  for (let i = 0; i < g.N; i++) mx = Math.max(mx, Math.abs(n[i]));
  for (let i = 0; i < g.N; i++) n[i] = amp * n[i] / mx;
  return n;
}

function each(g, fn) {
  for (let r = 0; r < g.H; r++) for (let c = 0; c < g.W; c++) fn(r * g.W + c, c * g.res, r * g.res);
}
const addTo = (z, n) => { for (let i = 0; i < z.length; i++) z[i] += n[i]; };
const inBox = (x, y, cx, cy, sx, sy) => Math.abs(x - cx) <= sx / 2 && Math.abs(y - cy) <= sy / 2;

const GEN = {
  curb_ramp(seed, L) {
    const d = DIFFICULTY.curb_ramp, rng = new Rng(seed), g = field(16, 8), z = new Float32Array(g.N);
    const h = d.curb_h[L], yc = 3.0, rx = 9.0 + rng.uniform(-1.5, 1.5), rw = d.ramp_w[L];
    each(g, (i, x, y) => {
      z[i] = y >= yc ? h : 0;
      if (Math.abs(x - rx) <= rw / 2 && y >= yc - 1.2 && y < yc) z[i] = h * (y - (yc - 1.2)) / 1.2;
    });
    addTo(z, roughness(rng, g, 0.005));
    return new Terrain("curb_ramp", g, z, [2.0, 1.5, 0.0], [14.0, 6.0]);
  },
  bumps_potholes(seed, L) {
    const rng = new Rng(seed), extra = new Rng(seed * 7919 + 13), g = field(16, 8), z = new Float32Array(g.N);
    each(g, (i, x) => { for (const bx of [4.0, 11.0]) z[i] += 0.05 * Math.exp(-(((x - bx) / 0.18) ** 2)); });
    const hole = (cx, cy) => each(g, (i, x, y) => { if ((x - cx) ** 2 + (y - cy) ** 2 < 0.35 ** 2) z[i] = -0.12; });
    for (let k = 0; k < 6; k++) hole(rng.uniform(3, 13), rng.uniform(1, 7));
    for (let k = 0; k < 4; k++) { const cx = rng.uniform(3, 13), cy = rng.uniform(1, 7); each(g, (i, x, y) => { if (inBox(x, y, cx, cy, 0.8, 0.8)) z[i] = 0.5; }); }
    for (let k = 0; k < DIFFICULTY.bumps_potholes.potholes[L] - 6; k++) hole(extra.uniform(3, 13), extra.uniform(1, 7));
    addTo(z, roughness(rng, g, 0.006));
    return new Terrain("bumps_potholes", g, z, [1.0, 4.0, 0.0], [15.0, 4.0]);
  },
  slope_crossfall(seed, L) {
    const d = DIFFICULTY.slope_crossfall, rng = new Rng(seed), g = field(16, 8), z = new Float32Array(g.N);
    const cy = 4.0 + rng.uniform(-0.8, 0.8), sy = d.mound_sy[L], cf = d.crossfall[L];
    each(g, (i, x, y) => { z[i] = 0.9 * Math.exp(-(((x - 8) / 2) ** 2) - (((y - cy) / sy) ** 2)) + cf * y; });
    addTo(z, roughness(rng, g, 0.006));
    return new Terrain("slope_crossfall", g, z, [1.0, cy, 0.0], [15.0, cy]);
  },
  random_mix(seed, L) {
    const rng = new Rng(seed), extra = new Rng(seed * 7919 + 13), g = field(16, 8);
    const z = roughness(rng, g, 0.01);
    const obstacle = (R) => {
      const cx = R.uniform(3, 13), cy = R.uniform(0.5, 7.5), kind = R.int(0, 3);
      if (kind === 0) { const sx = R.uniform(0.5, 1.5), sy = R.uniform(0.5, 1.5); each(g, (i, x, y) => { if (inBox(x, y, cx, cy, sx, sy)) z[i] = 0.4; }); }
      else if (kind === 1) { const sx = R.uniform(1, 3), sy = R.uniform(1, 3), h = R.uniform(0.03, 0.15); each(g, (i, x, y) => { if (inBox(x, y, cx, cy, sx, sy)) z[i] = h; }); }
      else { const a = R.uniform(0.2, 0.6); each(g, (i, x, y) => { z[i] += a * Math.exp(-(((x - cx) / 1.2) ** 2) - (((y - cy) / 1.2) ** 2)); }); }
    };
    const n = rng.int(3, 7);
    for (let k = 0; k < n; k++) obstacle(rng);
    for (let k = 0; k < DIFFICULTY.random_mix.extra[L]; k++) obstacle(extra);
    return new Terrain("random_mix", g, z, [1.0, 4.0, 0.0], [15.0, rng.uniform(1.5, 6.5)]);
  },
  down_curb(seed) {
    const rng = new Rng(seed), g = field(16, 8), z = new Float32Array(g.N), x0 = 7 + rng.uniform(-1, 1);
    each(g, (i, x) => { z[i] = x < x0 ? 0.07 : 0; });
    addTo(z, roughness(rng, g, 0.005));
    return new Terrain("down_curb", g, z, [1.0, 4.0, 0.0], [15.0, 4.0]);
  },
  down_ramp(seed) {
    const rng = new Rng(seed), g = field(16, 8), z = new Float32Array(g.N), x0 = 7 + rng.uniform(-1, 1);
    each(g, (i, x) => { z[i] = 0.15 * Math.min(1, Math.max(0, 1 - (x - x0) / 1.2)); });
    addTo(z, roughness(rng, g, 0.005));
    return new Terrain("down_ramp", g, z, [1.0, 4.0, 0.0], [15.0, 4.0]);
  },
  drain_channel(seed) {
    const rng = new Rng(seed), g = field(16, 8), z = new Float32Array(g.N);
    const cs = [5 + rng.uniform(-0.5, 0.5), 10 + rng.uniform(-0.5, 0.5)];
    each(g, (i, x) => { for (const cx of cs) z[i] -= 0.04 * Math.min(1, Math.max(0, 1 - Math.abs(x - cx) / 0.2)); });
    addTo(z, roughness(rng, g, 0.005));
    return new Terrain("drain_channel", g, z, [1.0, 4.0, 0.0], [15.0, 4.0]);
  },
};

export function makeTerrain(name, seed = 0, level = 0) {
  const lv = DIFFICULTY[name] ? level : 0;
  return GEN[name](seed, lv);
}
