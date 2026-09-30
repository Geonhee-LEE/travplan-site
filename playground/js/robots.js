// 로봇 종류. 운동학(몸체 twist 한계), traversability 한계, 전복 한계, 센서 높이, 걸음새가 만드는 몸체 흔들림.
// 흔들림은 센서 자세를 흔들고, elevation mapping이 그것을 얼마나 견디는지가 이 모듈의 요점이다.
// 값은 공개 제원을 참고한 대표값이다(사족: Unitree Go2·ANYmal급, 바퀴 사족: Go2-W·ANYmal on wheels급). 연구 비교용 가정이다.
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
};

// 전역 한계(SWERVE, TRAV)를 로봇에 맞춘다. 지도는 이 뒤에 다시 만들어야 한다.
export function applyRobot(key) {
  const R = ROBOTS[key] || ROBOTS.swerve;
  SWERVE.vmax = R.vmax.slice(); SWERVE.amax = R.amax.slice(); SWERVE.vminX = R.vminX;
  Object.assign(TRAV, R.trav);
  return R;
}

// 걸음새 흔들림: 트롯은 한 주기에 두 번 디디므로 높이·pitch는 2f, roll은 f. 진폭은 속도에 비례(서 있으면 20%).
export function gaitOffset(R, t, speed) {
  if (!R.gait) return { dz: 0, pitch: 0, roll: 0 };
  const G = R.gait, s = 0.2 + 0.8 * Math.min(1, speed / 0.6), ph = 2 * Math.PI * G.freq * t;
  return { dz: G.bob * s * Math.cos(2 * ph), pitch: G.pitch * s * Math.sin(2 * ph + 0.7), roll: G.roll * s * Math.sin(ph) };
}
