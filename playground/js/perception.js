// "L1 간이" 인식: 합성 LiDAR(sim/lidar.py) + 칸별 높이 융합(elevation_mapping_cupy의 핵심을 줄인 것).
// 레이를 지형 위로 진행시켜 처음 부딪힌 점을 얻고, 점마다 칸 높이를 칼만으로 융합해 분산을 유지한다.
// 지형에 닿기 전에 칸 위를 지나간 레이 높이는 그 칸의 상한(upper bound)이 된다.
// 실제 매퍼와 달리 드리프트 보정, 가시성 정리(ray casting clear), 이상치 제거는 없다.

export const LIDAR = {
  channels: 16,
  vfov: [-15, 15],            // 수직 시야 [deg], 센서 기준
  pitch: -10,                 // 센서를 숙인 각 [deg](TP-0060 설계: LiDAR는 먼저 숙인다)
  hres: 1.0,                  // 수평 해상도 [deg], 360°
  step: 0.04,                 // 레이 진행 간격 [m]
  noise0: 0.005, noiseK: 0.002, // 거리 d에서 높이 잡음 σ = noise0 + noiseK·d [m]. 크면 좁은 턱 창(0.30 m)에서 잡음이 턱으로 읽힌다
};

// 전면 스테레오(travplan/sim/stereo.py, TP-0065): 핀홀 격자 레이, 깊이 잡음 σ_Z = Z²·Δd/(f·B)
export const STEREO = {
  baseline: 0.12, focal: 640, dispStd: 0.25, hfov: 90, vfov: 60, cols: 48, rows: 24,
  pitch: -30, mountX: 0.25, maxRange: 4.0, step: 0.04,
};

export class ElevationMap {
  constructor(g) {
    this.g = g;
    this.h = new Float32Array(g.N).fill(NaN);        // 융합한 높이
    this.v = new Float32Array(g.N).fill(Infinity);   // 분산 [m²]
    this.upper = new Float32Array(g.N).fill(Infinity);
    this.points = [];                                // 마지막 스캔의 점(그리기용, 일부만)
  }

  // 전면 스테레오 한 번: 점을 같은 칼만 융합에 넣는다. T = 참 몸체 자세(레이를 쏜다), E = 매퍼가 믿는 몸체 자세(점을 놓는다).
  // camZ = 몸체 원점(지면 접점) 위 카메라 높이.
  stereo(z, T, E, camZ, rng) {
    const g = this.g, C = STEREO, res = g.res, W = g.W, Wm = (g.W - 1) * res, Hm = (g.H - 1) * res;
    const mount = [C.mountX, 0, camZ], ot = apply(T, mount), oe = apply(E, mount);
    const tx = Math.tan((C.hfov * Math.PI) / 360), ty = Math.tan((C.vfov * Math.PI) / 360);
    const ph = (-C.pitch * Math.PI) / 180, cp = Math.cos(ph), sp = Math.sin(ph);
    let n = 0;
    for (let r = 0; r < C.rows; r++) for (let c = 0; c < C.cols; c++) {
      const u = -tx + (2 * tx * c) / (C.cols - 1), v = -ty + (2 * ty * r) / (C.rows - 1);
      let bx = 1, by = -u, bz = v; const nrm = Math.hypot(bx, by, bz); bx /= nrm; by /= nrm; bz /= nrm;
      const px = cp * bx + sp * bz, pz = -sp * bx + cp * bz;               // 숙임(몸체 기준)
      const cosT = px * cp - pz * sp;                                        // 광축과의 코사인
      const dt = rot(T, px, by, pz), de = rot(E, px, by, pz);
      for (let d = C.step; d <= C.maxRange; d += C.step) {
        const hx = ot[0] + dt[0] * d, hy = ot[1] + dt[1] * d, rz = ot[2] + dt[2] * d;
        if (hx < 0 || hy < 0 || hx > Wm || hy > Hm) break;
        const tz = g.sample(z, hx, hy, 0);
        if (rz <= tz) {
          const Z = d * Math.max(0.2, cosT), sd = (Z * Z * C.dispStd) / (C.focal * C.baseline) / Math.max(0.2, cosT);
          const dm = d + rng.normal() * sd, ex = oe[0] + de[0] * dm, ey = oe[1] + de[1] * dm, zm = oe[2] + de[2] * dm;
          if (ex < 0 || ey < 0 || ex > Wm || ey > Hm) break;
          const i = Math.round(ey / res) * W + Math.round(ex / res), r2 = Math.max(1e-6, (sd * de[2]) ** 2 + 1e-5);
          this.fuse(i, zm, r2);
          this.upper[i] = Infinity;
          if ((n++ & 3) === 0) this.points.push(ex, ey);
          break;
        }
      }
    }
    return n;
  }

