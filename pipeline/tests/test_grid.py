import json
import wave
from pathlib import Path

import numpy as np
import pytest

from shor.corpus import Clip, load_corpus
from shor.gnani import GnaniError, OutOfCredit, Transcription
from shor.grid import (
    CONDITIONS,
    FIELD,
    RawResult,
    condition_by_id,
    load_raw,
    run_grid,
    save_raw,
)
from shor.normalize import Entity

RATE = 16000


def write_wav(path: Path, seconds: float = 0.5, freq: float = 440.0) -> None:
    t = np.arange(int(seconds * RATE)) / RATE
    samples = (6000 * np.sin(2 * np.pi * freq * t)).round().astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(samples.tobytes())


def make_clips(tmp_path: Path, n: int, field: bool = False) -> list[Clip]:
    clips = []
    for i in range(n):
        wav = tmp_path / f"c{i}.wav"
        write_wav(wav, freq=300 + 50 * i)
        clips.append(
            Clip(
                id=f"c{i}",
                category="amount",
                text="कुल 500 रुपये",
                entities=[Entity("amount", "500")],
                wav=wav,
                featured=False,
                field=field,
            )
        )
    return clips


class FakeClient:
    """Transcribes everything as 'ok'. `cached` holds audio paths that count as cached."""

    def __init__(self, model="prisma-v3.0", fail_on=None, credit_out_on=None):
        self.model = model
        self.cached: set[Path] = set()
        self.calls: list[Path] = []
        self.new_calls = 0
        self.fail_on = fail_on or set()
        self.credit_out_on = credit_out_on

    def is_cached(self, audio: Path) -> bool:
        return Path(audio) in self.cached

    def transcribe(self, audio, language_code="hi-IN", fmt="transcribe"):
        audio = Path(audio)
        self.calls.append(audio)
        if audio in self.cached:
            return Transcription("ok", self.model, "hi-IN", True, None)
        self.new_calls += 1
        if self.credit_out_on == self.new_calls:
            raise OutOfCredit("Gnani out of credit (402): no balance")
        if audio.stem in self.fail_on:
            raise GnaniError("Gnani request failed (HTTP 400): bad audio")
        self.cached.add(audio)
        return Transcription(f"ok {audio.stem}", self.model, "hi-IN", False, "r1")


CLEAN = [condition_by_id("clean")]


def test_conditions_are_the_eleven_ids():
    assert [c.id for c in CONDITIONS] == [
        "clean",
        "street_snr20",
        "street_snr10",
        "street_snr5",
        "street_snr0",
        "fan_snr20",
        "fan_snr10",
        "fan_snr5",
        "fan_snr0",
        "g711",
        "amr_nb",
    ]
    assert FIELD.id == "field" and FIELD.kind == "field"
    street10 = condition_by_id("street_snr10")
    assert (street10.kind, street10.noise, street10.snr_db) == ("noise", "street", 10)
    assert condition_by_id("amr_nb").codec == "amr_nb"


