// Einstiegspunkt: verbindet Spiellogik, Wörterbücher, Speicher und Oberfläche.

import { ROWS, LANGS, DIFFS, DEFAULT_MODE, modeKey, modeLabel, isValidMode } from "./config.js";
import { stripAccents } from "./wordlists.js";
import { getLanguage, isLanguageLoaded, loadProgress, saveProgress } from "./storage.js";
import { score, newGame, resumeOrNew, isAbandonedDaily, cleanStats, recordResult, shareText } from "./game.js";
import { getWellActive, pickGetWell } from "./messages.js";
import * as ui from "./ui.js";

// ---------- Zustand ----------

let mode = { ...DEFAULT_MODE };
let progress = { games: {}, stats: {}, dailyDone: {}, getWellSeen: [] };   // je Modus, außer getWellSeen
let game = null;
let pool = [];               // mögliche Lösungen im aktuellen Modus
let allowed = new Set();     // erlaubte Rateversuche im aktuellen Modus
let loading = false;         // ein Wörterbuch wird geladen
let animating = false;       // eine Zeile wird gerade aufgedeckt
let loadSeq = 0;             // nur der zuletzt gestartete Moduswechsel zählt
let statsTimer = null;

const busy = () => loading || animating;

function persist() {
  if (game) progress.games[modeKey(mode)] = game;
  saveProgress({ mode, ...progress });
}

function statsFor(key) {
  return (progress.stats[key] = cleanStats(progress.stats[key]));
}

// ---------- Modus wechseln ----------

// Ein älterer Moduswechsel wird verworfen, außer der neuere ist fehlgeschlagen
// und es gibt noch gar kein Spiel – dann ist das ältere Ergebnis besser als nichts.
const superseded = seq => seq !== loadSeq && (loading || !!game);

// Liefert true bei Erfolg, false bei Fehler und null, wenn inzwischen
// ein anderer Modus gewählt wurde.
async function startMode(next) {
  const seq = ++loadSeq;
  loading = true;
  if (!isLanguageLoaded(next.lang)) {
    ui.toast(`Lade Wörterbuch (${LANGS[next.lang].name}) …`, 120000);
  }
  let data;
  try {
    data = await getLanguage(next.lang);
  } catch (e) {
    console.error(e);
    if (superseded(seq)) return null;
    loading = false;
    ui.toast("Wörterbuch konnte nicht geladen werden. Internetverbindung prüfen.", 4000);
    return false;
  }
  if (superseded(seq)) return null;

  const nextPool = data.ranked[next.len]
    .filter(([, rank]) => rank < DIFFS[next.diff].top)
    .map(([w]) => w);
  if (nextPool.length === 0) {
    loading = false;
    ui.toast("Für diesen Modus gibt es keine Wörter.", 3000);
    return false;
  }

  clearTimeout(statsTimer);
  persist();                 // Spiel im bisherigen Modus sichern
  mode = { ...next };
  pool = nextPool;
  allowed = new Set([...data.allowed[mode.len], ...pool]);
  const k = modeKey(mode);
  const saved = progress.games[k];
  if (isAbandonedDaily(saved, pool, mode.len)) {
    recordResult(statsFor(k), false);
    progress.dailyDone[k] = saved.day;
  }
  game = resumeOrNew(saved, pool, k, mode.len, progress.dailyDone[k]);

  ui.$("modeLabel").textContent = modeLabel(mode);
  ui.buildBoard(mode.len);
  ui.buildKeyboard(mode.lang, handleKey);
  ui.renderGame(game);
  ui.toast(`${pool.length.toLocaleString("de-DE")} mögliche Lösungen`, 1500);
  persist();
  loading = false;
  return true;
}

// ---------- Eingabe ----------

function handleKey(k) {
  if (busy() || !game || game.status !== "playing" || ui.anyModalOpen()) return;
  if (k === "ENTER") return submit();
  if (k === "⌫") {
    game.current = [...game.current].slice(0, -1).join("");
  } else if ([...game.current + k].length <= mode.len) {
    game.current += k;
  }
  ui.renderCurrent(game);
}

