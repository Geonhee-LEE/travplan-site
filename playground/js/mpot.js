// MPOT(Motion Planning via Optimal Transport)의 Sinkhorn Step을 2D 경로에 옮긴 Planner(TP-0136).
// 원본: anindex/mpot (Le, Chalvatzaki, Biess, Peters, "Accelerating Motion Planning via Optimal Transport", NeurIPS 2023, MIT).
//
// 입자(경로) 여럿을 웨이포인트 단위로 함께 옮긴다. 한 번의 Sinkhorn Step은 이렇다(mpot/ot/sinkhorn_step.py).
//   1. 웨이포인트마다 무작위로 돌린 정다면체(orthoplex; 2D에서는 직교 방향 4개)를 놓는다.
//   2. 방향마다 probe 점(probe 반경의 1/6 … 5/6)에서 비용을 재 평균한다 → 비용 행렬 C[웨이포인트, 방향].
//   3. C를 [0, 1]로 맞추고(scale_cost_matrix), 균등 주변분포 사이의 엔트로피 OT를 Sinkhorn으로 푼다.
//   4. 각 웨이포인트를 방향별 한 걸음 점(step 반경)의 무게중심(barycentric projection)으로 옮긴다. 시작·목표는 고정.
// 원본과 다른 점: 상태가 위치뿐이다(원본은 위치·속도 4D와 GP 등속 prior). 매끄러움은 이웃 웨이포인트와의 2차 차분과
// 길이로 준다. 반경은 반복마다 (1 − anneal)배로 줄인다. 지형 비용은 Guidance와 같은 칸 가중치(1 + 4·cost + 0.5·σ)다.
import { Rng } from "./core.js";
import { sampleMap } from "./control.js";
import { TRAV } from "./travmap.js";

export const MPOT = {
  particles: 16,      // 입자(경로) 수
  waypoints: 40,      // 경로 하나의 웨이포인트(시작·목표 포함)
  iters: 60,          // 처음 계획의 Sinkhorn Step 횟수
  warmIters: 20,      // 재계획(이전 입자에서 출발)의 횟수
  stepRadius: 0.30,   // 한 걸음 [m]
  probeRadius: 0.60,  // probe가 닿는 거리 [m]
  numProbe: 5,
  anneal: 0.03,       // 반경 감소율
  entEps: 0.01,       // Sinkhorn 엔트로피 정규화(비용을 [0, 1]로 맞춘 뒤)
  sinkhornIters: 25,
  wSmooth: 4.0,       // 2차 차분(가속) 비용 [1/m²]
  wLen: 0.5,          // 이웃까지 거리 제곱 [1/m²]
  lethal: 20.0,       // 치명 칸의 칸 가중치
  initAmp: 1.2,       // 처음 입자를 구부리는 진폭 [m]
};

// 칸 가중치: Guidance의 간선 가중치와 같은 꼴. 치명 칸은 lethal.
function cellWeight(map, x, y, m) {
  sampleMap(map, x, y, m);
  return m[0] >= TRAV.lethal ? MPOT.lethal : 1 + 4 * m[0] + 0.5 * m[1];
}

// 경로 비용: 0.1 m마다 칸 가중치 × 길이(Dijkstra가 재는 양과 같다). 입자 고르기와 그림 색에 쓴다.
export function pathCost(map, P) {
  const m = [0, 0, 0, 0];
  let J = 0, lethal = false;
  for (let i = 1; i < P.length; i++) {
    const dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1], L = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(L / 0.1));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, w = cellWeight(map, P[i - 1][0] + t * dx, P[i - 1][1] + t * dy, m);
      if (w >= MPOT.lethal) lethal = true;
      J += w * (L / n);
    }
  }
  return { J, lethal };
}

