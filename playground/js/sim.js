// 폐루프: sim/kinematic_sim.py + eval/runner.py를 옮긴 것.
// 매 0.1 s: 관측 -> belief TravMap -> (10스텝마다) Planner -> Controller -> 스워브 적분 -> 실패 판정.
import { Rng, clamp } from "./core.js";
import { makeTerrain } from "./terrain.js";
import { buildMap, lineOfSight, TRAV } from "./travmap.js";
import { PLANNERS, costToGo, extractRoute } from "./planner.js";
import { ElevationMap } from "./perception.js";
import { MPPI, trackCommand, clampAccel, clampTwist, stepPose, sampleMap, attitude } from "./control.js";

export const SIM = { dt: 0.1, rollLimit: 0.30, pitchLimit: 0.35, goalTol: 0.3, maxTime: 60, replanEvery: 10, noise: 0.01, pedRadius: 0.55 };

export const PERCEPTION = {
  gt: { label: "완전 관측", note: "지도 전체를 처음부터 안다. 인식 오차가 없을 때의 상한." },
  range: { label: "L0 원형 시야", note: "로봇 주변 반경 안의 칸은 모두 보인다(가림 없음). 벤치마크 기본값." },
  occlusion: { label: "L0 + 가림", note: "센서 높이에서 2.5D 시선 검사. 턱·상자 뒤와 포트홀 바닥이 가려진다(TP-0031)." },
  l1lite: { label: "L1 간이", note: "합성 LiDAR(16채널, 10° 숙임)의 점을 칸마다 칼만으로 융합한다(elevation mapping). 링 사이가 비어 근거리 미관측이 L0보다 많다(TP-0053, TP-0100)." },
};

export class World {
  constructor(opts) {
    this.opts = opts;
    this.newTerrain();
  }

  newTerrain() {
    const o = this.opts;
    this.terrain = makeTerrain(o.scenario, o.seed, o.level);
    this.goal = this.terrain.goal.slice();
    this.rebuildGT();
    this.reset();
  }

  rebuildGT() {
    const g = this.terrain.grid;
    this.gt = buildMap(this.terrain.z, g);
    this.mapVersion = (this.mapVersion || 0) + 1;
  }

  reset() {
    const o = this.opts, g = this.terrain.grid, [x, y, yaw] = this.terrain.start;
    this.pose = [x, y, yaw]; this.twist = [0, 0, 0]; this.t = 0; this.k = 0;
    this.rng = new Rng(o.seed * 31 + 7);
    this.beliefElev = new Float32Array(g.N).fill(NaN);
    this.beliefCeil = new Float32Array(g.N).fill(Infinity);
    this.emap = new ElevationMap(g);
    this.lastVis = null;
    this.trail = [[x, y]];
    this.status = "running"; this.failure = "";
    this.stats = { len: 0, maxPitch: 0, maxRoll: 0, gtCostSum: 0, minClear: Infinity, steps: 0 };
    this.ms = { map: 0, plan: 0, ctrl: 0 };
    this.plan = null; this.ctrl = null;
    this.peds = (this.pedsInit || []).map((p) => ({ ...p }));
    this.mppi = new MPPI(o.mppi, o.seed);
    this.observe();
    this.replan();
  }

  // -> 거부 사유(문자열) 또는 null. 치명 셀 위 목표는 Python처럼 경로가 없으므로 받지 않는다.
  setGoal(x, y) {
    const m = sampleMap(this.gt, x, y, [0, 0, 0, 0]);
    if (m[0] >= TRAV.lethal) return "치명 셀 위에는 목표를 둘 수 없다";
    this.goal = [x, y];
    this.replan();
    return null;
  }

