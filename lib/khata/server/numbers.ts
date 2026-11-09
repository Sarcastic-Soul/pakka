// Port of extract_numbers / parse_spoken_numbers from pipeline/src/shor/normalize.py.

const NUKTA = "\u093c";

// Commas inside Indian (2,50,000) or Western (1,234,567) digit groups.
const GROUPING_COMMA = /(?<=[0-9]),(?=[0-9]{2,3}(?![0-9]))/g;

// Unicode decimal digits (Devanagari, etc.) to ASCII.
// Unicode Nd digits come in runs of 10 starting at zero (some runs touch, e.g.
// mathematical digits), so the offset from the start of the run, mod 10, is the value.
function asciiDigits(s: string): string {
  return s.replace(/\p{Nd}/gu, (c) => {
    const code = c.codePointAt(0)!;
    if (code <= 0x39) return c;
    let start = code;
    while (/\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
    return String((code - start) % 10);
  });
}

export function normalizeText(s: string): string {
  s = asciiDigits(s.normalize("NFC")).replace(GROUPING_COMMA, "");
  let out = "";
  for (const ch of s) {
    if (/[\p{L}\p{M}\p{N}]/u.test(ch)) out += ch.toLowerCase();
    else if (/\p{Cf}/u.test(ch) || ch === "'" || ch === "\u2019") continue;
    else out += " ";
  }
  return out.split(/\s+/).filter(Boolean).join(" ");
}

export function extractNumbers(s: string): string[] {
  s = asciiDigits(s.normalize("NFC")).replace(GROUPING_COMMA, "");
  return s.match(/[0-9]+/g) ?? [];
}

function fold(word: string): string {
  return normalizeText(word).replaceAll(NUKTA, "");
}

// Index is the value. Each entry lists the spellings seen in ASR output.
export const HINDI_0_99: readonly (readonly string[])[] = [
  ["शून्य", "सिफर", "जीरो"],
  ["एक"],
  ["दो"],
  ["तीन"],
  ["चार"],
  ["पाँच", "पांच"],
  ["छह", "छः", "छे", "छ"],
  ["सात"],
  ["आठ"],
  ["नौ"],
  ["दस"],
  ["ग्यारह"],
  ["बारह"],
  ["तेरह"],
  ["चौदह"],
  ["पंद्रह", "पन्द्रह"],
  ["सोलह"],
  ["सत्रह"],
  ["अठारह"],
  ["उन्नीस"],
  ["बीस"],
  ["इक्कीस"],
  ["बाईस", "बाइस"],
  ["तेईस", "तेइस"],
  ["चौबीस"],
  ["पच्चीस", "पचीस"],
  ["छब्बीस"],
  ["सत्ताईस", "सत्ताइस"],
  ["अट्ठाईस", "अट्ठाइस", "अठाईस"],
  ["उनतीस", "उन्तीस"],
  ["तीस"],
  ["इकतीस", "इकत्तीस"],
  ["बत्तीस"],
  ["तैंतीस", "तेंतीस", "तैतीस"],
  ["चौंतीस", "चौतीस"],
  ["पैंतीस", "पैतीस"],
  ["छत्तीस", "छतीस"],
  ["सैंतीस", "सैतीस"],
  ["अड़तीस", "अठतीस"],
  ["उनतालीस", "उन्तालीस", "उनचालीस"],
  ["चालीस"],
  ["इकतालीस"],
  ["बयालीस"],
  ["तैंतालीस", "तैतालीस", "तेतालीस"],
  ["चौवालीस", "चवालीस", "चौआलीस"],
  ["पैंतालीस", "पैतालीस"],
  ["छियालीस", "छयालीस"],
  ["सैंतालीस", "सैतालीस"],
  ["अड़तालीस", "अठतालीस"],
  ["उनचास", "उन्चास"],
  ["पचास"],
  ["इक्यावन", "इकावन"],
  ["बावन"],
  ["तिरपन", "तिरेपन"],
  ["चौवन", "चौअन"],
  ["पचपन"],
  ["छप्पन"],
  ["सत्तावन", "सतावन"],
  ["अट्ठावन", "अठावन"],
  ["उनसठ"],
  ["साठ"],
  ["इकसठ"],
  ["बासठ"],
  ["तिरसठ", "तिरेसठ"],
  ["चौंसठ", "चौसठ"],
  ["पैंसठ", "पैसठ"],
  ["छियासठ", "छासठ"],
  ["सड़सठ", "सरसठ"],
  ["अड़सठ", "अठसठ"],
  ["उनहत्तर", "उनहतर", "उन्हत्तर"],
  ["सत्तर"],
  ["इकहत्तर", "इकहतर"],
  ["बहत्तर", "बहतर"],
  ["तिहत्तर", "तिहतर"],
  ["चौहत्तर", "चौहतर"],
  ["पचहत्तर", "पचहतर"],
  ["छिहत्तर", "छिहतर"],
  ["सतहत्तर", "सतहतर"],
  ["अठहत्तर", "अठहतर"],
  ["उन्यासी", "उनासी", "उन्नासी"],
  ["अस्सी"],
  ["इक्यासी", "इकासी"],
  ["बयासी"],
  ["तिरासी"],
  ["चौरासी"],
  ["पचासी"],
  ["छियासी"],
  ["सतासी", "सत्तासी"],
  ["अट्ठासी", "अठासी"],
  ["नवासी"],
  ["नब्बे"],
  ["इक्यानवे", "इकानवे"],
  ["बानवे", "बानबे"],
  ["तिरानवे", "तिरानबे"],
  ["चौरानवे", "चौरानबे"],
  ["पचानवे", "पंचानवे"],
  ["छियानवे", "छियानबे"],
  ["सत्तानवे", "सत्तानबे"],
  ["अट्ठानवे", "अठानवे"],
  ["निन्यानवे", "निन्यानबे", "निन्नानवे"],
];

const EN_UNITS = "one two three four five six seven eight nine".split(" ");
const EN_TEENS = "ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const EN_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const SCALES: Record<string, number> = {
  "हज़ार": 1e3,
  "हजार": 1e3,
  "लाख": 1e5,
  "करोड़": 1e7,
  "करोड": 1e7,
  thousand: 1e3,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  lacs: 1e5,
  crore: 1e7,
  crores: 1e7,
  million: 1e6,
  billion: 1e9,
};
const HUNDREDS = ["सौ", "hundred"];

