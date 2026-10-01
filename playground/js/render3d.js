// 3D 보기: three.js(r128)를 처음 열 때만 불러온다. 높이장 메시(2칸마다 1정점)에 2D와 같은 색을 입힌다.
// 메시 높이는 view.js drawHeights가 고르고(기본은 로봇이 본 지형, '둘 다'면 참 지형을 등고선으로 더 그린다),
// 높이 과장(×1·×2·×3)은 그림의 높이에만 건다. 로봇 pitch·roll은 텔레메트리 값에 걸음새 흔들림을 더한 것이다(view.js robotPose).
// 2D처럼 MPPI 샘플, LiDAR 점, 센서 범위 원도 그린다. 선과 점은 그린 면 위에 올린다.
import { colorAt } from "./render2d.js";
import { drawHeights, meshCells, meshZ, robotPose, contours, CONTOUR } from "./view.js";

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const ORBIT_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";

// 높이장 법선(중앙 차분, 가장자리는 한쪽 차분). 로봇이 본 지형은 매 스텝 바뀌어 computeVertexNormals(삼각형마다)보다 싸게 구한다.
// z는 PlaneGeometry 순서(행 j = 0이 y가 큰 쪽), h는 정점 간격 [m].
function gridNormals(z, nx, ny, h, attr) {
  const n = attr.array;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(ny - 1, j + 1);
    const gx = (z[j * nx + i1] - z[j * nx + i0]) / ((i1 - i0) * h), gy = (z[j0 * nx + i] - z[j1 * nx + i]) / ((j1 - j0) * h);
    const k = 1 / Math.hypot(gx, gy, 1), o = (j * nx + i) * 3;
    n[o] = -gx * k; n[o + 1] = -gy * k; n[o + 2] = k;
  }
  attr.needsUpdate = true;
}

function load(src) {
  return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error(src)); document.head.appendChild(s); });
}