// 경로를 호 길이 기준 M점으로 다시 놓는다.
function resample(P, M) {
  const arc = [0];
  for (let i = 1; i < P.length; i++) arc.push(arc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = arc[arc.length - 1], out = [];
  let j = 1;
  for (let k = 0; k < M; k++) {
    const s = (tot * k) / (M - 1);
    while (j < P.length - 1 && arc[j] < s) j++;
    const seg = Math.max(arc[j] - arc[j - 1], 1e-9), a = Math.min(1, Math.max(0, (s - arc[j - 1]) / seg));
    out.push([P[j - 1][0] + a * (P[j][0] - P[j - 1][0]), P[j - 1][1] + a * (P[j][1] - P[j - 1][1])]);
  }
  return out;
}

// 처음 입자: 직선 + 양 끝이 0인 매끄러운 굽힘(사인 세 개, GP 다리처럼). 입자 0은 직선 그대로.
function initParticles(start, goal, rng) {
  const { particles: K, waypoints: M, initAmp } = MPOT;
  const dx = goal[0] - start[0], dy = goal[1] - start[1], L = Math.max(Math.hypot(dx, dy), 1e-6), nx = -dy / L, ny = dx / L;
  const out = [];
  for (let k = 0; k < K; k++) {
    const amp = k === 0 ? [0, 0, 0] : [1, 2, 3].map((h) => (rng.normal() * initAmp) / h);
    const P = [];
    for (let i = 0; i < M; i++) {
      const s = i / (M - 1), off = amp[0] * Math.sin(Math.PI * s) + amp[1] * Math.sin(2 * Math.PI * s) + amp[2] * Math.sin(3 * Math.PI * s);
      P.push([start[0] + s * dx + off * nx, start[1] + s * dy + off * ny]);
    }
    out.push(P);
  }
  return out;
}

// 재계획: 이전 입자마다 로봇에서 가장 가까운 웨이포인트부터 목표까지를 잘라 로봇 위치를 앞에 붙이고 다시 놓는다.
function warmParticles(prev, start, goal) {
  return prev.map((P) => {
    let i0 = 0, best = Infinity;
    for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - start[0], P[i][1] - start[1]); if (d < best) { best = d; i0 = i; } }
    const rest = P.slice(Math.min(i0 + 1, P.length - 1));
    rest[rest.length - 1] = [goal[0], goal[1]];
    return resample([[start[0], start[1]], ...rest], MPOT.waypoints);
  });
}

// 로그 영역 Sinkhorn: 균등 주변분포 a = 1/n, b = 1/m. -> 행 정규화된 전송 W[i, j] / a_i (행 합 1)
function sinkhornRows(C, n, m, eps, iters, f, g) {
  const la = -Math.log(n), lb = -Math.log(m);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      let mx = -Infinity;
      for (let j = 0; j < m; j++) { const v = (g[j] - C[i * m + j]) / eps; if (v > mx) mx = v; }
      let s = 0; for (let j = 0; j < m; j++) s += Math.exp((g[j] - C[i * m + j]) / eps - mx);
      f[i] = eps * (la - mx - Math.log(s));
    }
    for (let j = 0; j < m; j++) {
      let mx = -Infinity;
      for (let i = 0; i < n; i++) { const v = (f[i] - C[i * m + j]) / eps; if (v > mx) mx = v; }
      let s = 0; for (let i = 0; i < n; i++) s += Math.exp((f[i] - C[i * m + j]) / eps - mx);
      g[j] = eps * (lb - mx - Math.log(s));
    }
  }
  const W = new Float64Array(n * m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) W[i * m + j] = Math.exp((f[i] + g[j] - C[i * m + j]) / eps) * n;
  return W;
}

