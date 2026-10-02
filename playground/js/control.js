// Controller: robot/swerve.py, control/tracker.py, control/mppi/(mppi.py, costs.py)를 옮긴 것.
import { Rng, clamp, wrap } from "./core.js";
import { TRAV } from "./travmap.js";

export const SWERVE = { vmax: [1.5, 0.6, 1.2], amax: [1.0, 0.8, 2.0], vminX: -0.3 };

export function clampTwist(u) {
  return [clamp(u[0], SWERVE.vminX, SWERVE.vmax[0]), clamp(u[1], -SWERVE.vmax[1], SWERVE.vmax[1]), clamp(u[2], -SWERVE.vmax[2], SWERVE.vmax[2])];
}
export function clampAccel(u, p, dt) {
  return [0, 1, 2].map((k) => p[k] + clamp(u[k] - p[k], -SWERVE.amax[k] * dt, SWERVE.amax[k] * dt));
}
// 몸체 twist -> 다음 자세(중간점 yaw)
export function stepPose(x, y, yaw, u, dt) {
  const ym = yaw + 0.5 * u[2] * dt, c = Math.cos(ym), s = Math.sin(ym);
  return [x + (c * u[0] - s * u[1]) * dt, y + (s * u[0] + c * u[1]) * dt, yaw + u[2] * dt];
}

// 지도 위 한 점의 채널: cost, sigma, 경사(gx, gy). 격자 밖은 치명.
export function sampleMap(map, x, y, out) {
  const g = map.grid, fx = x / g.res, fy = y / g.res;
  if (fx < 0 || fy < 0 || fx > g.W - 1 || fy > g.H - 1) { out[0] = 1; out[1] = 1; out[2] = 0; out[3] = 0; return out; }
  const c0 = Math.min(g.W - 2, fx | 0), r0 = Math.min(g.H - 2, fy | 0), tx = fx - c0, ty = fy - r0, i = r0 * g.W + c0, W = g.W;
  const w00 = (1 - tx) * (1 - ty), w01 = tx * (1 - ty), w10 = (1 - tx) * ty, w11 = tx * ty;
  const s = (a) => a[i] * w00 + a[i + 1] * w01 + a[i + W] * w10 + a[i + W + 1] * w11;
  out[0] = s(map.cost); out[1] = s(map.sigma); out[2] = s(map.gx); out[3] = s(map.gy);
  return out;
}
export function attitude(gx, gy, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [Math.atan(c * gx + s * gy), Math.atan(-s * gx + c * gy)];   // [pitch, roll]
}

// ------------------------------------------------------------------ pure pursuit
export const TRACKER = { lookahead: 0.6, vRef: 1.0, kYaw: 2.0, slowdown: 1.0 };

export function trackCommand(pose, path) {
  let i0 = 0, best = Infinity;
  for (let i = 0; i < path.length; i++) { const d = Math.hypot(path[i][0] - pose[0], path[i][1] - pose[1]); if (d < best) { best = d; i0 = i; } }
  // tracker.py: 가장 가까운 점부터 호 길이가 lookahead 이상인 첫 점(없으면 끝점)
  let s = 0, j = path.length - 1, found = false;
  for (let i = i0 + 1; i < path.length; i++) {
    s += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (!found && s >= TRACKER.lookahead) { j = i; found = true; }
  }
  if (path.length === i0 + 1) j = i0;
  let remaining = s;
  const t = path[Math.min(j, path.length - 1)], dx = t[0] - pose[0], dy = t[1] - pose[1], dist = Math.hypot(dx, dy);
  remaining = Math.max(remaining, dist);
  const speed = TRACKER.vRef * Math.min(1, remaining / TRACKER.slowdown);
  const ux = dx / Math.max(dist, 1e-6), uy = dy / Math.max(dist, 1e-6), c = Math.cos(pose[2]), sn = Math.sin(pose[2]);
  const yawDes = dist > 0.1 ? Math.atan2(dy, dx) : pose[2];
  return clampTwist([(c * ux + sn * uy) * speed, (-sn * ux + c * uy) * speed, TRACKER.kYaw * wrap(yawDes - pose[2])]);
}

