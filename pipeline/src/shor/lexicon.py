from .normalize import NUKTA, normalize_text

# Devanagari spellings of English loanwords -> the Latin form Prisma writes.
# Only words that appear in this corpus or its transcripts; extend as needed.
LOANWORDS: dict[str, str] = {
    "बैंक": "bank",
    "लोन": "loan",
    "बिल": "bill",
    "स्कूल": "school",
    "फीस": "fees",
    "सैलरी": "salary",
    "ऑटो": "auto",
    "मोबाइल": "mobile",
    "नंबर": "number",
    "नम्बर": "number",
    "पिन": "pin",
    "कोड": "code",
    "कॉल": "call",
    "काल": "call",
    "अकाउंट": "account",
    "एकाउंट": "account",
    "पार्सल": "parcel",
    "वेरिफिकेशन": "verification",
    "फोन": "phone",
    "फ़ोन": "phone",
    "डॉक्टर": "doctor",
    "पेमेंट": "payment",
    "अमाउंट": "amount",
    "ईएमआई": "emi",
    "ओटीपी": "otp",
    "व्हाट्सएप": "whatsapp",
    "प्लीज": "please",
    "प्लीज़": "please",
    "अर्जेंट": "urgent",
    "स्टार्ट": "start",
    "बैक": "back",
    "वेरीफाई": "verify",
    "वेरिफाई": "verify",
}

# Same word, different accepted spelling.
SPELLINGS: dict[str, str] = {
    "रुपए": "रुपये",
    "रूपए": "रुपये",
    "रूपये": "रुपये",
    "आख़िरी": "आखिरी",
}

_LOAN = {w.replace(NUKTA, ""): v for w, v in LOANWORDS.items()}
_SPELL = {w.replace(NUKTA, ""): v.replace(NUKTA, "") for w, v in SPELLINGS.items()}


def canonical_tokens(s: str) -> list[str]:
    """Tokens for WER/CER: normalised, nukta dropped, accepted spellings merged
    and Devanagari loanwords written in Latin, so script choice is not an error."""
    out = []
    for tok in normalize_text(s).split():
        tok = tok.replace(NUKTA, "")
        tok = _SPELL.get(tok, tok)
        out.append(_LOAN.get(tok, tok))
    return out
