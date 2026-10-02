import { World, defaultOptions, PERCEPTION, SIM } from "./sim.js";
import { SCENARIOS, DIFFICULTY } from "./terrain.js";
import { PLANNERS } from "./planner.js";
import { CONTROLLERS } from "./control.js";
import { Map2D, LAYERS } from "./render2d.js";
import { chassisFeasibility } from "./chassis.js";
import { Map3D } from "./render3d.js";
import { ROBOTS } from "./robots.js";
import { PRESETS, GROUPS } from "./presets.js";
import { PUBLIC_BASE, baseState, canon, diff, isModified, parse, serialize, buildWorld, applyEdit, presetById, RUN_KEYS } from "./state.js";
import { EpisodeMeter, toCsv } from "./metrics.js";
import { attitudeNow, drawHeights, CONTOUR } from "./view.js";

const $ = (id) => document.getElementById(id);
const opts = defaultOptions();          // 화면 조작이 고치는 설정. World가 같은 객체를 본다
// geo는 그릴 높이(view.js: belief 로봇이 본 지형, true 참 지형, both 둘 다), exag는 높이 과장 배율(×1·×2·×3).
const view = { layer: "belief", geo: "belief", exag: 2, tool: "goal", route: true, samples: true, points: true, mode: "3d", cursor: null, drag: null };
let world = null;
let paused = false, speed = 1, acc = 0, last = performance.now(), logged = false;
const runLog = [];                      // 주행 기록(최근 10회)

// 주소 상태(state.js). active는 켜진 시연, viewChoice는 사용자가 고른 보기(3D가 안 열려 2D로 돌아가도 그대로 둔다).
// edits는 지금 지형에 쓴 편집, pedsFromPreset은 보행자가 시연이 정한 그대로인지다.
// runStart는 지금 주행의 시작 상태, runChanged는 첫 스텝 뒤에 결과를 바꾸는 조작(MPPI 값·목표·보행자·편집)이 있었는지다.
let active = null, viewChoice = "3d", edits = [], pedsFromPreset = true, runStart = null, runChanged = false;
let meter = new EpisodeMeter(), started = false, glFailed = false;

const map2d = new Map2D($("map2d"));
const map3d = new Map3D($("gl"));

