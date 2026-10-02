// Planner: planners/guidance.py(GlobalGuidance, Dijkstra cost-to-go)를 옮긴 것.
// 간선 비용 = 길이 × 두 칸 평균(1 + 4·cost + 0.5·sigma). 치명 셀은 그래프에서 뺀다.
import { TRAV } from "./travmap.js";

export const GUIDANCE = { costWeight: 4.0, sigmaWeight: 0.5 };
const NB = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

class Heap {
  constructor(n) { this.k = new Float64Array(n * 4); this.v = new Int32Array(n * 4); this.n = 0; }
  push(key, val) {
    if (this.n >= this.k.length) { const k = new Float64Array(this.k.length * 2); k.set(this.k); this.k = k; const v = new Int32Array(this.v.length * 2); v.set(this.v); this.v = v; }
    let i = this.n++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; }
    this.k[i] = key; this.v[i] = val;
  }
  pop() {
    const topK = this.k[0], topV = this.v[0], k = this.k[--this.n], v = this.v[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.n) break;
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= k) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = k; this.v[i] = v;
    this.lastK = topK;
    return topV;
  }
}

// map: TravMap(belief), goal [x,y] -> { ctg: Float32Array, next: Int32Array }
export function costToGo(map, goal) {
  const g = map.grid, N = g.N, W = g.W, H = g.H;
  const wcell = new Float32Array(N), free = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    free[i] = map.cost[i] < TRAV.lethal ? 1 : 0;
    wcell[i] = 1 + GUIDANCE.costWeight * map.cost[i] + GUIDANCE.sigmaWeight * map.sigma[i];
  }
  const dist = new Float64Array(N).fill(Infinity), next = new Int32Array(N).fill(-1);
  const [gr, gc] = g.cell(goal[0], goal[1]), s = gr * W + gc;
  const heap = new Heap(N);
  dist[s] = 0; heap.push(0, s);
  const L = NB.map(([dr, dc]) => g.res * Math.hypot(dr, dc));
  while (heap.n > 0) {
    const u = heap.pop(), du = heap.lastK;
    if (du > dist[u]) continue;
    const ur = (u / W) | 0, uc = u - ur * W;
    if (!free[u]) continue;                 // 목표가 치명 셀이면 도달 가능한 칸이 없다(Python과 같음)
    for (let k = 0; k < 8; k++) {
      const r = ur + NB[k][0], c = uc + NB[k][1];
      if (r < 0 || c < 0 || r >= H || c >= W) continue;
      const v = r * W + c;
      if (!free[v]) continue;
      const nd = du + L[k] * 0.5 * (wcell[u] + wcell[v]);
      if (nd < dist[v]) { dist[v] = nd; next[v] = u; heap.push(nd, v); }
    }
  }
  let big = 0;
  for (let i = 0; i < N; i++) if (dist[i] < Infinity && dist[i] > big) big = dist[i];
  const ctg = new Float32Array(N);
  for (let i = 0; i < N; i++) ctg[i] = dist[i] < Infinity ? dist[i] : big + 10;
  return { ctg, next, reachable: (i) => dist[i] < Infinity, big: big + 10, goalIdx: s };
}

// 로봇 칸에서 next를 따라 목표까지. 막혀 있으면 주변 21×21에서 가장 가까운 도달 가능 칸부터.
export function extractRoute(field, g, start, goal) {
  let [r, c] = g.cell(start[0], start[1]);
  let node = r * g.W + c;
  if (!field.reachable(node)) {
    let best = Infinity, bi = -1;
    for (let dr = -10; dr <= 10; dr++) for (let dc = -10; dc <= 10; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= g.H || cc >= g.W) continue;
      const i = rr * g.W + cc;
      if (field.reachable(i) && field.ctg[i] < best) { best = field.ctg[i]; bi = i; }
    }
    if (bi < 0) return { route: [[start[0], start[1]], [goal[0], goal[1]]], ok: false };
    node = bi;
  }
  const route = [[start[0], start[1]]];
  let guard = g.N;
  while (node !== field.goalIdx && node >= 0 && guard-- > 0) {
    const rr = (node / g.W) | 0, cc = node - rr * g.W;
    route.push([cc * g.res, rr * g.res]);
    node = field.next[node];
  }
  route.push([goal[0], goal[1]]);
  return { route, ok: true };
}

