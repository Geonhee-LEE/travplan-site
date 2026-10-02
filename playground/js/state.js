// 주소 해시 <-> Playground 설정. 화면 하나를 링크 하나로 다시 연다(TP-0105). DOM을 쓰지 않아 check.html과 Worker도 읽는다.
//   #TP-0047                                   시연 그대로
//   #TP-0047?v=3d&layer=belief_elev            시연 + 덮어쓰기
//   #pg?sc=bumps_potholes&s=4&per=occlusion    사용자 설정(기본값과 같은 키는 생략)
// 값은 화이트리스트와 범위로 자르고, 모르는 값은 기본값(시연이면 시연의 값)으로 돌린다.
// 상태는 { base, o, layer, view, geo, ex, goal, peds, edits }다. o는 defaultOptions()와 같은 모양이고,
// geo·ex는 그릴 높이와 높이 과장(view.js, TP-0106)이다.
// goal·peds가 null이면 지형·시연이 정한 것을 쓴다. 주행 중에 바꾼 것은 여기 담지 않는다(main.js가 기록 행에 표시).
import { World, defaultOptions, PERCEPTION } from "./sim.js";
import { SCENARIOS } from "./terrain.js";
import { PLANNERS } from "./planner.js";
import { CONTROLLERS } from "./control.js";
import { ROBOTS } from "./robots.js";
import { LAYERS } from "./render2d.js";
import { PRESETS } from "./presets.js";
import { GEO, EXAG } from "./view.js";

// 코어 버전 키: 코어 모듈 14개(chassis·control·core·mpot·perception·planner·plannerd·plannerd_weights·policy·policy_weights·robots·sim·terrain·travmap .js)를 이름순으로 이은
// 내용의 sha256 앞 8자. scripts/check_playground.sh가 다시 계산해 다르면 실패한다. 코어를 고치면 이 값도 바꾼다.
export const CORE_VERSION = "93ac0146";

// 공유 링크의 바탕. claude.ai 게시본이나 iframe 안에서는 location.href가 틀 주소일 수 있어 이 주소로 링크를 만든다.
export const PUBLIC_BASE = "https://geonhee-lee.github.io/travplan-site/playground/";

const MAP = { W: 16, H: 8 };   // 모든 시나리오의 지도 크기 [m](terrain.js field(16, 8))

// ------------------------------------------------------------------ 규칙
const num = (lo, hi, d) => ({ kind: "num", lo, hi, d });
const one = (keys) => ({ kind: "enum", keys });
const flag = { kind: "bool" };
const decimals = (d) => (String(d).split(".")[1] || "").length;

function snap(r, v) {       // 범위로 자르고 슬라이더 눈금에 맞춘다
  const n = Math.min(Math.round((r.hi - r.lo) / r.d), Math.max(0, Math.round((v - r.lo) / r.d)));
  return +(r.lo + n * r.d).toFixed(Math.max(decimals(r.d), decimals(r.lo)));
}

