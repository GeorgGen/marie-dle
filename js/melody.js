// Einstiegspunkt des Melodie-Modus: die ersten Töne einer bekannten Melodie erraten.
// Gewertet wird nur der Tonname (C, Cis, D …), nicht die Oktave.

import { ROWS } from "./config.js";
import { score, keyStates, newGame, dayIndex, cleanStats, recordResult } from "./game.js";
import { getWellActive, pickGetWell } from "./messages.js";
import { MELODIES } from "./melodies.js";
import { playNote, playSequence, stopAll } from "./audio.js";
import * as ui from "./ui.js";

// ---------- Töne ----------

const PCS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// Deutsche Namen, wie sie auf Klaviertasten üblich sind (A# = B, B = H).
const DE = ["C", "Cis", "D", "Es", "E", "F", "Fis", "G", "Gis", "A", "B", "H"];
const deName = pc => DE[PCS.indexOf(pc)];

function midiOf(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Ungültiger Ton: ${name}`);
  return PCS.indexOf(m[1]) + 12 * (+m[2] + 1);
}

const TUNES = Object.fromEntries(MELODIES.map(m => [m.id, {
  ...m,
  notes: m.notes.trim().split(/\s+/).map(s => {
    const [n, d] = s.split(":");
    return { midi: midiOf(n), dur: +d };
  })
}]));

// ---------- Modi ----------

const CATS = {
  all:     { name: "Alle",    hint: "Klassik und Pop gemischt." },
  classic: { name: "Klassik", hint: "Ballett, Barock, Violinkonzerte und mehr." },
  pop:     { name: "Pop",     hint: "Pop-Hooks – bisher nur eine kleine Auswahl." }
};
const LEVELS = {
  5: { name: "Leicht", hint: "Die ersten 5 Töne." },
  6: { name: "Mittel", hint: "Die ersten 6 Töne." },
  8: { name: "Schwer", hint: "Die ersten 8 Töne." },
  max: { name: "Max", hint: "Die ganze Stelle (8–16 Töne, je nach Stück)." }
};
const DEFAULT_MODE = { cat: "all", len: 6 };
const PROGRESS_KEY = "marie-dle-melodie-v1";

const modeKey = m => `melodie-${m.cat}-${m.len}`;
const modeLabel = m => `Melodien · ${CATS[m.cat].name} · ${LEVELS[m.len].name} (${m.len === "max" ? "alle" : m.len} Töne)`;
const isValidMode = m => !!m && typeof m === "object" &&
  Object.hasOwn(CATS, m.cat) && Object.hasOwn(LEVELS, m.len);
const poolFor = m => MELODIES.filter(t => m.cat === "all" || t.cat === m.cat).map(t => t.id);

// ---------- Zustand ----------

let mode = { ...DEFAULT_MODE };
let progress = { games: {}, stats: {}, dailyDone: {}, getWellSeen: [] };
let game = null;      // { day, daily, solution: Melodie-ID, guesses: [[Ton …]], current: [Ton …], status }
let pool = [];
let animating = false;
let statsTimer = null;

const tune = () => TUNES[game.solution];
// Anzahl der zu ratenden Töne: fest je Stufe, bei „Max“ die ganze Stelle (bzw. bis `max`).
const lenOf = (g = game) => {
  if (mode.len !== "max") return mode.len;
  const t = TUNES[g.solution];
  return Math.min(t.max || t.notes.length, t.notes.length);
};
const target = (g = game) => TUNES[g.solution].notes.slice(0, lenOf(g));
const solution = (g = game) => target(g).map(n => PCS[n.midi % 12]);

function persist() {
  if (game) progress.games[modeKey(mode)] = game;
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ mode, ...progress })); } catch {}
}

function statsFor(key) {
  return (progress.stats[key] = cleanStats(progress.stats[key]));
}

// Gespeichertes Spiel prüfen (localStorage kann beschädigt sein).
const isNotes = (a, len) => Array.isArray(a) && a.length <= len && a.every(p => PCS.includes(p));
function isValidGame(g) {
  if (!g || typeof g !== "object" || !pool.includes(g.solution)) return false;
  const len = lenOf(g);
  if (!Array.isArray(g.guesses) || g.guesses.length > ROWS) return false;
  if (!g.guesses.every(x => isNotes(x, len) && x.length === len)) return false;
  return isNotes(g.current, len) && Number.isInteger(g.day) && typeof g.daily === "boolean";
}

function statusOf(g) {
  const sol = solution(g).join();
  if (g.guesses.some(x => x.join() === sol)) return "won";
  return g.guesses.length >= ROWS ? "lost" : "playing";
}

function freshGame(daily) {
  return { ...newGame(pool, modeKey(mode), daily), current: [] };
}

function startMode(next) {
  clearTimeout(statsTimer);
  stopAll();
  persist();
  mode = { ...next };
  pool = poolFor(mode);
  const k = modeKey(mode), today = dayIndex();
  const saved = progress.games[k];
  game = null;
  if (isValidGame(saved)) {
    const g = { ...saved, status: statusOf(saved) };
    if (g.daily && g.day < today && g.status === "playing" && g.guesses.length > 0) {
      recordResult(statsFor(k), false);       // angefangenes Tagesrätsel von gestern
      progress.dailyDone[k] = g.day;
    } else if (!(g.daily && g.day < today) && (g.status === "playing" || g.daily)) {
      game = g;
    }
  }
  game = game || freshGame(progress.dailyDone[k] !== today);

  ui.$("modeLabel").textContent = modeLabel(mode);
  buildBoard();
  render();
  persist();
}

// ---------- Darstellung ----------

const tileFont = len => len <= 5 ? "1.6rem" : len <= 6 ? "1.45rem" : len <= 8 ? "1.15rem" : "0.95rem";
const rowEl = r => ui.$("board").children[r];

function buildBoard() {
  const len = lenOf(), board = ui.$("board");
  ui.buildBoard(len);
  board.style.setProperty("--tile-font", tileFont(len));
  // Viele Töne: hochkant statt quadratisch, sonst werden die Kacheln winzig.
  board.style.aspectRatio = len > 8 ? `${len} / 8.4` : "";
}

function render() {
  const sol = solution();
  game.guesses.forEach((g, r) => {
    const res = score(g, sol);
    g.forEach((pc, c) => {
      const tile = rowEl(r).children[c];
      tile.textContent = deName(pc);
      tile.className = "tile " + res[c];
    });
  });
  renderCurrent();
  renderKeys();
}

function renderCurrent() {
  const r = game.guesses.length;
  if (r >= ROWS) return;
  [...rowEl(r).children].forEach((tile, c) => {
    const pc = game.current[c];
    tile.textContent = pc ? deName(pc) : "";
    tile.className = "tile" + (pc ? " filled" : "");
  });
}

function renderKeys() {
  const best = keyStates(game.guesses, solution());
  document.querySelectorAll(".pkey").forEach(k => {
    k.classList.remove("correct", "present", "absent");
    const s = best[k.dataset.pc];
    if (s) k.classList.add(s);
  });
}

// Markiert beim Abspielen den gerade klingenden Ton in einer Zeile.
function highlighter(r) {
  return i => {
    const row = rowEl(r);
    if (!row) return;
    [...row.children].forEach((t, c) => t.classList.toggle("playing", c === i));
  };
}

// ---------- Klaviatur ----------

// Weiße Tasten C D E F G A H, schwarze Tasten jeweils rechts neben der weißen mit diesem Index.
const WHITE = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK = [["C#", 0], ["D#", 1], ["F#", 3], ["G#", 4], ["A#", 5]];

function buildPiano() {
  const piano = ui.$("piano");
  piano.innerHTML = "";
  const key = (pc, cls) => {
    const b = document.createElement("button");
    b.className = "pkey " + cls;
    b.dataset.pc = pc;
    b.textContent = deName(pc);
    b.setAttribute("aria-label", deName(pc));
    b.addEventListener("click", () => { handleNote(pc); b.blur(); });
    return b;
  };
  WHITE.forEach(pc => piano.appendChild(key(pc, "white")));
  BLACK.forEach(([pc, after]) => {
    const b = key(pc, "black");
    b.style.left = `calc(${(after + 1) * 100 / 7}% - var(--black-w) / 2)`;
    piano.appendChild(b);
  });
}

// ---------- Eingabe ----------

// Ein eingegebener Ton erklingt in der Oktave, die dem Ton der Melodie an dieser Stelle
// am nächsten liegt – so klingt eine richtige Zeile genau wie die Melodie.
function midiNear(pc, ref) {
  const base = PCS.indexOf(pc);
  let best = base + 60;
  for (let o = 0; o <= 9; o++) {
    const m = base + 12 * o;
    if (Math.abs(m - ref) < Math.abs(best - ref)) best = m;
  }
  return best;
}

function handleNote(pc) {
  if (animating || !game || game.status !== "playing" || ui.anyModalOpen()) return;
  const i = game.current.length;
  if (i >= lenOf()) return;
  game.current.push(pc);
  playNote(midiNear(pc, target()[i].midi), 0.5);
  renderCurrent();
  persist();
}

function handleBack() {
  if (animating || !game || game.status !== "playing" || ui.anyModalOpen()) return;
  game.current.pop();
  renderCurrent();
  persist();
}

function playMelody() {
  if (!game) return;
  const r = Math.min(game.guesses.length, ROWS - 1);
  const onStep = game.status === "playing" ? highlighter(r) : () => {};
  playSequence(target(), tune().bpm, onStep);
}

// Spielt die aktuelle (oder letzte) Zeile im Rhythmus der Melodie.
function playGuess() {
  if (!game || animating) return;
  const r = game.status === "playing" && game.current.length ? game.guesses.length : game.guesses.length - 1;
  const notes = r === game.guesses.length ? game.current : game.guesses[r];
  if (!notes || !notes.length) return ui.toast("Noch keine Töne eingegeben");
  const t = target();
  playSequence(notes.map((pc, i) => ({ midi: midiNear(pc, t[i].midi), dur: t[i].dur })), tune().bpm, highlighter(r));
}

async function submit() {
  if (animating || !game || game.status !== "playing" || ui.anyModalOpen()) return;
  const g = game, key = modeKey(mode), r = g.guesses.length;
  if (g.current.length < lenOf(g)) {
    ui.toast("Zu wenige Töne");
    return ui.shake(r);
  }
  const sol = solution(g);
  const guess = g.current;
  const result = score(guess, sol);
  g.guesses.push(guess);
  g.current = [];
  const won = guess.join() === sol.join();
  if (won) {
    g.status = "won";
    if (getWellActive()) g.getWell = pickGetWell(tune().title, progress.getWellSeen);
  } else if (g.guesses.length === ROWS) g.status = "lost";
  if (g.status !== "playing") {
    recordResult(statsFor(key), won, r + 1);
    if (g.daily) progress.dailyDone[key] = g.day;
  }
  persist();

  stopAll();
  animating = true;
  await ui.revealRow(r, result);
  animating = false;
  if (game !== g) return;
  renderKeys();

  if (g.status === "playing") return;
  if (won) {
    ui.celebrate(r);
    ui.toast(["Genial!", "Großartig!", "Beeindruckend!", "Super!", "Gut gemacht!", "Puh, knapp!"][r]);
  } else {
    ui.toast(tune().title, 2500);
  }
  // Zur Belohnung (oder zum Nachhören) die ganze bekannte Stelle abspielen.
  playSequence(tune().notes, tune().bpm);
  statsTimer = setTimeout(() => {
    if (game === g && !ui.anyModalOpen()) showStats();
  }, 1800);
}

document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (ui.anyModalOpen()) {
    if (e.key === "Escape") ui.closeModals();
    return;
  }
  const letters = { c: "C", d: "D", e: "E", f: "F", g: "G", a: "A", h: "B", b: "A#" };
  if (e.key === "Enter") submit();
  else if (e.key === "Backspace") handleBack();
  else if (e.key === " ") playMelody();
  else if (Object.hasOwn(letters, e.key.toLowerCase())) handleNote(letters[e.key.toLowerCase()]);
  else return;
  e.preventDefault();
});

ui.$("enterBtn").onclick = e => { submit(); e.currentTarget.blur(); };
ui.$("backBtn").onclick = e => { handleBack(); e.currentTarget.blur(); };
ui.$("listenBtn").onclick = e => { playMelody(); e.currentTarget.blur(); };
ui.$("guessBtn").onclick = e => { playGuess(); e.currentTarget.blur(); };

// ---------- Statistik ----------

function showStats() {
  if (!game || animating) return;
  ui.renderStats(statsFor(modeKey(mode)), game, modeLabel(mode));
  const box = ui.$("solutionBox");
  box.textContent = "";
  if (game.status !== "playing") {
    const b = document.createElement("b");
    b.textContent = tune().title;
    const by = document.createElement("div");
    by.className = "by";
    by.textContent = tune().by;
    const play = document.createElement("button");
    play.className = "btn secondary small";
    play.textContent = "▶ Nochmal anhören";
    play.onclick = () => playSequence(tune().notes, tune().bpm);
    box.append("Die Melodie war: ", b, by, play);
  }
  ui.openModal("statsModal");
}

function shareText() {
  const emoji = { correct: "🟩", present: "🟨", absent: "⬛" };
  const sol = solution();
  const rows = game.guesses.map(g => score(g, sol).map(s => emoji[s]).join(""));
  const result = game.status === "won" ? game.guesses.length : "X";
  const header = `Marie-dle 🎵 ${CATS[mode.cat].name} ${LEVELS[mode.len].name}`;
  return `${header} ${game.daily ? "#" + game.day : "(frei)"} ${result}/6\n\n${rows.join("\n")}`;
}

ui.$("statsBtn").onclick = showStats;
ui.$("helpBtn").onclick = () => ui.openModal("helpModal");

ui.$("shareBtn").onclick = async () => {
  try {
    await navigator.clipboard.writeText(shareText());
    ui.toast("In die Zwischenablage kopiert");
  } catch {
    ui.toast("Kopieren nicht möglich");
  }
};

ui.$("newBtn").onclick = () => {
  if (animating || !game) return;
  if (game.status === "playing" && game.guesses.length > 0) {
    if (!confirm("Laufendes Spiel abbrechen? Es zählt dann als verloren.")) return;
    recordResult(statsFor(modeKey(mode)), false);
    if (game.daily) progress.dailyDone[modeKey(mode)] = game.day;
  }
  clearTimeout(statsTimer);
  stopAll();
  ui.closeModals();
  // Möglichst eine andere Melodie als die gerade gespielte.
  const last = game.solution;
  do { game = freshGame(false); } while (pool.length > 1 && game.solution === last);
  buildBoard();
  render();
  persist();
};

// ---------- Modus-Menü ----------

let pending = { ...mode };

function renderMenu() {
  const segment = (id, options, field) => {
    const el = ui.$(id);
    el.innerHTML = "";
    options.forEach(([value, label]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = value === pending[field] ? "active" : "";
      b.onclick = () => { pending = { ...pending, [field]: value }; renderMenu(); };
      el.appendChild(b);
    });
  };
  segment("segCat", Object.entries(CATS).map(([k, v]) => [k, v.name]), "cat");
  segment("segLevel", Object.entries(LEVELS).map(([k, v]) => [k === "max" ? k : +k, v.name]), "len");
  const n = poolFor(pending).length;
  ui.$("levelHint").textContent =
    `${CATS[pending.cat].hint} ${LEVELS[pending.len].hint} ${n} Melodien.`;
}

ui.$("menuBtn").onclick = () => {
  if (animating) return;
  pending = { ...mode };
  renderMenu();
  ui.openModal("menuModal");
};

ui.$("playBtn").onclick = () => {
  if (animating) return;
  startMode(pending);
  ui.closeModals();
};

// ---------- Start ----------

const asObject = x => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
let saved = null;
try { saved = JSON.parse(localStorage.getItem(PROGRESS_KEY)); } catch {}
if (saved && typeof saved === "object") {
  progress = {
    games: asObject(saved.games),
    stats: asObject(saved.stats),
    dailyDone: asObject(saved.dailyDone),
    getWellSeen: Array.isArray(saved.getWellSeen) ? saved.getWellSeen.filter(x => typeof x === "string") : []
  };
  if (isValidMode(saved.mode)) mode = { cat: saved.mode.cat, len: saved.mode.len };
}

buildPiano();
startMode(mode);
if (!saved) ui.openModal("helpModal");
