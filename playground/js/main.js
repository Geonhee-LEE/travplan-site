import { World, defaultOptions, PERCEPTION, SIM } from "./sim.js";
import { SCENARIOS, DIFFICULTY } from "./terrain.js";
import { PLANNERS } from "./planner.js";
import { CONTROLLERS, sampleMap } from "./control.js";
import { Map2D, LAYERS } from "./render2d.js";
import { chassisFeasibility } from "./chassis.js";
import { Map3D } from "./render3d.js";

const $ = (id) => document.getElementById(id);
const opts = defaultOptions();
const view = { layer: "belief", tool: "goal", route: true, samples: true, points: true, exag: 2.0, mode: "2d", cursor: null, drag: null };
let world = new World(opts);
world.terrainVersion = 0;
let paused = false, speed = 1, acc = 0, last = performance.now(), logged = false;
const history = [];

const map2d = new Map2D($("map2d"));
const map3d = new Map3D($("gl"));

// 시연 프리셋: 저장소 결과를 브라우저에서 다시 보는 설정. id는 주소 해시(#TP-0047)와 대시보드 링크가 쓴다
// (automation/dashboard_links.py가 이 목록을 읽는다). 한 TP에 프리셋이 여럿이면 #TP-XXXX는 첫 번째를 연다.
const PRESETS = [
  { id: "TP-0031-low", tp: "TP-0031", label: "가림, 센서 0.3 m", set: { scenario: "bumps_potholes", level: 0, seed: 4, perception: "occlusion", sensorHeight: 0.3, shadowCeiling: false, depthPrior: false } },
  { id: "TP-0031-high", tp: "TP-0031", label: "센서 1.0 m로 올리기", set: { scenario: "bumps_potholes", level: 0, seed: 4, perception: "occlusion", sensorHeight: 1.0, shadowCeiling: false, depthPrior: false } },
  { id: "TP-0046", tp: "TP-0046", label: "가림 + 그림자 상한만", set: { scenario: "bumps_potholes", level: 0, seed: 4, perception: "occlusion", shadowCeiling: true, depthPrior: false } },
  { id: "TP-0047", tp: "TP-0047", label: "+ 깊이 prior", set: { scenario: "bumps_potholes", level: 0, seed: 4, perception: "occlusion", shadowCeiling: true, depthPrior: true, evidence: true } },
  { id: "TP-0048", tp: "TP-0048", label: "내림 턱 오탐(증거 제한 끔)", set: { scenario: "down_curb", level: 0, seed: 1, perception: "occlusion", shadowCeiling: true, depthPrior: true, evidence: false } },
  { id: "TP-0082", tp: "TP-0082", label: "차체 기준 층: 둔덕 경사", set: { scenario: "slope_crossfall", level: 0, seed: 0, perception: "range" }, layer: "chassis" },
  { id: "TP-0100", tp: "TP-0100", label: "L1 간이: 못 본 칸이 위험", set: { scenario: "bumps_potholes", level: 0, seed: 4, perception: "l1lite", shadowCeiling: true, depthPrior: true }, layer: "belief_elev" },
  { id: "TP-0101", tp: "TP-0101", label: "근거리 미관측을 치명으로(1.5 m)", set: { scenario: "bumps_potholes", level: 0, seed: 4, perception: "occlusion", shadowCeiling: true, depthPrior: true, unknownNear: 1.5 } },
  { id: "TP-0065", tp: "TP-0065", label: "L1 간이 + 전면 스테레오 + 미관측 1.5 m", set: { scenario: "down_curb", level: 0, seed: 0, perception: "l1lite", shadowCeiling: true, depthPrior: true, stereo: true, unknownNear: 1.5 }, layer: "belief_elev" },
  { id: "TP-0039", tp: "TP-0039", label: "연석 L3 (경사로 1.1 m)", set: { scenario: "curb_ramp", level: 3, seed: 0, perception: "range" } },
  { id: "planner-vs-controller", tp: "P/C", label: "Planner 없이 MPPI만", set: { scenario: "bumps_potholes", level: 0, seed: 0, perception: "range", planner: "straight" } },
  { id: "TP-0027", tp: "TP-0027", label: "보행자 3명", set: { scenario: "bumps_potholes", level: 0, seed: 1, perception: "range" }, peds: 3 },
];

