// Lädt die Online-Wortlisten einer Sprache und bereitet sie fürs Spiel auf.
//
// Ergebnis von buildLanguage():
//   ranked:  { länge: [[WORT, rang], ...] }  mögliche Lösungen, nach Häufigkeit sortiert
//   allowed: { länge: [WORT, ...] }          alle erlaubten Rateversuche

import { LANGS, LENGTHS, MAX_RANK } from "./config.js";

export function lines(text) {
  return text.replace(/^﻿/, "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

// Entfernt Akzente (É → E) und löst Ligaturen auf, die NFD nicht zerlegt (Œ → OE).
const LIGATURES = { "Œ": "OE", "œ": "oe", "Æ": "AE", "æ": "ae" };
export function stripAccents(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[ŒœÆæ]/g, c => LIGATURES[c]);
}

// Wandelt ein Wort in die Spielschreibweise (Großbuchstaben) um, oder null wenn unbrauchbar.
export function normalize(lang, word) {
  const L = LANGS[lang];
  if (word.includes("ß")) return null;            // "ß".toUpperCase() wäre "SS"
  let w = word.toUpperCase();
  if (L.stripAccents) w = stripAccents(w);
  return L.alpha.test(w) ? w : null;
}

// ---------- Hunspell-Wörterbücher (.dic) ----------

function hunspellStems(text) {
  return lines(text).slice(1).map(l => l.split(/[/\t ]/)[0]);
}

const isLower = s => !!s[0] && s[0] === s[0].toLowerCase();

// Einträge, die nur großgeschrieben vorkommen, sind Eigennamen ("Paris", "John").
function hunspellNames(text) {
  const stems = hunspellStems(text);
  const lower = new Set(stems.filter(isLower));
  return new Set(stems.filter(s => !isLower(s) && !lower.has(s.toLowerCase()))
                      .map(s => s.toLowerCase()));
}

// ---------- Sprachspezifische Filter ----------
// Jeder Filter liefert das Wörterbuch (für erlaubte Rateversuche) und
// isSolution(wort) für Wörter aus der Häufigkeitsliste (kleingeschrieben).

const FILTERS = {
  // Die Wortliste ist groß-/kleingeschrieben. Kleingeschriebene Wörter sind ok,
  // großgeschriebene nur mit Pluralform: Substantive ja, Eigennamen nein.
  de(t) {
    const dict = new Set(lines(t.dict));
    const isSolution = w => {
      if (dict.has(w)) return true;
      const c = w[0].toUpperCase() + w.slice(1);
      return dict.has(c) && ["n", "en", "e", "er", "nen"].some(s => dict.has(c + s));
    };
    return { dict, isSolution };
  },

  en(t) {
    const dict = new Set(lines(t.dict));
    const names = hunspellNames(t.hunspell);
    return { dict, isSolution: w => dict.has(w) && !names.has(w) };
  },

  // Kotus-Liste: Grundformen, keine Eigennamen.
  fi(t) {
    const dict = new Set(lines(t.dict));
    return { dict, isSolution: w => dict.has(w) };
  },

  fr(t) {
    const dict = new Set(hunspellStems(t.hunspell).filter(isLower));
    lines(t.list).forEach(w => dict.add(w.toLowerCase()));   // Liste ist ohne Akzente
    const names = hunspellNames(t.hunspell);
    return {
      dict,
      isSolution: w => (dict.has(w) || dict.has(stripAccents(w))) && !names.has(w)
    };
  }
};

// ---------- Download ----------

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}

// Liest nur die ersten n Zeilen und bricht den Download dann ab
// (die vollständigen Häufigkeitslisten sind 10–40 MB groß).
async function fetchFirstLines(url, n) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  const out = [];
  let rest = "";
  while (out.length < n) {
    const { done, value } = await reader.read();
    if (done) {
      rest += decoder.decode();
      if (rest) out.push(rest);
      break;
    }
    const parts = (rest + decoder.decode(value, { stream: true })).split("\n");
    rest = parts.pop();
    for (const p of parts) out.push(p);
  }
  reader.cancel().catch(() => {});
  return out.slice(0, n);
}

// ---------- Aufbereitung ----------

const MIN_DICT = 20000, MIN_POOL = 100;   // Plausibilitätsgrenzen, weit unter den echten Größen

export async function buildLanguage(lang) {
  const { freq: freqUrl, ...dictUrls } = LANGS[lang].urls;
  const names = Object.keys(dictUrls);
  const [freqLines, ...dictTexts] = await Promise.all([
    fetchFirstLines(freqUrl, MAX_RANK),
    ...names.map(k => fetchText(dictUrls[k]))
  ]);
  const texts = Object.fromEntries(names.map((k, i) => [k, dictTexts[i]]));
  const { dict, isSolution } = FILTERS[lang](texts);

  const ranked = {}, allowed = {};
  LENGTHS.forEach(n => { ranked[n] = []; allowed[n] = new Set(); });
  const seen = new Set();

  freqLines.forEach((line, rank) => {
    const w = line.split(" ")[0].trim();
    const W = normalize(lang, w);
    if (!W || !allowed[W.length]) return;
    allowed[W.length].add(W);
    if (!seen.has(W) && isSolution(w)) {
      seen.add(W);
      ranked[W.length].push([W, rank]);
    }
  });
  dict.forEach(w => {
    const W = normalize(lang, w);
    if (W && allowed[W.length]) allowed[W.length].add(W);
  });

  // Abgebrochene Downloads oder Fehlerseiten (z. B. WLAN-Login) nicht als Wörterbuch
  // übernehmen – sonst würden sie dauerhaft in der IndexedDB landen.
  if (freqLines.length < MAX_RANK / 2 || dict.size < MIN_DICT ||
      LENGTHS.some(n => ranked[n].length < MIN_POOL)) {
    throw new Error(`${lang}: Wortlisten unvollständig`);
  }

  return {
    ranked,
    allowed: Object.fromEntries(LENGTHS.map(n => [n, [...allowed[n]]]))
  };
}