// 한 번의 Sinkhorn Step: 모든 입자의 안쪽 웨이포인트를 함께 옮긴다.
function sinkhornStep(map, X, rs, rp, rng, duals) {
  const K = X.length, M = X[0].length, inner = M - 2, n = K * inner, dirs = 4, P = MPOT.numProbe;
  const C = new Float64Array(n * dirs), S = new Float64Array(n * dirs * 2), m = [0, 0, 0, 0];
  for (let k = 0; k < K; k++) for (let i = 1; i <= inner; i++) {
    const r = k * inner + (i - 1), [px, py] = X[k][i - 1], [x, y] = X[k][i], [nx, ny] = X[k][i + 1];
    const th = rng.r() * Math.PI / 2;                     // 무작위 회전(2D의 최대 토러스 회전)
    for (let j = 0; j < dirs; j++) {
      const a = th + (j * Math.PI) / 2, ux = Math.cos(a), uy = Math.sin(a);
      S[(r * dirs + j) * 2] = x + rs * ux; S[(r * dirs + j) * 2 + 1] = y + rs * uy;
      let c = 0;
      for (let q = 1; q <= P; q++) {
        const t = (q / (P + 1)) * rp, qx = x + t * ux, qy = y + t * uy;
        const ax = px - 2 * qx + nx, ay = py - 2 * qy + ny;
        c += cellWeight(map, qx, qy, m)
          + MPOT.wSmooth * (ax * ax + ay * ay)
          + MPOT.wLen * ((qx - px) ** 2 + (qy - py) ** 2 + (nx - qx) ** 2 + (ny - qy) ** 2);
      }
      C[r * dirs + j] = c / P;
    }
  }
  // scale_cost_matrix: 음수면 최솟값을 빼고, 1을 넘으면 최댓값으로 나눈다
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < C.length; i++) { if (C[i] < mn) mn = C[i]; if (C[i] > mx) mx = C[i]; }
  if (mn < 0) { for (let i = 0; i < C.length; i++) C[i] -= mn; mx -= mn; }
  if (mx > 1) for (let i = 0; i < C.length; i++) C[i] /= mx;
  if (!duals.f || duals.f.length !== n) { duals.f = new Float64Array(n); duals.g = new Float64Array(dirs); }
  const W = sinkhornRows(C, n, dirs, MPOT.entEps, MPOT.sinkhornIters, duals.f, duals.g);
  let disp = 0;
  for (let k = 0; k < K; k++) for (let i = 1; i <= inner; i++) {
    const r = k * inner + (i - 1);
    let x = 0, y = 0;
    for (let j = 0; j < dirs; j++) { const w = W[r * dirs + j]; x += w * S[(r * dirs + j) * 2]; y += w * S[(r * dirs + j) * 2 + 1]; }
    disp += (x - X[k][i][0]) ** 2 + (y - X[k][i][1]) ** 2;
    X[k][i] = [x, y];
  }
  return disp;
}

// Planner 진입점. mem은 World가 들고 있는 상태(이전 입자, 난수)다.
export function mpotPlan(map, start, goal, mem) {
  const t0 = performance.now();
  mem.rng ||= new Rng(mem.seed ?? 0);
  const fresh = !mem.particles || !mem.goal || mem.goal[0] !== goal[0] || mem.goal[1] !== goal[1];
  let X = fresh ? initParticles(start, goal, mem.rng) : warmParticles(mem.particles, start, goal);
  const iters = fresh ? MPOT.iters : MPOT.warmIters, duals = {};
  let rs = MPOT.stepRadius, rp = MPOT.probeRadius, disp = 0;
  for (let it = 0; it < iters; it++) {
    disp = sinkhornStep(map, X, rs, rp, mem.rng, duals);
    rs *= 1 - MPOT.anneal; rp *= 1 - MPOT.anneal;
  }
  const scored = X.map((P) => ({ P, ...pathCost(map, P) }));
  let best = 0;
  for (let k = 1; k < scored.length; k++) if (scored[k].J < scored[best].J) best = k;
  mem.particles = X; mem.goal = [goal[0], goal[1]];
  return {
    path: X[best], ok: !scored[best].lethal, field: null, ms: performance.now() - t0,
    particles: scored.map((s) => ({ P: s.P, J: s.J, lethal: s.lethal })), best, iters, disp,
  };
}