function css() {
  const s = getComputedStyle(document.documentElement), v = (n) => s.getPropertyValue(n).trim();
  return { line: v("--line"), muted: v("--muted"), fg: v("--fg"), accent: v("--accent"), route: v("--route"), ok: v("--ok"), bad: v("--bad"), mapBg: v("--map-bg") };
}
let CSS = css();
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { CSS = css(); });
new MutationObserver(() => { CSS = css(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// ------------------------------------------------------------------ 조작 연결
function segment(id, value, onPick) {
  const el = $(id);
  const sync = (v) => el.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === String(v))));
  el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; sync(b.dataset.val); onPick(b.dataset.val); });
  sync(value);
  return sync;
}
function slider(id, fmt, onInput) {
  const el = $(id), out = $(id + "Out");
  const show = () => { out.textContent = fmt(+el.value); };
  el.addEventListener("input", () => { show(); onInput(+el.value); });
  show();
  return (v) => { el.value = v; show(); };
}

// 시나리오 탭
const scBar = $("scenarios");
for (const [key, sc] of Object.entries(SCENARIOS)) {
  const b = document.createElement("button");
  b.className = "tab"; b.dataset.val = key;
  b.innerHTML = `${sc.label}<small>${key}</small>`;
  b.addEventListener("click", () => { opts.scenario = key; newWorld(); });
  scBar.appendChild(b);
}
const prBar = $("presets");
for (const p of PRESETS) {
  const b = document.createElement("button");
  b.className = "chip"; b.innerHTML = `<b>${p.tp}</b>${p.label}`;
  b.addEventListener("click", () => applyPreset(p));
  prBar.appendChild(b);
}

const syncPer = segment("perception", opts.perception, (v) => { opts.perception = v; restart(); });
const syncPl = segment("planner", opts.planner, (v) => { opts.planner = v; restart(); });
const syncCo = segment("controller", opts.controller, (v) => { opts.controller = v; restart(); });
$("layerSel").addEventListener("change", (e) => { setLayer(e.target.value); });
function setLayer(v) {
  view.layer = v; $("layerSel").value = v; uiKey = "";
  ensureChassis();
}
// 차체 기하 기준은 지형이 바뀔 때만 한 번 계산한다(약 1 s). 층을 고를 때 필요하면 시작한다.
function ensureChassis() {
  if (view.layer !== "chassis" || world.chassisVer === world.terrainVersion || world.chassisBusy) return;
  world.chassisBusy = true;
  $("probe").textContent = "차체 기하 기준을 계산하는 중이다(방위각 8개 × 모든 칸, 약 1 s)…";
  const w = world;
  setTimeout(() => {
    w.chassis = chassisFeasibility(w.terrain.z, w.terrain.grid);
    w.chassisVer = w.terrainVersion; w.chassisBusy = false;
    if (w === world) $("probe").textContent = "차체 기하 기준: 빨강·보라·파랑·주황 칸은 어느 방향으로도 차체가 들어가지 못한다.";
  }, 30);
}
segment("tool", view.tool, (v) => { view.tool = v; });
segment("speed", 1, (v) => { speed = +v; });
const syncView = segment("view", "2d", (v) => setMode(v));

const setLevel = slider("level", (v) => `L${v}`, (v) => { opts.level = v; newWorld(); });
const setSeed = slider("seed", (v) => `${v}`, (v) => { opts.seed = v; newWorld(); });
const setSH = slider("sensorHeight", (v) => `${v.toFixed(2)} m`, (v) => { opts.sensorHeight = v; restart(); });
const setUN = slider("unknownNear", (v) => (v ? `${v.toFixed(2)} m` : "끔"), (v) => { opts.unknownNear = v; restart(); });
const setSR = slider("sensorRange", (v) => `${v.toFixed(1)} m`, (v) => { opts.sensorRange = v; restart(); });
const setK = slider("K", (v) => `${v}`, (v) => { opts.mppi.K = v; });
const setT = slider("T", (v) => `${(v * 0.1).toFixed(1)} s`, (v) => { opts.mppi.T = v; });
const setL = slider("lambda", (v) => v.toFixed(2), (v) => { opts.mppi.lambda = v; });
const setN = slider("noiseScale", (v) => `×${v.toFixed(2)}`, (v) => { opts.mppi.noise = [0.4 * v, 0.25 * v, 0.6 * v]; });
const setWT = slider("wTrav", (v) => v.toFixed(1), (v) => { opts.mppi.w.trav = v; });
const setWR = slider("wRisk", (v) => v.toFixed(1), (v) => { opts.mppi.w.risk = v; });
const setWA = slider("wAtt", (v) => `${v}`, (v) => { opts.mppi.w.attitude = v; });