  // ------------------------------------------------------------ 인식
  observe() {
    const o = this.opts, g = this.terrain.grid, z = this.terrain.z;
    const t0 = performance.now();
    this.mapVersion = (this.mapVersion || 0) + 1;
    if (o.perception === "gt") { this.belief = this.gt; this.lastVis = null; this.ms.map = performance.now() - t0; return; }

    const R = o.sensorRange, [x, y] = this.pose;
    const near = { unknownNear: o.unknownNear || 0, unknownNearCost: o.unknownNearCost ?? 1.0, robotXY: [x, y] };
    if (o.perception === "l1lite") {
      const [cr, cc] = g.cell(x, y);
      this.emap.scan(z, this.pose, z[cr * g.W + cc] + o.sensorHeight, R, this.rng);
      this.lastVis = null;
      this.belief = buildMap(this.emap.h, g, {
        ceiling: o.shadowCeiling ? this.emap.upper : null,
        shadowDepth: o.shadowCeiling && o.depthPrior ? 0.10 : null,
        evidence: o.evidence, ...near,
      });
      this.beliefCeil = this.emap.upper;
      this.ms.map = performance.now() - t0;
      return;
    }
    let vis = new Uint8Array(g.N);
    const r0 = Math.max(0, Math.floor((y - R) / g.res)), r1 = Math.min(g.H - 1, Math.ceil((y + R) / g.res));
    const c0 = Math.max(0, Math.floor((x - R) / g.res)), c1 = Math.min(g.W - 1, Math.ceil((x + R) / g.res));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if ((c * g.res - x) ** 2 + (r * g.res - y) ** 2 <= R * R) vis[r * g.W + c] = 1;
    if (o.perception === "occlusion") {
      const [cr, cc] = g.cell(x, y);
      const los = lineOfSight(z, g, x, y, z[cr * g.W + cc] + o.sensorHeight, R);
      for (let i = 0; i < g.N; i++) vis[i] &= los.vis[i];
      if (o.shadowCeiling) for (let i = 0; i < g.N; i++) if (los.ceil[i] < this.beliefCeil[i]) this.beliefCeil[i] = los.ceil[i];
    }
    const e = this.beliefElev;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * g.W + c;
      if (!vis[i]) continue;
      const obs = z[i] + this.rng.normal() * SIM.noise;
      e[i] = Number.isFinite(e[i]) ? 0.7 * e[i] + 0.3 * obs : obs;
    }
    this.lastVis = vis;
    const useCeil = o.perception === "occlusion" && o.shadowCeiling;
    this.belief = buildMap(e, g, {
      ceiling: useCeil ? this.beliefCeil : null,
      shadowDepth: useCeil && o.depthPrior ? 0.10 : null,
      evidence: o.evidence, ...near,
    });
    this.ms.map = performance.now() - t0;
  }

  replan() {
    const res = PLANNERS[this.opts.planner].plan(this.belief, this.pose, this.goal);
    this.plan = res; this.ms.plan = res.ms;
  }

  // ------------------------------------------------------------ 보행자
  addPed(x, y, vx, vy) {
    const p = { x, y, vx, vy, r: SIM.pedRadius };
    this.peds.push(p);
    (this.pedsInit ||= []).push({ ...p });
  }
  clearPeds() { this.peds = []; this.pedsInit = []; }
  // 로봇의 예상 경로에 정면 1명 + 가로지르는 사람(Python crossing_pedestrians와 같은 규칙)
  // 기준 경로는 Python run_benchmark처럼 GT 지도 위 시작점 -> 목표 Dijkstra 경로다. 난수는 센서 잡음과 따로 쓴다.
  spawnCrossing(n = 3) {
    const g = this.terrain.grid, start = this.terrain.start;
    const field = costToGo(this.gt, this.goal);
    const got = extractRoute(field, g, start, this.goal);
    const route = got.ok ? got.route : [start.slice(0, 2), this.goal];
    const arc = [0];
    for (let i = 1; i < route.length; i++) arc.push(arc[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    const at = (f) => {
      const a = f * arc[arc.length - 1];
      let i = 1; while (i < arc.length - 1 && arc[i] < a) i++;
      const seg = Math.max(arc[i] - arc[i - 1], 1e-9), tx = (route[i][0] - route[i - 1][0]) / seg, ty = (route[i][1] - route[i - 1][1]) / seg;
      return [route[i - 1][0] + (a - arc[i - 1]) * tx, route[i - 1][1] + (a - arc[i - 1]) * ty, tx, ty];
    };
    const rng = new Rng(10000 + this.opts.seed * 17 + (this.pedsInit?.length || 0));
    const [px, py, tx, ty] = at(0.8), sp = rng.uniform(0.5, 0.9), off = rng.uniform(-0.2, 0.2);
    this.addPed(px - ty * off, py + tx * off, -sp * tx, -sp * ty);
    for (let i = 1; i < n; i++) {
      const f = i / n + rng.uniform(-0.08, 0.08), [qx, qy, ux, uy] = at(f);
      const tMeet = (f * arc[arc.length - 1]) / 0.9 + rng.uniform(-1, 1);
      const s = (rng.r() < 0.5 ? -1 : 1) * rng.uniform(0.4, 0.8), vx = -uy * s, vy = ux * s;
      this.addPed(qx - vx * tMeet, qy - vy * tMeet, vx, vy);
    }
  }

  // ------------------------------------------------------------ 한 스텝
  step() {
    if (this.status !== "running") return;
    const o = this.opts, dt = SIM.dt;
    if (this.k % SIM.replanEvery === 0) this.replan();
    const pedsNow = this.peds.map((p) => ({ ...p }));
    let u;
    if (o.controller === "mppi") {
      this.mppi.cfg = { ...this.mppi.cfg, ...o.mppi, w: { ...this.mppi.cfg.w, ...(o.mppi?.w || {}) } };
      if (this.mppi.U.length !== this.mppi.cfg.T * 3) this.mppi.reset();
      this.ctrl = this.mppi.control({ pose: this.pose, twist: this.twist, path: this.plan.path, goal: this.goal, map: this.belief, peds: pedsNow });
      u = this.ctrl.u; this.ms.ctrl = this.ctrl.ms;
    } else {
      const t0 = performance.now();
      u = trackCommand(this.pose, this.plan.path);
      this.ctrl = { nominal: null, samples: [], ms: performance.now() - t0 };
      this.ms.ctrl = this.ctrl.ms;
    }
    u = clampAccel(clampTwist(u), this.twist, dt);
    const prev = this.pose;
    this.pose = stepPose(prev[0], prev[1], prev[2], u, dt);
    this.twist = u; this.t += dt; this.k++;
    this.trail.push([this.pose[0], this.pose[1]]);
    for (const p of this.peds) { p.x += p.vx * dt; p.y += p.vy * dt; }   // Python DynamicObstacles.advance: 등속 직진

    // 판정은 GT 지도로 한다.
    const m = sampleMap(this.gt, this.pose[0], this.pose[1], [0, 0, 0, 0]);
    const [pitch, roll] = attitude(m[2], m[3], this.pose[2]);
    const s = this.stats;
    s.len += Math.hypot(this.pose[0] - prev[0], this.pose[1] - prev[1]);
    s.maxPitch = Math.max(s.maxPitch, Math.abs(pitch)); s.maxRoll = Math.max(s.maxRoll, Math.abs(roll));
    s.gtCostSum += m[0]; s.steps++;
    this.cur = { pitch, roll, gtCost: m[0], speed: Math.hypot(u[0], u[1]), u };
    let clear = Infinity;
    for (const p of this.peds) clear = Math.min(clear, Math.hypot(p.x - this.pose[0], p.y - this.pose[1]) - p.r);
    s.minClear = Math.min(s.minClear, clear);

    if (m[0] >= TRAV.lethal) this.fail("lethal", "치명 셀 진입");
    else if (Math.abs(roll) > SIM.rollLimit || Math.abs(pitch) > SIM.pitchLimit) this.fail("tipover", "전복 한계 초과");
    else if (clear < 0) this.fail("collision", "보행자 충돌");
    else if (Math.hypot(this.pose[0] - this.goal[0], this.pose[1] - this.goal[1]) < SIM.goalTol) { this.status = "reached"; }
    else if (this.t >= SIM.maxTime) this.fail("timeout", "60 s 시간 초과");

    this.observe();
  }

  fail(code, text) { this.status = "failed"; this.failure = text; this.failCode = code; }
}

export function defaultOptions() {
  return {
    scenario: "curb_ramp", level: 0, seed: 0,
    perception: "occlusion", sensorHeight: 0.3, sensorRange: 5.0,
    shadowCeiling: true, depthPrior: true, evidence: true,
    unknownNear: 0, unknownNearCost: 1.0,
    planner: "guidance", controller: "mppi",
    mppi: { K: 256, T: 40, lambda: 0.5, noise: [0.4, 0.25, 0.6], w: { trav: 6.0, risk: 3.0, attitude: 20.0 } },
  };
}
