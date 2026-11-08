"""Noise cleaning before Prisma: RNNoise (ffmpeg arnndn) and DeepFilterNet.

Cleaned copies live next to the noisy ones in .work/<condition>/<method>/,
so every cleaned file is made once and every Prisma call is cached.
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[2] / ".tools"
RNNOISE_MODEL = TOOLS / "cb.rnnn"
DEEP_FILTER = TOOLS / "deep-filter"
METHODS = ("rnnoise", "deepfilter")


def _ffmpeg(*args: str) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True
    )


def clean_rnnoise(src: Path, out: Path) -> None:
    # RNNoise works at 48 kHz; Prisma gets 16 kHz mono like every other file.
    _ffmpeg(
        "-i",
        str(src),
        "-af",
        f"aresample=48000,arnndn=m={RNNOISE_MODEL},aresample=16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(out),
    )


def clean_deepfilter(src: Path, out: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        hi = t / "in.wav"
        _ffmpeg(
            "-i", str(src), "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(hi)
        )
        subprocess.run(
            [str(DEEP_FILTER), "-D", "-o", str(t / "out"), str(hi)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        _ffmpeg(
            "-i",
            str(t / "out" / "in.wav"),
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(out),
        )


CLEANERS = {"rnnoise": clean_rnnoise, "deepfilter": clean_deepfilter}


def check_tools(method: str) -> None:
    need = RNNOISE_MODEL if method == "rnnoise" else DEEP_FILTER
    if not need.exists():
        raise SystemExit(f"{need} is missing; see pipeline/README for the download")
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg is not installed")


def cleaned_copy(
    noisy: Path, method: str, work_dir: Path, cond_id: str, clip_id: str
) -> Path:
    out = Path(work_dir) / cond_id / method / f"{clip_id}.wav"
    if out.exists():
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp.wav")
    try:
        CLEANERS[method](Path(noisy), tmp)
        os.replace(tmp, out)
    finally:
        tmp.unlink(missing_ok=True)
    return out