export function trackerControls(pose0, twist0, path, T, dt) {
  let p = pose0.slice(), up = twist0.slice();
  const U = new Float32Array(T * 3);
  for (let t = 0; t < T; t++) {
    const u = clampAccel(trackCommand(p, path), up, dt);
    U.set(u, t * 3); p = stepPose(p[0], p[1], p[2], u, dt); up = u;
  }
  return U;
}

// ------------------------------------------------------------------ MPPI
// lag > 0(TP-0135): 롤아웃이 하체 정책(GR00T 분리형 WBC)의 닫힌 루프를 안다 — 명령 c는 1차 지연(시정수 lag)으로
// 몸체 twist가 되고, |c| < lagStand면 서기 정책이 0을 향한다. 그때 평균은 몸체 twist가 아니라 명령으로 낸다.
// lag = 0이면 이전과 같다(비트 단위).
export const MPPI_DEFAULT = {
  K: 256, T: 40, dt: 0.1, lambda: 0.5, noise: [0.4, 0.25, 0.6], corr: 0.7, prior: 0.3, lag: 0, lagStand: 0,
  w: { deviation: 2.0, progress: 4.0, trav: 6.0, risk: 3.0, attitude: 20.0 },
};

export class MPPI {
  constructor(cfg = {}, seed = 0) {
    const d = structuredClone(MPPI_DEFAULT);
    this.cfg = { ...d, ...cfg, w: { ...d.w, ...(cfg.w || {}) } };
    this.rng = new Rng(seed + 101);
    this.reset();
  }
  reset() { this.U = new Float32Array(this.cfg.T * 3); }

  _reference(path, pose) {
    // 가장 가까운 점부터 0.1 m 간격, 8 m까지
    let i0 = 0, best = Infinity;
    for (let i = 0; i < path.length; i++) { const d = Math.hypot(path[i][0] - pose[0], path[i][1] - pose[1]); if (d < best) { best = d; i0 = i; } }
    const p = path.slice(i0).length >= 2 ? path.slice(i0) : path.slice(-2);
    const ref = [p[0].slice()], arc = [0];
    let s = 0, next = 0.1;
    for (let i = 1; i < p.length && s < 8.0; i++) {
      const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      while (next <= s + seg && next <= 8.0) { const a = (next - s) / Math.max(seg, 1e-6); ref.push([p[i - 1][0] + a * (p[i][0] - p[i - 1][0]), p[i - 1][1] + a * (p[i][1] - p[i - 1][1])]); arc.push(next); next += 0.1; }
      s += seg;
    }
    if (ref.length < 2) { ref.push(p[p.length - 1].slice()); arc.push(Math.hypot(ref[1][0] - ref[0][0], ref[1][1] - ref[0][1])); }
    return { ref, arc };
  }