export class Map3D {
  constructor(host) { this.host = host; this.ready = null; this.stride = 2; }

  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (!document.createElement("canvas").getContext("webgl")) throw new Error("WebGL을 쓸 수 없다");
      if (!window.THREE) await load(THREE_URL);
      if (!THREE.OrbitControls) await load(ORBIT_URL);
      const T = THREE;
      this.renderer = new T.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.host.appendChild(this.renderer.domElement);
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(40, 2, 0.1, 200);
      this.camera.up.set(0, 0, 1);
      this.camera.position.set(8, -9, 9);
      this.controls = new T.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(8, 4, 0);
      this.controls.enableDamping = true;
      this.scene.add(new T.HemisphereLight(0xdfe8ff, 0x20251f, 0.75));
      const sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(-6, 8, 12); this.scene.add(sun);
      this.robot = new T.Group();
      const body = new T.Mesh(new T.BoxGeometry(0.7, 0.5, 0.22), new T.MeshStandardMaterial({ color: 0x1b2226, roughness: 0.6 }));
      body.position.z = 0.2; this.robot.add(body);
      const top = new T.Mesh(new T.BoxGeometry(0.72, 0.52, 0.03), new T.MeshStandardMaterial({ color: 0xf2b705 }));
      top.position.z = 0.32; this.robot.add(top);
      const lidar = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.08, 16), new T.MeshStandardMaterial({ color: 0x9aa4a0 }));
      lidar.rotation.x = Math.PI / 2; lidar.position.set(0.25, 0, 0.38); this.robot.add(lidar);
      this.wheels = [];
      for (const [mx, my] of [[0.25, 0.18], [0.25, -0.18], [-0.25, 0.18], [-0.25, -0.18]]) {
        const wgrp = new T.Group(); wgrp.position.set(mx, my, 0.08);
        const w = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.05, 18), new T.MeshStandardMaterial({ color: 0xd9dfdc }));
        wgrp.add(w); this.robot.add(wgrp); this.wheels.push([wgrp, mx, my]);
      }
      this.scene.add(this.robot);
      this.wheelParts = this.robot.children.slice();
      // 사족 몸통·다리(바퀴 사족은 다리 끝에 바퀴). 종류에 따라 보이는 부분을 바꾼다.
      const mat = new T.MeshStandardMaterial({ color: 0xd9dfdc, roughness: 0.5 });
      this.legBody = new T.Group();
      const torso = new T.Mesh(new T.BoxGeometry(0.7, 0.36, 0.16), new T.MeshStandardMaterial({ color: 0x1b2226, roughness: 0.6 }));
      torso.position.z = 0.36; this.legBody.add(torso);
      const stripe = new T.Mesh(new T.BoxGeometry(0.72, 0.38, 0.02), new T.MeshStandardMaterial({ color: 0xf2b705 }));
      stripe.position.z = 0.45; this.legBody.add(stripe);
      const head = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.07, 16), new T.MeshStandardMaterial({ color: 0x9aa4a0 }));
      head.rotation.x = Math.PI / 2; head.position.set(0.2, 0, 0.5); this.legBody.add(head);
      this.legs = [];
      for (const [k, mx, my] of [[0, 0.26, 0.2], [1, 0.26, -0.2], [1, -0.26, 0.2], [0, -0.26, -0.2]]) {
        const hip = new T.Group(); hip.position.set(mx, my, 0.33);
        const leg = new T.Mesh(new T.CylinderGeometry(0.025, 0.02, 0.33, 8), mat);
        leg.rotation.x = Math.PI / 2; leg.position.z = -0.165; hip.add(leg);
        const foot = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.04, 16), mat);
        foot.position.z = -0.29; hip.add(foot);
        this.legBody.add(hip); this.legs.push([hip, k, foot]);
      }
      this.legBody.visible = false; this.robot.add(this.legBody);
      this.goalMark = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.02, 32), new T.MeshBasicMaterial({ color: 0x4cc38a, transparent: true, opacity: 0.8 }));
      this.goalMark.rotation.x = Math.PI / 2; this.scene.add(this.goalMark);
      this.lines = {};
      this.pedMeshes = [];
      // MPPI 샘플(선분 묶음, 색 = 비용), LiDAR 점, 센서 범위 원, 참 지형 등고선(보이는 선 + 면에 가린 부분의 옅은 선)
      this.samples = this.segments(0xffffff, { vertexColors: true, opacity: 0.6 });
      this.points = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({ color: 0x78dcff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.85 }));
      this.points.geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(3 * 1024), 3));
      this.points.frustumCulled = false; this.scene.add(this.points);
      this.ring = new T.LineLoop(new T.BufferGeometry(), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
      this.ring.geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(3 * 96), 3));
      this.ring.frustumCulled = false; this.scene.add(this.ring);
      this.contour = this.segments(CONTOUR.hex, { opacity: 0.9 });
      this.contourGhost = new T.LineSegments(this.contour.geometry, new T.LineBasicMaterial({ color: CONTOUR.hex, transparent: true, opacity: 0.3, depthTest: false, depthWrite: false }));
      this.contourGhost.frustumCulled = false; this.contourGhost.renderOrder = 2; this.scene.add(this.contourGhost);
    })();
    this.ready.catch(() => { this.ready = null; if (this.renderer) { this.renderer.domElement.remove(); this.renderer = null; } });
    return this.ready;
  }

  // 선분 묶음 하나. 버퍼는 fill()이 모자랄 때만 키운다.
  segments(color, { vertexColors = false, opacity = 1 } = {}) {
    const T = THREE, L = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ color, vertexColors, transparent: true, opacity, depthWrite: false }));
    L.frustumCulled = false; L.visible = false; this.scene.add(L);
    return L;
  }
  fill(obj, name, n, itemSize = 3) {   // obj.geometry의 name 속성이 n개 이상 담게 한다
    const geo = obj.geometry, a = geo.getAttribute(name);
    if (!a || a.count < n) geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(Math.max(64, n * 2) * itemSize), itemSize));
    return geo.getAttribute(name);
  }

  buildMesh(world) {
    const T = THREE, g = world.terrain.grid, st = this.stride, { nx, ny, cells } = meshCells(g, st);
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    const geo = new T.PlaneGeometry((nx - 1) * st * g.res, (ny - 1) * st * g.res, nx - 1, ny - 1);
    geo.translate(((nx - 1) * st * g.res) / 2, ((ny - 1) * st * g.res) / 2, 0);
    geo.setAttribute("color", new T.BufferAttribute(new Float32Array(nx * ny * 3), 3));
    this.mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    this.scene.add(this.mesh);
    this.nx = nx; this.ny = ny; this.cells = cells; this.zbuf = new Float32Array(cells.length);
    this.meshFor = world.terrain; this._zKey = null; this._meshKey = null; this._ctKey = null;
  }

  // 그린 면의 높이(과장 포함). 선·점·목표·보행자를 이 면 위에 올린다.
  zAt(world, x, y) { return world.terrain.grid.sample(this.H.fill, x, y, 0) * this.exag; }

  update(world, view) {
    if (!this.renderer) return;
    const T = THREE, ex = view.exag, H = drawHeights(view.geo, world);
    this.exag = ex; this.H = H;
    if (this.meshFor !== world.terrain || !this.mesh) this.buildMesh(world);
    const pos = this.mesh.geometry.attributes.position, col = this.mesh.geometry.attributes.color;
    // 높이는 그릴 높이가 바뀔 때(로봇이 본 지형이면 매 스텝), 색은 층·지도가 바뀔 때 다시 쓴다.
    const zkey = `${H.believed ? world.mapVersion : "t"}|${world.terrainVersion}|${ex}|${view.geo}`;
    if (zkey !== this._zKey || world !== this._zWorld) {
      meshZ(H.fill, this.cells, ex, this.zbuf);
      for (let v = 0; v < this.cells.length; v++) pos.setZ(v, this.zbuf[v]);
      pos.needsUpdate = true;
      gridNormals(this.zbuf, this.nx, this.ny, this.stride * world.terrain.grid.res, this.mesh.geometry.attributes.normal);
      this._zKey = zkey; this._zWorld = world;
    }
    const key = `${world.mapVersion}|${view.layer}|${world.terrainVersion}|${world.chassisVer ?? -1}`;
    if (key !== this._meshKey || world !== this._meshWorld) {
      for (let v = 0; v < this.cells.length; v++) {
        const k = this.cells[v], [R, G, B] = colorAt(view.layer, world, k, view.layer === "belief" && world.lastVis && world.lastVis[k] ? 1.1 : 0.95);
        col.setXYZ(v, R / 255, G / 255, B / 255);
      }
      col.needsUpdate = true; this._meshKey = key; this._meshWorld = world;
    }

    // 로봇 자세: 그린 면 위, pitch·roll은 텔레메트리 값 + 걸음새 흔들림(과장하지 않는다)
    const P = robotPose(world, H.fill, ex);
    this.robot.position.set(P.x, P.y, P.z);
    this.robot.rotation.set(0, 0, 0); this.robot.rotateZ(P.yaw); this.robot.rotateY(-P.pitch); this.robot.rotateX(P.roll);
    const u = world.twist, R = world.R || { kind: "wheel" };
    const legged = R.kind !== "wheel";
    for (const p of this.wheelParts) p.visible = !legged;
    this.legBody.visible = legged;
    if (legged) {
      const ph = 2 * Math.PI * (R.gait?.freq || 1) * world.t, sp = Math.min(1, Math.hypot(u[0], u[1]) / 0.6), amp = R.kind === "legs" ? 0.35 : 0.1;
      for (const [hip, k, foot] of this.legs) {
        hip.rotation.y = amp * sp * Math.sin(ph + k * Math.PI);
        foot.rotation.x = R.kind === "wheellegs" ? 0 : Math.PI / 2;   // 바퀴는 축이 몸체 y, 발은 바닥에 눕힌 원판
        foot.scale.set(R.kind === "wheellegs" ? 1 : 0.4, R.kind === "wheellegs" ? 1 : 0.4, R.kind === "wheellegs" ? 1 : 0.6);
      }
    }
    for (const [wg, mx, my] of this.wheels) { const vx = u[0] - u[2] * my, vy = u[1] + u[2] * mx; wg.rotation.z = Math.hypot(vx, vy) > 0.02 ? Math.atan2(vy, vx) : 0; }
    this.goalMark.position.set(world.goal[0], world.goal[1], this.zAt(world, world.goal[0], world.goal[1]) + 0.03);

    // 선은 버퍼를 한 번 만들고 다시 쓴다(매 프레임 geometry·material을 새로 만들지 않는다).
    const setLine = (name, pts, color, lift) => {
      let L = this.lines[name];
      const n = pts && pts.length >= 2 ? pts.length : 0;
      if (!L || L.cap < n) {
        if (L) { this.scene.remove(L.line); L.line.geometry.dispose(); L.line.material.dispose(); }
        const cap = Math.max(64, n * 2), geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.BufferAttribute(new Float32Array(cap * 3), 3));
        L = this.lines[name] = { cap, line: new T.Line(geo, new T.LineBasicMaterial({ color })) };
        this.scene.add(L.line);
      }
      const pos = L.line.geometry.attributes.position;
      for (let i = 0; i < n; i++) pos.setXYZ(i, pts[i][0], pts[i][1], this.zAt(world, pts[i][0], pts[i][1]) + lift);
      pos.needsUpdate = true;
      L.line.geometry.setDrawRange(0, n);
      L.line.geometry.computeBoundingSphere();
      L.line.visible = n > 0;
    };
    setLine("trail", world.trail, 0xffffff, 0.04);
    setLine("route", view.route && world.plan ? world.plan.path : null, 0x5fd3c6, 0.06);
    setLine("nominal", world.ctrl?.nominal, 0xf2b705, 0.1);
    this.drawSamples(world, view);
    this.drawPoints(world, view);
    this.drawRing(world);
    this.drawContours(world, H, ex);

    while (this.pedMeshes.length < world.peds.length) {
      const m = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 1.6, 16), new T.MeshStandardMaterial({ color: 0xff8fb8 }));
      m.rotation.x = Math.PI / 2; this.scene.add(m); this.pedMeshes.push(m);
    }
    this.pedMeshes.forEach((m, i) => {
      const p = world.peds[i]; m.visible = !!p;
      if (p) m.position.set(p.x, p.y, this.zAt(world, p.x, p.y) + 0.8);
    });
  }

  // MPPI 샘플: 2D처럼 비용이 낮을수록 밝게(비용 하위 80%까지 색을 나눈다)
  drawSamples(world, view) {
    const c = world.ctrl, S = view.samples && c && c.samples && c.samples.length ? c.samples : null;
    this.samples.visible = !!S;
    if (!S) return;
    const key = [c, this.exag, view.geo, world.mapVersion];
    if (this._sKey && key.every((v, i) => v === this._sKey[i])) return;
    this._sKey = key;
    const n = S.length * c.T * 2, pos = this.fill(this.samples, "position", n), col = this.fill(this.samples, "color", n);
    const ss = S.map((s) => s.s).sort((a, b) => a - b), lo = ss[0], hi = ss[Math.floor(ss.length * 0.8)] || lo + 1;
    let v = 0;
    for (const s of S) {
      const q = Math.min(1, (s.s - lo) / Math.max(1e-6, hi - lo)), k = 0.35 + 0.65 * (1 - q);
      const R = ((120 + 110 * (1 - q)) / 255) * k, G = ((210 - 80 * q) / 255) * k, B = ((230 - 120 * q) / 255) * k;
      for (let t = 0; t < c.T; t++) for (const tt of [t, t + 1]) {
        const o = (s.k * (c.T + 1) + tt) * 3, x = s.P[o], y = s.P[o + 1];
        pos.setXYZ(v, x, y, this.zAt(world, x, y) + 0.05); col.setXYZ(v, R, G, B); v++;
      }
    }
    pos.needsUpdate = true; col.needsUpdate = true; this.samples.geometry.setDrawRange(0, v);
  }

  // L1 간이: 마지막 스캔의 LiDAR 점(2D와 같은 점)을 그린 면 위에
  drawPoints(world, view) {
    const pts = view.points && world.opts.perception === "l1lite" && world.emap && world.emap.points.length ? world.emap.points : null;
    this.points.visible = !!pts;
    if (!pts) return;
    const key = [pts, this.exag, view.geo, world.mapVersion];
    if (this._pKey && key.every((v, i) => v === this._pKey[i])) return;
    this._pKey = key;
    const n = pts.length / 2, pos = this.fill(this.points, "position", n);
    for (let k = 0; k < n; k++) { const x = pts[2 * k], y = pts[2 * k + 1]; pos.setXYZ(k, x, y, this.zAt(world, x, y) + 0.03); }
    pos.needsUpdate = true; this.points.geometry.setDrawRange(0, n);
  }

  // 센서 범위 원(인식이 '완전'이 아닐 때, 2D와 같다)
  drawRing(world) {
    const on = world.opts.perception !== "gt";
    this.ring.visible = on;
    if (!on) return;
    const pos = this.ring.geometry.getAttribute("position"), n = pos.count, R = world.opts.sensorRange, [x, y] = world.pose;
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n, px = x + R * Math.cos(a), py = y + R * Math.sin(a);
      pos.setXYZ(k, px, py, this.zAt(world, px, py) + 0.05);
    }
    pos.needsUpdate = true;
  }

  // '둘 다': 참 지형 등고선을 그 높이(과장 포함)에 그린다. 면에 가린 부분(못 본 포트홀 바닥 등)은 옅은 선으로 비친다.
  drawContours(world, H, ex) {
    const on = !!H.line;
    this.contour.visible = on; this.contourGhost.visible = on;
    if (!on) return;
    const key = `${world.terrainVersion}|${ex}`;
    if (key === this._ctKey && this._ctFor === world.terrain) return;
    this._ctKey = key; this._ctFor = world.terrain;
    const { seg, lev } = contours(H.line, world.terrain.grid), n = lev.length * 2, pos = this.fill(this.contour, "position", n);
    for (let i = 0; i < lev.length; i++) {
      const z = lev[i] * ex + 0.02;
      pos.setXYZ(2 * i, seg[4 * i], seg[4 * i + 1], z); pos.setXYZ(2 * i + 1, seg[4 * i + 2], seg[4 * i + 3], z);
    }
    pos.needsUpdate = true; this.contour.geometry.setDrawRange(0, n);
  }

  render(bg) {
    if (!this.renderer) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (this._w !== w || this._h !== h) { this.renderer.setSize(w, h, false); this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix(); this._w = w; this._h = h; }
    this.scene.background = new THREE.Color(bg);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