def test_load_corpus(tmp_path):
    corpus = tmp_path / "corpus.json"
    corpus.write_text(
        json.dumps(
            [
                {
                    "id": "amt_01",
                    "category": "amount",
                    "text": "कुल 2,50,000 रुपये",
                    "entities": [{"type": "amount", "value": "250000", "aliases": []}],
                    "featured": True,
                    "field": False,
                }
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    clips = load_corpus(corpus, clips_dir=tmp_path / "clips")
    assert clips[0].id == "amt_01"
    assert clips[0].entities == [Entity("amount", "250000", [])]
    assert clips[0].wav == tmp_path / "clips" / "amt_01.wav"
    assert clips[0].featured and not clips[0].field


def test_grid_stops_on_out_of_credit_and_keeps_finished(tmp_path):
    clips = make_clips(tmp_path, 4)
    client = FakeClient(credit_out_on=3)
    seen = []
    raw = run_grid(
        clips, CLEAN, client, tmp_path, tmp_path / "work", None, on_result=seen.append
    )
    assert [r.clip_id for r in raw] == ["c0", "c1"]
    assert all(r.error is None for r in raw)
    assert seen == raw
    assert len(client.calls) == 3


def test_budget_counts_only_uncached_calls(tmp_path):
    clips = make_clips(tmp_path, 5)
    client = FakeClient()
    client.cached = {clips[0].wav, clips[2].wav}
    raw = run_grid(clips, CLEAN, client, tmp_path, tmp_path / "work", 2)
    # c0 cached, c1 new, c2 cached, c3 new, c4 skipped (budget spent)
    assert [r.clip_id for r in raw] == ["c0", "c1", "c2", "c3"]
    assert client.new_calls == 2


def test_cached_answers_still_returned_after_budget_spent(tmp_path):
    clips = make_clips(tmp_path, 3)
    client = FakeClient()
    client.cached = {clips[2].wav}
    raw = run_grid(clips, CLEAN, client, tmp_path, tmp_path / "work", 1)
    assert [r.clip_id for r in raw] == ["c0", "c2"]


def test_failed_call_becomes_error_row_and_grid_continues(tmp_path):
    clips = make_clips(tmp_path, 3)
    client = FakeClient(fail_on={"c1"})
    raw = run_grid(clips, CLEAN, client, tmp_path, tmp_path / "work", None)
    assert [r.clip_id for r in raw] == ["c0", "c1", "c2"]
    assert raw[1].error is not None and "HTTP 400" in raw[1].error
    assert raw[1].transcript == ""
    assert raw[0].error is None and raw[2].error is None


def test_field_clips_only_run_field_condition(tmp_path):
    clips = make_clips(tmp_path, 1)
    wav = tmp_path / "fld_01.wav"
    write_wav(wav)
    field_clip = Clip("fld_01", "plain", "x", [], wav, False, True)
    conditions = [condition_by_id("clean"), FIELD]
    client = FakeClient()
    raw = run_grid(
        clips + [field_clip], conditions, client, tmp_path, tmp_path / "work", None
    )
    pairs = [(r.clip_id, r.condition_id) for r in raw]
    assert pairs == [("c0", "clean"), ("fld_01", "field")]
    # field audio is sent as recorded
    assert client.calls[-1] == field_clip.wav


def test_noise_condition_reuses_degraded_wav(tmp_path):
    clips = make_clips(tmp_path, 1)
    noise_dir = tmp_path / "noise"
    noise_dir.mkdir()
    write_wav(noise_dir / "street.wav", seconds=0.2, freq=1200)
    work = tmp_path / "work"
    cond = [condition_by_id("street_snr10")]
    client = FakeClient()
    run_grid(clips, cond, client, noise_dir, work, None)
    out = work / "street_snr10" / "c0.wav"
    assert out.exists() and client.calls == [out]
    mtime = out.stat().st_mtime_ns
    run_grid(clips, cond, client, noise_dir, work, None)
    assert out.stat().st_mtime_ns == mtime
    assert client.new_calls == 1


def test_degrade_failure_becomes_error_row(tmp_path):
    silent = tmp_path / "s.wav"
    with wave.open(str(silent), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"\0\0" * RATE)
    clip = Clip("s", "plain", "x", [], silent, False, False)
    noise_dir = tmp_path / "noise"
    noise_dir.mkdir()
    write_wav(noise_dir / "fan.wav")
    raw = run_grid(
        [clip],
        [condition_by_id("fan_snr0")],
        FakeClient(),
        noise_dir,
        tmp_path / "w",
        None,
    )
    assert len(raw) == 1 and raw[0].error is not None


def test_progress_line_never_prints_key(tmp_path, capsys):
    clips = make_clips(tmp_path, 1)
    client = FakeClient()
    client._api_key = "secret-key-123"
    run_grid(clips, CLEAN, client, tmp_path, tmp_path / "work", None)
    out = capsys.readouterr().out
    assert "c0" in out and "clean" in out and "new" in out
    assert "secret-key-123" not in out


def test_save_raw_merges_and_replaces(tmp_path):
    path = tmp_path / "raw-m.json"
    save_raw(path, [RawResult("a", "clean", "m", "", "HTTP 504")])
    save_raw(path, [RawResult("b", "clean", "m", "hi", None)])
    save_raw(path, [RawResult("a", "clean", "m", "fixed", None)])
    rows = {(r.clip_id, r.condition_id): r for r in load_raw(path)}
    assert rows[("a", "clean")].transcript == "fixed"
    assert rows[("a", "clean")].error is None
    assert rows[("b", "clean")].transcript == "hi"
    assert not list(tmp_path.glob("*.tmp"))


def test_save_raw_keeps_good_answer_over_later_error(tmp_path):
    path = tmp_path / "raw-m.json"
    save_raw(path, [RawResult("a", "clean", "m", "good", None)])
    save_raw(path, [RawResult("a", "clean", "m", "", "HTTP 504")])
    assert load_raw(path)[0].transcript == "good"


@pytest.mark.parametrize("missing", [True, False])
def test_load_raw_missing_file(tmp_path, missing):
    path = tmp_path / "raw.json"
    if not missing:
        path.write_text("[]", encoding="utf-8")
    assert load_raw(path) == []


def test_export_web_audio_featured_only(tmp_path):
    from shor.grid import export_noise, export_web_audio

    clips = make_clips(tmp_path, 2)
    clips[0].featured = True
    work = tmp_path / "work"
    (work / "g711").mkdir(parents=True)
    write_wav(work / "g711" / "c0.wav")
    out = tmp_path / "audio"
    export_web_audio(clips, [condition_by_id("clean"), condition_by_id("g711"),
                             condition_by_id("fan_snr0")], work, out)
    assert sorted(p.relative_to(out).as_posix() for p in out.rglob("*.mp3")) == [
        "c0/clean.mp3",
        "c0/g711.mp3",
    ]
    noise_dir = tmp_path / "noise"
    noise_dir.mkdir()
    write_wav(noise_dir / "fan.wav")
    export_noise(noise_dir, tmp_path / "pub")
    assert [p.name for p in (tmp_path / "pub").iterdir()] == ["fan.mp3"]


def test_cli_api_key_from_dotenv(tmp_path, monkeypatch, capsys):
    from shor import cli

    monkeypatch.delenv("GNANI_API_KEY", raising=False)
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    with pytest.raises(SystemExit) as exc:
        cli._api_key()
    assert "GNANI_API_KEY is not set" in str(exc.value)
    (tmp_path / ".env").write_text("# x\nOTHER=1\nGNANI_API_KEY='abc123'\n")
    assert cli._api_key() == "abc123"


def test_cli_score_writes_results_offline(tmp_path, monkeypatch):
    from shor import cli

    corpus = tmp_path / "corpus.json"
    corpus.write_text(json.dumps([{
        "id": "amt_01", "category": "amount", "text": "कुल 500 रुपये",
        "entities": [{"type": "amount", "value": "500", "aliases": []}],
        "featured": False, "field": False,
    }], ensure_ascii=False), encoding="utf-8")
    work = tmp_path / "work"
    save_raw(work / "raw-m.json", [RawResult("amt_01", "clean", "m", "कुल 500 रुपये", None)])
    monkeypatch.setattr(cli, "CORPUS", corpus)
    monkeypatch.setattr(cli, "WORK", work)
    out = tmp_path / "results.json"
    cli.main(["score", "--out", str(out)])
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["aggregates"][0]["entity_accuracy"] == 1.0