  // req: { pose, twist, path, goal, map, peds } -> { u, nominal, samples, costs, info }
  control(req) {
    const t0 = performance.now();
    const { K, T, dt, lambda, noise, corr, prior, w, lag, lagStand } = this.cfg;
    const al = lag > 0 ? 1 - Math.exp(-dt / lag) : 1;
    const body = (c, up) => {                         // 명령 -> 이번 스텝의 몸체 twist
      if (!(lag > 0)) return clampAccel(c, up, dt);
      const tg = Math.hypot(c[0], c[1], c[2]) < lagStand ? [0, 0, 0] : c;
      return clampAccel([up[0] + al * (tg[0] - up[0]), up[1] + al * (tg[1] - up[1]), up[2] + al * (tg[2] - up[2])], up, dt);
    };
    const { ref, arc } = this._reference(req.path, req.pose);
    const endGap = Math.hypot(req.path[req.path.length - 1][0] - req.goal[0], req.path[req.path.length - 1][1] - req.goal[1]);
    const reachesGoal = endGap < 0.5;
    const Uref = trackerControls(req.pose, req.twist, req.path, T, dt);
    const kp = Math.floor(prior * K);

    // 샘플: AR(1) 상관 잡음. 각 묶음의 첫 샘플은 평균 그대로, 마지막 샘플은 정지.
    const need = K * T * 3;
    if (!this.buf || this.buf.V.length !== need || this.buf.S.length !== K) {
      this.buf = { V: new Float32Array(need), A: new Float32Array(need), P: new Float32Array(K * (T + 1) * 3), S: new Float32Array(K), r: new Float32Array(T),
        terms: Object.fromEntries(["reference", "trav", "risk", "attitude", "control", "approach"].map((n) => [n, new Float32Array(K)])) };
    }
    const { V, A, P, S, r, terms } = this.buf, a = corr, b = Math.sqrt(1 - a * a);
    for (let k = 0; k < K; k++) {
      const mean = k < K - kp ? this.U : Uref, first = k === 0 || k === K - kp;
      let e0 = 0, e1 = 0, e2 = 0;
      for (let t = 0; t < T; t++) {
        const n0 = this.rng.normal() * noise[0], n1 = this.rng.normal() * noise[1], n2 = this.rng.normal() * noise[2];
        if (t === 0) { e0 = n0; e1 = n1; e2 = n2; } else { e0 = a * e0 + b * n0; e1 = a * e1 + b * n1; e2 = a * e2 + b * n2; }
        const o = (k * T + t) * 3;
        V[o] = mean[t * 3] + (first ? 0 : e0); V[o + 1] = mean[t * 3 + 1] + (first ? 0 : e1); V[o + 2] = mean[t * 3 + 2] + (first ? 0 : e2);
        if (k === K - 1) { V[o] = 0; V[o + 1] = 0; V[o + 2] = 0; }
      }
    }

    const m = [0, 0, 0, 0], peds = req.peds || [];
    const topk = Math.max(1, Math.ceil(0.2 * T));
    for (let k = 0; k < K; k++) {
      let x = req.pose[0], y = req.pose[1], yaw = req.pose[2], up = req.twist;
      const po = k * (T + 1) * 3; P[po] = x; P[po + 1] = y; P[po + 2] = yaw;
      let devSum = 0, travSum = 0, lethal = false, attSoft = 0, attHard = false, dynHard = false, appr = 0;
      let smooth = 0, lat = 0, rev = 0, dmin = 0, jmin = 0;
      for (let t = 0; t < T; t++) {
        const o = (k * T + t) * 3;
        const c = clampTwist([V[o], V[o + 1], V[o + 2]]), u = body(c, up), keep = lag > 0 ? c : u;
        [x, y, yaw] = stepPose(x, y, yaw, u, dt);
        A[o] = keep[0]; A[o + 1] = keep[1]; A[o + 2] = keep[2];
        const q = po + (t + 1) * 3; P[q] = x; P[q + 1] = y; P[q + 2] = yaw;
        // reference: 경로까지 거리
        dmin = Infinity; jmin = 0;
        for (let j = 0; j < ref.length; j++) { const d = (ref[j][0] - x) ** 2 + (ref[j][1] - y) ** 2; if (d < dmin) { dmin = d; jmin = j; } }
        dmin = Math.sqrt(dmin); devSum += dmin;
        // 지형
        sampleMap(req.map, x, y, m);
        travSum += m[0] * dt; if (m[0] >= TRAV.lethal) lethal = true;
        let dyn = 0;
        for (const p of peds) {
          const tt = (t + 1) * dt, cx = p.x + p.vx * tt, cy = p.y + p.vy * tt, rad = p.r + 0.15 * tt;
          const c = clamp(1 - (Math.hypot(x - cx, y - cy) - rad) / 0.6, 0, 1); if (c > dyn) dyn = c;
        }
        if (dyn >= 1) dynHard = true;
        r[t] = m[0] + 0.7 * m[1] + dyn;
        const [pitch, roll] = attitude(m[2], m[3], yaw);
        const ar = Math.abs(roll), ap = Math.abs(pitch);
        attSoft += (Math.max(0, ar - 0.08) ** 2 + Math.max(0, ap - 0.12) ** 2) * dt;
        if (ar > 0.25 || ap > 0.30) attHard = true;
        if (reachesGoal) { const v = Math.hypot(u[0], u[1]), dg = Math.hypot(x - req.goal[0], y - req.goal[1]); const ex = Math.max(0, v - Math.sqrt(2 * 0.6 * dg)); appr += ex * ex * dt; }
        if (t > 0) { const du0 = (u[0] - up[0]) / dt, du1 = (u[1] - up[1]) / dt, du2 = (u[2] - up[2]) / dt; smooth += 0.5 * du0 * du0 + 0.5 * du1 * du1 + 0.2 * du2 * du2; }
        lat += u[1] * u[1]; rev += Math.min(0, u[0]) ** 2;
        up = u;
      }
      const remaining = arc[arc.length - 1] - arc[jmin] + dmin;
      terms.reference[k] = w.deviation * devSum / T + w.progress * remaining;
      terms.trav[k] = w.trav * travSum + (lethal ? 1e3 : 0);
      let cv = 0;                                       // CVaR: 큰 값 topk개의 평균(부분 선택)
      for (let i = 0; i < topk; i++) {
        let bi = i; for (let jj = i + 1; jj < T; jj++) if (r[jj] > r[bi]) bi = jj;
        const tmp = r[i]; r[i] = r[bi]; r[bi] = tmp; cv += r[i];
      }
      terms.risk[k] = w.risk * cv / topk + (dynHard ? 1e3 : 0);
      terms.attitude[k] = w.attitude * attSoft + (attHard ? 1e3 : 0);
      terms.control[k] = (smooth / Math.max(1, T - 1)) * dt + 0.3 * lat / T + 1.0 * rev / T;
      terms.approach[k] = 5.0 * appr;
      S[k] = terms.reference[k] + terms.trav[k] + terms.risk[k] + terms.attitude[k] + terms.control[k] + terms.approach[k];
    }

    let smin = Infinity, best = 0;
    for (let k = 0; k < K; k++) if (S[k] < smin) { smin = S[k]; best = k; }
    const wts = new Float32Array(K); let wsum = 0;
    for (let k = 0; k < K; k++) { wts[k] = Math.exp(-(S[k] - smin) / lambda); wsum += wts[k]; }
    const U = new Float32Array(T * 3);
    for (let k = 0; k < K; k++) { const wk = wts[k] / wsum; if (wk < 1e-9) continue; for (let i = 0; i < T * 3; i++) U[i] += wk * A[k * T * 3 + i]; }

    // 갱신된 평균으로 한 번 더 굴린 것이 실제 계획이다.
    let x = req.pose[0], y = req.pose[1], yaw = req.pose[2], up = req.twist;
    const nominal = [[x, y]], Uout = new Float32Array(T * 3);
    for (let t = 0; t < T; t++) {
      const c = clampTwist([U[t * 3], U[t * 3 + 1], U[t * 3 + 2]]), u = body(c, up);
      Uout.set(lag > 0 ? c : u, t * 3); [x, y, yaw] = stepPose(x, y, yaw, u, dt); nominal.push([x, y]); up = u;
    }
    this.U = new Float32Array(T * 3);
    this.U.set(Uout.subarray(3)); this.U.set(Uout.subarray((T - 1) * 3), (T - 1) * 3);   // warm start

    const stride = Math.max(1, Math.floor(K / 64)), samples = [];
    for (let k = 0; k < K; k += stride) samples.push({ k: 0, s: S[k], P: P.slice(k * (T + 1) * 3, (k + 1) * (T + 1) * 3) });
    const breakdown = {}; for (const [n, v] of Object.entries(terms)) breakdown[n] = v[best];
    return {
      u: [Uout[0], Uout[1], Uout[2]], nominal, samples, T, smin, sbest: best, breakdown, ref,
      ms: performance.now() - t0,
    };
  }
}

export const CONTROLLERS = {
  mppi: { label: "MPPI", note: "지형 투영 롤아웃 K개를 비용 6항(경로, 지형, 위험 CVaR, 자세, 제어, 목표 접근)으로 가중 평균한다." },
  tracker: { label: "Pure pursuit", note: "경로만 따라간다. 지형과 보행자를 스스로 피하지 않는다." },
  learned: { label: "학습 정책(ES)", note: "파이썬에서 진화 전략으로 학습한 1.7k 파라미터 MLP. 입력 50개(앞쪽 7x5 지형 비용, 경로 네 점, 현재 twist, 몸이 느끼는 pitch·roll)뿐이고 롤아웃이 없다(TP-0128)." },
  blind: { label: "지도 없는 보행(대조군)", note: "같은 MLP인데 지형 입력 36개를 0으로 받고 경로 대신 목표 직선만 받는다. 고유수용(pitch·roll)만으로 간다 — 사족은 어느 정도 가고 바퀴는 못 간다(TP-0129)." },
};