// [주소 키, 읽기, 쓰기, 규칙]. 순서가 주소에 쓰는 순서다.
const at = (path) => [(o) => path.reduce((a, k) => a[k], o), (o, v) => { const p = path.slice(0, -1).reduce((a, k) => a[k], o); p[path[path.length - 1]] = v; }];
const OPT_KEYS = [
  ["sc", ...at(["scenario"]), one(Object.keys(SCENARIOS))],
  ["lv", ...at(["level"]), num(0, 3, 1)],
  ["s", ...at(["seed"]), num(0, 19, 1)],
  ["rb", ...at(["robot"]), one(Object.keys(ROBOTS))],
  ["pc", ...at(["poseComp"]), flag],
  ["pn", ...at(["poseNoise"]), num(0, 3, 0.25)],
  ["wbc", ...at(["wbcAware"]), flag],
  ["per", ...at(["perception"]), one(Object.keys(PERCEPTION))],
  ["sh", ...at(["sensorHeight"]), num(0.2, 1.2, 0.05)],
  ["sr", ...at(["sensorRange"]), num(3, 8, 0.5)],
  ["ceil", ...at(["shadowCeiling"]), flag],
  ["dp", ...at(["depthPrior"]), flag],
  ["ev", ...at(["evidence"]), flag],
  ["un", ...at(["unknownNear"]), num(0, 2, 0.25)],
  ["unc", ...at(["unknownNearCost"]), num(0, 1, 0.05)],
  ["st", ...at(["stereo"]), flag],
  ["pl", ...at(["planner"]), one(Object.keys(PLANNERS))],
  ["co", ...at(["controller"]), one(Object.keys(CONTROLLERS))],
  ["gs", ...at(["genSteps"]), num(1, 40, 1)],
  ["pf", ...at(["pdFallback"]), flag],
  ["K", ...at(["mppi", "K"]), num(32, 1024, 32)],
  ["T", ...at(["mppi", "T"]), num(10, 60, 5)],
  ["lam", ...at(["mppi", "lambda"]), num(0.05, 2, 0.05)],
  // 탐색 잡음은 화면 슬라이더처럼 기본 [0.4, 0.25, 0.6]의 배율 하나로 담는다.
  ["nz", (o) => o.mppi.noise[0] / 0.4, (o, v) => { o.mppi.noise = [0.4 * v, 0.25 * v, 0.6 * v]; }, num(0.25, 2, 0.05)],
  ["wt", ...at(["mppi", "w", "trav"]), num(0, 20, 0.5)],
  ["wr", ...at(["mppi", "w", "risk"]), num(0, 10, 0.5)],
  ["wa", ...at(["mppi", "w", "attitude"]), num(0, 60, 1)],
];
const VIEW_KEYS = ["v", "layer", "geo", "ex"];   // 결과를 바꾸지 않는 키(보기, 층, 그릴 높이, 높이 과장)
// 결과를 바꾸는 키. 이것이 기본과 다르면 시연은 '수정됨'이고 주소에 cv를 붙인다.
export const RUN_KEYS = new Set([...OPT_KEYS.map((k) => k[0]), "goal", "ped", "ed"]);

function enc(rule, v) {
  if (rule.kind === "bool") return v ? "1" : "0";
  if (rule.kind === "num") return String(snap(rule, v));
  return String(v);
}
// -> [값, 쓸 수 있나]
function dec(rule, s) {
  if (rule.kind === "bool") return s === "1" || s === "true" ? [true, true] : s === "0" || s === "false" ? [false, true] : [null, false];
  if (rule.kind === "num") { const v = s.trim() === "" ? NaN : Number(s); return Number.isFinite(v) ? [snap(rule, v), true] : [null, false]; }
  return rule.keys.includes(s) ? [s, true] : [null, false];
}

const EDIT_CODE = { box: "b", pothole: "p", erase: "e" };
const EDIT_NAME = { b: "box", p: "pothole", e: "erase" };
// 이름표에서 찾을 때는 자기 키만 본다(constructor·__proto__ 같은 상속 이름은 모르는 값이다).
const own = (table, k) => (Object.hasOwn(table, k) ? table[k] : undefined);
// 목록 상한. 화면에서 만들 수 있는 양보다 넉넉히 두고, 넘으면 그 키 전체를 모르는 값으로 본다.
const MAX_PEDS = 100, MAX_EDITS = 1000;
const inMap = (x, y) => x >= 0 && y >= 0 && x <= MAP.W && y <= MAP.H;
const nums = (s, n) => { const a = s.split(",").map((t) => (t.trim() === "" ? NaN : Number(t))); return a.length === n && a.every(Number.isFinite) ? a : null; };

function encGoal(g) { return g ? `${g[0]},${g[1]}` : ""; }
function decGoal(s) { const a = nums(s, 2); return a && inMap(a[0], a[1]) ? a : undefined; }
function encPeds(p) { return p.map((q) => q.join(",")).join(";"); }
function decPeds(s) {
  if (s === "") return [];
  const out = s.split(";").filter((t) => t.trim()).map((t) => nums(t, 4));
  const ok = out.length <= MAX_PEDS && out.every((a) => a && Math.abs(a[0]) <= 100 && Math.abs(a[1]) <= 100 && Math.hypot(a[2], a[3]) <= 3);
  return ok ? out : undefined;
}
function encEdits(e) { return e.map(([op, x, y]) => `${EDIT_CODE[op]},${x},${y}`).join(";"); }
function decEdits(s) {
  if (s === "") return [];
  const out = s.split(";").filter((t) => t.trim()).map((t) => { const [c, ...r] = t.split(","), op = own(EDIT_NAME, c.trim()), a = nums(r.join(","), 2); return op && a && inMap(a[0], a[1]) ? [op, a[0], a[1]] : null; });
  return out.length <= MAX_EDITS && out.every(Boolean) ? out : undefined;
}