  fuse(i, zm, r2) {
    if (!Number.isFinite(this.h[i])) { this.h[i] = zm; this.v[i] = r2; }
    else { const K = this.v[i] / (this.v[i] + r2); this.h[i] += K * (zm - this.h[i]); this.v[i] *= 1 - K; }
  }

  // T = 참 몸체 자세(레이를 쏘고 지형과 부딪히는 곳을 찾는다), E = 매퍼가 믿는 몸체 자세(측정 거리를 그 자세로 세계에 놓는다).
  // 둘이 같으면 자세 보상이 완벽한 경우다. sensorH = 몸체 원점 위 LiDAR 높이, range = 최대 거리, z = 실제 높이장.
  // 상한(upper bound)도 E로 그린 레이를 따라 갱신한다. 자세를 잘못 믿으면 상한도 틀린다.
  // lidar: 로봇별 덮어쓰기(TP-0135 — G1은 머리에 Livox MID-360을 뒤집어 달아 수직 시야가 −52°~+7°다). 없으면 LIDAR.
  scan(z, T, E, sensorH, range, rng, lidar = null) {
    const g = this.g, L = lidar ? { ...LIDAR, ...lidar } : LIDAR, res = g.res, W = g.W;
    const Wm = (g.W - 1) * res, Hm = (g.H - 1) * res;
    const ot = apply(T, [0, 0, sensorH]), oe = apply(E, [0, 0, sensorH]);
    const pts = [];
    const nh = Math.round(360 / L.hres);
    for (let c = 0; c < L.channels; c++) {
      const el = ((L.vfov[0] + ((L.vfov[1] - L.vfov[0]) * c) / (L.channels - 1) + L.pitch) * Math.PI) / 180;
      const ce = Math.cos(el), se = Math.sin(el);
      for (let k = 0; k < nh; k++) {
        const az = (k * L.hres * Math.PI) / 180, bx = Math.cos(az) * ce, by = Math.sin(az) * ce;
        const dt = rot(T, bx, by, se), de = rot(E, bx, by, se);
        let prev = -1;
        for (let d = L.step; d <= range; d += L.step) {
          const hx = ot[0] + dt[0] * d, hy = ot[1] + dt[1] * d, rz = ot[2] + dt[2] * d;   // d는 레이 길이
          if (hx < 0 || hy < 0 || hx > Wm || hy > Hm) break;
          const tz = g.sample(z, hx, hy, 0);
          const ex = oe[0] + de[0] * d, ey = oe[1] + de[1] * d, ez = oe[2] + de[2] * d;
          if (ex < 0 || ey < 0 || ex > Wm || ey > Hm) break;
          const q = Math.round(ex / res), r = Math.round(ey / res), i = r * W + q;
          if (rz <= tz) {
            const sd = L.noise0 + L.noiseK * d;
            pts.push(q, r, ez + rng.normal() * sd, sd * sd);
            break;
          }
          if (i !== prev && ez < this.upper[i]) this.upper[i] = ez;   // 레이가 칸 위를 지나갔다 -> 높이 상한
          prev = i;
        }
      }
    }
    for (let p = 0; p < pts.length; p += 4) this.fuse(pts[p + 1] * W + pts[p], pts[p + 2], pts[p + 3]);   // 칼만 융합
    this.points = [];
    for (let p = 0; p < pts.length; p += 12) this.points.push(pts[p] * res, pts[p + 1] * res);   // 3점에 1개
    return pts.length / 4;
  }
}

// 몸체 자세 = 원점(지면 접점 + 흔들림 dz)과 회전 Rz(yaw)·Ry(−pitch)·Rx(roll). pitch는 코가 들리면 +, roll은 왼쪽이 들리면 +.
export function bodyFrame(x, y, z0, yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // 열 = 몸체 x, y, z 축의 세계 방향
  const R = [cy * cp, -sy * cr - cy * sp * sr, sy * sr - cy * sp * cr,
             sy * cp, cy * cr - sy * sp * sr, -cy * sr - sy * sp * cr,
             sp, cp * sr, cp * cr];
  return { o: [x, y, z0], R };
}
function rot(F, x, y, z) { const R = F.R; return [R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z]; }
function apply(F, p) { const v = rot(F, p[0], p[1], p[2]); return [F.o[0] + v[0], F.o[1] + v[1], F.o[2] + v[2]]; }
