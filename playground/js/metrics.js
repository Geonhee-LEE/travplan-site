// 주행 한 번 -> Python metrics.csv 한 줄(travplan/eval/metrics.py의 EpisodeMetrics, eval/runner.py의 log).
// 같은 이름은 같은 정의로 계산한다. 시간 열(plan_ms·control_ms)은 브라우저에서 잰 값이라 크기를 Python과 비교하지 않는다.
// JS에 없는 값은 빈 칸으로 둔다. DOM을 쓰지 않는다.
import { SIM } from "./sim.js";
import { DIFFICULTY } from "./terrain.js";

// tests/test_playground_state.py가 EpisodeMetrics의 필드 순서와 같은지 본다.
export const METRIC_COLUMNS = [
  "planner", "scenario", "seed", "success", "failure", "time_s", "path_len_m", "max_roll_deg", "max_pitch_deg",
  "mean_gt_cost", "rms_jerk", "plan_ms_mean", "plan_ms_p95", "control_ms_mean", "min_obs_clear_m",
];
const FAILURE = { lethal: "lethal", tipover: "tip", collision: "collision", timeout: "timeout" };   // JS failCode -> Python failure
const DEG = 180 / Math.PI;

// numpy.percentile(a, q)의 기본(linear)
function percentile(a, q) {
  const s = a.slice().sort((x, y) => x - y), i = (q / 100) * (s.length - 1), lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

// 스텝마다 world.step() 직후에 after(world, k0)을 부른다. k0은 그 스텝을 시작할 때의 world.k다.
// run_episode처럼 재계획은 k % replanEvery == 0 스텝에서만 센다(reset의 첫 계획은 세지 않는다).
export class EpisodeMeter {
  constructor() { this.tw = []; this.jerkSq = 0; this.jerkN = 0; this.plan = []; this.ctrl = 0; this.n = 0; }
  after(world, k0) {
    if (k0 % SIM.replanEvery === 0) this.plan.push(world.ms.plan);
    this.ctrl += world.ms.ctrl; this.n++;
    this.tw.push([world.twist[0], world.twist[1]]);
    if (this.tw.length > 3) this.tw.shift();
    if (this.tw.length === 3) {                 // np.diff(twist[:, :2], n=2) / dt**2
      const [a, b, c] = this.tw, d2 = SIM.dt * SIM.dt, jx = (c[0] - 2 * b[0] + a[0]) / d2, jy = (c[1] - 2 * b[1] + a[1]) / d2;
      this.jerkSq += jx * jx + jy * jy; this.jerkN++;
    }
  }
  // 끝난 주행 -> { 열 이름: 값 }. tags.edited면 scenario에 '+edit'를 붙인다(Python에는 지형 편집이 없다).
  row(world, tags = {}) {
    const o = world.opts, s = world.stats, k = world.k, xy = world.trail.slice(1);   // log["xy"]는 스텝 뒤 위치만 담는다
    let len = 0;
    for (let i = 1; i < xy.length; i++) len += Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]);
    const plan = this.plan.length ? this.plan : [0];
    const sc = o.scenario + (DIFFICULTY[o.scenario] && o.level > 0 ? `@L${o.level}` : "")
      + ((world.pedsInit || []).length ? "+ped" : "") + (tags.edited ? "+edit" : "");
    return {
      planner: `${o.planner}+${o.controller}`, scenario: sc, seed: o.seed,
      success: world.status === "reached" ? "True" : "False",
      failure: world.status === "reached" ? "" : FAILURE[world.failCode] || "",
      time_s: k * SIM.dt, path_len_m: len,
      max_roll_deg: k ? s.maxRoll * DEG : 0, max_pitch_deg: k ? s.maxPitch * DEG : 0,
      mean_gt_cost: k ? s.gtCostSum / s.steps : 0,
      rms_jerk: k > 3 && this.jerkN ? Math.sqrt(this.jerkSq / this.jerkN) : 0,
      plan_ms_mean: plan.reduce((a, b) => a + b, 0) / plan.length, plan_ms_p95: percentile(plan, 95),
      control_ms_mean: this.n ? this.ctrl / this.n : 0,
      min_obs_clear_m: Number.isFinite(s.minClear) ? s.minClear : "nan",   // 보행자가 없으면 Python처럼 nan
    };
  }
}

const cell = (v) => {
  if (v === null || v === undefined) return "";
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
// 줄 끝은 Python csv 모듈처럼 CRLF다.
export function toCsv(rows) {
  return [METRIC_COLUMNS.join(","), ...rows.map((r) => METRIC_COLUMNS.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
