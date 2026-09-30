// 3D 보기: three.js(r128)를 처음 열 때만 불러온다. 높이장 메시(2칸마다 1정점)에 2D와 같은 색을 입힌다.
import { colorAt } from "./render2d.js";

const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const ORBIT_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";

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
      this.goalMark = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.02, 32), new T.MeshBasicMaterial({ color: 0x4cc38a, transparent: true, opacity: 0.8 }));
      this.goalMark.rotation.x = Math.PI / 2; this.scene.add(this.goalMark);
      this.lines = {};
      this.pedMeshes = [];
    })();
    this.ready.catch(() => { this.ready = null; if (this.renderer) { this.renderer.domElement.remove(); this.renderer = null; } });
    return this.ready;
  }

  buildMesh(world) {
    const T = THREE, g = world.terrain.grid, st = this.stride;
    const nx = Math.floor((g.W - 1) / st) + 1, ny = Math.floor((g.H - 1) / st) + 1;
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    const geo = new T.PlaneGeometry((nx - 1) * st * g.res, (ny - 1) * st * g.res, nx - 1, ny - 1);
    geo.translate(((nx - 1) * st * g.res) / 2, ((ny - 1) * st * g.res) / 2, 0);
    geo.setAttribute("color", new T.BufferAttribute(new Float32Array(nx * ny * 3), 3));
    this.mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    this.scene.add(this.mesh);
    this.nx = nx; this.ny = ny; this.meshFor = world.terrain; this._normalKey = null; this._meshKey = null;
  }

  zAt(world, x, y) { return world.terrain.grid.sample(world.terrain.z, x, y, 0) * this.exag; }

  update(world, view) {
    if (!this.renderer) return;
    const T = THREE, g = world.terrain.grid, st = this.stride;
    this.exag = view.exag;
    if (this.meshFor !== world.terrain || !this.mesh) this.buildMesh(world);
    const pos = this.mesh.geometry.attributes.position, col = this.mesh.geometry.attributes.color;
    const key = `${world.mapVersion}|${view.layer}|${world.terrainVersion}|${view.exag}`;
    const repaint = key !== this._meshKey; this._meshKey = key;
    // PlaneGeometry 정점 순서: 위(y 큰 쪽) 행부터
    if (repaint) for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const v = j * this.nx + i, r = Math.min(g.H - 1, (this.ny - 1 - j) * st), c = Math.min(g.W - 1, i * st), k = r * g.W + c;
      pos.setZ(v, world.terrain.z[k] * view.exag);
      const [R, G, B] = colorAt(view.layer, world, k, view.layer === "belief" && world.lastVis && world.lastVis[k] ? 1.1 : 0.95);
      col.setXYZ(v, R / 255, G / 255, B / 255);
    }
    if (repaint) { pos.needsUpdate = true; col.needsUpdate = true; }
    const nkey = `${world.terrainVersion}:${view.exag}`;
    if (this._normalKey !== nkey) { this.mesh.geometry.computeVertexNormals(); this._normalKey = nkey; }

    // 로봇 자세: 지면 높이 + 앞뒤·좌우 높이차로 pitch/roll
    const [x, y, yaw] = world.pose, c = Math.cos(yaw), s = Math.sin(yaw);
    const zf = this.zAt(world, x + 0.3 * c, y + 0.3 * s), zb = this.zAt(world, x - 0.3 * c, y - 0.3 * s);
    const zl = this.zAt(world, x - 0.2 * s, y + 0.2 * c), zr = this.zAt(world, x + 0.2 * s, y - 0.2 * c);
    this.robot.position.set(x, y, (zf + zb + zl + zr) / 4);
    this.robot.rotation.set(0, 0, 0); this.robot.rotateZ(yaw);
    this.robot.rotateY(-Math.atan2(zf - zb, 0.6)); this.robot.rotateX(Math.atan2(zl - zr, 0.4));
    const u = world.twist;
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

    while (this.pedMeshes.length < world.peds.length) {
      const m = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 1.6, 16), new T.MeshStandardMaterial({ color: 0xff8fb8 }));
      m.rotation.x = Math.PI / 2; this.scene.add(m); this.pedMeshes.push(m);
    }
    this.pedMeshes.forEach((m, i) => {
      const p = world.peds[i]; m.visible = !!p;
      if (p) m.position.set(p.x, p.y, this.zAt(world, p.x, p.y) + 0.8);
    });
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
