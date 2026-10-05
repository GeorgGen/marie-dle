// Klangerzeugung mit der Web Audio API: ein einfacher, klavierähnlicher Ton, ohne Sounddateien.

let ctx = null;
let voices = [];      // laufende Oszillatoren, damit „Stopp“ alles beenden kann
let timers = [];

// Der AudioContext darf erst nach einer Nutzeraktion starten (Autoplay-Regeln der Browser).
function audio() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

const freq = midi => 440 * Math.pow(2, (midi - 69) / 12);

// Zwei Oszillatoren (Grundton + leise Oktave) mit schnellem Anschlag und Abklingen.
function tone(midi, t, dur) {
  const c = audio();
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(dur, 0.2) + 0.4);
  g.connect(c.destination);
  for (const [type, mult, vol] of [["triangle", 1, 1], ["sine", 2, 0.3]]) {
    const o = c.createOscillator(), v = c.createGain();
    o.type = type;
    o.frequency.value = freq(midi) * mult;
    v.gain.value = vol;
    o.connect(v).connect(g);
    o.start(t);
    o.stop(t + dur + 0.5);
    o.onended = () => { voices = voices.filter(x => x !== o); };
    voices.push(o);
  }
}

export function playNote(midi, dur = 0.5) {
  tone(midi, audio().currentTime + 0.01, dur);
}

export function stopAll() {
  voices.forEach(o => { try { o.stop(); } catch {} });
  voices = [];
  timers.forEach(clearTimeout);
  timers = [];
}

// Spielt [{midi, dur}] (dur in Vierteln) im angegebenen Tempo.
// onStep(i) wird beim i-ten Ton aufgerufen, onStep(-1) am Ende.
// Sehr lange Töne werden gekürzt, damit niemand fünf Sekunden auf den nächsten wartet.
export function playSequence(notes, bpm, onStep = () => {}) {
  stopAll();
  const c = audio();
  const beat = 60 / bpm;
  let t = c.currentTime + 0.08, ms = 80;
  notes.forEach((n, i) => {
    const len = Math.min(Math.max(n.dur * beat, 0.09), 1.6);
    tone(n.midi, t, len);
    timers.push(setTimeout(() => onStep(i), ms));
    t += len;
    ms += len * 1000;
  });
  timers.push(setTimeout(() => onStep(-1), ms + 200));
}
