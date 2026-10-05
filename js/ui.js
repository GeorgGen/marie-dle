// Alles, was das DOM anfasst: Spielbrett, Tastatur, Toasts und Dialoge.

import { ROWS, LANGS, LENGTHS, DIFFS } from "./config.js";
import { score, keyStates } from "./game.js";

export const $ = id => document.getElementById(id);

const boardEl = $("board");
const kbEl = $("keyboard");
const TILE_FONT = { 4: "2.2rem", 5: "2rem", 6: "1.7rem", 7: "1.45rem" };
const FLIP_MS = 300;

const rowEl = r => boardEl.children[r];

// ---------- Spielbrett ----------

export function buildBoard(len) {
  boardEl.style.setProperty("--cols", len);
  boardEl.style.setProperty("--tile-font", TILE_FONT[len]);
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement("div");
    row.className = "row";
    for (let c = 0; c < len; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }
}

export function renderGame(game) {
  game.guesses.forEach((g, r) => {
    const result = score(g, game.solution);
    [...g].forEach((ch, c) => {
      const tile = rowEl(r).children[c];
      tile.textContent = ch;
      tile.className = "tile " + result[c];
    });
  });
  renderCurrent(game);
  renderKeys(game);
}

export function renderCurrent(game) {
  const r = game.guesses.length;
  if (r >= ROWS) return;
  const letters = [...game.current];
  [...rowEl(r).children].forEach((tile, c) => {
    tile.textContent = letters[c] || "";
    tile.className = "tile" + (letters[c] ? " filled" : "");
  });
}

// Dreht die Kacheln einer Zeile nacheinander um; resolved nach der Animation.
export function revealRow(r, result) {
  if (!rowEl(r)) return Promise.resolve();
  const tiles = [...rowEl(r).children];
  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add("flip");
      setTimeout(() => { tile.className = "tile flip " + result[i]; }, FLIP_MS * 0.8);
    }, i * FLIP_MS);
  });
  return new Promise(resolve => setTimeout(resolve, tiles.length * FLIP_MS + 250));
}

export function celebrate(r) {
  [...rowEl(r).children].forEach((tile, i) =>
    setTimeout(() => tile.classList.add("win"), i * 100));
}

export function shake(r) {
  const el = rowEl(r);
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth;          // Reflow, damit die Animation neu startet
  el.classList.add("shake");
}

// ---------- Tastatur ----------

export function buildKeyboard(lang, onKey) {
  kbEl.innerHTML = "";
  LANGS[lang].keys.forEach(keys => {
    const row = document.createElement("div");
    row.className = "kb-row";
    keys.forEach(k => {
      const b = document.createElement("button");
      b.className = "key" + (k.length > 1 ? " wide" : "");
      b.textContent = k;
      b.dataset.key = k;
      b.addEventListener("click", () => { onKey(k); b.blur(); });
      row.appendChild(b);
    });
    kbEl.appendChild(row);
  });
}

export function renderKeys(game) {
  const best = keyStates(game.guesses, game.solution);
  kbEl.querySelectorAll(".key").forEach(k => {
    const s = best[k.dataset.key];
    k.className = "key" + (k.dataset.key.length > 1 ? " wide" : "") + (s ? " " + s : "");
  });
}

// ---------- Toast ----------

let toastTimer;
export function toast(msg, ms = 1200) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

// ---------- Dialoge ----------

// Solange ein Dialog offen ist, ist die Seite dahinter inert: kein Fokus, keine Klicks
// (sonst lässt sich z. B. mit Tab + Leertaste auf der Bildschirmtastatur weiterspielen).
const background = () => document.querySelectorAll("body > header, body > main");

export function openModal(id) {
  $(id).classList.add("open");
  background().forEach(el => { el.inert = true; });
}

export function closeModals() {
  document.querySelectorAll(".overlay").forEach(o => o.classList.remove("open"));
  background().forEach(el => { el.inert = false; });
}

export function anyModalOpen() {
  return !!document.querySelector(".overlay.open");
}

document.querySelectorAll(".overlay").forEach(o => {
  o.addEventListener("click", e => {
    if (e.target === o || e.target.hasAttribute("data-close")) closeModals();
  });
});

export function renderStats(stats, game, label) {
  $("statsMode").textContent = label;
  $("sPlayed").textContent = stats.played;
  $("sWin").textContent = stats.played ? Math.round(100 * stats.wins / stats.played) : 0;
  $("sStreak").textContent = stats.streak;
  $("sMax").textContent = stats.maxStreak;

  const max = Math.max(1, ...stats.dist);
  const dist = $("dist");
  dist.innerHTML = "";
  stats.dist.forEach((n, i) => {
    const row = document.createElement("div");
    row.className = "dist-row";
    const highlight = game.status === "won" && game.guesses.length === i + 1;
    const num = document.createElement("span");
    num.textContent = i + 1;
    const bar = document.createElement("div");
    bar.className = "dist-bar" + (highlight ? " hl" : "");
    bar.style.width = `${Math.max(7, 100 * n / max)}%`;
    bar.textContent = n;
    row.append(num, bar);
    dist.appendChild(row);
  });

  const done = game.status !== "playing";
  const box = $("solutionBox");
  box.textContent = "";
  if (done) {
    const b = document.createElement("b");
    b.textContent = game.solution;
    box.append("Das Wort war: ", b);
  }
  $("shareBtn").style.display = done ? "" : "none";

  const note = $("getWell");
  const message = game.status === "won" && typeof game.getWell === "string" ? game.getWell : "";
  note.textContent = message;
  note.hidden = !message;
}

// Segment-Buttons im Modus-Menü; onChange bekommt die geänderte Auswahl.
export function renderMenu(pending, onChange) {
  const segment = (id, options, current, field) => {
    const el = $(id);
    el.innerHTML = "";
    options.forEach(([value, label]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = value === current ? "active" : "";
      b.onclick = () => onChange({ ...pending, [field]: value });
      el.appendChild(b);
    });
  };
  segment("segLang", Object.entries(LANGS).map(([k, v]) => [k, v.name]), pending.lang, "lang");
  segment("segLen", LENGTHS.map(n => [n, String(n)]), pending.len, "len");
  segment("segDiff", Object.entries(DIFFS).map(([k, v]) => [k, v.name]), pending.diff, "diff");
  $("diffHint").textContent =
    `Lösungen aus den ${DIFFS[pending.diff].top.toLocaleString("de-DE")} häufigsten Wörtern.`;
}