for (const id of ["shadowCeiling", "depthPrior", "evidence", "stereo"]) {
  $(id).checked = opts[id];
  $(id).addEventListener("change", () => { opts[id] = $(id).checked; restart(); });
}
$("showRoute").addEventListener("change", (e) => { view.route = e.target.checked; });
$("showSamples").addEventListener("change", (e) => { view.samples = e.target.checked; });
$("showPoints").addEventListener("change", (e) => { view.points = e.target.checked; });

$("play").addEventListener("click", () => {
  if (world.status !== "running") { restart(); return; }
  paused = !paused; syncPlay();
});
$("stepBtn").addEventListener("click", () => { paused = true; syncPlay(); world.step(); });
$("restart").addEventListener("click", restart);
$("newSeed").addEventListener("click", () => { opts.seed = (opts.seed + 1) % 20; newWorld(); });
$("bannerRetry").addEventListener("click", restart);
$("bannerNew").addEventListener("click", () => { opts.seed = (opts.seed + 1) % 20; newWorld(); });
$("spawnPeds").addEventListener("click", () => { world.spawnCrossing(3); restart(); });   // 시작 시각에 맞춘 보행자라 처음부터 다시
$("clearPeds").addEventListener("click", () => { world.clearPeds(); });

document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, select, textarea, button, a")) return;
  if (e.key === " ") { e.preventDefault(); $("play").click(); }
  else if (e.key === "r") restart();
  else if (e.key === "n") $("newSeed").click();
});

function syncPlay() { $("play").textContent = world.status !== "running" ? "다시 달리기" : paused ? "재생" : "일시정지"; }

function syncPanel() {
  scBar.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.val === opts.scenario)));
  const sc = SCENARIOS[opts.scenario];
  $("scDesc").textContent = sc.note;
  const hasLv = !!DIFFICULTY[opts.scenario];
  $("level").disabled = !hasLv;
  const d = DIFFICULTY[opts.scenario];
  $("scNote").textContent = hasLv ? Object.entries(d).map(([k, v]) => `${k} ${v[opts.level]}`).join(" · ") : "레벨 없음";
  setLevel(opts.level); setSeed(opts.seed); setSH(opts.sensorHeight); setSR(opts.sensorRange); setUN(opts.unknownNear || 0);
  $("unknownNear").disabled = opts.perception === "gt";
  syncPer(opts.perception); syncPl(opts.planner); syncCo(opts.controller);
  $("perNote").textContent = PERCEPTION[opts.perception].note;
  $("plNote").textContent = PLANNERS[opts.planner].note;
  $("coNote").textContent = CONTROLLERS[opts.controller].note;
  $("mppiParams").hidden = opts.controller !== "mppi";
  const occl = opts.perception === "occlusion" || opts.perception === "l1lite";
  $("sensorHeight").disabled = !occl;
  $("sensorRange").disabled = opts.perception === "gt";
  for (const id of ["shadowCeiling", "depthPrior", "evidence", "stereo"]) { $(id).checked = opts[id]; $(id).disabled = !occl; }
  $("stereo").checked = !!opts.stereo; $("stereo").disabled = opts.perception !== "l1lite";
  $("depthPrior").disabled = !occl || !opts.shadowCeiling;
  $("evidence").disabled = !occl || !opts.shadowCeiling || !opts.depthPrior;
  setK(opts.mppi.K); setT(opts.mppi.T); setL(opts.mppi.lambda); setN(opts.mppi.noise[0] / 0.4);
  setWT(opts.mppi.w.trav); setWR(opts.mppi.w.risk); setWA(opts.mppi.w.attitude);
}

function newWorld() {
  const peds = world.pedsInit;
  world = new World(opts); world.terrainVersion = 0; world.edited = false;
  if (peds?.length) { world.pedsInit = []; for (const p of peds) world.addPed(p.x, p.y, p.vx, p.vy); world.peds = world.pedsInit.map((p) => ({ ...p })); }
  onNewRun();
}
function restart() {
  world.opts = opts; world.reset();
  onNewRun();
}
function onNewRun() { paused = false; logged = false; acc = 0; uiKey = ""; syncPanel(); syncPlay(); ensureChassis(); }