type Kind = "small" | "en_unit" | "en_tens" | "hundred" | "scale" | "literal";

const WORDS = new Map<string, [Kind, number]>();
HINDI_0_99.forEach((spellings, value) => {
  for (const w of spellings) WORDS.set(fold(w), ["small", value]);
});
EN_UNITS.forEach((w, i) => WORDS.set(w, ["en_unit", i + 1]));
WORDS.set("zero", ["small", 0]);
EN_TEENS.forEach((w, i) => WORDS.set(w, ["small", i + 10]));
for (const [w, v] of Object.entries(EN_TENS)) WORDS.set(w, ["en_tens", v]);
for (const w of HUNDREDS) WORDS.set(fold(w), ["hundred", 100]);
for (const [w, v] of Object.entries(SCALES)) WORDS.set(fold(w), ["scale", v]);

const SMALL_KINDS: readonly (Kind | null)[] = ["small", "en_unit", "en_tens", "literal"];

// Fractional money words. "times" multiplies the next unit (डेढ़ सौ = 150).
// "plus" adds a fraction of the unit to an optional count (साढ़े तीन सौ = 350,
// सवा सौ = 125). They only count when a सौ / scale word follows.
type Fraction = ["times" | "plus", number];
const FRACTIONS = new Map<string, Fraction>();
const addFraction = (words: string[], f: Fraction) => {
  for (const w of words) FRACTIONS.set(fold(w), f);
};
addFraction(["डेढ़", "डेढ", "डेड़", "dedh", "dedth", "derh", "dhedh"], ["times", 1.5]);
addFraction(["ढाई", "ढ़ाई", "dhai", "dhaai", "dhaee"], ["times", 2.5]);
addFraction(["सवा", "sawa", "sava", "sawaa", "savaa"], ["plus", 0.25]);
addFraction(["साढ़े", "साढे", "साड़े", "sadhe", "saadhe", "saade", "sade", "sarhe"], ["plus", 0.5]);
addFraction(["पौने", "पोने", "paune", "pone"], ["plus", -0.25]);

// Romanized units, only read after a fraction word ("dedh sau").
const ROMAN_UNITS = new Map<string, [Kind, number]>([
  ["sau", ["hundred", 100]],
  ["so", ["hundred", 100]],
  ["hazar", ["scale", 1e3]],
  ["hazaar", ["scale", 1e3]],
  ["hajar", ["scale", 1e3]],
]);

/** A unit word's value (सौ, हज़ार, लाख, ...) or null. */
function unitOf(tok: string | undefined): [Kind, number] | null {
  if (tok !== undefined && ROMAN_UNITS.has(tok)) return ROMAN_UNITS.get(tok)!;
  const atom = tok === undefined ? null : classify(tok);
  return atom && (atom[0] === "hundred" || atom[0] === "scale") ? [atom[0], atom[1]] : null;
}

