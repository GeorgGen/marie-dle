# Marie-dle

Ein Wordle-Klon im Browser für Deutsch, Englisch, Finnisch und Französisch, mit 4 bis 7 Buchstaben langen Wörtern und drei Schwierigkeitsstufen. Ohne Build-Schritt und ohne Abhängigkeiten: nur HTML, CSS und JavaScript-Module.

## Starten

```bash
./serve.sh          # oder: python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen. Ein Doppelklick auf `index.html` reicht nicht, weil Browser JavaScript-Module über `file://` blockieren.

## Spielmodi

| Einstellung | Optionen |
|---|---|
| Sprache | Deutsch, Englisch, Finnisch, Französisch |
| Wortlänge | 4, 5, 6, 7 |
| Schwierigkeit | Leicht, Mittel, Schwer: Lösungen aus den 3.000, 15.000 bzw. 60.000 häufigsten Wörtern |

Jeder Modus hat ein eigenes Tageswort und eine eigene Statistik. Danach kann man mit „Neues Wort“ beliebig weiterspielen. Im Statistik-Dialog zeigt der Reiter „Gesamt“ einen Vergleich über alle Modi: Wörter gegen Melodien, Sprachen, Wortlängen und Schwierigkeitsstufen (Spiele, Gewinnquote, Ø Versuche).

## Melodie-Modus

Über 🎵 in der Kopfzeile (bzw. `melodie.html`) errät man statt eines Worts die ersten 5, 6 oder 8 Töne (oder bei „Max“ alle gespeicherten) einer bekannten Melodie auf einer Klaviatur. Gewertet wird nur der Tonname, nicht die Oktave. Die Töne erzeugt der Browser selbst (Web Audio API), es gibt keine Sounddateien.

Die Melodien stehen in [`js/melodies.js`](js/melodies.js) als `"Ton:Dauer"`-Folgen (z. B. `"E5:0.25 D#5:0.25"`, Dauer in Vierteln). Jede Melodie reicht bis zum Ende ihrer ersten musikalischen Phrase; `max` legt fest, wie viele Töne davon im Modus „Max“ geraten werden. Die Melodien wurden mit Online-Notenquellen abgeglichen und anschließend durchgehört. Neue Einträge brauchen mindestens 8 Töne.

## Gute-Besserungs-Nachrichten

Bis einschließlich `GET_WELL_UNTIL` (in [`js/messages.js`](js/messages.js)) erscheint nach jedem gelösten Wort eine Gute-Besserungs-Nachricht im Statistik-Dialog. Sie wird zufällig gewählt und wiederholt sich erst, wenn alle einmal dran waren. `{word}` im Text wird durch das gelöste Wort ersetzt. Danach ist das Spiel wieder ein ganz normales Wordle.

Die Nachrichten sind in Sets organisiert (`MESSAGE_SETS`); welches verwendet wird, legt `ACTIVE_SET` fest. Aktiv ist `marie` (10 persönliche Nachrichten), daneben gibt es `erkaeltung` (30 lustige Nachrichten rund ums Erkältetsein).

## Woher die Wörter kommen

Beim ersten Start einer Sprache lädt das Spiel die Listen direkt von GitHub. Danach liegen sie aufbereitet in der IndexedDB des Browsers.

| Sprache | Häufigkeit | Wörterbuch | Eigennamen-Filter |
|---|---|---|---|
| Deutsch | [FrequencyWords](https://github.com/hermitdave/FrequencyWords) | [wortliste](https://github.com/davidak/wortliste) | Großgeschriebene Wörter nur mit Pluralform |
| Englisch | FrequencyWords | [english-words](https://github.com/dwyl/english-words) | [Hunspell](https://github.com/wooorm/dictionaries): nur großgeschriebene Einträge |
| Finnisch | FrequencyWords | [Kotus-Wortliste](https://github.com/hugovk/everyfinnishword) | nicht nötig, die Liste hat keine Namen |
| Französisch | FrequencyWords | Hunspell + [French-Wordlist](https://github.com/Taknok/French-Wordlist) | Hunspell |

- **Lösungswort:** ein Wort aus der Häufigkeitsliste, bis zum Rang der gewählten Schwierigkeit, das den Filter besteht.
- **Erlaubter Rateversuch:** jedes Wort aus der Häufigkeitsliste (Top 60.000) oder dem Wörterbuch.
- Von den vollständigen Häufigkeitslisten (10–40 MB) werden nur die ersten 60.000 Zeilen gestreamt, das sind etwa 0,8 MB.
- Alle URLs zeigen auf feste Commits statt auf `master`/`main`. So bekommen alle Spieler:innen dieselben Listen und damit dieselben Tageswörter.
- Unvollständige Downloads (z. B. eine WLAN-Login-Seite statt der Liste) werden erkannt und nicht gespeichert.

Sonderzeichen: Ä, Ö und Ü (Deutsch) bzw. Ä und Ö (Finnisch) sind eigene Buchstaben. Wörter mit ß werden übersprungen. Im Französischen werden Akzente entfernt (É → E).

## Projektstruktur

```
woertle/
├── index.html        Markup: Spielbrett, Tastatur, Dialoge
├── melodie.html      Melodie-Modus
├── css/style.css     Layout, Farben (hell/dunkel), Animationen
├── js/
│   ├── config.js     Sprachen, Tastaturen, Schwierigkeiten, Quell-URLs
│   ├── wordlists.js  Download und Aufbereitung der Wortlisten
│   ├── storage.js    IndexedDB-Cache (Wörterbücher), localStorage (Spielstand)
│   ├── messages.js   Gute-Besserungs-Nachrichten und bis wann sie erscheinen
│   ├── game.js       Reine Spiellogik: Wertung, Tageswort, Statistik
│   ├── ui.js         DOM: Brett, Tastatur, Toasts, Dialoge
│   ├── overview.js   Gesamtstatistik über alle Modi
│   ├── main.js       Einstiegspunkt Wörter, verbindet alles
│   ├── melody.js     Einstiegspunkt Melodie-Modus
│   ├── melodies.js   Melodien (Töne und Dauern)
│   └── audio.js      Klangerzeugung (Web Audio API)
└── serve.sh          Lokaler Webserver
```

## Erweitern

- **Neue Sprache:** In `config.js` einen Eintrag in `LANGS` anlegen (Alphabet, Tastatur, URLs) und in `wordlists.js` einen Filter in `FILTERS` ergänzen.
- **Schwierigkeit ändern:** `DIFFS` in `config.js`. Die größte Stufe bestimmt, wie viele Zeilen geladen werden.
- Nach Änderungen an der Aufbereitung oder an den gepinnten Commits `DICT_VERSION` in `storage.js` erhöhen, damit Browser den Cache neu aufbauen.