import { mpotPlan } from "./mpot.js";
import { plannerDPlan, plannerDReady } from "./plannerd.js";

// Planner D(TP-0137): Guidance(Dijkstra)의 cost-to-go와 경로가 소목표·선택기의 입력이다(파이썬 러너가 1 Hz로 넘기는 것과 같다).
// 가중치(plannerd_weights.js, 4 MB)를 아직 불러오지 않았으면 그동안은 Guidance 경로를 내고 loading을 표시한다.
function pdPlan(map, start, goal, mem, sampler) {
  const t0 = performance.now();
  const field = costToGo(map, goal), { route, ok } = extractRoute(field, map.grid, start, goal);
  const msGuide = performance.now() - t0;
  if (!plannerDReady()) return { path: route, ok, field, ms: msGuide, loading: true };
  const res = plannerDPlan(map, start, goal, mem || {}, { field, route }, sampler);
  return { ...res, msGuide };          // ms = Planner D만(파이썬 plan_ms와 같은 범위), msGuide = Dijkstra
}

export const PLANNERS = {
  guidance: {
    label: "Guidance (Dijkstra)",
    note: "belief TravMap 위의 Dijkstra 최단 cost 경로. travplan의 비학습 기준선 Planner다.",
    plan(map, start, goal) {
      const t0 = performance.now();
      const field = costToGo(map, goal);
      const { route, ok } = extractRoute(field, map.grid, start, goal);
      return { path: route, ok, field, ms: performance.now() - t0 };
    },
  },
  mpot: {
    label: "MPOT (Sinkhorn Step)",
    note: "최적 수송 기반 경로 최적화(Le 외, NeurIPS 2023). 경로 16개의 웨이포인트를 무작위 회전한 방향 4개와 probe 비용, 엔트로피 OT로 함께 옮긴다. 가장 싼 경로를 고른다. 재계획은 이전 입자에서 출발한다(TP-0136).",
    plan(map, start, goal, mem) { return mpotPlan(map, start, goal, mem || {}); },
  },
  plannerd: {
    label: "Planner D · flow matching", learned: true,
    note: "travplan의 학습 Planner(레벨 0–3 시연 + DAgger). 자기중심 지도 crop·소목표·twist를 조건으로 4 s 제어열 16개를 ODE(Euler) n스텝으로 뽑고, 지도 cost·치명·Guidance cost-to-go로 하나를 고른다(TP-0137).",
    plan(map, start, goal, mem) { return pdPlan(map, start, goal, mem, "flow"); },
  },
  plannerd_diff: {
    label: "Planner D · diffusion", learned: true,
    note: "같은 망을 diffusion으로 샘플한다: 선형 일정의 DDPM 조상 샘플링(x̂₁ = x + (1 − t)·v로 사후 q(x_s | x_t, x̂₁)에서 한 걸음씩 노이즈를 다시 섞는다). 같은 스텝이면 표본이 더 흩어진다(TP-0137, 배경 0.6b).",
    plan(map, start, goal, mem) { return pdPlan(map, start, goal, mem, "diffusion"); },
  },
  straight: {
    label: "직선 (지도 무시)",
    note: "지형을 보지 않고 목표까지 직선을 낸다. Controller(MPPI)가 혼자 지형을 피할 수 있는지 볼 때 쓴다.",
    plan(map, start, goal) {
      return { path: [[start[0], start[1]], [goal[0], goal[1]]], ok: true, field: null, ms: 0 };
    },
  },
};