function applyPreset(p) {
  Object.assign(opts, defaultOptions(), p.set);          // 시연은 MPPI도 기본값에서 시작한다
  world.clearPeds();
  newWorld();
  setLayer(p.layer || "belief");
  if (p.peds) { world.spawnCrossing(p.peds); restart(); }
}

// ------------------------------------------------------------------ 지도 클릭
const cv = $("map2d");
function evWorld(e) { const r = cv.getBoundingClientRect(); return map2d.toWorld(e.clientX - r.left, e.clientY - r.top); }
function editTerrain(fn) {
  fn(); world.terrainVersion++; world.edited = true; world.rebuildGT(); ensureChassis();
  world.observe(); world.replan();
}
cv.addEventListener("pointerdown", (e) => {
  if (!map2d.L) return;
  const [x, y] = evWorld(e), g = world.terrain.grid;
  if (!g.inside(x, y)) return;
  if (view.tool === "goal") {
    if (world.status !== "running") restart();          // 끝난 주행은 처음부터 다시 달린다
    const why = world.setGoal(x, y);
    if (why) $("probe").textContent = why + ". 다른 곳을 고르세요.";
  }
  else if (view.tool === "box") editTerrain(() => world.terrain.addBox(x, y));
  else if (view.tool === "pothole") editTerrain(() => world.terrain.addPothole(x, y));
  else if (view.tool === "erase") editTerrain(() => world.terrain.erase(x, y));
  else if (view.tool === "ped") { view.drag = { from: [x, y], to: [x, y] }; cv.setPointerCapture(e.pointerId); }
  if (view.tool === "goal") { paused = false; syncPlay(); }
});
cv.addEventListener("pointermove", (e) => {
  if (!map2d.L) return;
  const [x, y] = evWorld(e), r = cv.getBoundingClientRect();
  view.cursor = { px: [e.clientX - r.left, e.clientY - r.top], w: [x, y] };
  if (view.drag) view.drag.to = [x, y];
  probe(x, y);
});
cv.addEventListener("pointerleave", () => { view.cursor = null; });
cv.addEventListener("pointercancel", () => { view.drag = null; });
cv.addEventListener("pointerup", () => {
  if (!view.drag) return;
  const { from, to } = view.drag, dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy);
  const sp = Math.min(1.2, Math.max(0.5, d));   // 끈 길이 = 속력(0.5–1.2 m/s)
  const ux = d > 0.05 ? dx / d : -1, uy = d > 0.05 ? dy / d : 0;
  world.addPed(from[0], from[1], ux * sp, uy * sp);
  view.drag = null;
});

function probe(x, y) {
  const g = world.terrain.grid;
  if (!g.inside(x, y)) { $("probe").textContent = ""; return; }
  const [r, c] = g.cell(x, y), i = r * g.W + c, gt = world.gt, b = world.belief;
  const state = b.known[i] ? "관측" : b.bounded[i] ? "미관측(상한·prior)" : "미관측";
  const cm = (v) => (v * 100).toFixed(1);
  const seen = b.known[i] ? `로봇이 본 높이 ${cm(b.elev[i])} cm` : "로봇은 못 봄";
  const sig = opts.perception === "l1lite" && Number.isFinite(world.emap.v[i]) ? ` · σ ${cm(Math.sqrt(world.emap.v[i]))} cm` : "";
  const ceil = !b.known[i] && world.beliefCeil && Number.isFinite(world.beliefCeil[i]) ? ` · 상한 ${cm(world.beliefCeil[i])} cm` : "";
  const ch = world.chassis && world.chassisVer === world.terrainVersion
    ? ` · 차체: ${world.chassis.lethalAll[i] ? ["", "자세로", "바퀴 들뜸으로", "배 밑 간섭으로"][world.chassis.reason[i]] + " 못 들어감" : world.chassis.lethalAny[i] ? "일부 방향 막힘" : "들어감"}` : "";
  $("probe").textContent = `x ${x.toFixed(2)} y ${y.toFixed(2)} m · 실제 높이 ${cm(world.terrain.z[i])} cm · ${seen}${sig}${ceil}`
    + ` · 경사 ${(b.slope[i] * 57.3).toFixed(1)}° · 턱 ${cm(b.step[i])} cm · 거칠기 ${cm(b.rough[i])} cm`
    + ` · 로봇이 본 cost ${b.cost[i].toFixed(2)} (${state}) · 실제 cost ${gt.cost[i].toFixed(2)}${ch}`;
}

