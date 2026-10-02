// 그리기 보기(TP-0106): 지도를 어느 높이로 그릴지 고르고, 3D 로봇 자세를 텔레메트리와 맞춘다.
// 2D 음영(render2d.js)과 3D 기하(render3d.js)가 같은 함수를 쓴다. DOM과 three.js를 쓰지 않아 check.html도 읽는다.
//   belief  로봇이 본 지형(기본). 관측한 칸은 융합한 높이, 못 본 칸은 belief.elev의 채운 값(로봇이 믿는 값)
//   true    참 지형. 로봇이 못 본 포트홀도 보인다
//   both    면은 로봇이 본 지형, 참 지형은 등고선으로만 그린다
// 인식이 '완전'이면 belief가 GT 지도라 로봇이 본 지형이 곧 참 지형이다.
// 높이 과장(×1·×2·×3)은 그림의 높이에만 건다. 3D 로봇의 pitch·roll은 과장하지 않은 텔레메트리 값이다.
import { sampleMap, attitude } from "./control.js";
import { avgPool } from "./core.js";

export const GEO = {
  belief: { label: "로봇이 본 지형" },
  true: { label: "참 지형" },
  both: { label: "둘 다(참은 등고선)" },
};
export const EXAG = [1, 2, 3];
// 참 지형 등고선: 5 cm 간격, 수준을 2.5 cm 비껴 평지(0 ± 1 cm 거칠기)가 선을 만들지 않게 한다. 색은 2D·3D·범례가 같이 쓴다.
export const CONTOUR = { step: 0.05, offset: 0.025, css: "rgba(240, 228, 186, 0.85)", hex: 0xf0e4ba };

// 그릴 높이 -> { fill: 면(2D 음영·3D 기하)의 높이, line: 선으로만 그릴 참 높이(없으면 null), believed: 면이 로봇이 본 지형인가 }
export function drawHeights(mode, world) {
  const z = world.terrain.z;
  if (mode === "true" || !world.belief) return { fill: z, line: null, believed: false };
  return { fill: world.belief.elev, line: mode === "both" ? z : null, believed: true };
}

// 2D 음영(북서 광원). 과장 ×2가 예전 고정 음영(기울기 × 2.2)과 같다.
export function hillshade(h, g, exag, out) {
  const W = g.W, H = g.H, k = 1.1 * exag;
  out = out || new Float32Array(g.N);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c;
    const dx = (h[r * W + Math.min(W - 1, c + 1)] - h[r * W + Math.max(0, c - 1)]) / (2 * g.res);
    const dy = (h[Math.min(H - 1, r + 1) * W + c] - h[Math.max(0, r - 1) * W + c]) / (2 * g.res);
    const nx = -dx * k, ny = -dy * k, n = Math.hypot(nx, ny, 1);
    out[i] = 0.62 + 0.48 * Math.max(0, (nx * -0.55 + ny * 0.55 + 0.63) / n);
  }
  return out;
}

// 3D 높이장 메시의 정점 -> 칸 번호(stride칸마다 1정점, three.js PlaneGeometry 순서: 위(y 큰 쪽) 행부터).
export function meshCells(g, stride) {
  const nx = Math.floor((g.W - 1) / stride) + 1, ny = Math.floor((g.H - 1) / stride) + 1, cells = new Int32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) cells[j * nx + i] = Math.min(g.H - 1, (ny - 1 - j) * stride) * g.W + Math.min(g.W - 1, i * stride);
  return { nx, ny, cells };
}
// 정점 높이 = 그릴 높이 × 과장
export function meshZ(h, cells, exag, out) {
  out = out || new Float32Array(cells.length);
  for (let v = 0; v < cells.length; v++) out[v] = h[cells[v]] * exag;
  return out;
}

