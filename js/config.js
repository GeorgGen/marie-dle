// Spielkonstanten, Schwierigkeitsstufen und Sprachdefinitionen.

// Auf feste Commits gepinnt, damit alle Spieler:innen dieselben Listen (und Tageswörter) haben.
const GH = "https://raw.githubusercontent.com/";

// Häufigkeitslisten aus Filmuntertiteln (OpenSubtitles 2018), absteigend sortiert.
const freqUrl = lang =>
  `${GH}hermitdave/FrequencyWords/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/${lang}/${lang}_full.txt`;

export const ROWS = 6;
export const LENGTHS = [4, 5, 6, 7];

export const DIFFS = {
  easy:   { name: "Leicht", top: 4000 },
  medium: { name: "Mittel", top: 20000 },
  hard:   { name: "Schwer", top: 100000 }
};

// Wie viele Zeilen der Häufigkeitsliste geladen werden (= größte Stufe).
export const MAX_RANK = Math.max(...Object.values(DIFFS).map(d => d.top));

export const DEFAULT_MODE = { lang: "de", len: 5, diff: "medium" };

// alpha:        erlaubte Buchstaben nach Großschreibung
// stripAccents: Akzente entfernen (É → E)
// urls.freq:    Häufigkeitsliste; weitere urls werden in wordlists.js ausgewertet
export const LANGS = {
  de: {
    name: "Deutsch", short: "DE",
    alpha: /^[A-ZÄÖÜ]+$/,
    keys: [["Q","W","E","R","T","Z","U","I","O","P","Ü"],
           ["A","S","D","F","G","H","J","K","L","Ö","Ä"],
           ["ENTER","Y","X","C","V","B","N","M","⌫"]],
    urls: {
      freq: freqUrl("de"),
      dict: GH + "davidak/wortliste/1a8edf627b06b4443d3857317dca9c3cf7f97382/wortliste.txt"
    }
  },
  en: {
    name: "Englisch", short: "EN",
    alpha: /^[A-Z]+$/,
    keys: [["Q","W","E","R","T","Y","U","I","O","P"],
           ["A","S","D","F","G","H","J","K","L"],
           ["ENTER","Z","X","C","V","B","N","M","⌫"]],
    urls: {
      freq: freqUrl("en"),
      dict: GH + "dwyl/english-words/20f5cc9b3f0ccc8ce45d814c532b7c2031bba31c/words_alpha.txt",
      hunspell: GH + "wooorm/dictionaries/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries/en/index.dic"
    }
  },
  fi: {
    name: "Finnisch", short: "FI",
    alpha: /^[A-ZÄÖ]+$/,
    keys: [["Q","W","E","R","T","Y","U","I","O","P"],
           ["A","S","D","F","G","H","J","K","L","Ö","Ä"],
           ["ENTER","Z","X","C","V","B","N","M","⌫"]],
    urls: {
      freq: freqUrl("fi"),
      dict: GH + "hugovk/everyfinnishword/d4df6e4efdce54c10197cf151a5cd0638d99860a/kaikkisanat.txt"
    }
  },
  fr: {
    name: "Französisch", short: "FR",
    alpha: /^[A-Z]+$/,
    stripAccents: true,
    keys: [["A","Z","E","R","T","Y","U","I","O","P"],
           ["Q","S","D","F","G","H","J","K","L","M"],
           ["ENTER","W","X","C","V","B","N","⌫"]],
    urls: {
      freq: freqUrl("fr"),
      hunspell: GH + "wooorm/dictionaries/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries/fr/index.dic",
      list: GH + "Taknok/French-Wordlist/69c15b1b1e5c5423576f97dd98d1d0466c528043/francais.txt"
    }
  }
};

export const modeKey = m => `${m.lang}-${m.len}-${m.diff}`;
export const modeLabel = m => `${LANGS[m.lang].name} · ${m.len} Buchstaben · ${DIFFS[m.diff].name}`;
export const isValidMode = m =>
  !!m && typeof m === "object" && Object.hasOwn(LANGS, m.lang) &&
  LENGTHS.includes(m.len) && Object.hasOwn(DIFFS, m.diff);
