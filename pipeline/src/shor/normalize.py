import re
import unicodedata
from dataclasses import dataclass, field
from typing import Literal

NUKTA = "\u093c"

# Commas inside Indian (2,50,000) or Western (1,234,567) digit groups. A comma
# followed by anything else ("1, 2" or "12,3456") is a list separator.
_GROUPING_COMMA = re.compile(r"(?<=[0-9]),(?=[0-9]{2,3}(?![0-9]))")
_NUMBER = re.compile(r"[0-9]+")


def _ascii_digits(s: str) -> str:
    return "".join(
        str(unicodedata.decimal(c)) if unicodedata.category(c) == "Nd" else c for c in s
    )


def normalize_text(s: str) -> str:
    """NFC, ASCII digits, lower case, no punctuation or symbols, single spaces.

    Letters, combining marks (Devanagari vowel signs, virama, nukta) and numbers
    are kept. `\\w` is avoided because it drops combining marks.
    """
    s = _GROUPING_COMMA.sub("", _ascii_digits(unicodedata.normalize("NFC", s)))
    out = []
    for ch in s:
        cat = unicodedata.category(ch)
        if cat[0] in "LMN":
            out.append(ch.lower())
        elif cat == "Cf" or ch in "'\u2019":
            continue
        else:
            out.append(" ")
    return " ".join("".join(out).split())


def extract_numbers(s: str) -> list[str]:
    s = _GROUPING_COMMA.sub("", _ascii_digits(unicodedata.normalize("NFC", s)))
    return _NUMBER.findall(s)


def _fold(word: str) -> str:
    # Drops the nukta so हज़ार/हजार and अड़तालीस/अडतालीस look the same.
    return normalize_text(word).replace(NUKTA, "")


def _is_digits(tok: str) -> bool:
    return tok.isascii() and tok.isdigit()


# Index is the value. Each entry lists the spellings seen in ASR output.
HINDI_0_99: tuple[tuple[str, ...], ...] = (
    ("शून्य", "सिफर", "जीरो"),
    ("एक",),
    ("दो",),
    ("तीन",),
    ("चार",),
    ("पाँच", "पांच"),
    ("छह", "छः", "छे", "छ"),
    ("सात",),
    ("आठ",),
    ("नौ",),
    ("दस",),
    ("ग्यारह",),
    ("बारह",),
    ("तेरह",),
    ("चौदह",),
    ("पंद्रह", "पन्द्रह"),
    ("सोलह",),
    ("सत्रह",),
    ("अठारह",),
    ("उन्नीस",),
    ("बीस",),
    ("इक्कीस",),
    ("बाईस", "बाइस"),
    ("तेईस", "तेइस"),
    ("चौबीस",),
    ("पच्चीस", "पचीस"),
    ("छब्बीस",),
    ("सत्ताईस", "सत्ताइस"),
    ("अट्ठाईस", "अट्ठाइस", "अठाईस"),
    ("उनतीस", "उन्तीस"),
    ("तीस",),
    ("इकतीस", "इकत्तीस"),
    ("बत्तीस",),
    ("तैंतीस", "तेंतीस", "तैतीस"),
    ("चौंतीस", "चौतीस"),
    ("पैंतीस", "पैतीस"),
    ("छत्तीस", "छतीस"),
    ("सैंतीस", "सैतीस"),
    ("अड़तीस", "अठतीस"),
    ("उनतालीस", "उन्तालीस", "उनचालीस"),
    ("चालीस",),
    ("इकतालीस",),
    ("बयालीस",),
    ("तैंतालीस", "तैतालीस", "तेतालीस"),
    ("चौवालीस", "चवालीस", "चौआलीस"),
    ("पैंतालीस", "पैतालीस"),
    ("छियालीस", "छयालीस"),
    ("सैंतालीस", "सैतालीस"),
    ("अड़तालीस", "अठतालीस"),
    ("उनचास", "उन्चास"),
    ("पचास",),
    ("इक्यावन", "इकावन"),
    ("बावन",),
    ("तिरपन", "तिरेपन"),
    ("चौवन", "चौअन"),
    ("पचपन",),
    ("छप्पन",),
    ("सत्तावन", "सतावन"),
    ("अट्ठावन", "अठावन"),
    ("उनसठ",),
    ("साठ",),
    ("इकसठ",),
    ("बासठ",),
    ("तिरसठ", "तिरेसठ"),
    ("चौंसठ", "चौसठ"),
    ("पैंसठ", "पैसठ"),
    ("छियासठ", "छासठ"),
    ("सड़सठ", "सरसठ"),
    ("अड़सठ", "अठसठ"),
    ("उनहत्तर", "उनहतर", "उन्हत्तर"),
    ("सत्तर",),
    ("इकहत्तर", "इकहतर"),
    ("बहत्तर", "बहतर"),
    ("तिहत्तर", "तिहतर"),
    ("चौहत्तर", "चौहतर"),
    ("पचहत्तर", "पचहतर"),
    ("छिहत्तर", "छिहतर"),
    ("सतहत्तर", "सतहतर"),
    ("अठहत्तर", "अठहतर"),
    ("उन्यासी", "उनासी", "उन्नासी"),
    ("अस्सी",),
    ("इक्यासी", "इकासी"),
    ("बयासी",),
    ("तिरासी",),
    ("चौरासी",),
    ("पचासी",),
    ("छियासी",),
    ("सतासी", "सत्तासी"),
    ("अट्ठासी", "अठासी"),
    ("नवासी",),
    ("नब्बे",),
    ("इक्यानवे", "इकानवे"),
    ("बानवे", "बानबे"),
    ("तिरानवे", "तिरानबे"),
    ("चौरानवे", "चौरानबे"),
    ("पचानवे", "पंचानवे"),
    ("छियानवे", "छियानबे"),
    ("सत्तानवे", "सत्तानबे"),
    ("अट्ठानवे", "अठानवे"),
    ("निन्यानवे", "निन्यानबे", "निन्नानवे"),
)

