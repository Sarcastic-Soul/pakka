import json
import os
import subprocess
from collections.abc import Callable
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

from .corpus import Clip
from .degrade import apply_codec, mix_at_snr
from .gnani import GnaniError, OutOfCredit

LANGUAGE = "hi-IN"
FORMAT = "transcribe"


@dataclass(frozen=True)
class Condition:
    id: str
    kind: Literal["clean", "noise", "codec", "field"]
    noise: str | None = None
    snr_db: float | None = None
    codec: str | None = None


NOISES = ("street", "fan")
SNRS = (10, 5, 0, -5, -10)

CONDITIONS: list[Condition] = [
    Condition("clean", "clean"),
    *(
        Condition(f"{noise}_snr{snr}", "noise", noise=noise, snr_db=float(snr))
        for noise in NOISES
        for snr in SNRS
    ),
    Condition("g711", "codec", codec="g711"),
    Condition("amr_nb", "codec", codec="amr_nb"),
]
FIELD = Condition("field", "field")


def condition_by_id(cid: str) -> Condition:
    for c in [*CONDITIONS, FIELD]:
        if c.id == cid:
            return c
    raise KeyError(cid)


@dataclass
class RawResult:
    clip_id: str
    condition_id: str
    model: str
    transcript: str
    error: str | None


def _audio_for(clip: Clip, cond: Condition, noise_dir: Path, work_dir: Path) -> Path:
    """The file to send. Damaged copies are made once and reused."""
    if cond.kind in ("clean", "field"):
        return clip.wav
    out = Path(work_dir) / cond.id / f"{clip.id}.wav"
    if out.exists():
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp.wav")
    try:
        if cond.kind == "noise":
            noise = Path(noise_dir) / f"{cond.noise}.wav"
            if not noise.exists():
                raise FileNotFoundError(f"noise file missing: {noise}")
            mix_at_snr(clip.wav, noise, cond.snr_db, tmp)
        else:
            apply_codec(clip.wav, cond.codec, tmp)
        os.replace(tmp, out)
    finally:
        tmp.unlink(missing_ok=True)
    return out


def _is_cached(client, audio: Path) -> bool:
    if hasattr(client, "is_cached"):
        return client.is_cached(audio)
    key = client._key(Path(audio).read_bytes(), LANGUAGE, FORMAT)
    return client._read_cache(client.cache_dir / f"{key}.json") is not None


def _short(text: str, width: int = 50) -> str:
    text = " ".join(text.split())
    return text if len(text) <= width else text[: width - 1] + "…"


def run_grid(
    clips: list[Clip],
    conditions: list[Condition],
    client,
    noise_dir: Path,
    work_dir: Path,
    max_new_calls: int | None,
    on_result: Callable[[RawResult], None] | None = None,
) -> list[RawResult]:
    """One request at a time. Field clips run only under FIELD, other clips
    never do. Stops on OutOfCredit; other failures become error rows."""
    results: list[RawResult] = []
    new_calls = 0
    budget_note = False

    def keep(r: RawResult) -> None:
        results.append(r)
        if on_result is not None:
            on_result(r)

    for clip in clips:
        for cond in conditions:
            if (cond.kind == "field") != clip.field:
                continue
            tag = f"{clip.id} {cond.id}"
            try:
                audio = _audio_for(clip, cond, noise_dir, work_dir)
            except (OSError, ValueError, subprocess.CalledProcessError) as exc:
                print(f"{tag}: could not prepare audio ({type(exc).__name__}: {exc})")
                keep(RawResult(clip.id, cond.id, client.model, "", f"audio: {exc}"))
                continue

            cached = _is_cached(client, audio)
            if not cached and max_new_calls is not None and new_calls >= max_new_calls:
                if not budget_note:
                    print(
                        f"new-call budget of {max_new_calls} spent; cached only from here"
                    )
                    budget_note = True
                continue
            if not cached:
                new_calls += 1
            try:
                t = client.transcribe(audio, language_code=LANGUAGE, fmt=FORMAT)
            except OutOfCredit as exc:
                print(f"{tag}: {exc}. Stopping; finished calls are kept.")
                return results
            except GnaniError as exc:
                print(f"{tag}: error: {exc}")
                keep(RawResult(clip.id, cond.id, client.model, "", str(exc)))
                continue
            state = "cached" if t.cached else "new"
            shown = _short(t.transcript) if t.transcript else "(no speech returned)"
            print(f"{tag} [{state}] {shown}")
            keep(RawResult(clip.id, cond.id, client.model, t.transcript, None))
    return results


def load_raw(path: Path) -> list[RawResult]:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    return [RawResult(**item) for item in data]


def save_raw(path: Path, new: list[RawResult]) -> None:
    """Merges into the file. A later error never replaces an earlier answer."""
    path = Path(path)
    rows = {(r.clip_id, r.condition_id, r.model): r for r in load_raw(path)}
    for r in new:
        key = (r.clip_id, r.condition_id, r.model)
        old = rows.get(key)
        if old is not None and old.error is None and r.error is not None:
            continue
        rows[key] = r
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(
        json.dumps([asdict(r) for r in rows.values()], ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    os.replace(tmp, path)


def _to_mp3(src: Path, out: Path, bitrate: str, rate: int | None = None) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    args = [
        "ffmpeg",
        "-nostdin",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-ac",
        "1",
    ]
    if rate is not None:
        args += ["-ar", str(rate)]
    args += ["-c:a", "libmp3lame", "-b:a", bitrate, str(out)]
    subprocess.run(args, check=True, capture_output=True)


def export_web_audio(
    clips: list[Clip], conditions: list[Condition], work_dir: Path, out_dir: Path
) -> None:
    """MP3 32 kbps mono for featured clips. Damaged copies come from the run."""
    for clip in clips:
        if not clip.featured:
            continue
        for cond in conditions:
            if cond.kind == "field":
                continue
            src = (
                clip.wav
                if cond.kind == "clean"
                else Path(work_dir) / cond.id / f"{clip.id}.wav"
            )
            if not src.exists():
                print(f"skip {clip.id} {cond.id}: no audio at {src}")
                continue
            _to_mp3(src, Path(out_dir) / clip.id / f"{cond.id}.mp3", "32k")


def export_noise(noise_dir: Path, out_dir: Path) -> None:
    for noise in NOISES:
        src = Path(noise_dir) / f"{noise}.wav"
        if not src.exists():
            print(f"skip noise {noise}: no file at {src}")
            continue
        _to_mp3(src, Path(out_dir) / f"{noise}.mp3", "64k", 16000)
