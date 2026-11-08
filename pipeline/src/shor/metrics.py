from collections.abc import Sequence


def _edit_distance(a: Sequence, b: Sequence) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, start=1):
        cur = [i]
        for j, y in enumerate(b, start=1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def _rate(ref: Sequence, hyp: Sequence) -> float:
    if not ref:
        return 0.0 if not hyp else 1.0
    return _edit_distance(ref, hyp) / len(ref)


def wer(ref: str, hyp: str) -> float:
    from .lexicon import canonical_tokens

    return _rate(canonical_tokens(ref), canonical_tokens(hyp))


def cer(ref: str, hyp: str) -> float:
    from .lexicon import canonical_tokens

    return _rate(" ".join(canonical_tokens(ref)), " ".join(canonical_tokens(hyp)))
