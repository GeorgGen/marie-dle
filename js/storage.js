// Persistenz: aufbereitete Wörterbücher in IndexedDB, Spielstand in localStorage.
// Alles ist "best effort" – ohne Speicher läuft das Spiel trotzdem.

import { LENGTHS } from "./config.js";
import { buildLanguage } from "./wordlists.js";

const DB_NAME = "woertle", DB_STORE = "dicts";
const DICT_VERSION = "v4";          // erhöhen, wenn sich die Aufbereitung ändert
const PROGRESS_KEY = "woertle-v2";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE).objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

const memory = {};

const isLanguageData = d =>
  !!d && LENGTHS.every(n => Array.isArray(d.ranked?.[n]) && Array.isArray(d.allowed?.[n]));

export function isLanguageLoaded(lang) {
  return !!memory[lang];
}

// Wörterbuch aus Speicher, Cache oder (beim ersten Mal) aus dem Netz.
export async function getLanguage(lang) {
  if (memory[lang]) return memory[lang];
  const key = `${lang}-${DICT_VERSION}`;
  let data = null;
  try { data = await dbGet(key); } catch {}
  if (!isLanguageData(data)) {
    data = await buildLanguage(lang);
    try { await dbSet(key, data); } catch {}
  }
  return (memory[lang] = data);
}

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY));
  } catch {
    return null;
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}