// ------------------------------------------------------------------ 3D
async function setMode(m) {
  view.mode = m;
  $("gl").hidden = m !== "3d"; $("map2d").hidden = m === "3d"; $("hint3d").hidden = m !== "3d";
  $("tool").querySelectorAll("button").forEach((b) => { b.disabled = m === "3d"; });
  if (m === "3d") {
    try { await map3d.init(); }
    catch (err) {
      syncView("2d"); await setMode("2d");
      $("probe").textContent = `3D 보기를 열지 못했다(${err.message}). 2D 보기로 돌아왔다.`;
    }
  }
}

// ------------------------------------------------------------------ 표시
const deg = (r) => (r * 57.2958).toFixed(1);
function telemetry() {
  const c = world.cur || { pitch: 0, roll: 0, gtCost: 0, speed: 0 };
  const cls = (v, lim) => (Math.abs(v) > lim ? "bad" : Math.abs(v) > 0.7 * lim ? "warn" : "");
  const clear = world.stats.minClear;
  $("telemetry").innerHTML = [
    `<span>t <b>${world.t.toFixed(1)} s</b></span>`,
    `<span>속도 <b>${c.speed.toFixed(2)} m/s</b></span>`,
    `<span class="${cls(c.pitch, SIM.pitchLimit)}">pitch <b>${deg(c.pitch)}°</b></span>`,
    `<span class="${cls(c.roll, SIM.rollLimit)}">roll <b>${deg(c.roll)}°</b></span>`,
    `<span class="${c.gtCost > 0.7 ? "warn" : ""}">실제 cost <b>${c.gtCost.toFixed(2)}</b></span>`,
    world.peds.length ? `<span class="${clear < 0.3 ? "warn" : ""}">보행자 여유 <b>${Number.isFinite(clear) ? clear.toFixed(2) + " m" : "-"}</b></span>` : "",
    `<span>지도 <b>${world.ms.map.toFixed(0)}</b> · 계획 <b>${world.ms.plan.toFixed(0)}</b> · 제어 <b>${world.ms.ctrl.toFixed(0)} ms</b></span>`,
    !paused && world.status === "running" ? `<span class="${rt.factor < 0.9 * speed ? "warn" : ""}">실시간 <b>×${rt.factor.toFixed(2)}</b></span>` : "",
  ].join("");
  $("pedCount").textContent = `${world.peds.length}명`;
}

const TERM_LABEL = { reference: "경로", trav: "지형", risk: "위험 CVaR", attitude: "자세", control: "제어", approach: "목표 접근" };
function bars() {
  const c = world.ctrl;
  if (!c || !c.breakdown) { if (opts.controller !== "mppi") $("bars").innerHTML = '<p class="empty">Pure pursuit는 비용을 쓰지 않는다.</p>'; $("ctrlMs").textContent = ""; return; }
  const entries = Object.entries(c.breakdown), mx = Math.max(1, ...entries.filter(([, v]) => v < 1000).map(([, v]) => v));
  $("bars").innerHTML = entries.map(([k, v]) => {
    const hard = v >= 1000, w = hard ? 100 : Math.min(100, (100 * v) / mx);
    return `<div><span>${TERM_LABEL[k]}</span><span class="track"><span class="fill${hard ? " hard" : ""}" style="width:${w}%"></span></span><output>${hard ? "치명 " : ""}${v.toFixed(1)}</output></div>`;
  }).join("");
  $("ctrlMs").textContent = `K ${opts.mppi.K} · ${c.ms.toFixed(1)} ms`;
}

