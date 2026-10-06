// Gute-Besserungs-Nachrichten für Marie. Nach jedem gelösten Wort erscheint eine,
// bis einschließlich GET_WELL_UNTIL; danach ist Marie-dle wieder ein normales Wordle.
// {word} wird durch das gelöste Wort ersetzt.
//
// Es gibt mehrere Sets; ACTIVE_SET bestimmt, welches verwendet wird.

export const GET_WELL_UNTIL = "2026-10-10";

export const ACTIVE_SET = "marie";

export const MESSAGE_SETS = {
  // Persönliche Nachrichten für Marie
  marie: [
    "Gute Besserung, Marie!",
    "Du bist toll!",
    "Wenn Rätselraten Medizin wäre, wärst du jetzt schon fast wieder fit. 💊",
    "Gelöst! 🎉 Dein Immunsystem hat gerade angerufen und gefragt, ob du ihm auch so schnell helfen kannst.",
    "Ich finde dich so unfassbar schlau und intelligent, Marie!",
    "Du beeindruckst mich jeden Tag aufs Neue!",
    "Das war beeindruckend! Gönn deinem Kopf jetzt eine Pause, er hat sich Tee verdient. 🫖",
    "Glückwunsch! Hier ist eine virtuelle Umarmung (garantiert virenfrei). 🤗",
    "{word}! Wie machst du das bloß mit Fieber? Stell dir vor, was du erst gesund kannst.",
    "Du würdest Wir Sind Helden bestimmt ein Wort geben!"
  ],

  // Erstes Set: 30 lustige Nachrichten rund ums Erkältetsein
  erkaeltung: [
    "Gelöst! 🎉 Dein Immunsystem hat gerade angerufen und gefragt, ob du ihm auch so schnell helfen kannst.",
    "{word}! Wie machst du das bloß – mit Fieber? Stell dir vor, was du erst gesund kannst. 🤒➡️💪",
    "Die Viren haben dir beim Raten zugeschaut und sind jetzt eingeschüchtert. Gut so. 🦠😱",
    "Ein Wort weniger auf der Welt, das du nicht kennst. Und hoffentlich ein Schnupfentaschentuch weniger. 🤧💛",
    "Offizielles Rezept von Dr. Wordle: 3× täglich raten, viel Tee, noch mehr Decke. 🍵🛋️",
    "Du hast {word} gefunden! Jetzt fehlt nur noch das Wort GESUND. Das kommt bestimmt bald. 🌈",
    "Bravo! Deine Kuscheldecke ist sehr stolz auf dich und hat das auch allen Kissen erzählt. 🛏️✨",
    "Gelöst! Zur Belohnung: eine imaginäre heiße Schokolade mit extra Marshmallows. ☕🍡",
    "So viel Gehirnschmalz – und das im Krankenbett! Die Wissenschaft steht vor einem Rätsel. 🧠🔬",
    "Gute Besserung von allen Buchstaben, besonders von G, U, T und E. 💌",
    "{word} – erledigt. Nächste Aufgabe auf der Liste: ausruhen. Das ist ein Befehl! 😤💤",
    "Wenn Rätselraten Medizin wäre, wärst du jetzt schon fast wieder fit. 💊😄",
    "Die grünen Kästchen sind übrigens die Farbe von Pfefferminztee. Zufall? Ich glaube nicht. 🌿",
    "Glückwunsch! Hier ist eine virtuelle Umarmung (garantiert virenfrei). 🤗",
    "Ein kleiner Sieg für dich, eine große Niederlage für die Erkältung. 🚀🦠",
    "Sogar krank schlägst du dieses Spiel. Die Erkältung hat keine Chance. 🥊",
    "{word}! Merk dir das Wort, damit kannst du später beim Arzt angeben. 🩺😎",
    "Du hast gewonnen! Preis: ein ganzer Tag Nichtstun, ohne schlechtes Gewissen. 🏆🛋️",
    "Schnell gelöst – wahrscheinlich, weil du so viel Zeit im Bett liegst. Nutz sie auch zum Schlafen! 😴",
    "Achtung: Akute Klugheit festgestellt. Nebenwirkungen: gute Laune. Bitte weiter so. 📋😁",
    "Jeder grüne Buchstabe heißt: Du wirst ein bisschen gesünder. (Medizinisch nicht bewiesen, aber fühlt sich richtig an.) 💚",
    "Suppe, Decke, Marie-dle – die heilige Dreifaltigkeit des Krankseins. 🍲🛌🟩",
    "Bravo! Ein kleines Kätzchen im Internet ist gerade sehr stolz auf dich. 🐱",
    "{word} – wieder eins geknackt. Jetzt noch die Erkältung knacken, dann bist du unaufhaltsam. 🔓",
    "Hier ist eine Medaille für Tapferkeit im Krankenbett. 🥇 Du darfst sie auch im Pyjama tragen.",
    "Das war beeindruckend! Gönn deinem Kopf jetzt eine Pause – er hat sich Tee verdient. 🫖",
    "Die Taschentuch-Industrie dankt für deine Unterstützung, wünscht dir aber trotzdem gute Besserung. 🤧📦",
    "Gelöst! Kleiner Reminder: Du bist toll, auch wenn deine Nase gerade so rot ist wie die von Rudolph. 🦌❤️",
    "{word} gefunden! Wenn du so weitermachst, schreibst du bald das Wörterbuch neu. 📖✍️",
    "Ganz schnell wieder gesund werden, okay? Das Spiel ist schön, aber du fehlst draußen. 🌻"
  ]
};

const GET_WELL_MESSAGES = MESSAGE_SETS[ACTIVE_SET];

const localDate = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function getWellActive(date = new Date()) {
  return localDate(date) <= GET_WELL_UNTIL;
}

// Nimmt eine noch nicht gezeigte Nachricht; erst wenn alle dran waren, geht es von vorn los.
// `seen` enthält bereits gezeigte Nachrichten als "set:index" und wird hier ergänzt;
// so stören sich die Sets nicht gegenseitig, wenn ACTIVE_SET gewechselt wird.
export function pickGetWell(word, seen) {
  const id = i => `${ACTIVE_SET}:${i}`;
  const all = GET_WELL_MESSAGES.map((_, i) => i);
  let unseen = all.filter(i => !seen.includes(id(i)));
  if (unseen.length === 0) {
    for (let j = seen.length - 1; j >= 0; j--) {
      if (seen[j].startsWith(ACTIVE_SET + ":")) seen.splice(j, 1);
    }
    unseen = all;
  }
  const i = unseen[Math.floor(Math.random() * unseen.length)];
  seen.push(id(i));
  return GET_WELL_MESSAGES[i].replaceAll("{word}", word);
}
