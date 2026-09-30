// 격자, 난수, 필터. travplan/core/grid.py와 representation/features.py의 pool 연산을 옮긴 것.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) { this.r = mulberry32(seed); this.spare = null; }
  uniform(a = 0, b = 1) { return a + (b - a) * this.r(); }
  int(a, b) { return a + Math.floor(this.r() * (b - a)); }       // [a, b)
  normal() {
    if (this.spare !== null) { const s = this.spare; this.spare = null; return s; }
    let u = 0, v = 0;
    while (u === 0) u = this.r();
    v = this.r();
    const m = Math.sqrt(-2 * Math.log(u));
    this.spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  }
}

// 격자: 원점 (0,0), 행 = y, 열 = x. index = r * W + c.
export class Grid {
  constructor(res, W, H) { this.res = res; this.W = W; this.H = H; this.N = W * H; }
  x(c) { return c * this.res; }
  y(r) { return r * this.res; }
  cell(x, y) {
    const c = Math.min(this.W - 1, Math.max(0, Math.round(x / this.res)));
    const r = Math.min(this.H - 1, Math.max(0, Math.round(y / this.res)));
    return [r, c];
  }
  inside(x, y) { return x >= 0 && y >= 0 && x <= (this.W - 1) * this.res && y <= (this.H - 1) * this.res; }
  // 이중선형 보간. 격자 밖은 oob 값.
  sample(a, x, y, oob) {
    const fx = x / this.res, fy = y / this.res;
    if (fx < 0 || fy < 0 || fx > this.W - 1 || fy > this.H - 1) return oob;
    const c0 = Math.min(this.W - 2, Math.floor(fx)), r0 = Math.min(this.H - 2, Math.floor(fy));
    const tx = fx - c0, ty = fy - r0, i = r0 * this.W + c0;
    return (a[i] * (1 - tx) + a[i + 1] * tx) * (1 - ty) + (a[i + this.W] * (1 - tx) + a[i + this.W + 1] * tx) * ty;
  }
}

export const odd = (n) => Math.max(3, n | 1);

// 1차원 슬라이딩 최댓값(단조 덱). 창 k(홀수), 가장자리는 창을 잘라 쓴다(= max_pool padding).
function slideMax(src, dst, n, stride, off, k, tmpIdx) {
  const h = k >> 1;
  let head = 0, tail = 0;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + h);
    while (j <= hi) {
      const v = src[off + j * stride];
      while (tail > head && src[off + tmpIdx[tail - 1] * stride] <= v) tail--;
      tmpIdx[tail++] = j++;
    }
    while (tmpIdx[head] < i - h) head++;
    dst[off + i * stride] = src[off + tmpIdx[head] * stride];
  }
}

export function maxPool(a, g, k, out) {
  const tmp = new Float32Array(g.N);
  out = out || new Float32Array(g.N);
  const idx = new Int32Array(Math.max(g.W, g.H) + 1);
  for (let r = 0; r < g.H; r++) slideMax(a, tmp, g.W, 1, r * g.W, k, idx);
  for (let c = 0; c < g.W; c++) slideMax(tmp, out, g.H, g.W, c, k, idx);
  return out;
}

// 평균 pool(count_include_pad=False): 누적합으로 O(N).
export function avgPool(a, g, k, out) {
  const h = k >> 1, W = g.W, H = g.H;
  const tmp = new Float32Array(g.N);
  out = out || new Float32Array(g.N);
  for (let r = 0; r < H; r++) {
    const o = r * W;
    let s = 0, lo = 0, hi = -1;
    for (let c = 0; c < W; c++) {
      const nlo = Math.max(0, c - h), nhi = Math.min(W - 1, c + h);
      while (hi < nhi) s += a[o + ++hi];
      while (lo < nlo) s -= a[o + lo++];
      tmp[o + c] = s / (hi - lo + 1);
    }
  }
  for (let c = 0; c < W; c++) {
    let s = 0, lo = 0, hi = -1;
    for (let r = 0; r < H; r++) {
      const nlo = Math.max(0, r - h), nhi = Math.min(H - 1, r + h);
      while (hi < nhi) s += tmp[++hi * W + c];
      while (lo < nlo) s -= tmp[lo++ * W + c];
      out[r * W + c] = s / (hi - lo + 1);
    }
  }
  return out;
}

// 중앙 차분(가장자리 복제) -> [d/dx, d/dy]
export function grad(z, g) {
  const gx = new Float32Array(g.N), gy = new Float32Array(g.N), W = g.W, H = g.H, d = 2 * g.res;
  for (let r = 0; r < H; r++) {
    const rm = Math.max(0, r - 1) * W, rp = Math.min(H - 1, r + 1) * W, o = r * W;
    for (let c = 0; c < W; c++) {
      gx[o + c] = (z[o + Math.min(W - 1, c + 1)] - z[o + Math.max(0, c - 1)]) / d;
      gy[o + c] = (z[rp + c] - z[rm + c]) / d;
    }
  }
  return [gx, gy];
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