function banner() {
  const b = $("banner");
  if (world.status === "running") { b.hidden = true; return; }
  b.hidden = false;
  b.className = "banner " + (world.status === "reached" ? "ok" : "bad");
  $("bannerText").textContent = world.status === "reached" ? `도달 · ${world.t.toFixed(1)} s · ${world.stats.len.toFixed(1)} m` : `실패 · ${world.failure} · ${world.t.toFixed(1)} s`;
  if (!logged) {
    logged = true;
    history.unshift({
      sc: `${opts.scenario}${DIFFICULTY[opts.scenario] ? "@L" + opts.level : ""} s${opts.seed}${world.edited ? " (편집)" : ""}`,
      per: ({ gt: "완전", range: "L0", occlusion: `가림 ${opts.sensorHeight.toFixed(1)} m`, l1lite: `L1 간이 ${opts.sensorHeight.toFixed(1)} m` }[opts.perception])
        + (opts.perception === "occlusion" || opts.perception === "l1lite" ? `${opts.shadowCeiling ? " +상한" : ""}${opts.shadowCeiling && opts.depthPrior ? " +prior" : ""}` : "")
        + (opts.perception === "l1lite" && opts.stereo ? " +스테레오" : "")
        + (opts.unknownNear ? ` +미관측 ${opts.unknownNear} m` : ""),
      stack: `${opts.planner}+${opts.controller}`, ok: world.status === "reached", res: world.status === "reached" ? "도달" : world.failure,
      t: world.t, pitch: world.stats.maxPitch, cost: world.stats.gtCostSum / Math.max(1, world.stats.steps),
    });
    history.length = Math.min(history.length, 10);
    $("history").innerHTML = history.map((h) => `<tr><td>${h.sc}</td><td>${h.per}</td><td>${h.stack}</td><td class="${h.ok ? "ok" : "bad"}">${h.res}</td><td>${h.t.toFixed(1)} s</td><td>${deg(h.pitch)}°</td><td>${h.cost.toFixed(3)}</td></tr>`).join("");
    syncPlay();
  }
}

// ------------------------------------------------------------------ 표시 보조
function syncLegend() {
  const L = LAYERS[view.layer];
  $("legendLayer").innerHTML = L.legend();
  $("layerNote").textContent = `${L.group} · ${L.label}: ${L.note}`;
  document.querySelectorAll(".legend [data-l1]").forEach((el) => { el.hidden = opts.perception !== "l1lite"; });
  $("legHorizon").textContent = (opts.mppi.T * SIM.dt).toFixed(1);
}

// 실시간 배율: 최근 1초 동안 흐른 시뮬 시간 / 실제 시간
const rt = { simT: 0, wall: performance.now(), factor: 1 };
function realtime(now) {
  if (now - rt.wall >= 1000) { rt.factor = (world.t - rt.simT) / ((now - rt.wall) / 1000); rt.simT = world.t; rt.wall = now; }
  if (world.t < rt.simT) rt.simT = world.t;           // 새 주행
}

// ------------------------------------------------------------------ 루프
let uiKey = "";
function frame(now) {
  const dtReal = Math.min(0.25, (now - last) / 1000); last = now;
  if (!paused && world.status === "running") {
    acc += dtReal * speed;
    const t0 = performance.now();
    while (acc >= SIM.dt && world.status === "running" && performance.now() - t0 < 45) { world.step(); acc -= SIM.dt; }
    if (acc > 0.3) acc = 0.3;
  }
  realtime(now);
  if (view.mode === "2d") map2d.draw(world, view, CSS);
  else if (map3d.renderer) { map3d.update(world, view); map3d.render(CSS.mapBg); }
  // 글자 영역은 스텝·상태·층이 바뀔 때만 다시 쓴다.
  const key = `${world.k}|${world.status}|${paused}|${world.peds.length}|${view.layer}|${opts.mppi.T}|${Math.round(rt.factor * 10)}|${world.mapVersion}`;
  if (key !== uiKey) { uiKey = key; telemetry(); bars(); banner(); syncLegend(); }
  requestAnimationFrame(frame);
}

// 동작 줄이기 설정이면 일시정지로 시작한다.
if (matchMedia("(prefers-reduced-motion: reduce)").matches) paused = true;
// 주소 해시로 프리셋 열기: #TP-0047, #TP-0031-high 등(대시보드의 '▶ 시뮬레이션' 링크)
function presetFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return;
  const p = PRESETS.find((q) => q.id === h) || PRESETS.find((q) => q.tp === h);
  if (p) applyPreset(p);
}
window.addEventListener("hashchange", presetFromHash);

// 대시보드 링크: 저장소(로컬 서버·GitHub Pages)에서는 옆의 docs/dashboard.html, 게시본에서는 대시보드 게시본
const DASHBOARD_ARTIFACT = "https://claude.ai/artifact/QMumSBE3kBQMqAyu1oPxHG";
{
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname.endsWith("github.io") || location.protocol === "file:";
  $("dashLink").href = local ? "../dashboard.html" : DASHBOARD_ARTIFACT;
}

syncPanel(); syncPlay();
presetFromHash();
requestAnimationFrame(frame);
