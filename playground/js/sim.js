// 폐루프: sim/kinematic_sim.py + eval/runner.py를 옮긴 것.
// 매 0.1 s: 관측 -> belief TravMap -> (10스텝마다) Planner -> Controller -> 스워브 적분 -> 실패 판정.
import { Rng, clamp } from "./core.js";
import { makeTerrain } from "./terrain.js";
import { buildMap, lineOfSight, TRAV } from "./travmap.js";
import { PLANNERS, costToGo, extractRoute } from "./planner.js";
import { ElevationMap, bodyFrame } from "./perception.js";
import { applyRobot, gaitOffset, wbcTrack, footTouchdowns } from "./robots.js";
import { MPPI, trackCommand, clampAccel, clampTwist, stepPose, sampleMap, attitude } from "./control.js";
import { policyFor, predict, straightPath } from "./policy.js";

export const SIM = { dt: 0.1, rollLimit: 0.30, pitchLimit: 0.35, goalTol: 0.3, maxTime: 60, replanEvery: 10, noise: 0.01, pedRadius: 0.55 };

// 출발점에 겹쳐 생긴 보행자를 제 경로를 따라 민다(Python sim/terrain.py clear_start, TP-0147).
// 처음 1초 동안 출발점에서 0.3 m를 비울 때까지 0.1 s씩 늦게 출발시키고, 그래도 안 되면 앞으로 보낸다. 난수는 쓰지 않는다.
export function clearStart(peds, start, r, margin = 0.3, horizon = 1.0) {
  const gap = (x, y, vx, vy) => {
    let m = Infinity;
    for (let k = 0; k <= 10; k++) { const t = (horizon * k) / 10; m = Math.min(m, Math.hypot(x + vx * t - start[0], y + vy * t - start[1])); }
    return m - r;
  };
  return peds.map(([x, y, vx, vy]) => {
    if (gap(x, y, vx, vy) >= margin) return [x, y, vx, vy];
    for (const s of [-1, 1]) {
      for (let k = 1; k <= 200; k++) {
        const qx = x + s * 0.1 * k * vx, qy = y + s * 0.1 * k * vy;
        if (gap(qx, qy, vx, vy) >= margin) return [qx, qy, vx, vy];
      }
    }
    return [x, y, vx, vy];
  });
}

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
    this.applyRobot();
    this.terrain = makeTerrain(o.scenario, o.seed, o.level);
    this.goal = this.terrain.goal.slice();
    this.rebuildGT();
    this.reset();
  }

  // 로봇 종류가 운동 한계·traversability 한계·전복 한계를 정한다. 바꾸면 GT 지도를 다시 만들어야 한다.
  applyRobot() {
    this.R = applyRobot(this.opts.robot);
    SIM.rollLimit = this.R.tip.roll; SIM.pitchLimit = this.R.tip.pitch;
  }

  rebuildGT() {
    const g = this.terrain.grid;
    this.gt = buildMap(this.terrain.z, g);
    this.mapVersion = (this.mapVersion || 0) + 1;
  }

  reset() {
    const o = this.opts, g = this.terrain.grid, [x, y, yaw] = this.terrain.start;
    this.pose = [x, y, yaw]; this.twist = [0, 0, 0]; this.t = 0; this.k = 0;
    // 걸음 시계(TP-0135): 사족·바퀴 사족은 시뮬 시각과 같고, 휴머노이드(WBC)는 서 있는 동안 멈춘다.
    this.gaitClock = 0; this.wbc = this.R.wbc ? { standing: true } : null;
    const c0 = Math.cos(yaw), s0 = Math.sin(yaw);
    this.feet = (this.R.feet || []).map(([, bx, by]) => [x + c0 * bx - s0 * by, y + s0 * bx + c0 * by]);
    this.footsteps = []; this.footFaults = 0; this.footCount = 0;
    this.rng = new Rng(o.seed * 31 + 7);
    this.poseRng = new Rng(o.seed * 131 + 5); this.poseErr = [0, 0, 0];   // 자세 추정 오차(pitch, roll, z)
    this.mapErr = null;
    this.beliefElev = new Float32Array(g.N).fill(NaN);
    this.beliefCeil = new Float32Array(g.N).fill(Infinity);
    this.emap = new ElevationMap(g);
    this.lastVis = null;
    this.trail = [[x, y]];
    this.status = "running"; this.failure = "";
    this.stats = { len: 0, maxPitch: 0, maxRoll: 0, gtCostSum: 0, minClear: Infinity, steps: 0, errSum: 0, errN: 0, falseMax: 0 };
    this.ms = { map: 0, plan: 0, ctrl: 0 };
    this.plan = null; this.ctrl = null;
    this.planMem = { seed: o.seed * 7919 + 13 };          // 상태를 갖는 Planner(MPOT의 입자·난수, TP-0136)
    this.peds = (this.pedsInit || []).map((p) => ({ ...p }));
    this.mppi = new MPPI(o.mppi, o.seed);
    this.blindPath = straightPath([x, y], this.goal, g.res);   // 지도 없는 대조군이 받는 전부(TP-0129)
    this.observe();
    this.replan();
  }

  // -> 거부 사유(문자열) 또는 null. 치명 셀 위 목표는 Python처럼 경로가 없으므로 받지 않는다.
  setGoal(x, y) {
    const m = sampleMap(this.gt, x, y, [0, 0, 0, 0]);
    if (m[0] >= TRAV.lethal) return "치명 셀 위에는 목표를 둘 수 없다";
    this.goal = [x, y];
    this.blindPath = straightPath(this.terrain.start.slice(0, 2), this.goal, this.terrain.grid.res);
    this.replan();
    return null;
  }

  // ------------------------------------------------------------ 인식
  observe() {
    const o = this.opts, g = this.terrain.grid, z = this.terrain.z;
    const t0 = performance.now();
    this.mapVersion = (this.mapVersion || 0) + 1;
    const [bodyT, bodyE] = this.sensorPoses();
    if (o.perception === "gt") { this.belief = this.gt; this.lastVis = null; this.mapErr = null; this.ms.map = performance.now() - t0; return; }

    const R = o.sensorRange, [x, y] = this.pose;
    const near = { unknownNear: o.unknownNear || 0, unknownNearCost: o.unknownNearCost ?? 1.0, robotXY: [x, y] };
    if (o.perception === "l1lite") {
      this.emap.scan(z, bodyT, bodyE, o.sensorHeight, R, this.rng, this.R.lidar);
      if (o.stereo) this.emap.stereo(z, bodyT, bodyE, this.R.sensorH, this.rng);   // TP-0065 전면 스테레오(몸체에 붙은 카메라)
      this.lastVis = null;
      this.belief = buildMap(this.emap.h, g, {
        ceiling: o.shadowCeiling ? this.emap.upper : null,
        shadowDepth: o.shadowCeiling && o.depthPrior ? 0.10 : null,
        evidence: o.evidence, ...near,
      });
      this.beliefCeil = this.emap.upper;
      this.measureMap();
      this.ms.map = performance.now() - t0;
      return;
    }
    let vis = new Uint8Array(g.N);
    const r0 = Math.max(0, Math.floor((y - R) / g.res)), r1 = Math.min(g.H - 1, Math.ceil((y + R) / g.res));
    const c0 = Math.max(0, Math.floor((x - R) / g.res)), c1 = Math.min(g.W - 1, Math.ceil((x + R) / g.res));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if ((c * g.res - x) ** 2 + (r * g.res - y) ** 2 <= R * R) vis[r * g.W + c] = 1;
    if (o.perception === "occlusion") {
      const [cr, cc] = g.cell(x, y);
      const los = lineOfSight(z, g, x, y, z[cr * g.W + cc] + o.sensorHeight + this.body.gait.dz, R);
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
    this.measureMap();
    this.ms.map = performance.now() - t0;
  }

  // 몸체 자세: 지면 높이·지형 기울기(GT 지도의 기울기) + 걸음새 흔들림. -> [참 자세, 매퍼가 믿는 자세]
  // 보상 켬: 매퍼가 IMU·다리 기구학으로 참 자세를 알되 추정 잡음(1차 저역, 시정수 약 1 s)이 있다.
  // 보상 끔: 매퍼는 yaw와 지면 높이만 안다(몸체가 수평이고 흔들리지 않는다고 믿는다).
  sensorPoses() {
    const o = this.opts, g = this.terrain.grid, [x, y, yaw] = this.pose;
    // 지형 자세는 3D 보기와 같이 앞뒤(±0.3 m)·좌우(±0.2 m) 접지 높이차로 잡는다.
    const zs = this.terrain.z, c = Math.cos(yaw), sn = Math.sin(yaw), at = (dx, dy) => g.sample(zs, x + dx, y + dy, 0);
    const zf = at(0.3 * c, 0.3 * sn), zb = at(-0.3 * c, -0.3 * sn), zl = at(-0.2 * sn, 0.2 * c), zr = at(0.2 * sn, -0.2 * c);
    const z0 = (zf + zb + zl + zr) / 4, pa = Math.atan2(zf - zb, 0.6), ra = Math.atan2(zl - zr, 0.4);
    const gait = gaitOffset(this.R, this.gaitClock, Math.hypot(this.twist[0], this.twist[1]));
    // WBC 휴머노이드는 몸통을 곧게 세운다(rpy_cmd = 0): 머리 센서는 지형 기울기가 아니라 걸음새 흔들림만 탄다.
    const up = this.R.wbc?.upright, pitch = (up ? 0 : pa) + gait.pitch, roll = (up ? 0 : ra) + gait.roll, zB = z0 + gait.dz;
    this.body = { z: zB, pitch, roll, gait };
    const T = bodyFrame(x, y, zB, yaw, pitch, roll);
    if (!o.poseComp) return [T, bodyFrame(x, y, z0, yaw, 0, 0)];
    const s = ((o.poseNoise || 0) * Math.PI) / 180, e = this.poseErr, a = 0.9, b = Math.sqrt(1 - a * a);
    e[0] = a * e[0] + b * s * this.poseRng.normal(); e[1] = a * e[1] + b * s * this.poseRng.normal();
    e[2] = a * e[2] + b * 0.005 * (o.poseNoise || 0) * this.poseRng.normal();   // 1°당 높이 5 mm
    return [T, bodyFrame(x, y, zB + e[2], yaw, pitch + e[0], roll + e[1])];
  }

  // 지도 품질: 로봇 3 m 안 관측 칸의 높이 RMSE와 '거짓 치명'(로봇 지도는 치명, 실제 cost는 아님) 칸 수.
  measureMap() {
    const g = this.terrain.grid, b = this.belief, z = this.terrain.z, [x, y] = this.pose, R = 3.0;
    let se = 0, n = 0, fb = 0;
    const r0 = Math.max(0, Math.floor((y - R) / g.res)), r1 = Math.min(g.H - 1, Math.ceil((y + R) / g.res));
    const c0 = Math.max(0, Math.floor((x - R) / g.res)), c1 = Math.min(g.W - 1, Math.ceil((x + R) / g.res));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * g.W + c;
      if (!b.known[i] || (c * g.res - x) ** 2 + (r * g.res - y) ** 2 > R * R) continue;
      const d = b.elev[i] - z[i]; se += d * d; n++;
      if (b.cost[i] >= TRAV.lethal && this.gt.cost[i] < TRAV.lethal) fb++;
    }
    this.mapErr = { rmse: n ? Math.sqrt(se / n) : 0, falseBlocked: fb, n };
    const s = this.stats;
    if (s && n) { s.errSum += this.mapErr.rmse; s.errN++; s.falseMax = Math.max(s.falseMax, fb); }
  }

  replan() {
    this.planMem.twist = this.twist.slice(); this.planMem.steps = this.opts.genSteps;   // Planner D의 조건과 생성 스텝 수(TP-0137)
    this.planMem.fallback = !!this.opts.pdFallback;                                       // Planner D의 Guidance 폴백(TP-0078)
    const res = PLANNERS[this.opts.planner].plan(this.belief, this.pose, this.goal, this.planMem);
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
    const peds = [[px - ty * off, py + tx * off, -sp * tx, -sp * ty]];
    for (let i = 1; i < n; i++) {
      const f = i / n + rng.uniform(-0.08, 0.08), [qx, qy, ux, uy] = at(f);
      const tMeet = (f * arc[arc.length - 1]) / 0.9 + rng.uniform(-1, 1);
      const s = (rng.r() < 0.5 ? -1 : 1) * rng.uniform(0.4, 0.8), vx = -uy * s, vy = ux * s;
      peds.push([qx - vx * tMeet, qy - vy * tMeet, vx, vy]);
    }
    for (const [x, y, vx, vy] of clearStart(peds, start, SIM.pedRadius)) this.addPed(x, y, vx, vy);
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
      // 휴머노이드: MPPI 롤아웃이 하체 정책의 지연·서기 전환을 알게 할지(TP-0135). 끄면 명령이 곧바로 몸체 twist라고 믿는다.
      const aware = this.R.wbc && o.wbcAware !== false;
      this.mppi.cfg.lag = aware ? this.R.wbc.tau : 0; this.mppi.cfg.lagStand = aware ? this.R.wbc.stand : 0;
      if (this.mppi.U.length !== this.mppi.cfg.T * 3) this.mppi.reset();
      this.ctrl = this.mppi.control({ pose: this.pose, twist: this.twist, path: this.plan.path, goal: this.goal, map: this.belief, peds: pedsNow });
      u = this.ctrl.u; this.ms.ctrl = this.ctrl.ms;
    } else if (o.controller === "learned" || o.controller === "blind") {
      // 학습 정책(TP-0128). 지도 없는 대조군(TP-0129)은 지형 입력을 0으로 받고 목표 직선만 본다.
      const blind = o.controller === "blind";
      const pol = policyFor(o.robot, blind);
      const t0 = performance.now();
      if (!pol) {                                   // 그 로봇의 가중치가 없으면 솔직하게 pure pursuit로 떨어진다
        u = trackCommand(this.pose, blind ? this.blindPath : this.plan.path);
        this.ctrl = { nominal: null, samples: [], ms: performance.now() - t0, missing: true };
      } else {
        const path = blind ? this.blindPath : this.plan.path;
        const att = [this.body?.pitch ?? 0, this.body?.roll ?? 0];   // 몸이 느끼는 자세(걸음새 흔들림 포함)
        u = pol.control(this.belief, this.pose, this.twist, path, att);
        // 명령을 낸 시각에서 끊는다. 아래 predict()는 화면에 그릴 궤적일 뿐이라 제어 시간이 아니다
        // (MPPI의 nominal은 평균 갱신의 일부라 ms 안에 있는 것이 맞다 — 그래서 여기만 따로 끊는다).
        const ms = performance.now() - t0;
        this.ctrl = { nominal: predict(pol, this.belief, this.pose, this.twist, path),
                      samples: [], ms, policy: pol, blind };
      }
      this.ms.ctrl = this.ctrl.ms;
    } else {
      const t0 = performance.now();
      u = trackCommand(this.pose, this.plan.path);
      this.ctrl = { nominal: null, samples: [], ms: performance.now() - t0 };
      this.ms.ctrl = this.ctrl.ms;
    }
    u = clampTwist(u);                                             // 휴머노이드에게는 GR00T의 navigate_cmd 한계
    if (this.R.wbc) {                                              // 하체 정책: 서기/걷기 전환과 추종 지연(TP-0135)
      const w = wbcTrack(this.R, u, this.twist, dt);
      this.wbc = { standing: w.standing, cmd: u };                // cmd = 하체 정책이 받은 navigate_cmd
      u = w.u;
    }
    u = clampAccel(u, this.twist, dt);
    const prev = this.pose, prevClock = this.gaitClock;
    this.pose = stepPose(prev[0], prev[1], prev[2], u, dt);
    this.twist = u; this.t += dt; this.k++;
    if (!this.wbc?.standing) this.gaitClock += dt;
    for (const f of footTouchdowns(this.R, prevClock, this.gaitClock, this.pose, u, this.terrain.z, this.terrain.grid)) {
      this.feet[f.i] = [f.x, f.y]; this.footCount++; if (!f.ok) this.footFaults++;
      this.footsteps.push(f); if (this.footsteps.length > 48) this.footsteps.shift();
    }
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
    else if (this.t >= (this.R.maxTime ?? SIM.maxTime)) this.fail("timeout", `${this.R.maxTime ?? SIM.maxTime} s 시간 초과`);

    this.observe();
  }

  fail(code, text) { this.status = "failed"; this.failure = text; this.failCode = code; }
}

export function defaultOptions() {
  return {
    scenario: "curb_ramp", level: 0, seed: 0,
    robot: "swerve", poseComp: true, poseNoise: 0, wbcAware: true,
    perception: "occlusion", sensorHeight: 0.3, sensorRange: 5.0,
    shadowCeiling: true, depthPrior: true, evidence: true,
    unknownNear: 0, unknownNearCost: 1.0,
    stereo: false,
    planner: "guidance", controller: "mppi", genSteps: 10, pdFallback: false,
    mppi: { K: 256, T: 40, lambda: 0.5, noise: [0.4, 0.25, 0.6], w: { trav: 6.0, risk: 3.0, attitude: 20.0 } },
  };
}