// 주소 글자: 이 규칙의 값은 [A-Za-z0-9._,;-]뿐이다. 나머지는 퍼센트 인코딩한다.
const esc = (s) => String(s).replace(/[^A-Za-z0-9._,;-]/g, (c) => encodeURIComponent(c));
const unesc = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const clip = (s) => (s.length > 40 ? s.slice(0, 40) + "…" : s);   // 알림에 옮기는 값은 40자까지

// ------------------------------------------------------------------ 상태
export function presetById(id) { return PRESETS.find((p) => p.id === id) || null; }

// 시연(또는 기본 설정)을 그대로 연 상태
export function baseState(id = null) {
  const p = presetById(id), o = defaultOptions();
  if (p) Object.assign(o, structuredClone(p.set));
  return { base: p ? p.id : null, o, layer: p?.layer || "belief", view: "3d", geo: "belief", ex: 2, goal: null, peds: null, edits: [] };
}

// 같은 뜻의 상태를 한 모양으로: 시연 보행자가 없는 바탕의 빈 보행자 목록은 null(없음)과 같다.
export function canon(st) {
  const p = presetById(st.base);
  const peds = st.peds === null || (st.peds.length === 0 && !p?.peds) ? null : st.peds.map((q) => q.slice());
  return {
    base: p ? p.id : null, o: structuredClone(st.o), layer: st.layer, view: st.view,
    geo: own(GEO, st.geo) ? st.geo : "belief", ex: EXAG.includes(st.ex) ? st.ex : 2,   // 옛 상태(geo·ex 없음)는 기본값
    goal: st.goal ? st.goal.slice() : null, peds, edits: st.edits.map((e) => e.slice()),
  };
}

// 바탕(시연 또는 기본)과 다른 키 -> [[키, 주소 값], ...]
export function diff(st) {
  const s = canon(st), b = baseState(s.base), out = [];
  for (const [k, get, , rule] of OPT_KEYS) { const a = enc(rule, get(s.o)); if (a !== enc(rule, get(b.o))) out.push([k, a]); }
  if (s.goal) out.push(["goal", encGoal(s.goal)]);
  if (s.peds !== null) out.push(["ped", encPeds(s.peds)]);
  if (s.edits.length) out.push(["ed", encEdits(s.edits)]);
  if (s.view !== b.view) out.push(["v", s.view]);
  if (s.layer !== b.layer) out.push(["layer", s.layer]);
  if (s.geo !== b.geo) out.push(["geo", s.geo]);
  if (s.ex !== b.ex) out.push(["ex", String(s.ex)]);
  return out;
}

// 결과를 바꾸는 설정이 시연과 다른가(층·보기는 보지 않는다)
export function isModified(st) { return diff(st).some(([k]) => RUN_KEYS.has(k)); }

// 상태 -> 주소 해시('#' 없이). 결과를 바꾸는 키가 있으면 cv를 붙인다.
export function serialize(st) {
  const s = canon(st), d = diff(s);
  if (d.some(([k]) => RUN_KEYS.has(k))) d.push(["cv", CORE_VERSION]);
  const head = s.base || "pg";
  return d.length ? `${esc(head)}?${d.map(([k, v]) => `${k}=${esc(v)}`).join("&")}` : esc(head);
}

