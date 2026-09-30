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

  // 전면 스테레오 한 번: 점을 같은 칼만 융합에 넣는다. groundZ = 로봇 아래 지면 높이, 카메라는 그 위 camZ
  stereo(z, pose, groundZ, camZ, rng) {
    const g = this.g, C = STEREO, res = g.res, W = g.W, Wm = (g.W - 1) * res, Hm = (g.H - 1) * res;
    const cy = Math.cos(pose[2]), sy = Math.sin(pose[2]);
    const ox = pose[0] + C.mountX * cy, oy = pose[1] + C.mountX * sy, oz = groundZ + camZ;
    const tx = Math.tan((C.hfov * Math.PI) / 360), ty = Math.tan((C.vfov * Math.PI) / 360);
    const ph = (-C.pitch * Math.PI) / 180, cp = Math.cos(ph), sp = Math.sin(ph);
    let n = 0;
    for (let r = 0; r < C.rows; r++) for (let c = 0; c < C.cols; c++) {
      const u = -tx + (2 * tx * c) / (C.cols - 1), v = -ty + (2 * ty * r) / (C.rows - 1);
      let bx = 1, by = -u, bz = v; const nrm = Math.hypot(bx, by, bz); bx /= nrm; by /= nrm; bz /= nrm;
      const px = cp * bx + sp * bz, pz = -sp * bx + cp * bz;               // 숙임
      const cosT = px * cp - pz * sp;                                        // 광축과의 코사인
      const wx = cy * px - sy * by, wy = sy * px + cy * by;                  // 방위
      for (let d = C.step; d <= C.maxRange; d += C.step) {
        const hx = ox + wx * d, hy = oy + wy * d, rz = oz + pz * d;
        if (hx < 0 || hy < 0 || hx > Wm || hy > Hm) break;
        const tz = g.sample(z, hx, hy, 0);
        if (rz <= tz) {
          const Z = d * Math.max(0.2, cosT), sd = (Z * Z * C.dispStd) / (C.focal * C.baseline) / Math.max(0.2, cosT);
          const q = Math.round(hx / res), rr = Math.round(hy / res), i = rr * W + q, zm = tz + rng.normal() * sd * Math.abs(pz), r2 = Math.max(1e-6, (sd * pz) ** 2 + 1e-5);
          if (!Number.isFinite(this.h[i])) { this.h[i] = zm; this.v[i] = r2; }
          else { const K = this.v[i] / (this.v[i] + r2); this.h[i] += K * (zm - this.h[i]); this.v[i] *= 1 - K; }
          this.upper[i] = Infinity;
          if ((n++ & 3) === 0) this.points.push(hx, hy);
          break;
        }
      }
    }
    return n;
  }

  // pose: [x, y, yaw], sensorZ: 센서 절대 높이, range: 최대 거리, z: 실제 높이장, rng: 잡음
  scan(z, pose, sensorZ, range, rng) {
    const g = this.g, L = LIDAR, res = g.res, W = g.W;
    const Wm = (g.W - 1) * res, Hm = (g.H - 1) * res;
    const pts = [];
    const nh = Math.round(360 / L.hres);
    for (let c = 0; c < L.channels; c++) {
      const el = ((L.vfov[0] + ((L.vfov[1] - L.vfov[0]) * c) / (L.channels - 1) + L.pitch) * Math.PI) / 180;
      const ce = Math.cos(el), se = Math.sin(el);
      for (let k = 0; k < nh; k++) {
        const az = pose[2] + (k * L.hres * Math.PI) / 180;
        const dx = Math.cos(az) * ce, dy = Math.sin(az) * ce;
        let prev = -1;
        for (let d = L.step; d <= range; d += L.step) {
          const hx = pose[0] + dx * d, hy = pose[1] + dy * d, rz = sensorZ + se * d;   // d는 레이 길이
          if (hx < 0 || hy < 0 || hx > Wm || hy > Hm) break;
          const tz = g.sample(z, hx, hy, 0);
          const r = Math.round(hy / res), q = Math.round(hx / res), i = r * W + q;
          if (rz <= tz) {
            const sd = L.noise0 + L.noiseK * d;
            pts.push(q, r, tz + rng.normal() * sd, sd * sd);
            break;
          }
          if (i !== prev && rz < this.upper[i]) this.upper[i] = rz;   // 레이가 칸 위를 지나갔다 -> 높이 상한
          prev = i;
        }
      }
    }
    // 칼만 융합
    for (let p = 0; p < pts.length; p += 4) {
      const i = pts[p + 1] * W + pts[p], zm = pts[p + 2], r2 = pts[p + 3];
      if (!Number.isFinite(this.h[i])) { this.h[i] = zm; this.v[i] = r2; }
      else { const K = this.v[i] / (this.v[i] + r2); this.h[i] += K * (zm - this.h[i]); this.v[i] *= 1 - K; }
    }
    this.points = [];
    for (let p = 0; p < pts.length; p += 12) this.points.push(pts[p] * res, pts[p + 1] * res);   // 3점에 1개
    return pts.length / 4;
  }
}