async function submit() {
  const g = game, key = modeKey(mode);
  const r = g.guesses.length;
  if (r >= ROWS) return;
  const guess = g.current;
  if ([...guess].length < mode.len) {
    ui.toast("Zu wenige Buchstaben");
    return ui.shake(r);
  }
  if (!allowed.has(guess)) {
    ui.toast("Nicht im Wörterbuch");
    return ui.shake(r);
  }

  // Ergebnis sofort festhalten und speichern – nicht erst nach der Animation,
  // sonst gehen Rateversuche bei Reload oder Moduswechsel verloren.
  const result = score(guess, g.solution);
  g.guesses.push(guess);
  g.current = "";
  const won = guess === g.solution;
  if (won) {
    g.status = "won";
    if (getWellActive()) g.getWell = pickGetWell(g.solution, progress.getWellSeen);
  } else if (g.guesses.length === ROWS) g.status = "lost";
  if (g.status !== "playing") {
    recordResult(statsFor(key), won, r + 1);
    if (g.daily) progress.dailyDone[key] = g.day;
  }
  persist();

  animating = true;
  await ui.revealRow(r, result);
  animating = false;
  if (game !== g) return;
  ui.renderKeys(g);

  if (won) {
    ui.celebrate(r);
    ui.toast(["Genial!", "Großartig!", "Beeindruckend!", "Super!", "Gut gemacht!", "Puh, knapp!"][r]);
  } else if (g.status === "lost") {
    ui.toast(g.solution, 2500);
  }
  if (g.status !== "playing") {
    statsTimer = setTimeout(() => {
      if (game === g && !ui.anyModalOpen()) showStats();
    }, 1800);
  }
}

// Buchstaben, die als zwei Spielbuchstaben eingegeben werden dürfen (Französisch: Œ → OE).
const LIGATURE_KEYS = /^[œæ]$/i;

document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (ui.anyModalOpen()) {
    if (e.key === "Escape") ui.closeModals();
    return;
  }
  const L = LANGS[mode.lang];
  let k;
  if (e.key === "Enter") k = "ENTER";
  else if (e.key === "Backspace") k = "⌫";
  else if ([...e.key].length === 1) {
    k = e.key.toUpperCase();
    if (L.stripAccents) k = stripAccents(k);
    // "ß" → "SS", "ﬁ" → "FI": mehrbuchstabige Ergebnisse nur für echte Ligaturen
    if ([...k].length !== 1 && !(L.stripAccents && LIGATURE_KEYS.test(e.key))) return;
    if (!L.alpha.test(k)) return;
  } else return;
  e.preventDefault();
  handleKey(k);
});

// ---------- Statistik ----------

function showStats() {
  if (!game || animating) return;
  ui.renderStats(statsFor(modeKey(mode)), game, modeLabel(mode));
  ui.openModal("statsModal");
}

ui.$("statsBtn").onclick = showStats;
ui.$("helpBtn").onclick = () => ui.openModal("helpModal");

ui.$("shareBtn").onclick = async () => {
  const header = `Marie-dle ${LANGS[mode.lang].short} ${mode.len} ${DIFFS[mode.diff].name}`;
  try {
    await navigator.clipboard.writeText(shareText(game, header));
    ui.toast("In die Zwischenablage kopiert");
  } catch {
    ui.toast("Kopieren nicht möglich");
  }
};

ui.$("newBtn").onclick = () => {
  if (busy() || !game) return;
  if (game.status === "playing" && game.guesses.length > 0) {
    if (!confirm("Laufendes Spiel abbrechen? Es zählt dann als verloren.")) return;
    recordResult(statsFor(modeKey(mode)), false);
    if (game.daily) progress.dailyDone[modeKey(mode)] = game.day;
  }
  clearTimeout(statsTimer);
  ui.closeModals();
  game = newGame(pool, modeKey(mode), false);
  ui.buildBoard(mode.len);
  ui.renderGame(game);
  persist();
};

// ---------- Modus-Menü ----------

let pending = { ...mode };

function updateMenu(next) {
  pending = next;
  ui.renderMenu(pending, updateMenu);
}

function openMenu() {
  if (animating) return;
  updateMenu({ ...mode });
  ui.openModal("menuModal");
}

ui.$("menuBtn").onclick = openMenu;

ui.$("playBtn").onclick = async () => {
  if (animating) return;
  const btn = ui.$("playBtn");
  btn.disabled = true;
  btn.textContent = "Lade …";
  const ok = await startMode(pending);
  btn.disabled = false;
  btn.textContent = "Spielen";
  if (ok) ui.closeModals();
};

// ---------- Start ----------

// Gespeicherter Stand kann beschädigt sein: nur Objekte übernehmen, den Rest prüfen
// resumeOrNew bzw. cleanStats beim Zugriff.
const asObject = x => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const saved = loadProgress();
if (saved && typeof saved === "object") {
  progress = {
    games: asObject(saved.games),
    stats: asObject(saved.stats),
    dailyDone: asObject(saved.dailyDone),
    getWellSeen: Array.isArray(saved.getWellSeen) ? saved.getWellSeen.filter(x => typeof x === "string") : []
  };
  if (isValidMode(saved.mode)) mode = { lang: saved.mode.lang, len: saved.mode.len, diff: saved.mode.diff };
}

ui.$("modeLabel").textContent = modeLabel(mode);
ui.buildBoard(mode.len);
ui.buildKeyboard(mode.lang, handleKey);

const started = await startMode(mode);
if (started === true) {
  if (!saved && !ui.anyModalOpen()) ui.openModal("helpModal");
} else if (started === false) {
  openMenu();
}
