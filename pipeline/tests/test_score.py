import json
import math
from pathlib import Path

import pytest

from shor.corpus import Clip
from shor.grid import CONDITIONS, RawResult, condition_by_id
from shor.normalize import Entity
from shor.score import breakpoint_snr, score, write_results

M = "prisma-v3.0"


def clip(cid: str, text: str, entities: list[Entity], featured=False) -> Clip:
    return Clip(cid, "amount", text, entities, Path(f"/x/{cid}.wav"), featured, False)


AMT = clip("amt_01", "कुल 2,50,000 रुपये चाहिए", [Entity("amount", "250000")], True)
NAM = clip("nam_01", "मेरा नाम राहुल है", [Entity("name", "राहुल", ["rahul"])])
PLN = clip("pln_01", "आज मौसम अच्छा है", [])


def row(payload, cid, cond, model=M):
    return next(
        r
        for r in payload["results"]
        if (r["clip"], r["condition"], r["model"]) == (cid, cond, model)
    )


def agg(payload, cond, model=M):
    return next(
        a
        for a in payload["aggregates"]
        if (a["condition"], a["model"]) == (cond, model)
    )


def test_breakpoint_interpolates():
    got = breakpoint_snr([(20, 1.0), (10, 0.95), (5, 0.8), (0, 0.4)])
    assert got == pytest.approx(8.33, abs=0.01)


def test_breakpoint_none_when_never_below():
    assert breakpoint_snr([(20, 1.0), (10, 0.95), (5, 0.92), (0, 0.9)]) is None
    assert breakpoint_snr([]) is None


def test_breakpoint_first_point_below_returns_first_snr():
    assert breakpoint_snr([(20, 0.5), (10, 0.3)]) == 20


def test_empty_transcript_scores_wer_1_and_entity_false():
    raw = [RawResult("amt_01", "clean", M, "", None)]
    p = score([AMT], raw, CONDITIONS)
    r = row(p, "amt_01", "clean")
    assert r["transcript"] == ""
    assert r["wer"] == 1.0 and r["cer"] == 1.0
    assert r["entity_ok"] is False
    assert agg(p, "clean")["entity_accuracy"] == 0.0


def test_delta_wer_is_zero_for_clean():
    raw = [RawResult("amt_01", "clean", M, "कुल 250000 रुपये", None)]
    p = score([AMT], raw, CONDITIONS)
    assert row(p, "amt_01", "clean")["delta_wer"] == 0.0
    assert agg(p, "clean")["delta_wer"] == 0.0


def test_delta_wer_compares_to_same_model_clean():
    raw = [
        RawResult("amt_01", "clean", M, "कुल 250000 रुपये", None),
        RawResult("amt_01", "street_snr10", M, "कुल 250000 रुपये", None),
        RawResult("amt_01", "clean", "prisma-v2.5", "a b c d", None),
        RawResult("amt_01", "street_snr10", "prisma-v2.5", "a b c x", None),
    ]
    p = score([AMT], raw, CONDITIONS)
    noisy = row(p, "amt_01", "street_snr10")
    assert noisy["wer"] > 0  # differs from the reference text
    assert noisy["delta_wer"] == 0.0  # same as its own clean answer
    assert row(p, "amt_01", "street_snr10", "prisma-v2.5")["delta_wer"] == 0.25
    assert p["models"] == [M, "prisma-v2.5"]


def test_entity_accuracy_is_share_of_clips_with_entities():
    raw = [
        RawResult("amt_01", "clean", M, "कुल 2,50,000 रुपये चाहिए", None),
        RawResult("nam_01", "clean", M, "मेरा नाम मोहन है", None),
        RawResult("pln_01", "clean", M, "आज मौसम अच्छा है", None),
    ]
    p = score([AMT, NAM, PLN], raw, CONDITIONS)
    assert row(p, "amt_01", "clean")["entity_ok"] is True
    assert row(p, "nam_01", "clean")["entity_ok"] is False
    assert row(p, "pln_01", "clean")["entity_ok"] is True
    a = agg(p, "clean")
    assert a["entity_accuracy"] == 0.5
    assert a["n"] == 3


def test_error_rows_are_left_out():
    raw = [
        RawResult("amt_01", "clean", M, "कुल 250000", None),
        RawResult("amt_01", "street_snr0", M, "", "HTTP 504"),
    ]
    p = score([AMT], raw, CONDITIONS)
    assert [c["id"] for c in p["conditions"]] == ["clean"]
    assert len(p["results"]) == 1


def test_partial_run_has_no_nan(tmp_path):
    raw = [
        RawResult("amt_01", "street_snr10", M, "कुल 250000", None),
        RawResult("nam_01", "street_snr10", M, "", None),
        RawResult("pln_01", "g711", M, "", None),
    ]
    p = score([AMT, NAM, PLN], raw, CONDITIONS)
    out = tmp_path / "out" / "results.json"
    write_results(out, p)
    text = out.read_text(encoding="utf-8")
    assert "NaN" not in text and "रुपये" in text
    data = json.loads(text)
    assert {a["condition"] for a in data["aggregates"]} == {"street_snr10", "g711"}
    assert [c["id"] for c in data["conditions"]] == ["street_snr10", "g711"]
    assert data["conditions"][0] == {
        "id": "street_snr10",
        "kind": "noise",
        "noise": "street",
        "snr_db": 10,
    }
    assert data["conditions"][1] == {"id": "g711", "kind": "codec", "codec": "g711"}
    g711 = agg(data, "g711")
    assert g711["n"] == 1 and math.isfinite(g711["entity_accuracy"])
    assert data["breakpoints"] == [{"model": M, "noise": "street", "snr_db": 10}]
    for r in data["results"]:
        assert all(math.isfinite(r[k]) for k in ("wer", "cer", "delta_wer")), r


def test_clips_and_audio_base():
    raw = [RawResult(c.id, "clean", M, c.text, None) for c in (AMT, NAM)]
    p = score([AMT, NAM, PLN], raw, CONDITIONS)
    assert p["clips"] == [
        {
            "id": "amt_01",
            "category": "amount",
            "text": AMT.text,
            "audio_base": "/audio/amt_01",
        },
        {"id": "nam_01", "category": "amount", "text": NAM.text, "audio_base": None},
    ]
    assert p["generated_at"].endswith("Z")


def test_breakpoints_use_snr_order_and_skip_unrun_noise():
    clips = [clip(f"a{i}", "कुल 500 रुपये", [Entity("amount", "500")]) for i in range(4)]
    raw = []
    # street: 20 -> 4/4, 10 -> 3/4, 5 -> 2/4
    hits = {20: 4, 10: 3, 5: 2}
    for snr, n in hits.items():
        for i, c in enumerate(clips):
            text = "कुल 500 रुपये" if i < n else "कुल रुपये"
            raw.append(RawResult(c.id, f"street_snr{snr}", M, text, None))
    p = score(clips, raw, CONDITIONS)
    (bp,) = p["breakpoints"]
    assert bp["noise"] == "street"
    # 1.0 at 20, 0.75 at 10: crosses 0.9 at 20 - 10 * 0.1 / 0.25 = 16
    assert bp["snr_db"] == pytest.approx(16.0)


def test_write_results_rejects_nan(tmp_path):
    with pytest.raises(ValueError):
        write_results(tmp_path / "r.json", {"x": float("nan")})


def test_unknown_condition_is_ignored():
    raw = [RawResult("amt_01", "nope", M, "x", None)]
    p = score([AMT], raw, [condition_by_id("clean")])
    assert p["results"] == [] and p["conditions"] == []
