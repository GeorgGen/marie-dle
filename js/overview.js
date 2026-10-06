// Gesamtstatistik über alle Modi: Wörter und Melodien, verglichen nach Sprache, Länge und Stufe.
// Liest beide Spielstände direkt aus dem localStorage (beide Seiten haben denselben Ursprung).

import { LANGS, DIFFS } from "./config.js";
import { cleanStats } from "./game.js";

const WORDS_KEY = "woertle-v2";
const MELODY_KEY = "marie-dle-melodie-v1";

const MELODY_CATS = { all: "Alle", classic: "Klassik", pop: "Pop" };
const MELODY_LEVELS = { 5: "Leicht", 6: "Mittel", 8: "Schwer", max: "Max" };

function readStats(key) {
  try {
    const s = JSON.parse(localStorage.getItem(key))?.stats;
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}

// Alle Modus-Statistiken mit ihren Merkmalen, z. B. { kind: "words", lang: "de", len: "5", diff: "easy", s }.
function entries() {
  const list = [];
  for (const [k, raw] of Object.entries(readStats(WORDS_KEY))) {
    const [lang, len, diff] = k.split("-");
    if (Object.hasOwn(LANGS, lang) && Object.hasOwn(DIFFS, diff)) {
      list.push({ kind: "words", lang, len, diff, s: cleanStats(raw) });
    }
  }
  for (const [k, raw] of Object.entries(readStats(MELODY_KEY))) {
    const [, cat, level] = k.split("-");
    if (Object.hasOwn(MELODY_CATS, cat) && Object.hasOwn(MELODY_LEVELS, level)) {
      list.push({ kind: "melody", cat, level, s: cleanStats(raw) });
    }
  }
  return list.filter(e => e.s.played > 0);
}

function sum(list) {
  const t = { played: 0, wins: 0, tries: 0, maxStreak: 0 };
  for (const { s } of list) {
    t.played += s.played;
    t.wins += s.wins;
    t.tries += s.dist.reduce((a, n, i) => a + n * (i + 1), 0);
    t.maxStreak = Math.max(t.maxStreak, s.maxStreak);
  }
  return t;
}

const pct = t => (t.played ? Math.round(100 * t.wins / t.played) : 0);
const avg = t => (t.wins ? (t.tries / t.wins).toFixed(1).replace(".", ",") : "–");

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Eine Vergleichstabelle: je Gruppe Spiele, Gewinnquote als Balken, Ø Versuche bis zum Sieg.
function table(title, groups) {
  const rows = groups.map(([label, list]) => [label, sum(list)]).filter(([, t]) => t.played > 0);
  if (rows.length < 1) return null;
  const box = el("div", "ov-block");
  box.append(el("h3", null, title));
  const head = el("div", "ov-row ov-head");
  head.append(el("span", null, ""), el("span", null, "Spiele"), el("span", null, "Gewonnen"), el("span", null, "Ø Vers."));
  box.append(head);
  for (const [label, t] of rows) {
    const row = el("div", "ov-row");
    const bar = el("div", "ov-bar");
    const fill = el("div", "ov-fill");
    fill.style.width = `${pct(t)}%`;
    bar.append(fill, el("span", null, `${pct(t)} %`));
    row.append(el("span", "ov-label", label), el("span", "ov-num", t.played), bar, el("span", "ov-num", avg(t)));
    box.append(row);
  }
  return box;
}

export function renderOverview(container) {
  container.innerHTML = "";
  const all = entries();
  if (all.length === 0) {
    container.append(el("p", "note", "Noch keine abgeschlossenen Spiele. Sobald du ein Wort oder eine Melodie gespielt hast, erscheinen hier die Vergleiche."));
    return;
  }

  const t = sum(all);
  const top = el("div", "stats");
  for (const [num, lbl] of [[t.played, "Gespielt"], [pct(t), "% Gewonnen"], [avg(t), "Ø Versuche"], [t.maxStreak, "Beste Serie"]]) {
    const d = el("div");
    d.append(el("div", "num", num), el("div", "lbl", lbl));
    top.append(d);
  }
  container.append(top);

  const words = all.filter(e => e.kind === "words");
  const melodies = all.filter(e => e.kind === "melody");
  const by = (list, key, labels) => Object.entries(labels).map(([k, label]) => [label, list.filter(e => e[key] === k)]);

  const blocks = [
    table("Wörter oder Melodien", [["Wörter", words], ["Melodien", melodies]]),
    table("Sprache", by(words, "lang", Object.fromEntries(Object.entries(LANGS).map(([k, v]) => [k, v.name])))),
    table("Wortlänge", by(words, "len", { 4: "4 Buchstaben", 5: "5 Buchstaben", 6: "6 Buchstaben", 7: "7 Buchstaben" })),
    table("Schwierigkeit (Wörter)", by(words, "diff", Object.fromEntries(Object.entries(DIFFS).map(([k, v]) => [k, v.name])))),
    table("Melodien nach Stufe", by(melodies, "level", MELODY_LEVELS)),
    table("Melodien nach Musik", by(melodies, "cat", MELODY_CATS))
  ];
  blocks.filter(Boolean).forEach(b => container.append(b));
  container.append(el("p", "hint", "Ø Versuche: durchschnittliche Anzahl Versuche bei gewonnenen Spielen."));
}