_EN_UNITS = "one two three four five six seven eight nine".split()
_EN_TEENS = (
    "zero ten eleven twelve thirteen fourteen fifteen sixteen seventeen "
    "eighteen nineteen"
).split()
_EN_TENS = {
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fourty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
_SCALES = {
    "हज़ार": 10**3,
    "हजार": 10**3,
    "लाख": 10**5,
    "करोड़": 10**7,
    "करोड": 10**7,
    "thousand": 10**3,
    "lakh": 10**5,
    "lakhs": 10**5,
    "lac": 10**5,
    "lacs": 10**5,
    "crore": 10**7,
    "crores": 10**7,
    "million": 10**6,
    "billion": 10**9,
}
_HUNDREDS = ("सौ", "hundred")

# folded word -> (kind, value)
_WORDS: dict[str, tuple[str, int]] = {}
for _value, _spellings in enumerate(HINDI_0_99):
    for _w in _spellings:
        _WORDS[_fold(_w)] = ("small", _value)
for _value, _w in enumerate(_EN_UNITS, start=1):
    _WORDS[_w] = ("en_unit", _value)
_WORDS["zero"] = ("small", 0)
for _value, _w in enumerate(_EN_TEENS[1:], start=10):
    _WORDS[_w] = ("small", _value)
for _w, _value in _EN_TENS.items():
    _WORDS[_w] = ("en_tens", _value)
for _w in _HUNDREDS:
    _WORDS[_fold(_w)] = ("hundred", 100)
for _w, _value in _SCALES.items():
    _WORDS[_fold(_w)] = ("scale", _value)

_DIGIT_WORDS: dict[str, str] = {
    _fold(w): str(v) for v in range(10) for w in HINDI_0_99[v]
}
_DIGIT_WORDS["zero"] = "0"
_DIGIT_WORDS.update({w: str(v) for v, w in enumerate(_EN_UNITS, start=1)})

_SMALL_KINDS = ("small", "en_unit", "en_tens", "literal")


def _classify(tok: str) -> tuple[str, int, bool] | None:
    """Returns (kind, value, is_word) for a normalised token, or None."""
    if _is_digits(tok):
        return ("literal", int(tok), False)
    hit = _WORDS.get(tok.replace(NUKTA, ""))
    if hit is None:
        return None
    return (hit[0], hit[1], True)


class _Builder:
    """Accumulates one spoken number: total holds finished scale groups and
    chunk holds the part below the next scale."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.total = 0
        self.chunk = 0
        self.last: str | None = None
        self.last_scale: int | None = None
        self.has_word = False

    def can_take(self, kind: str) -> bool:
        last = self.last
        if last is None or kind == "scale":
            return True
        if kind == "hundred":
            return last == "scale" or (last in _SMALL_KINDS and 0 < self.chunk < 100)
        if last in ("hundred", "scale"):
            return True
        # English only: "twenty five". Hindi has no tens + unit compounds.
        return kind == "en_unit" and last == "en_tens"

    def add(self, kind: str, value: int, is_word: bool, results: list[int]) -> None:
        if kind == "scale":
            # A scale that is not smaller than the last one starts a new
            # number ("दो लाख तीन लाख" is two numbers).
            if self.last_scale is not None and value >= self.last_scale:
                results.append(self.total)
                self.total = 0
            self.total += (self.chunk or 1) * value
            self.chunk = 0
            self.last_scale = value
        elif kind == "hundred":
            self.chunk = (
                self.chunk * 100 if self.last in _SMALL_KINDS else self.chunk + 100
            )
        else:
            self.chunk += value
        self.last = kind
        self.has_word = self.has_word or is_word


def parse_spoken_numbers(s: str) -> list[int]:
    """Hindi and English number words as integers.

    Plain digit tokens only join a number that also has a word in it
    ("2 लाख 50 हज़ार"); digits alone are left to extract_numbers.
    """
    tokens = normalize_text(s).split()
    results: list[int] = []
    b = _Builder()

    def flush() -> None:
        if b.last is not None and b.has_word:
            results.append(b.total + b.chunk)
        b.reset()

    for i, tok in enumerate(tokens):
        atom = _classify(tok)
        if atom is None:
            if tok == "and" and b.last in ("hundred", "scale") and i + 1 < len(tokens):
                nxt = _classify(tokens[i + 1])
                if nxt is not None and nxt[0] in _SMALL_KINDS:
                    continue
            flush()
            continue
        kind, value, is_word = atom
        if not b.can_take(kind):
            flush()
        b.add(kind, value, is_word, results)
    flush()
    return results


@dataclass(frozen=True)
class Entity:
    type: Literal["amount", "digits", "name"]
    value: str
    aliases: list[str] = field(default_factory=list)


def _only_digits(s: str) -> str:
    return "".join(c for c in _ascii_digits(s) if c.isdigit())


def _canon(digits: str) -> str:
    return digits.lstrip("0") or "0"


def _digit_runs(transcript: str) -> list[str]:
    """Digit strings from runs of digit tokens or spoken digit words that touch
    each other. Any other word ends a run."""
    runs: list[str] = []
    cur: list[str] = []
    for tok in normalize_text(transcript).split():
        if _is_digits(tok):
            cur.append(tok)
            continue
        digit = _DIGIT_WORDS.get(tok.replace(NUKTA, ""))
        if digit is not None:
            cur.append(digit)
            continue
        if cur:
            runs.append("".join(cur))
            cur = []
    if cur:
        runs.append("".join(cur))
    return runs


def _name_match(candidate: str, text: str) -> bool:
    cand = normalize_text(candidate)
    if not cand:
        return False
    if cand.isascii():
        # "ram" must not match inside "program"
        return f" {cand} " in f" {text} "
    return cand in text


def entity_match(entity: Entity, transcript: str) -> bool:
    if entity.type == "amount":
        want = _only_digits(entity.value)
        if not want:
            return False
        found = {_canon(n) for n in extract_numbers(transcript)}
        found.update(str(n) for n in parse_spoken_numbers(transcript))
        return _canon(want) in found
    if entity.type == "digits":
        want = _only_digits(entity.value)
        return bool(want) and want in _digit_runs(transcript)
    text = normalize_text(transcript)
    return any(_name_match(c, text) for c in [entity.value, *entity.aliases])
