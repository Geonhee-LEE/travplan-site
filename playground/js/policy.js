// 학습 정책(TP-0128·TP-0129): travplan/control/tiny_policy.py를 옮긴 것.
// 브라우저는 학습하지 않는다. scripts/train_playground_policy.py가 ES로 가중치를 만들고,
// scripts/export_playground_policy.py가 policy_weights.js로 굽고, 여기서는 추론만 한다.
// 관측 50개와 forward가 파이썬과 글자 그대로 같아야 같은 가중치가 같은 로봇을 몬다
// (scripts/check_policy.mjs가 황금 벡터로, tests/test_tiny_policy.py가 파이썬 쪽을 고정한다).
import { attitude, clampAccel, clampTwist, sampleMap, stepPose } from "./control.js";
import { WEIGHTS } from "./policy_weights.js";

export const FORWARD_M = [0.0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4];
export const LATERAL_M = [-0.6, -0.3, 0.0, 0.3, 0.6];
export const ARC_M = [0.5, 1.0, 2.0, 3.0];
export const PATH_SCALE_M = 3.0;
export const REMAINING_MAX_M = 8.0;
export const ATT_SCALE_RAD = 0.5;
export const N_PATCH = FORWARD_M.length * LATERAL_M.length;        // 35
export const I_PATH = N_PATCH + 1;                                 // 36
export const I_TWIST = I_PATH + 2 * ARC_M.length + 1;              // 45
export const OBS_DIM = I_TWIST + 3 + 2;                            // 50
const I_ATT = OBS_DIM - 2;

const clip1 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);