function css() {
  const s = getComputedStyle(document.documentElement), v = (n) => s.getPropertyValue(n).trim();
  return { line: v("--line"), muted: v("--muted"), fg: v("--fg"), accent: v("--accent"), route: v("--route"), ok: v("--ok"), bad: v("--bad"), mapBg: v("--map-bg") };
}
let CSS = css();
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { CSS = css(); });
new MutationObserver(() => { CSS = css(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r2 = (v) => Math.round(v * 100) / 100;   // 지도에서 찍은 좌표는 1 cm로 맞춰 주소와 같은 값을 쓴다

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

// ------------------------------------------------------------------ 시연: 한 줄 칩, 펼치는 카드, 오른쪽 시연 카드
const onoff = (v) => (v === "1" ? "켬" : "끔");
const KEY_TEXT = {
  sc: (v) => SCENARIOS[v]?.label || v, lv: (v) => `레벨 ${v}`, s: (v) => `seed ${v}`,
  rb: (v) => ROBOTS[v]?.label || v, pc: (v) => `자세 보상 ${onoff(v)}`, pn: (v) => `자세 추정 잡음 ${v}°`,
  per: (v) => PERCEPTION[v]?.label || v, sh: (v) => `센서 ${v} m`, sr: (v) => `센서 범위 ${v} m`,
  ceil: (v) => `그림자 상한 ${onoff(v)}`, dp: (v) => `깊이 prior ${onoff(v)}`, ev: (v) => `증거 제한 ${onoff(v)}`,
  un: (v) => (+v ? `근거리 미관측 ${v} m` : "근거리 미관측 끔"), unc: (v) => `미관측 cost ${v}`, st: (v) => `전면 스테레오 ${onoff(v)}`,
  pl: (v) => `Planner ${PLANNERS[v]?.label || v}`, co: (v) => `Controller ${CONTROLLERS[v]?.label || v}`,
  K: (v) => `K ${v}`, T: (v) => `지평 ${(v * SIM.dt).toFixed(1)} s`, lam: (v) => `λ ${v}`, nz: (v) => `탐색 잡음 ×${v}`,
  wt: (v) => `지형 가중 ${v}`, wr: (v) => `위험 가중 ${v}`, wa: (v) => `자세 가중 ${v}`,
  goal: () => "목표 이동", ped: (v) => (v ? `보행자 ${v.split(";").length}명` : "보행자 없음"), ed: (v) => `지형 편집 ${v.split(";").length}곳`,
};
const diffText = (st) => diff(st).filter(([k]) => RUN_KEYS.has(k)).map(([k, v]) => KEY_TEXT[k](v)).join(", ");
function pairInfo(addr) {
  const r = parse(addr), p = presetById(r.state.base), extra = diffText(r.state);
  return { st: r.state, text: p ? `${p.tp} ${p.label}${extra ? " + " + extra : ""}` : extra };
}

const chipBox = $("presets"), cardBox = $("cards");
for (const [g, name] of Object.entries(GROUPS)) {
  const ps = PRESETS.filter((p) => p.group === g);
  chipBox.insertAdjacentHTML("beforeend", `<span class="grp">${esc(name)}</span>` + ps.map((p) =>
    `<button class="chip" data-preset="${esc(p.id)}" aria-pressed="false" title="볼 것: ${esc(p.watch)}"><b>${esc(p.tp)}</b>${esc(p.label)}<em class="mod" hidden>수정됨</em></button>`).join(""));
  cardBox.insertAdjacentHTML("beforeend", `<section class="pgroup" aria-label="${esc(name)}"><h3>${esc(name)}</h3>` + ps.map((p) => {
    const pair = p.pair ? pairInfo(p.pair) : null;
    return `<article class="pcard"><button class="pc-main" data-preset="${esc(p.id)}" aria-pressed="false">`
      + `<span class="pc-head"><b>${esc(p.tp)}</b>${esc(p.label)}<em class="mod" hidden>수정됨</em></span>`
      + `<span class="pc-k">볼 것</span><span>${esc(p.watch)}</span><span class="pc-k">이 페이지</span><span>${esc(p.expect.text)}</span>`
      + `<span class="pc-k">저장소</span><span>${esc(p.repo)}</span></button>`
      + (pair ? `<button class="pc-pair" data-pair="${esc(p.pair)}">비교 ▸ ${esc(pair.text)}</button>` : "") + "</article>";
  }).join("") + "</section>");
}
const others = PRESETS.filter((p) => !GROUPS[p.group]);   // 묶음이 없는 시연도 칩은 둔다
if (others.length) chipBox.insertAdjacentHTML("beforeend", `<span class="grp">기타</span>` + others.map((p) => `<button class="chip" data-preset="${esc(p.id)}" aria-pressed="false"><b>${esc(p.tp)}</b>${esc(p.label)}<em class="mod" hidden>수정됨</em></button>`).join(""));
for (const box of [chipBox, cardBox]) box.addEventListener("click", (e) => {
  const pair = e.target.closest("[data-pair]");
  if (pair) { openAddress(pair.dataset.pair); return; }
  const b = e.target.closest("[data-preset]");
  if (b) applyPreset(presetById(b.dataset.preset));
});
$("cardsBtn").addEventListener("click", () => {
  const open = cardBox.hidden;
  cardBox.hidden = !open; $("cardsBtn").setAttribute("aria-expanded", String(open));
  $("cardsBtn").textContent = open ? "카드 접기" : "카드로 보기";
});
$("demoPair").addEventListener("click", (e) => openAddress(e.currentTarget.dataset.pair));
$("demoReset").addEventListener("click", () => applyPreset(presetById(active)));

function syncPresets() {
  const cur = snapshot(), mod = !!active && isModified(cur);
  document.querySelectorAll("[data-preset]").forEach((el) => {
    const on = el.dataset.preset === active;
    el.setAttribute("aria-pressed", String(on));
    const m = el.querySelector(".mod"); if (m) m.hidden = !(on && mod);
  });
  const p = presetById(active);
  $("demoState").textContent = p ? (mod ? "수정됨" : "켜짐") : "없음";
  $("demoTitle").innerHTML = p ? `<b>${esc(p.tp)}</b>${esc(p.label)}` : "사용자 설정";
  $("demoInfo").innerHTML = p
    ? `<dt>볼 것</dt><dd>${esc(p.watch)}</dd><dt>이 페이지</dt><dd>${esc(p.expect.text)}</dd><dt>저장소</dt><dd>${esc(p.repo)}</dd>`
      + (mod ? `<dt>바꾼 것</dt><dd>${esc(diffText(cur))}</dd>` : "")
    : `<dt>안내</dt><dd>위 '시연'에서 하나를 고르면 저장소 결과를 그 설정 그대로 다시 달린다. '카드로 보기'는 시연마다 볼 것과 기대 결과를 보인다.</dd>`;
  const pb = $("demoPair");
  pb.hidden = !p?.pair;
  if (p?.pair) { pb.dataset.pair = p.pair; pb.textContent = `비교 ▸ ${pairInfo(p.pair).text}`; }
  $("demoReset").hidden = !(p && mod);
  $("demoNote").hidden = !p;
}
// 한 줄 칩에서 켜진 시연이 보이게 옆으로만 넘긴다(페이지는 움직이지 않는다).
function revealChip() {
  const b = [...chipBox.querySelectorAll("[data-preset]")].find((el) => el.dataset.preset === active);
  if (!b) return;
  const l = b.offsetLeft - chipBox.offsetLeft, r = l + b.offsetWidth;
  if (l < chipBox.scrollLeft || r > chipBox.scrollLeft + chipBox.clientWidth) chipBox.scrollLeft = Math.max(0, l - 40);
}

// 로봇을 바꾸면 한계가 바뀌어 GT 지도부터 다시 만든다. 센서 높이는 그 로봇의 기본 장착 높이로 맞춘다.
const syncRobot = segment("robot", opts.robot, (v) => { opts.robot = v; opts.sensorHeight = ROBOTS[v].sensorH; newWorld(); });
$("poseComp").addEventListener("change", (e) => { opts.poseComp = e.target.checked; restart(); });
$("wbcAware").addEventListener("change", (e) => { opts.wbcAware = e.target.checked; restart(); });
const setPN = slider("poseNoise", (v) => (v ? `${v.toFixed(2)}°` : "없음"), (v) => { opts.poseNoise = v; restart(); });
const syncPer = segment("perception", opts.perception, (v) => { opts.perception = v; restart(); });
const syncPl = segment("planner", opts.planner, (v) => { opts.planner = v; restart(); });
const syncCo = segment("controller", opts.controller, (v) => { opts.controller = v; restart(); });
$("layerSel").addEventListener("change", (e) => { setLayer(e.target.value); });
function setLayer(v) {
  view.layer = v; $("layerSel").value = v; uiKey = "";
  touch(true); ensureChassis();
}
// 차체 기하 기준은 지형이 바뀔 때만 한 번 계산한다(약 1 s). 층을 고를 때 필요하면 시작한다.
function ensureChassis() {
  if (view.layer !== "chassis" || world.chassisVer === world.terrainVersion || world.chassisBusy) return;
  world.chassisBusy = true;
  $("probe").textContent = "차체 기하 기준을 계산하는 중이다(방위각 8개 × 모든 칸, 약 1 s)…";
  const w = world;
  setTimeout(() => {
    flushAddr();   // 이 계산이 메인 스레드를 막는 동안 주소 쓰기가 밀리지 않게 먼저 쓴다
    w.chassis = chassisFeasibility(w.terrain.z, w.terrain.grid);
    w.chassisVer = w.terrainVersion; w.chassisBusy = false;
    if (w === world) $("probe").textContent = "차체 기하 기준: 빨강·보라·파랑·주황 칸은 어느 방향으로도 차체가 들어가지 못한다.";
  }, 30);
}
// 그릴 높이와 높이 과장: 2D 음영과 3D 기하가 함께 바뀐다(주소의 geo·ex).
$("geoSel").addEventListener("change", (e) => { view.geo = e.target.value; uiKey = ""; touch(true); });
const syncExag = segment("exag", view.exag, (v) => { view.exag = +v; uiKey = ""; touch(true); });
segment("tool", view.tool, (v) => { view.tool = v; });
segment("speed", 1, (v) => { speed = +v; });
const syncView = segment("view", view.mode, (v) => { viewChoice = v; touch(true); setMode(v); });

const setLevel = slider("level", (v) => `L${v}`, (v) => { opts.level = v; newWorld(); });
const setSeed = slider("seed", (v) => `${v}`, (v) => { opts.seed = v; newWorld(); });
const setSH = slider("sensorHeight", (v) => `${v.toFixed(2)} m`, (v) => { opts.sensorHeight = v; restart(); });
const setUN = slider("unknownNear", (v) => (v ? `${v.toFixed(2)} m` : "끔"), (v) => { opts.unknownNear = v; restart(); });
const setSR = slider("sensorRange", (v) => `${v.toFixed(1)} m`, (v) => { opts.sensorRange = v; restart(); });
// MPPI 값은 주행을 다시 시작하지 않고 다음 스텝부터 쓴다. 첫 스텝 뒤에 바꾸면 '주행 중 변경'이다.
const setK = slider("K", (v) => `${v}`, (v) => { opts.mppi.K = v; changed(); });
const setT = slider("T", (v) => `${(v * 0.1).toFixed(1)} s`, (v) => { opts.mppi.T = v; changed(); });
const setL = slider("lambda", (v) => v.toFixed(2), (v) => { opts.mppi.lambda = v; changed(); });
const setN = slider("noiseScale", (v) => `×${v.toFixed(2)}`, (v) => { opts.mppi.noise = [0.4 * v, 0.25 * v, 0.6 * v]; changed(); });
const setWT = slider("wTrav", (v) => v.toFixed(1), (v) => { opts.mppi.w.trav = v; changed(); });
const setWR = slider("wRisk", (v) => v.toFixed(1), (v) => { opts.mppi.w.risk = v; changed(); });
const setWA = slider("wAtt", (v) => `${v}`, (v) => { opts.mppi.w.attitude = v; changed(); });

for (const id of ["shadowCeiling", "depthPrior", "evidence", "stereo"]) {
  $(id).checked = opts[id];
  $(id).addEventListener("change", () => { opts[id] = $(id).checked; restart(); });
}
$("showRoute").addEventListener("change", (e) => { view.route = e.target.checked; });
$("showSamples").addEventListener("change", (e) => { view.samples = e.target.checked; });
$("showPoints").addEventListener("change", (e) => { view.points = e.target.checked; });

function stepOnce() {
  if (world.status !== "running") return;
  const k0 = world.k;
  world.step();
  meter.after(world, k0);
}
$("play").addEventListener("click", () => {
  if (world.status !== "running") { restart(); return; }
  paused = !paused; syncPlay();
});
$("stepBtn").addEventListener("click", () => { paused = true; syncPlay(); stepOnce(); });
$("restart").addEventListener("click", restart);
$("newSeed").addEventListener("click", () => { opts.seed = (opts.seed + 1) % 20; newWorld(); });
$("bannerRetry").addEventListener("click", restart);
$("bannerNew").addEventListener("click", () => { opts.seed = (opts.seed + 1) % 20; newWorld(); });
$("spawnPeds").addEventListener("click", () => { world.spawnCrossing(3); pedsFromPreset = false; restart(); });   // 시작 시각에 맞춘 보행자라 처음부터 다시
$("clearPeds").addEventListener("click", () => { world.clearPeds(); pedsFromPreset = false; changed(); });
$("linkBtn").addEventListener("click", () => copyLink(linkFor(addrState()), $("linkBtn")));
$("shareClose").addEventListener("click", () => { $("share").hidden = true; });
$("noticeClose").addEventListener("click", () => { $("notice").hidden = true; });
$("csvBtn").addEventListener("click", exportCsv);

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
  const R = ROBOTS[opts.robot];
  syncRobot(opts.robot); $("robotDesc").textContent = R.note;
  $("robotNote").textContent = `턱 ${Math.round(R.trav.maxStep * 100)} cm · 경사 ${Math.round(R.trav.maxSlope * 57.3)}° · ${R.vmax[0]} m/s`;
  $("poseComp").checked = opts.poseComp; setPN(opts.poseNoise || 0);
  $("wbcAware").checked = opts.wbcAware !== false; $("wbcAware").disabled = !R.wbc || opts.controller !== "mppi";
  $("poseComp").disabled = opts.perception !== "l1lite"; $("poseNoise").disabled = opts.perception !== "l1lite" || !opts.poseComp;
  $("perNote").textContent = PERCEPTION[opts.perception].note;
  $("plNote").textContent = PLANNERS[opts.planner].note;
  $("coNote").textContent = CONTROLLERS[opts.controller].note;
  $("mppiParams").hidden = opts.controller !== "mppi";
  // 그릴 것이 없는 표시 체크는 숨긴다: MPPI 샘플은 MPPI, LiDAR 점은 L1 간이에서만 있다.
  $("showSamples").closest("label").hidden = opts.controller !== "mppi";
  $("showPoints").closest("label").hidden = opts.perception !== "l1lite";
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

// ------------------------------------------------------------------ 주행 시작과 주소 상태
// 지형·지도를 다시 만드는 조작은 계산(0.1–0.3 s) 전에 주소부터 쓴다. 계산이 끝난 뒤의 touch()는 같은 주소라 다시 쓰지 않는다.
const viewKeys = () => ({ layer: view.layer, view: viewChoice, geo: view.geo, ex: view.exag });   // 주소의 보기 키
const putNext = (s) => putHash(serialize({ ...s, ...viewKeys() }));
function newWorld() {
  putNext({ ...snapshot(), goal: null, edits: [] });
  const peds = world.pedsInit;
  world = new World(opts); world.terrainVersion = 0; world.edited = false; edits = [];   // 새 지형이라 편집과 목표는 처음으로
  if (peds?.length) { world.pedsInit = []; for (const p of peds) world.addPed(p.x, p.y, p.vx, p.vy); world.peds = world.pedsInit.map((p) => ({ ...p })); }
  onNewRun();
}
function restart() {
  putNext(snapshot());
  world.opts = opts; world.reset();
  onNewRun();
}
function onNewRun() {
  paused = false; logged = false; acc = 0; uiKey = "";
  runStart = snapshot(); runChanged = false; meter = new EpisodeMeter();
  syncPanel(); syncPlay(); ensureChassis(); touch();
}

// 지금 '다시 달리기'가 돌릴 설정(주행 중 변경까지 담는다)
function snapshot() {
  const g = world.goal, g0 = world.terrain.goal;
  return canon({
    base: active, o: opts, ...viewKeys(),
    goal: g[0] === g0[0] && g[1] === g0[1] ? null : g.slice(),
    peds: pedsFromPreset ? null : (world.pedsInit || []).map((p) => [p.x, p.y, p.vx, p.vy]),
    edits,
  });
}
// 주소에 쓸 상태: 주행 중에 바꾼 것은 담지 않고 그 주행의 시작 상태를 둔다. 층·보기·그릴 높이·과장은 언제나 지금 것이다.
function addrState() {
  const s = runChanged && world.status === "running" ? runStart : snapshot();
  return { ...s, ...viewKeys() };
}
// 결과를 바꾸는 조작 뒤에 부른다. 첫 스텝 전이면 시작 상태에 담고, 주행 중이면 '주행 중 변경'으로 표시한다.
function changed() {
  if (world.status === "running") { if (world.k > 0) runChanged = true; else runStart = snapshot(); }
  touch();
}

// 주소·기록 행·시연 -> 화면. 시작 상태는 state.js의 buildWorld가 만든다(check.html과 같은 길).
function applyState(s, notes = []) {
  s = canon(s);
  if (started) putHash(serialize(s));
  active = s.base;
  for (const k of Object.keys(opts)) delete opts[k];
  Object.assign(opts, structuredClone(s.o));
  edits = s.edits.map((e) => e.slice());
  pedsFromPreset = s.peds === null;
  world = buildWorld(s, opts);
  world.terrainVersion = 0; world.edited = edits.length > 0;
  view.layer = s.layer; $("layerSel").value = s.layer;
  view.geo = s.geo; $("geoSel").value = s.geo; view.exag = s.ex; syncExag(s.ex);
  viewChoice = s.view;   // 3D가 한 번 안 열렸으면 주소가 3D여도 2D로 둔다(사용자가 3D를 누를 때만 다시 시도)
  if (!started || (s.view !== view.mode && !(s.view === "3d" && glFailed))) { syncView(s.view); setMode(s.view); }
  onNewRun();
  showNotes(notes);
  revealChip();
}
// 시연·비교 상대·기록 행을 눌러도 보기(2D·3D), 그릴 높이, 과장은 그대로 둔다. 층은 시연이 정한다.
const keepView = () => ({ view: viewChoice, geo: view.geo, ex: view.exag });
function applyPreset(p) { if (p) applyState({ ...baseState(p.id), ...keepView() }); }
function openAddress(addr) { const r = parse(addr); applyState({ ...r.state, ...keepView() }, r.notes); }

function showNotes(notes) {
  $("notice").hidden = !notes.length;
  $("noticeText").textContent = notes.join(" ");
}

// 주소 쓰기: 마지막 조작 200 ms 뒤 replaceState(브라우저 기록은 늘지 않는다). 손으로 고친 주소는 hashchange로 다시 연다.
// 시간은 조작한 순간부터 센다. 지형을 새로 만드는 데 걸린 시간(L1 간이에서 약 0.2 s)을 기다림에 더하지 않기 위해서다.
// 층·보기처럼 한 번에 끝나는 조작은 바로 쓴다(now).
let addrTimer = 0, actedAt = performance.now();
for (const t of ["input", "change", "click", "keydown", "pointerup"]) document.addEventListener(t, () => { actedAt = performance.now(); }, true);
function touch(now = false) {
  syncPresets(); clearTimeout(addrTimer); addrTimer = 0;
  if (now) writeAddr();
  else addrTimer = setTimeout(writeAddr, Math.max(0, actedAt + 200 - performance.now()));
}
function writeAddr() { addrTimer = 0; putHash(serialize(addrState())); }
function flushAddr() { if (addrTimer) { clearTimeout(addrTimer); writeAddr(); } }   // 기다리는 주소 쓰기를 지금 한다
function putHash(h) {
  if (serialize(parse(location.hash).state) === h) return;             // 지금 주소가 이미 이 상태다(#TP-0031처럼 다른 꼴 포함)
  if (!location.hash && h === "pg") return;                               // 처음 연 기본 설정은 주소를 비워 둔다
  try { history.replaceState(history.state, "", "#" + h); } catch { /* 틀 안에서 막히면 링크 복사만 쓴다 */ }
}
window.addEventListener("hashchange", () => {
  const r = parse(location.hash);
  if (serialize(r.state) === serialize(addrState())) return;
  applyState(r.state, r.notes);
});

// 공유 링크: 공개 페이지(로컬 서버·GitHub Pages)를 맨 위 창으로 열었으면 그 주소, claude.ai 게시본이나 iframe 안이면 공개 Playground 주소.
function shareBase() {
  let top = true;
  try { top = window.top === window; } catch { top = false; }
  const claude = /(^|\.)claude\.ai$|(^|\.)claudeusercontent\.com$/.test(location.hostname);
  return top && !claude && /^https?:$/.test(location.protocol) ? location.origin + location.pathname : PUBLIC_BASE;
}
const linkFor = (s) => shareBase() + "#" + serialize(s);
async function copyLink(url, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch { /* 권한이 없으면 아래 입력칸으로 */ }
  const inp = $("shareUrl");
  inp.value = url;
  if (!ok) {
    $("share").hidden = false; inp.focus(); inp.select();
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    $("shareNote").textContent = ok ? "복사했다." : "복사가 막혀 주소를 선택해 두었다. Ctrl+C(⌘C)로 복사한다.";
  }
  if (btn) { const t = btn.dataset.label || (btn.dataset.label = btn.textContent); btn.textContent = ok ? "복사했다 ✓" : "주소를 선택했다"; setTimeout(() => { btn.textContent = t; }, 1600); }
  return ok;
}

// ------------------------------------------------------------------ 지도 클릭(2D)
const cv = $("map2d");
function evWorld(e) { const r = cv.getBoundingClientRect(); return map2d.toWorld(e.clientX - r.left, e.clientY - r.top); }
function editTerrain(op, x, y) {
  applyEdit(world.terrain, op, x, y); edits.push([op, x, y]);
  world.terrainVersion++; world.edited = true; world.rebuildGT(); ensureChassis();
  if (world.status === "running" && world.k === 0) world.reset();   // 첫 스텝 전 편집은 시작 상태가 된다(주소로 연 World와 같다)
  else { world.observe(); world.replan(); }
  changed();
}
cv.addEventListener("pointerdown", (e) => {
  if (!map2d.L) return;
  const [x, y] = evWorld(e).map(r2), g = world.terrain.grid;
  if (!g.inside(x, y)) return;
  if (view.tool === "goal") {
    if (world.status !== "running") restart();          // 끝난 주행은 처음부터 다시 달린다
    const why = world.setGoal(x, y);
    if (why) $("probe").textContent = why + ". 다른 곳을 고르세요.";
    else changed();
  }
  else if (view.tool === "box") editTerrain("box", x, y);
  else if (view.tool === "pothole") editTerrain("pothole", x, y);
  else if (view.tool === "erase") editTerrain("erase", x, y);
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
  world.addPed(from[0], from[1], r2(ux * sp), r2(uy * sp));
  view.drag = null; pedsFromPreset = false; changed();
});

function probe(x, y) {
  const g = world.terrain.grid;
  if (!g.inside(x, y)) { $("probe").textContent = ""; return; }
  const [r, c] = g.cell(x, y), i = r * g.W + c, gt = world.gt, b = world.belief;
  const state = b.known[i] ? "관측" : b.bounded[i] ? "미관측(상한·prior)" : "미관측";
  const cm = (v) => (v * 100).toFixed(1);
  const seen = b.known[i] ? `로봇이 본 높이 ${cm(b.elev[i])} cm(오차 ${cm(b.elev[i] - world.terrain.z[i])})` : "로봇은 못 봄";
  const sig = opts.perception === "l1lite" && Number.isFinite(world.emap.v[i]) ? ` · σ ${cm(Math.sqrt(world.emap.v[i]))} cm` : "";
  const ceil = !b.known[i] && world.beliefCeil && Number.isFinite(world.beliefCeil[i]) ? ` · 상한 ${cm(world.beliefCeil[i])} cm` : "";
  const ch = world.chassis && world.chassisVer === world.terrainVersion
    ? ` · 차체: ${world.chassis.lethalAll[i] ? ["", "자세로", "바퀴 들뜸으로", "배 밑 간섭으로"][world.chassis.reason[i]] + " 못 들어감" : world.chassis.lethalAny[i] ? "일부 방향 막힘" : "들어감"}` : "";
  $("probe").textContent = `x ${x.toFixed(2)} y ${y.toFixed(2)} m · 실제 높이 ${cm(world.terrain.z[i])} cm · ${seen}${sig}${ceil}`
    + ` · 경사 ${(b.slope[i] * 57.3).toFixed(1)}° · 턱 ${cm(b.step[i])} cm · 거칠기 ${cm(b.rough[i])} cm`
    + ` · 로봇이 본 cost ${b.cost[i].toFixed(2)} (${state}) · 실제 cost ${gt.cost[i].toFixed(2)}${ch}`;
}

// ------------------------------------------------------------------ 3D
// 3D에서는 클릭 도구를 숨긴다(3D에서 지형을 찍는 것은 TP-0115). 3D에 보이는 조작은 모두 3D 그림을 바꾼다.
async function setMode(m) {
  view.mode = m;
  $("gl").hidden = m !== "3d"; $("map2d").hidden = m === "3d"; $("hint3d").hidden = m !== "3d";
  $("tool").hidden = m === "3d";
  fitMap();   // 도구 줄이 숨거나 나타나 툴바 높이가 바뀐다
  if (m === "3d") {
    try { await map3d.init(); glFailed = false; }
    catch (err) {
      glFailed = true;
      syncView("2d"); await setMode("2d");
      $("probe").textContent = `3D 보기를 열지 못했다(${err.message}). 2D 보기로 돌아왔다.`;
    }
  }
}

// ------------------------------------------------------------------ 표시
const deg = (r) => (r * 57.2958).toFixed(1);
function telemetry() {
  const c = attitudeNow(world);   // 3D 로봇도 이 pitch·roll로 기운다(view.js robotPose)
  const cls = (v, lim) => (Math.abs(v) > lim ? "bad" : Math.abs(v) > 0.7 * lim ? "warn" : "");
  const clear = world.stats.minClear;
  $("telemetry").innerHTML = [
    `<span>t <b>${world.t.toFixed(1)} s</b></span>`,
    `<span>속도 <b>${c.speed.toFixed(2)} m/s</b></span>`,
    `<span class="${cls(c.pitch, SIM.pitchLimit)}">pitch <b>${deg(c.pitch)}°</b></span>`,
    `<span class="${cls(c.roll, SIM.rollLimit)}">roll <b>${deg(c.roll)}°</b></span>`,
    `<span class="${c.gtCost > 0.7 ? "warn" : ""}">실제 cost <b>${c.gtCost.toFixed(2)}</b></span>`,
    world.mapErr && opts.perception !== "gt" ? `<span class="${world.mapErr.rmse > 0.03 ? "warn" : ""}" title="로봇 3 m 안 관측 칸: 본 높이와 실제 높이의 RMSE">높이 오차 <b>${(world.mapErr.rmse * 100).toFixed(1)} cm</b></span>` : "",
    world.mapErr && opts.perception !== "gt" ? `<span class="${world.mapErr.falseBlocked > 20 ? "warn" : ""}" title="로봇 3 m 안: 로봇 지도는 치명인데 실제 cost는 치명이 아닌 관측 칸">거짓 치명 <b>${world.mapErr.falseBlocked}칸</b></span>` : "",
    world.R && world.R.gait ? `<span title="걸음새로 흔들린 몸체 pitch(지형 기울기 제외)">흔들림 <b>${deg(world.body.gait.pitch)}°</b></span>` : "",
    world.wbc ? `<span title="GR00T 분리형 WBC: 하체 정책이 받은 navigate_cmd(vx·vy·ωz). 크기가 0.05보다 작으면 서기 정책으로 선다(TP-0135)">WBC <b>${world.wbc.standing ? "서기" : "걷기"}</b>${world.wbc.cmd ? ` · 명령 <b>${world.wbc.cmd.map((v) => v.toFixed(2)).join(" ")}</b>` : ""}</span>` : "",
    world.R?.feet ? `<span class="${world.footFaults ? "warn" : ""}" title="발이 디딘 횟수와 나쁜 디딤(경사 30° 초과 또는 턱 한계 초과 칸). 실패 판정에는 쓰지 않는다(TP-0135)">발 디딤 <b>${world.footCount}</b> · 나쁜 디딤 <b>${world.footFaults}</b></span>` : "",
    world.peds.length ? `<span class="${clear < 0.3 ? "warn" : ""}">보행자 여유 <b>${Number.isFinite(clear) ? clear.toFixed(2) + " m" : "-"}</b></span>` : "",
    `<span>지도 <b>${world.ms.map.toFixed(0)}</b> · 계획 <b>${world.ms.plan.toFixed(0)}</b> · 제어 <b>${world.ms.ctrl.toFixed(0)} ms</b></span>`,
    !paused && world.status === "running" ? `<span class="${rt.factor < 0.9 * speed ? "warn" : ""}">실시간 <b>×${rt.factor.toFixed(2)}</b></span>` : "",
  ].join("");
  $("pedCount").textContent = `${world.peds.length}명`;
}

const TERM_LABEL = { reference: "경로", trav: "지형", risk: "위험 CVaR", attitude: "자세", control: "제어", approach: "목표 접근" };
function bars() {
  const c = world.ctrl;
  if (opts.controller === "learned" || opts.controller === "blind") {
    const pol = c?.policy;
    $("bars").innerHTML = pol
      ? `<p class="empty">학습 정책은 비용 항이 없다. 입력 50개 → tanh MLP(${pol.nParams.toLocaleString()} 파라미터) → 몸체 twist 3개.`
        + `${c.blind ? " 지형 입력 36개는 0이고 경로 대신 목표 직선만 받는다." : ""} 가중치는 파이썬에서 ES로 학습했다(TP-0128).</p>`
      : '<p class="empty">이 로봇의 학습 가중치가 없어 pure pursuit로 돈다.</p>';
    $("ctrlMs").textContent = c ? `${c.ms.toFixed(2)} ms` : "";
    return;
  }
  if (!c || !c.breakdown) { if (opts.controller !== "mppi") $("bars").innerHTML = '<p class="empty">Pure pursuit는 비용을 쓰지 않는다.</p>'; $("ctrlMs").textContent = ""; return; }
  const entries = Object.entries(c.breakdown), mx = Math.max(1, ...entries.filter(([, v]) => v < 1000).map(([, v]) => v));
  $("bars").innerHTML = entries.map(([k, v]) => {
    const hard = v >= 1000, w = hard ? 100 : Math.min(100, (100 * v) / mx);
    return `<div><span>${TERM_LABEL[k]}</span><span class="track"><span class="fill${hard ? " hard" : ""}" style="width:${w}%"></span></span><output>${hard ? "치명 " : ""}${v.toFixed(1)}</output></div>`;
  }).join("");
  $("ctrlMs").textContent = `K ${opts.mppi.K} · ${c.ms.toFixed(1)} ms`;
}

// 시연을 그대로 달렸는데 결과가 PRESETS.expect와 다르면 배너에 쓴다.
function expectNote() {
  const p = presetById(runStart?.base);
  if (!p || runChanged || isModified(runStart)) return "";
  const e = p.expect, same = world.status === e.status && (e.status !== "failed" || !e.fail || e.fail === world.failCode);
  return same ? "" : `시연 기대와 다르다(기대: ${e.text})`;
}
function mppiText(o) {
  if (o.controller !== "mppi") return "—";
  const d = defaultOptions().mppi, m = o.mppi, nz = +(m.noise[0] / 0.4).toFixed(2), extra = [];
  if (nz !== 1) extra.push(`잡음 ×${nz}`);
  if (m.w.trav !== d.w.trav || m.w.risk !== d.w.risk || m.w.attitude !== d.w.attitude) extra.push(`가중 ${m.w.trav}/${m.w.risk}/${m.w.attitude}`);
  return [`K ${m.K}`, `T ${(m.T * SIM.dt).toFixed(1)} s`, `λ ${m.lambda}`, ...extra].join(" · ");
}
function banner() {
  const b = $("banner");
  if (world.status === "running") { b.hidden = true; return; }
  b.hidden = false;
  b.className = "banner " + (world.status === "reached" ? "ok" : "bad");
  $("bannerText").textContent = world.status === "reached" ? `도달 · ${world.t.toFixed(1)} s · ${world.stats.len.toFixed(1)} m` : `실패 · ${world.failure} · ${world.t.toFixed(1)} s`;
  const en = expectNote();
  $("bannerExpect").hidden = !en; $("bannerExpect").textContent = en;
  if (!logged) {
    logged = true;
    const s = world.stats;
    runLog.unshift({
      st: runStart, changed: runChanged, m: meter.row(world, { edited: world.edited }),
      robot: ({ swerve: "스워브", quadruped: "사족", wheelLeg: "바퀴 사족", humanoid: "휴머노이드" }[opts.robot])
        + (opts.perception === "l1lite" && opts.robot !== "swerve" ? (opts.poseComp ? ` 보상${opts.poseNoise ? " ±" + opts.poseNoise + "°" : ""}` : " 보상 끔") : "")
        + (opts.robot === "humanoid" && opts.controller === "mppi" ? (opts.wbcAware !== false ? " WBC 앎" : " WBC 모름") : ""),
      err: s.errN ? `${((100 * s.errSum) / s.errN).toFixed(1)} cm` : "-",
      sc: `${opts.scenario}${DIFFICULTY[opts.scenario] ? "@L" + opts.level : ""} s${opts.seed}${world.edited ? " (편집)" : ""}`,
      per: ({ gt: "완전", range: "L0", occlusion: `가림 ${opts.sensorHeight.toFixed(1)} m`, l1lite: `L1 간이 ${opts.sensorHeight.toFixed(1)} m` }[opts.perception])
        + (opts.perception === "occlusion" || opts.perception === "l1lite" ? `${opts.shadowCeiling ? " +상한" : ""}${opts.shadowCeiling && opts.depthPrior ? " +prior" : ""}` : "")
        + (opts.perception === "l1lite" && opts.stereo ? " +스테레오" : "")
        + (opts.unknownNear ? ` +미관측 ${opts.unknownNear} m` : ""),
      stack: `${opts.planner}+${opts.controller}`, mppi: mppiText(runStart.o), ok: world.status === "reached", res: world.status === "reached" ? "도달" : world.failure,
      t: world.t, pitch: world.stats.maxPitch, cost: world.stats.gtCostSum / Math.max(1, world.stats.steps),
    });
    runLog.length = Math.min(runLog.length, 10);
    renderLog();
    syncPlay(); touch();   // 주행 중 변경이 있었으면 이제 주소가 다음 주행의 설정이 된다
  }
}
function renderLog() {
  $("history").innerHTML = runLog.map((h, i) => {
    const tip = h.changed ? "주행 중에 MPPI 값·목표·보행자·지형을 바꿔서, 이 행의 주소(시작 상태)로는 같은 결과가 나오지 않을 수 있다" : "이 설정으로 다시 달린다";
    return `<tr data-i="${i}" title="${tip}"><td><button class="mini" data-act="rerun" aria-label="${i + 1}번째 기록을 다시 달리기">▶</button></td>`
      + `<td>${esc(h.robot)}</td><td>${esc(h.sc)}</td><td>${esc(h.per)}</td><td>${esc(h.stack)}</td><td>${esc(h.mppi)}</td>`
      + `<td class="${h.ok ? "ok" : "bad"}">${esc(h.res)}${h.changed ? '<span class="tag">주행 중 변경</span>' : ""}</td>`
      + `<td>${h.t.toFixed(1)} s</td><td>${deg(h.pitch)}°</td><td>${h.cost.toFixed(3)}</td><td>${esc(h.err)}</td>`
      + `<td><a class="mini" data-act="link" href="${esc(linkFor(h.st))}" target="_blank" rel="noopener" title="이 주행의 시작 설정을 새 탭으로 연다">링크</a></td></tr>`;
  }).join("");
}
$("history").addEventListener("click", (e) => {
  if (e.target.closest("[data-act=link]")) return;      // 링크는 새 탭으로
  const tr = e.target.closest("tr[data-i]");
  if (!tr) return;
  const h = runLog[+tr.dataset.i];
  if (h) applyState({ ...h.st, layer: view.layer, ...keepView() });
});
function exportCsv() {
  const csv = toCsv(runLog.slice().reverse().map((h) => h.m));     // 오래된 주행부터
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "travplan-playground-metrics.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch { /* 아래 글 상자로 */ }
  if (shareBase() === PUBLIC_BASE) {   // claude.ai·iframe 안에서는 내려받기가 막힐 수 있다
    $("csvBox").hidden = false; $("csvText").value = csv; $("csvText").select();
  }
  return csv;
}

// ------------------------------------------------------------------ 표시 보조
// 그릴 높이 범례: 면의 높이가 무엇인지, 못 본 칸은 로봇이 믿는 값이라는 것, 과장 배율.
function geoLegend() {
  const ex = `<b>높이 ×${view.exag}</b>`, pose = view.mode === "3d" ? " 3D 로봇의 pitch·roll은 과장하지 않은 실제 값이다." : "";
  if (view.geo === "true") return `<span class="geo">${ex} 음영·3D 높이는 참 지형이다. 로봇이 못 본 칸도 보인다.${pose}</span>`;
  const fill = opts.perception === "gt" ? "완전 관측이라 참 지형과 같다."
    : "못 본 칸은 로봇이 믿는 값이다(관측의 이웃 평균을 0.4 m까지 번지고 그 밖은 0 m, 그림자 상한·깊이 prior가 있으면 그 아래로 내린 높이).";
  return `<span class="geo">${ex} 음영·3D 높이는 로봇이 본 지형이다. ${fill}${pose}</span>`
    + (view.geo === "both" ? `<span><i class="line" style="background:${CONTOUR.css};box-shadow:0 0 0 1px #6b7773"></i>참 지형 등고선(5 cm${view.mode === "3d" ? ", 면에 가린 곳은 옅게" : ""})</span>` : "");
}
function syncLegend() {
  const L = LAYERS[view.layer];
  $("legendLayer").innerHTML = L.legend();
  $("legendGeo").innerHTML = geoLegend();
  $("layerNote").textContent = `${L.group} · ${L.label}: ${L.note}`;
  document.querySelectorAll(".legend [data-l1]").forEach((el) => { el.hidden = opts.perception !== "l1lite"; });
  $("legHorizon").textContent = (opts.mppi.T * SIM.dt).toFixed(1);
}

// 첫 화면에 재생 막대가 들어오게 지도 높이를 줄인다(넓은 화면의 2 : 1.08을 넘지 않는다). 펼친 시연 카드는 높이 계산에서 뺀다.
function fitMap() {
  const wrap = $("wrap"), cards = $("cards");
  const above = wrap.getBoundingClientRect().top + window.scrollY - (cards.hidden ? 0 : cards.offsetHeight + 10);
  const play = $("play").getBoundingClientRect().height + 18;   // 재생 막대 첫 줄(위아래 여백 포함)
  wrap.style.setProperty("--fit-h", `${Math.max(220, Math.floor(window.innerHeight - above - play - 6))}px`);
}
window.addEventListener("resize", fitMap);
document.fonts?.ready?.then(fitMap);

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
    while (acc >= SIM.dt && world.status === "running" && performance.now() - t0 < 45) { stepOnce(); acc -= SIM.dt; }
    if (acc > 0.3) acc = 0.3;
  }
  realtime(now);
  if (view.mode === "2d") map2d.draw(world, view, CSS);
  else if (map3d.renderer) { map3d.update(world, view); map3d.render(CSS.mapBg); }
  // 글자 영역은 스텝·상태·층이 바뀔 때만 다시 쓴다.
  const key = `${world.k}|${world.status}|${paused}|${world.peds.length}|${view.layer}|${view.geo}|${view.exag}|${view.mode}|${opts.mppi.T}|${Math.round(rt.factor * 10)}|${world.mapVersion}`;
  if (key !== uiKey) { uiKey = key; telemetry(); bars(); banner(); syncLegend(); }
  requestAnimationFrame(frame);
}

// 대시보드 링크: 저장소(로컬 서버·GitHub Pages)에서는 옆의 docs/dashboard.html, 게시본에서는 대시보드 게시본
const DASHBOARD_ARTIFACT = "https://claude.ai/artifact/QMumSBE3kBQMqAyu1oPxHG";
{
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname.endsWith("github.io") || location.protocol === "file:";
  $("dashLink").href = local ? "../dashboard.html" : DASHBOARD_ARTIFACT;
}

// 검사용(check.html, 헤드리스 검사): 같은 출처에서 지금 주행을 끝까지 계산하고 결과·주소·CSV를 읽는다. 화면 조작에는 쓰지 않는다.
window.playgroundTest = {
  hash: () => serialize(addrState()),
  link: () => linkFor(addrState()),
  result: () => ({ status: world.status, fail: world.failCode || "", t: world.t, k: world.k, pose: world.pose.slice() }),
  runToEnd() { paused = true; syncPlay(); while (world.status === "running") stepOnce(); banner(); return this.result(); },
  log: () => runLog.map((h) => ({ link: linkFor(h.st), hash: serialize(h.st), changed: h.changed, m: h.m })),
  csv: () => toCsv(runLog.slice().reverse().map((h) => h.m)),
  step(n = 1) { paused = true; syncPlay(); for (let i = 0; i < n; i++) stepOnce(); return this.result(); },
  // 3D 검사(TP-0106): three.js 로봇의 회전 행렬에서 읽은 pitch·roll, 텔레메트리 값, 메시 높이와 그릴 높이의 차.
  view3d() {
    if (view.mode !== "3d" || !map3d.renderer || !map3d.mesh) return null;
    map3d.update(world, view); map3d.robot.updateMatrixWorld(true);
    const e = map3d.robot.matrixWorld.elements;   // 열 우선: R[2][0] = e[2], R[2][1] = e[6], R[2][2] = e[10]
    const H = drawHeights(view.geo, world), pos = map3d.mesh.geometry.attributes.position, cells = map3d.cells, known = world.belief.known;
    let meshErr = 0, unseen = 0;
    for (let v = 0; v < cells.length; v++) {
      if (!known[cells[v]]) unseen++;
      meshErr = Math.max(meshErr, Math.abs(pos.getZ(v) / view.exag - H.fill[cells[v]]));
    }
    const a = attitudeNow(world), gait = world.body?.gait || { pitch: 0, roll: 0 };
    return {
      geo: view.geo, exag: view.exag, robot: { pitch: Math.asin(Math.max(-1, Math.min(1, e[2]))), roll: Math.atan2(e[6], e[10]), z: e[14] },
      tele: { pitch: a.pitch, roll: a.roll }, gait: { pitch: gait.pitch, roll: gait.roll }, meshErr, unseen, vertices: cells.length,
      visible: { samples: map3d.samples.visible, points: map3d.points.visible, ring: map3d.ring.visible, contour: map3d.contour.visible, route: !!map3d.lines.route?.line.visible },
    };
  },
};

// 시작: 주소(#TP-0047, #TP-0047?…, #pg?…)를 열고, 없으면 기본 설정. 기본 보기는 3D이고 WebGL이 없으면 2D로 돌아간다.
{
  const r = parse(location.hash);
  applyState(r.state, r.notes);
  started = true;
}
// 동작 줄이기 설정이면 일시정지로 시작한다.
if (matchMedia("(prefers-reduced-motion: reduce)").matches) { paused = true; syncPlay(); }
fitMap();
requestAnimationFrame(frame);
