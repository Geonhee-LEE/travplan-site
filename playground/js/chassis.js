// 차체 기하 기준: travplan/sim/ground_truth.py(TP-0082)를 옮긴 것. cost 추정기와 코드를 공유하지 않는 기준이다.
// 칸마다 방위각 8개로 AntBot G50 차체를 세우고 세 가지를 본다. 네 바퀴 높이로 잰 자세(roll 0.30·pitch 0.35 rad),
// 바퀴 하나가 나머지 평면보다 0.08 m 넘게 들뜨는지, 바퀴 평면 + 지상고보다 높은 지형이 배 밑에 있는지.

export const CHASSIS = {
  wheelbase: 0.530, track: 0.401, wheelRadius: 0.103,
  clearance: 0.10,            // 가정값(공개된 값 없음, TP-0035). Python은 0.08–0.15 m로 스윕한다
  rollLimit: 0.30, pitchLimit: 0.35, maxWheelDrop: 0.08,
};
const YAWS = Array.from({ length: 8 }, (_, i) => (Math.PI * i) / 8);

// -> { failFrac, lethalAll, lethalAny, reason(0 없음, 1 자세, 2 바퀴 들뜸, 3 배 밑) }
export function chassisFeasibility(z, g, spec = CHASSIS) {
  const N = g.N, W = g.W, res = g.res;
  const hl = spec.wheelbase / 2, ht = spec.track / 2;
  const wheels = [[hl, ht], [hl, -ht], [-hl, ht], [-hl, -ht]];
  const belly = [];
  for (let x = -hl; x <= hl + 1e-9; x += res) for (let y = -ht; y <= ht + 1e-9; y += res) belly.push([x, y]);
  const nFail = new Uint8Array(N), reason = new Uint8Array(N);
  const Wm = (g.W - 1) * res, Hm = (g.H - 1) * res;
  const sample = (x, y) => g.sample(z, Math.min(Wm, Math.max(0, x)), Math.min(Hm, Math.max(0, y)), 0);   // 격자 밖은 가장자리 높이
  const tp = Math.tan;
  for (const yaw of YAWS) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const wr = wheels.map(([bx, by]) => [c * bx - s * by, s * bx + c * by]);
    const br = belly.map(([bx, by]) => [c * bx - s * by, s * bx + c * by]);
    for (let r = 0; r < g.H; r++) for (let q = 0; q < W; q++) {
      const i = r * W + q, cx = q * res, cy = r * res;
      const fl = sample(cx + wr[0][0], cy + wr[0][1]), fr = sample(cx + wr[1][0], cy + wr[1][1]);
      const rl = sample(cx + wr[2][0], cy + wr[2][1]), rr = sample(cx + wr[3][0], cy + wr[3][1]);
      const pitch = Math.atan((0.5 * (fl + fr - rl - rr)) / spec.wheelbase);
      const roll = Math.atan((0.5 * (fl + rl - fr - rr)) / spec.track);
      let why = 0;
      if (Math.abs(roll) > spec.rollLimit || Math.abs(pitch) > spec.pitchLimit) why = 1;
      const z0 = (fl + fr + rl + rr) / 4, tpch = tp(pitch), trol = tp(roll);
      if (!why) {
        const zs = [fl, fr, rl, rr];
        let hang = -Infinity;
        for (let k = 0; k < 4; k++) hang = Math.max(hang, z0 + wheels[k][0] * tpch + wheels[k][1] * trol - zs[k]);
        if (hang > spec.maxWheelDrop) why = 2;
      }
      if (!why) {
        for (let k = 0; k < br.length; k++) {
          const under = z0 + belly[k][0] * tpch + belly[k][1] * trol + spec.clearance;
          if (sample(cx + br[k][0], cy + br[k][1]) > under) { why = 3; break; }
        }
      }
      if (why) { nFail[i]++; if (!reason[i]) reason[i] = why; }
    }
  }
  const failFrac = new Float32Array(N), lethalAll = new Uint8Array(N), lethalAny = new Uint8Array(N);
  for (let i = 0; i < N; i++) { failFrac[i] = nFail[i] / YAWS.length; lethalAll[i] = nFail[i] === YAWS.length ? 1 : 0; lethalAny[i] = nFail[i] > 0 ? 1 : 0; }
  return { failFrac, lethalAll, lethalAny, reason };
}