// 참 지형 등고선(marching squares). 3×3 평균으로 거칠기를 누른 뒤 그린다.
// -> { seg: [x0, y0, x1, y1, ...] (m), lev: 선분마다 수준 높이 (m) }
export function contours(z, g, step = CONTOUR.step, offset = CONTOUR.offset) {
  const h = avgPool(z, g, 3), W = g.W, res = g.res, seg = [], lev = [];
  const cut = (a, b, L) => (L - a) / (b - a || 1e-9);
  for (let r = 0; r < g.H - 1; r++) for (let c = 0; c < W - 1; c++) {
    // 칸 네 꼭짓점: a(r, c), b(r, c+1), e(r+1, c+1), d(r+1, c)
    const a = h[r * W + c], b = h[r * W + c + 1], d = h[(r + 1) * W + c], e = h[(r + 1) * W + c + 1];
    const lo = Math.min(a, b, d, e), hi = Math.max(a, b, d, e);
    for (let n = Math.ceil((lo - offset) / step); offset + n * step <= hi; n++) {
      const L = offset + n * step;
      if (L <= lo) continue;
      const P = {   // 수준 L이 각 변을 지나는 점. r0 = a–b(행 r), c1 = b–e(열 c+1), r1 = d–e(행 r+1), c0 = a–d(열 c)
        r0: [(c + cut(a, b, L)) * res, r * res], c1: [(c + 1) * res, (r + cut(b, e, L)) * res],
        r1: [(c + cut(d, e, L)) * res, (r + 1) * res], c0: [c * res, (r + cut(a, d, L)) * res],
      };
      const k = (a > L ? 1 : 0) | (b > L ? 2 : 0) | (e > L ? 4 : 0) | (d > L ? 8 : 0);
      const pairs = k === 5 || k === 10 ? ((a + b + d + e) / 4 > L ? SADDLE_HI[k] : SADDLE_LO[k]) : CASES[k];
      for (const [p, q] of pairs) { seg.push(P[p][0], P[p][1], P[q][0], P[q][1]); lev.push(L); }
    }
  }
  return { seg: Float32Array.from(seg), lev: Float32Array.from(lev) };
}
// 수준보다 높은 꼭짓점의 비트(a 1, b 2, e 4, d 8) -> 잇는 변 쌍. 5와 10은 안장점이라 칸 가운데 높이로 가른다.
const CASES = [[], [["c0", "r0"]], [["r0", "c1"]], [["c0", "c1"]], [["c1", "r1"]], null, [["r0", "r1"]], [["c0", "r1"]],
  [["r1", "c0"]], [["r0", "r1"]], null, [["c1", "r1"]], [["c0", "c1"]], [["r0", "c1"]], [["c0", "r0"]], []];
const SADDLE_HI = { 5: [["c0", "r1"], ["r0", "c1"]], 10: [["c0", "r0"], ["c1", "r1"]] };   // 가운데가 높으면 높은 꼭짓점끼리 이어진다
const SADDLE_LO = { 5: [["c0", "r0"], ["c1", "r1"]], 10: [["r0", "c1"], ["r1", "c0"]] };

// 텔레메트리의 자세. 첫 스텝 뒤에는 sim.js가 판정에 쓴 world.cur, 그 전에는 같은 식(GT 지도의 기울기)으로 시작 자세에서 계산한다.
// world.reset()은 world.cur를 비우지 않으므로 k = 0이면 지난 주행의 값을 쓰지 않는다.
export function attitudeNow(world) {
  if (world.k > 0 && world.cur) { const c = world.cur; return { pitch: c.pitch, roll: c.roll, gtCost: c.gtCost, speed: c.speed }; }
  const m = sampleMap(world.gt, world.pose[0], world.pose[1], [0, 0, 0, 0]), [pitch, roll] = attitude(m[2], m[3], world.pose[2]);
  return { pitch, roll, gtCost: m[0], speed: Math.hypot(world.twist[0], world.twist[1]) };
}

// 3D 로봇 자세. 위치는 그린 면 위(앞뒤 ±0.3 m·좌우 ±0.2 m 접지 높이의 평균, sim.js sensorPoses와 같은 점)에 걸음새 위아래를 더한다.
// pitch·roll은 텔레메트리 값에 걸음새 흔들림을 더한다. 회전은 Rz(yaw)·Ry(−pitch)·Rx(roll)이다(perception.js bodyFrame과 같다).
export function robotPose(world, h, exag) {
  const [x, y, yaw] = world.pose, g = world.terrain.grid, c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (dx, dy) => g.sample(h, x + dx, y + dy, 0);
  const z0 = (at(0.3 * c, 0.3 * s) + at(-0.3 * c, -0.3 * s) + at(-0.2 * s, 0.2 * c) + at(0.2 * s, -0.2 * c)) / 4;
  const a = attitudeNow(world), gait = world.body?.gait || { dz: 0, pitch: 0, roll: 0 };
  // WBC 휴머노이드는 몸통을 곧게 세운다(rpy_cmd = 0, TP-0135): 지형 기울기 대신 걸음새 흔들림만 탄다(sim.js sensorPoses와 같다).
  const up = world.R?.wbc?.upright ? 0 : 1;
  return { x, y, z: z0 * exag + gait.dz, yaw, pitch: up * a.pitch + gait.pitch, roll: up * a.roll + gait.roll, gait };
}
