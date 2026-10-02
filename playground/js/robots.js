// 로봇 종류. 운동학(몸체 twist 한계), traversability 한계, 전복 한계, 센서 높이, 걸음새가 만드는 몸체 흔들림.
// 흔들림은 센서 자세를 흔들고, elevation mapping이 그것을 얼마나 견디는지가 이 모듈의 요점이다.
// 값은 공개 제원을 참고한 대표값이다(사족: Unitree Go2·ANYmal급, 바퀴 사족: Go2-W·ANYmal on wheels급, 휴머노이드: Unitree G1급).
// 연구 비교용 가정이다.
//
// 휴머노이드의 이동은 NVlabs/GR00T-WholeBodyControl의 분리형 WBC(decoupled whole-body control)를 본뜬다(TP-0135).
// 상위가 navigate_cmd(vx, vy, ωz)를 내면 하체 RL 정책이 그것을 따라 걷고, 상체는 따로(여기서는 팔 흔들기만) 움직인다.
// 관절 수준 정책은 옮기지 않았다. 그 닫힌 루프의 거동만 흉내 낸다:
//   - 명령 한계: KeyboardNavigationPolicy 기본값 0.5 m/s · 0.5 rad/s
//   - |cmd| < 0.05이면 서기 정책(policy_1), 아니면 걷기 정책(policy_2) — 서 있으면 걸음 시계도 멈춘다
//   - 걸음 시계 freq_cmd 1.5 Hz(gait_indices += 0.02 · freq, 50 Hz), 두 발 위상차 0.5, 골반 높이 height_cmd 0.74 m
//   - 몸통은 rpy_cmd = 0으로 곧게 선다 — 지형이 기울어도 머리 센서는 걸음새 흔들림만 탄다
//   - 하체 정책의 속도 추종은 1차 지연(시정수 0.4 s, 가정)으로 둔다
import { SWERVE } from "./control.js";
import { TRAV } from "./travmap.js";

export const ROBOTS = {
  swerve: {
    label: "스워브(바퀴)", note: "travplan 기준 로봇(AntBot급 비동축 스워브). 턱 8 cm까지. 몸체는 지형만 따라 기운다.",
    vmax: [1.5, 0.6, 1.2], amax: [1.0, 0.8, 2.0], vminX: -0.3,
    trav: { maxSlope: 0.26, maxStep: 0.08, maxRough: 0.04 },
    tip: { roll: 0.30, pitch: 0.35 }, sensorH: 0.30, body: [0.70, 0.50], kind: "wheel",
    gait: null,
  },
  quadruped: {
    label: "사족 보행", note: "걸어서 턱 20 cm·경사 30°까지 넘는다. 걸음마다 몸체가 위아래(2 cm)와 pitch·roll(2–3°)로 흔들린다.",
    vmax: [1.0, 0.5, 1.0], amax: [1.0, 1.0, 2.0], vminX: -0.5,
    trav: { maxSlope: 0.52, maxStep: 0.20, maxRough: 0.08 },
    tip: { roll: 0.50, pitch: 0.55 }, sensorH: 0.45, body: [0.70, 0.40], kind: "legs",
    gait: { freq: 2.2, bob: 0.020, pitch: 0.040, roll: 0.035 },
  },
  wheelLeg: {
    label: "바퀴 달린 사족", note: "다리 끝이 바퀴. 굴러서 빠르고(1.5 m/s) 다리로 턱 15 cm까지 넘는다. 흔들림은 걷는 사족의 약 1/3.",
    vmax: [1.5, 0.5, 1.2], amax: [1.2, 1.0, 2.0], vminX: -0.5,
    trav: { maxSlope: 0.44, maxStep: 0.15, maxRough: 0.06 },
    tip: { roll: 0.45, pitch: 0.50 }, sensorH: 0.45, body: [0.70, 0.40], kind: "wheellegs",
    gait: { freq: 1.2, bob: 0.006, pitch: 0.012, roll: 0.010 },
  },
  humanoid: {
    label: "휴머노이드(G1급)", note: "Unitree G1급, 걸음은 GR00T 분리형 WBC를 본뜬다: 속도 명령(0.5 m/s·0.5 rad/s 한계)을 하체 정책이 0.4 s 지연으로 따르고 0.05 아래면 선다. 걸음 1.5 Hz, 골반 0.74 m, 머리 LiDAR 1.2 m라 멀리 본다. 턱 15 cm·경사 20°.",
    vmax: [0.5, 0.5, 0.5], amax: [0.8, 0.8, 1.5], vminX: -0.5,
    trav: { maxSlope: 0.35, maxStep: 0.15, maxRough: 0.06 },
    tip: { roll: 0.30, pitch: 0.35 }, sensorH: 1.2, body: [0.26, 0.44], kind: "humanoid",
    gait: { freq: 1.5, bob: 0.025, pitch: 0.015, roll: 0.045 },
    wbc: { tau: 0.4, stand: 0.05, pelvis: 0.74, upright: true },
    maxTime: 90,                                            // 0.5 m/s라 스워브(1.5 m/s, 60 s)와 비슷한 거리 예산을 준다
    // L1 간이의 LiDAR: G1 머리의 Livox MID-360은 뒤집어 달려 수직 시야 −7°~+52°가 −52°~+7°가 된다.
    // 비반복 주사를 채널 32개로 근사한다(가정). 숙임 0°.
    lidar: { channels: 32, vfov: [-52, 7], pitch: 0 },
    feet: [[0.0, 0.0, 0.10], [0.5, 0.0, -0.10]],          // [위상 오프셋, 몸체 x, y]: 왼발, 오른발
  },
};

