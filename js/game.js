// Reine Spiellogik ohne DOM: Wertung, Tageswort, Spielzustand.

import { ROWS } from "./config.js";

// Wertet einen Rateversuch aus, inkl. korrekter Behandlung doppelter Buchstaben:
// Erst die Treffer an der richtigen Stelle, dann die übrigen Buchstaben zählen.
export function score(guess, solution) {
  const g = [...guess], s = [...solution], n = s.length;
  const res = Array(n).fill("absent");
  const remaining = {};
  for (let i = 0; i < n; i++) {
    if (g[i] === s[i]) res[i] = "correct";
    else remaining[s[i]] = (remaining[s[i]] || 0) + 1;
  }
  for (let i = 0; i < n; i++) {
    if (res[i] !== "correct" && remaining[g[i]] > 0) {
      res[i] = "present";
      remaining[g[i]]--;
    }
  }
  return res;
}

// Tage seit 1.1.2024 (lokales Datum) – Nummer des Tagesworts.
export function dayIndex(date = new Date()) {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - Date.UTC(2024, 0, 1)) / 86400000);
}

// FNV-1a: deterministisch, damit alle Spieler:innen im selben Modus dasselbe Tageswort haben.
function hash(str) {
  let h = 2166136261;
  for (const c of str) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function newGame(pool, key, daily) {
  const day = dayIndex();
  const i = daily ? hash(`${key}:${day}`) % pool.length
                  : Math.floor(Math.random() * pool.length);
  return { day, daily, solution: pool[i], guesses: [], current: "", status: "playing" };
}

const isWord = (w, len) => typeof w === "string" && [...w].length === len;

// Prüft ein gespeichertes Spiel (localStorage kann beschädigt oder manipuliert sein).
function isValidGame(g, pool, len) {
  return !!g && typeof g === "object" &&
    isWord(g.solution, len) && pool.includes(g.solution) &&
    Array.isArray(g.guesses) && g.guesses.length <= ROWS &&
    g.guesses.every(w => isWord(w, len)) &&
    [-1, g.guesses.length - 1].includes(g.guesses.indexOf(g.solution)) &&
    typeof g.current === "string" && [...g.current].length <= len &&
    Number.isInteger(g.day) && typeof g.daily === "boolean";
}

// Status aus den Rateversuchen ableiten statt dem gespeicherten Wert zu vertrauen.
function statusOf(g) {
  if (g.guesses.includes(g.solution)) return "won";
  return g.guesses.length >= ROWS ? "lost" : "playing";
}

// Ein angefangenes Tageswort von einem früheren Tag: zählt als verloren.
export function isAbandonedDaily(saved, pool, len) {
  return isValidGame(saved, pool, len) && saved.daily && saved.day < dayIndex() &&
         saved.guesses.length > 0 && statusOf(saved) === "playing";
}

// Gespeichertes Spiel fortsetzen oder ein neues beginnen.
export function resumeOrNew(saved, pool, key, len, dailyDoneDay) {
  const today = dayIndex();
  if (isValidGame(saved, pool, len)) {
    const game = { ...saved, status: statusOf(saved) };
    if (game.status === "playing" && (!game.daily || game.day === today)) return game;
    if (game.daily && game.day === today) return game;
  }
  return newGame(pool, key, dailyDoneDay !== today);
}

export function emptyStats() {
  return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0] };
}

// Repariert eine gespeicherte Statistik: nur nichtnegative ganze Zahlen.
export function cleanStats(s) {
  const n = v => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
  const clean = emptyStats();
  if (!s || typeof s !== "object") return clean;
  for (const k of ["played", "wins", "streak", "maxStreak"]) clean[k] = n(s[k]);
  if (Array.isArray(s.dist)) clean.dist = clean.dist.map((_, i) => n(s.dist[i]));
  clean.wins = Math.min(clean.wins, clean.played);
  return clean;
}

export function recordResult(stats, won, tries) {
  stats.played++;
  if (won) {
    stats.wins++;
    stats.streak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    stats.dist[tries - 1]++;
  } else {
    stats.streak = 0;
  }
}

// Beste Bewertung je Buchstabe, für die Einfärbung der Tastatur.
export function keyStates(guesses, solution) {
  const rank = { absent: 1, present: 2, correct: 3 };
  const best = {};
  for (const g of guesses) {
    const res = score(g, solution);
    [...g].forEach((ch, i) => {
      if (!best[ch] || rank[res[i]] > rank[best[ch]]) best[ch] = res[i];
    });
  }
  return best;
}

export function shareText(game, header) {
  const emoji = { correct: "🟩", present: "🟨", absent: "⬛" };
  const rows = game.guesses.map(g => score(g, game.solution).map(s => emoji[s]).join(""));
  const result = game.status === "won" ? game.guesses.length : "X";
  return `${header} ${game.daily ? "#" + game.day : "(frei)"} ${result}/6\n\n${rows.join("\n")}`;
}