// 주소 해시 -> { state, cv, notes }. notes는 화면에 알릴 문장(모르는 시연·값, 다른 코어 버전).
export function parse(hash) {
  const h = String(hash || "").replace(/^#/, ""), q = h.indexOf("?");
  const head = unesc(q < 0 ? h : h.slice(0, q)).trim(), query = q < 0 ? "" : h.slice(q + 1);
  const notes = [];
  let base = null;
  if (head && head !== "pg") {
    const p = presetById(head) || PRESETS.find((x) => x.tp === head);
    if (p) base = p.id; else notes.push(`모르는 시연 '${clip(head)}'이라 기본 설정으로 연다.`);
  }
  const st = baseState(base);
  let cv = null;
  const bad = (k, v) => notes.push(`'${k}=${clip(v)}'는 쓸 수 없는 값이라 ${base ? "시연 값" : "기본값"}으로 둔다.`);
  for (const part of query.split("&")) {
    if (!part) continue;
    const i = part.indexOf("="), k = unesc(i < 0 ? part : part.slice(0, i)), v = unesc(i < 0 ? "" : part.slice(i + 1));
    const opt = OPT_KEYS.find((x) => x[0] === k);
    if (opt) {
      const [, , set, rule] = opt, [val, ok] = dec(rule, v);
      if (!ok) { bad(k, v); continue; }
      if (rule.kind === "num" && Number(v) !== val && (Number(v) < rule.lo || Number(v) > rule.hi)) notes.push(`'${k}=${v}'는 범위(${rule.lo}–${rule.hi}) 밖이라 ${val}로 자른다.`);
      set(st.o, val);
    } else if (k === "goal") { const g = decGoal(v); if (g === undefined) bad(k, v); else st.goal = g; }
    else if (k === "ped") { const p = decPeds(v); if (p === undefined) bad(k, v); else st.peds = p; }
    else if (k === "ed") { const e = decEdits(v); if (e === undefined) bad(k, v); else st.edits = e; }
    else if (k === "v") { if (v === "2d" || v === "3d") st.view = v; else bad(k, v); }
    else if (k === "layer") { if (own(LAYERS, v)) st.layer = v; else bad(k, v); }
    else if (k === "geo") { if (own(GEO, v)) st.geo = v; else bad(k, v); }
    else if (k === "ex") { const n = v.trim() === "" ? NaN : Number(v); if (EXAG.includes(n)) st.ex = n; else bad(k, v); }
    else if (k === "cv") cv = v;
    else notes.push(`모르는 키 '${clip(k)}'는 무시한다.`);
  }
  if (cv && cv !== CORE_VERSION) notes.push(`다른 코어 버전(cv=${clip(cv)}, 지금 ${CORE_VERSION})에서 만든 링크라 결과가 다를 수 있다.`);
  return { state: canon(st), cv, notes };
}

// ------------------------------------------------------------------ 상태 -> 시작 상태의 World
export function applyEdit(terrain, op, x, y) {
  if (op === "box") terrain.addBox(x, y);
  else if (op === "pothole") terrain.addPothole(x, y);
  else if (op === "erase") terrain.erase(x, y);
}

// 시연 보행자: 시연 자신의 지형·목표에서 경로에 놓는다(Python crossing_pedestrians와 같은 규칙, sim.js spawnCrossing).
// 덮어쓰기로 지형을 바꿔도 좌표는 그대로 따라간다. 화면에서 시연을 연 뒤 '새 지형'을 눌렀을 때와 같다.
function presetPeds(p) {
  const w = new World(Object.assign(defaultOptions(), structuredClone(p.set)));
  w.spawnCrossing(p.peds);
  return w.pedsInit.map((q) => [q.x, q.y, q.vx, q.vy]);
}

// 상태 -> 첫 스텝 전의 World. main.js와 check.html이 같은 함수를 쓴다(주소를 새 탭에서 열면 같은 주행이 나온다).
// opts를 주면 그 객체를 World가 그대로 쓴다(화면 슬라이더가 고치는 객체).
export function buildWorld(st, opts = structuredClone(st.o)) {
  const s = canon(st), p = presetById(s.base);
  const peds = s.peds ?? (p?.peds ? presetPeds(p) : []);
  const w = new World(opts);            // 로봇 한계를 전역에 쓰므로 시연 보행자용 World보다 뒤에 만든다
  for (const [op, x, y] of s.edits) applyEdit(w.terrain, op, x, y);
  if (s.edits.length) w.rebuildGT();
  if (s.goal) w.goal = s.goal.slice();
  w.pedsInit = []; w.peds = [];
  for (const [x, y, vx, vy] of peds) w.addPed(x, y, vx, vy);
  w.reset();
  return w;
}