/**
 * Reads a fraction phrase starting at tokens[i]. Returns the value, the unit
 * it ends on, and how many tokens it used, or null if it is not one.
 */
function readFraction(tokens: string[], i: number): [number, Kind, number, number] | null {
  const frac = FRACTIONS.get(tokens[i].replaceAll(NUKTA, ""));
  if (!frac) return null;
  const [mode, f] = frac;
  let count = 1;
  let used = 1;
  if (mode === "plus") {
    const n = classify(tokens[i + 1] ?? "");
    if (n && SMALL_KINDS.includes(n[0]) && n[1] >= 1 && n[1] <= 99) {
      count = n[1];
      used = 2;
    }
  }
  const unit = unitOf(tokens[i + used]);
  if (!unit) return null;
  const value = mode === "times" ? f * unit[1] : (count + f) * unit[1];
  if (!Number.isInteger(value) || value <= 0) return null;
  return [value, unit[0], unit[1], used + 1];
}

function classify(tok: string): [Kind, number, boolean] | null {
  if (/^[0-9]+$/.test(tok)) return ["literal", Number(tok), false];
  const hit = WORDS.get(tok.replaceAll(NUKTA, ""));
  return hit ? [hit[0], hit[1], true] : null;
}

class Builder {
  total = 0;
  chunk = 0;
  last: Kind | null = null;
  lastScale: number | null = null;
  hasWord = false;

  reset() {
    this.total = 0;
    this.chunk = 0;
    this.last = null;
    this.lastScale = null;
    this.hasWord = false;
  }

  canTake(kind: Kind): boolean {
    const last = this.last;
    if (last === null || kind === "scale") return true;
    if (kind === "hundred") {
      return last === "scale" || (SMALL_KINDS.includes(last) && this.chunk > 0 && this.chunk < 100);
    }
    if (last === "hundred" || last === "scale") return true;
    // English only: "twenty five". Hindi has no tens + unit compounds.
    return kind === "en_unit" && last === "en_tens";
  }

  add(kind: Kind, value: number, isWord: boolean, results: number[]) {
    if (kind === "scale") {
      // A scale not smaller than the last one starts a new number.
      if (this.lastScale !== null && value >= this.lastScale) {
        results.push(this.total);
        this.total = 0;
      }
      this.total += (this.chunk || 1) * value;
      this.chunk = 0;
      this.lastScale = value;
    } else if (kind === "hundred") {
      this.chunk = SMALL_KINDS.includes(this.last) ? this.chunk * 100 : this.chunk + 100;
    } else {
      this.chunk += value;
    }
    this.last = kind;
    this.hasWord = this.hasWord || isWord;
  }
}

/**
 * Hindi and English number words as integers. Plain digit tokens only join a
 * number that also has a word in it ("2 लाख 50 हज़ार"); digits alone are left
 * to extractNumbers.
 */
export function parseSpokenNumbers(s: string): number[] {
  const tokens = normalizeText(s).split(" ").filter(Boolean);
  const results: number[] = [];
  const b = new Builder();
  const flush = () => {
    if (b.last !== null && b.hasWord) results.push(b.total + b.chunk);
    b.reset();
  };
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const frac = readFraction(tokens, i);
    if (frac !== null) {
      const [value, unitKind, unitValue, used] = frac;
      // "दो लाख ढाई हज़ार" continues the number; anything else starts a new one.
      const joins = b.last === "scale" && b.chunk === 0 && b.lastScale !== null && b.lastScale > unitValue;
      if (!joins) flush();
      if (unitKind === "scale") {
        b.total += value;
        b.lastScale = unitValue;
      } else {
        b.chunk = value;
      }
      b.last = unitKind;
      b.hasWord = true;
      i += used - 1;
      continue;
    }
    const atom = classify(tok);
    if (atom === null) {
      if (tok === "and" && (b.last === "hundred" || b.last === "scale") && i + 1 < tokens.length) {
        const nxt = classify(tokens[i + 1]);
        if (nxt !== null && SMALL_KINDS.includes(nxt[0])) continue;
      }
      flush();
      continue;
    }
    const [kind, value, isWord] = atom;
    if (!b.canTake(kind)) flush();
    b.add(kind, value, isWord, results);
  }
  flush();
  return results;
}

/** Every number in the text, from digits and from spoken words. */
export function numbersIn(text: string): Set<number> {
  const out = new Set<number>();
  for (const d of extractNumbers(text)) out.add(Number(d));
  for (const n of parseSpokenNumbers(text)) out.add(n);
  return out;
}
