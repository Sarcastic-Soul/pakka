import json
import os
from datetime import UTC, datetime
from pathlib import Path

from .corpus import Clip
from .grid import NOISES, SNRS, Condition, RawResult
from .metrics import cer, wer
from .normalize import entity_match

THRESHOLD = 0.9


def breakpoint_snr(
    points: list[tuple[float, float]], threshold: float = THRESHOLD
) -> float | None:
    """First SNR, going from clean to loud noise, where accuracy drops below the
    threshold, linearly interpolated between the two points around it."""
    prev: tuple[float, float] | None = None
    for snr, acc in points:
        if acc < threshold:
            if prev is None:
                return snr
            s0, a0 = prev
            return s0 + (snr - s0) * (a0 - threshold) / (a0 - acc)
        prev = (snr, acc)
    return None


def _num(x: float) -> int | float:
    return int(x) if float(x).is_integer() else x


def _condition_json(c: Condition) -> dict:
    out: dict = {"id": c.id, "kind": c.kind}
    if c.kind == "noise":
        out.update(noise=c.noise, snr_db=_num(c.snr_db))
    elif c.kind == "codec":
        out["codec"] = c.codec
    return out


def _mean(xs: list[float]) -> float:
    return round(sum(xs) / len(xs), 4)


def score(clips: list[Clip], raw: list[RawResult], conditions: list[Condition]) -> dict:
    by_clip = {c.id: c for c in clips}
    by_cond = {c.id: c for c in conditions}
    good = [
        r
        for r in raw
        if r.error is None and r.clip_id in by_clip and r.condition_id in by_cond
    ]
    models = list(dict.fromkeys(r.model for r in good))
    clean = {
        (r.model, r.clip_id): r.transcript for r in good if r.condition_id == "clean"
    }

    rows = []
    for r in good:
        clip = by_clip[r.clip_id]
        w = wer(clip.text, r.transcript)
        if clip.entities:
            ok = all(entity_match(e, r.transcript) for e in clip.entities)
        else:
            # no entity to check: count the clip as right only if every word is right
            ok = w == 0.0
        base = clean.get((r.model, r.clip_id))
        delta = (
            0.0
            if r.condition_id == "clean" or base is None
            else wer(base, r.transcript)
        )
        rows.append(
            {
                "clip": r.clip_id,
                "condition": r.condition_id,
                "model": r.model,
                "transcript": r.transcript,
                "entity_ok": ok,
                "wer": round(w, 4),
                "cer": round(cer(clip.text, r.transcript), 4),
                "delta_wer": round(delta, 4),
                "_has_entity": bool(clip.entities),
            }
        )

    aggregates = []
    acc_at: dict[tuple[str, str], float] = {}
    for model in models:
        for cond in conditions:
            cell = [
                x for x in rows if x["model"] == model and x["condition"] == cond.id
            ]
            if not cell:
                continue
            scored = [x for x in cell if x["_has_entity"]] or cell
            acc = _mean([1.0 if x["entity_ok"] else 0.0 for x in scored])
            acc_at[(model, cond.id)] = acc
            aggregates.append(
                {
                    "model": model,
                    "condition": cond.id,
                    "entity_accuracy": acc,
                    "wer": _mean([x["wer"] for x in cell]),
                    "delta_wer": _mean([x["delta_wer"] for x in cell]),
                    "n": len(cell),
                }
            )
    for x in rows:
        del x["_has_entity"]

    breakpoints = []
    for model in models:
        for noise in NOISES:
            points = [
                (float(snr), acc_at[(model, f"{noise}_snr{snr}")])
                for snr in SNRS
                if (model, f"{noise}_snr{snr}") in acc_at
            ]
            if not points:
                continue
            bp = breakpoint_snr(points)
            breakpoints.append(
                {
                    "model": model,
                    "noise": noise,
                    "snr_db": None if bp is None else _num(round(bp, 2)),
                }
            )

    used_conds = {x["condition"] for x in rows}
    used_clips = {x["clip"] for x in rows}
    return {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "models": models,
        "conditions": [_condition_json(c) for c in conditions if c.id in used_conds],
        "clips": [
            {
                "id": c.id,
                "category": c.category,
                "text": c.text,
                "audio_base": f"/audio/{c.id}" if c.featured else None,
                "has_entity": bool(c.entities),
            }
            for c in clips
            if c.id in used_clips
        ],
        "results": rows,
        "aggregates": aggregates,
        "breakpoints": breakpoints,
    }


def write_results(path: Path, payload: dict) -> None:
    text = json.dumps(payload, allow_nan=False, ensure_ascii=False, indent=2)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text + "\n", encoding="utf-8")
    os.replace(tmp, path)