// 관측 50개. 전부 몸체 좌표라 yaw가 바뀌어도 같은 지형은 같은 숫자로 보인다.
//  [0:35] 앞쪽 7 x 5 격자의 belief COST(격자 밖은 1), [35] 그 35칸의 평균 SIGMA,
//  [36:44] 경로 전방 네 점(호 0.5/1/2/3 m)의 몸체 좌표 / 3 m, [44] 남은 경로 / 8 m,
//  [45:48] 현재 twist / vmax, [48:50] 몸이 느끼는 pitch·roll / 0.5 rad.
// blind면 [0:36]을 0으로 둔다 — 지도를 아예 못 보는 대조군(TP-0129)이고, 자세는 IMU라 남는다.
export function buildObs(map, pose, twist, path, att, opt, out) {
  const vmax = opt.vmax, blind = !!opt.blind;
  const obs = out || new Float64Array(OBS_DIM);
  obs.fill(0);
  const c = Math.cos(pose[2]), s = Math.sin(pose[2]), m = [0, 0, 0, 0];
  if (!blind) {
    let i = 0, sig = 0;
    for (const fx of FORWARD_M) for (const fy of LATERAL_M) {
      sampleMap(map, pose[0] + c * fx - s * fy, pose[1] + s * fx + c * fy, m);
      obs[i++] = m[0]; sig += m[1];
    }
    obs[N_PATCH] = sig / N_PATCH;
  }
  // 경로: 가장 가까운 점부터 호 길이로 앞을 본다(control.js의 trackCommand와 같은 규칙).
  let i0 = 0, best = Infinity;
  for (let k = 0; k < path.length; k++) { const d = (path[k][0] - pose[0]) ** 2 + (path[k][1] - pose[1]) ** 2; if (d < best) { best = d; i0 = k; } }
  const arc = [0];
  for (let k = i0 + 1; k < path.length; k++) arc.push(arc[arc.length - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
  let col = I_PATH;
  for (const a of ARC_M) {
    let j = 0; while (j < arc.length && arc[j] < a) j++;            // numpy searchsorted(arc, a)
    const t = path[i0 + Math.min(j, arc.length - 1)];
    const dx = t[0] - pose[0], dy = t[1] - pose[1];
    obs[col++] = clip1((c * dx + s * dy) / PATH_SCALE_M);
    obs[col++] = clip1((-s * dx + c * dy) / PATH_SCALE_M);
  }
  obs[col] = Math.min(arc[arc.length - 1], REMAINING_MAX_M) / REMAINING_MAX_M;
  obs[I_TWIST] = twist[0] / vmax[0];
  obs[I_TWIST + 1] = twist[1] / vmax[1];
  obs[I_TWIST + 2] = twist[2] / vmax[2];
  obs[I_ATT] = clip1(att[0] / ATT_SCALE_RAD);
  obs[I_ATT + 1] = clip1(att[1] / ATT_SCALE_RAD);
  return obs;
}

export class TinyPolicy {
  constructor(spec) {
    if (spec.format !== "travplan-tiny-policy-1") throw new Error(`unknown policy format: ${spec.format}`);
    if (spec.obs.dim !== OBS_DIM) throw new Error(`obs dim ${spec.obs.dim} != ${OBS_DIM}`);
    this.spec = spec;
    this.robot = spec.robot; this.blind = !!spec.blind;
    this.vmax = spec.obs.vmax; this.vminX = spec.obs.vmin_x;
    this.layers = spec.layers.map((L) => ({ W: Float64Array.from(L.W), b: Float64Array.from(L.b), nIn: L.in, nOut: L.out }));
    this.buf = this.layers.map((L) => new Float64Array(L.nOut));
    this.obs = new Float64Array(OBS_DIM);
  }
  get nParams() { return this.layers.reduce((a, L) => a + L.W.length + L.b.length, 0); }

  // obs -> [-1, 1]^3. 파이썬 raw()와 같이 blind면 지도 입력 36개를 여기서도 지운다 — buildObs가
  // 이미 0으로 주지만, 다른 경로로 obs가 들어와도 두 쪽이 갈라지지 않게 같은 자리에 둔다.
  raw(obs) {
    let h = obs;
    if (this.blind) {
      if (!this._masked || this._masked.length !== obs.length) this._masked = new Float64Array(obs.length);
      this._masked.set(obs);
      this._masked.fill(0, 0, I_PATH);
      h = this._masked;
    }
    for (let l = 0; l < this.layers.length; l++) {
      const { W, b, nIn, nOut } = this.layers[l], o = this.buf[l];
      for (let j = 0; j < nOut; j++) {
        let acc = b[j];
        for (let k = 0; k < nIn; k++) acc += h[k] * W[k * nOut + j];
        o[j] = Math.tanh(acc);
      }
      h = o;
    }
    return h;
  }
  // 몸체 twist. 후진은 vminX 쪽이 짧으므로 따로 곱한다(파이썬과 같다).
  act(obs) {
    const a = this.raw(obs);
    return [a[0] >= 0 ? a[0] * this.vmax[0] : a[0] * Math.abs(this.vminX), a[1] * this.vmax[1], a[2] * this.vmax[2]];
  }
  control(map, pose, twist, path, att) {
    return this.act(buildObs(map, pose, twist, path, att, this, this.obs));
  }
}

const cache = new Map();
export function getPolicy(name) {
  if (!cache.has(name)) {
    const spec = WEIGHTS[name];
    if (!spec) return null;
    cache.set(name, new TinyPolicy(spec));
  }
  return cache.get(name);
}
// 로봇 종류 + 지도 사용 여부로 가중치를 고른다. 없으면 null(호출부가 pure pursuit로 떨어진다).
export function policyFor(robot, blind) {
  return getPolicy(`tiny-${robot}${blind ? "-blind" : ""}`);
}
export function policyNames() { return Object.keys(WEIGHTS); }

// 목표까지 직선을 0.05 m 간격으로 깐 것. 지도 없는 대조군은 이것만 받는다(학습 때와 같은 샘플 간격).
export function straightPath(from, goal, res = 0.05) {
  const d = Math.hypot(goal[0] - from[0], goal[1] - from[1]);
  const n = Math.max(2, Math.floor(d / res) + 1), out = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); out.push([from[0] + t * (goal[0] - from[0]), from[1] + t * (goal[1] - from[1])]); }
  return out;
}

// 화면에 그릴 예측 궤적. 믿음 지도 위에서 정책을 T스텝 굴린다(MPPI의 nominal 자리).
// 자세는 그 지도의 기울기에서 다시 구한다 — 미래의 IMU는 없으니 지도로 대신한다.
export function predict(policy, map, pose, twist, path, T = 20, dt = 0.1) {
  let p = pose.slice(), u = twist.slice();
  const out = [[p[0], p[1]]], m = [0, 0, 0, 0];
  for (let t = 0; t < T; t++) {
    sampleMap(map, p[0], p[1], m);
    const att = attitude(m[2], m[3], p[2]);
    u = clampAccel(clampTwist(policy.control(map, p, u, path, att)), u, dt);
    p = stepPose(p[0], p[1], p[2], u, dt);
    out.push([p[0], p[1]]);
  }
  return out;
}