// 사족의 발: 트롯은 대각선 쌍(왼앞·오른뒤 / 오른앞·왼뒤)이 반 주기씩 엇갈린다. 바퀴 사족은 굴러가므로 발자국이 없다.
ROBOTS.quadruped.feet = [[0.0, 0.26, 0.25], [0.5, 0.26, -0.25], [0.5, -0.26, 0.25], [0.0, -0.26, -0.25]];

// 전역 한계(SWERVE, TRAV)를 로봇에 맞춘다. 지도는 이 뒤에 다시 만들어야 한다.
export function applyRobot(key) {
  const R = ROBOTS[key] || ROBOTS.swerve;
  SWERVE.vmax = R.vmax.slice(); SWERVE.amax = R.amax.slice(); SWERVE.vminX = R.vminX;
  Object.assign(TRAV, R.trav);
  return R;
}

// GR00T 분리형 WBC의 하체 정책을 닫힌 루프 거동으로 흉내 낸다(TP-0135). cmd는 이미 한계로 자른 navigate_cmd다.
// -> { u: 이번 스텝의 몸체 twist, standing }. 서기 정책은 0을 향해 같은 지연으로 멈춘다.
export function wbcTrack(R, cmd, twist, dt) {
  const W = R.wbc, standing = Math.hypot(cmd[0], cmd[1], cmd[2]) < W.stand;   // np.linalg.norm(cmd) < 0.05
  const a = 1 - Math.exp(-dt / W.tau), tgt = standing ? [0, 0, 0] : cmd;
  return { u: [0, 1, 2].map((i) => twist[i] + a * (tgt[i] - twist[i])), standing };
}

// 발 디딤: 걸음 시계 위상이 반 주기를 넘을 때(흔들던 발이 내려올 때) 그 발이 땅에 닿는다.
// 위치 = 엉덩이 + Raibert 보정(속도 × 디딤 시간 / 2). 디딘 칸의 경사가 30°를 넘거나 몸 아래 지면과의 높이차가
// 로봇의 턱 한계를 넘으면 '나쁜 디딤'이다. 실패 판정은 바꾸지 않고(몸 중심의 cost·자세 그대로) 기록만 한다.
export function footTouchdowns(R, prevClock, clock, pose, twist, z, g) {
  if (!R.feet || !R.gait) return [];
  const f = R.gait.freq, out = [], [x, y, yaw] = pose, c = Math.cos(yaw), s = Math.sin(yaw);
  const tStance = 0.5 / f, vx = c * twist[0] - s * twist[1], vy = s * twist[0] + c * twist[1];
  const ground = g.sample(z, x, y, 0), lim = Math.tan(0.52);
  for (let i = 0; i < R.feet.length; i++) {
    const [off, bx, by] = R.feet[i], a = prevClock * f + off, b = clock * f + off;
    if (Math.floor(a - 0.5) === Math.floor(b - 0.5)) continue;                // 반 주기 경계를 넘지 않았다
    const fx = x + c * bx - s * by + vx * tStance / 2, fy = y + s * bx + c * by + vy * tStance / 2;
    const zf = g.sample(z, fx, fy, 0), h = g.res;
    const sl = Math.hypot(g.sample(z, fx + h, fy, 0) - g.sample(z, fx - h, fy, 0), g.sample(z, fx, fy + h, 0) - g.sample(z, fx, fy - h, 0)) / (2 * h);
    out.push({ i, x: fx, y: fy, yaw, side: by >= 0 ? 1 : -1, ok: sl <= lim && Math.abs(zf - ground) <= R.trav.maxStep });
  }
  return out;
}

// 걸음새 흔들림: 트롯은 한 주기에 두 번 디디므로 높이·pitch는 2f, roll은 f. 진폭은 속도에 비례(서 있으면 20%).
// t는 걸음 시계다. 사족·바퀴 사족은 시뮬 시각과 같고, 휴머노이드는 서 있는 동안 멈춘다.
export function gaitOffset(R, t, speed) {
  if (!R.gait) return { dz: 0, pitch: 0, roll: 0 };
  const G = R.gait, s = 0.2 + 0.8 * Math.min(1, speed / 0.6), ph = 2 * Math.PI * G.freq * t;
  return { dz: G.bob * s * Math.cos(2 * ph), pitch: G.pitch * s * Math.sin(2 * ph + 0.7), roll: G.roll * s * Math.sin(ph) };
}
