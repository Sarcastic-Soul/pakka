import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Literal

import numpy as np

RATE = 16000
SILENCE_DBFS = -40.0
INT16_MAX = 32767
INT16_MIN = -32768


def _ffmpeg(*args: str) -> None:
    subprocess.run(
        ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", *args],
        check=True,
        capture_output=True,
    )


def _load_16k_mono(src: Path, workdir: Path, name: str) -> np.ndarray:
    converted = workdir / f"{name}.wav"
    _ffmpeg(
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        str(RATE),
        "-c:a",
        "pcm_s16le",
        str(converted),
    )
    with wave.open(str(converted), "rb") as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")


def _write_wav(path: Path, samples: np.ndarray, rate: int) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(samples.astype("<i2").tobytes())


def _rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x**2)))


def mix_at_snr(clip: Path, noise: Path, snr_db: float, out: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        speech = _load_16k_mono(clip, work, "clip").astype(np.float64)
        noise_16k = _load_16k_mono(noise, work, "noise").astype(np.float64)

    threshold = 32768 * 10 ** (SILENCE_DBFS / 20)
    loud = np.flatnonzero(np.abs(speech) > threshold)
    if loud.size == 0:
        raise ValueError("clip is silent")
    start, end = int(loud[0]), int(loud[-1]) + 1

    if noise_16k.size == 0:
        raise ValueError("noise is empty")
    window = np.resize(noise_16k, speech.size)

    # Measure the noise over the same span as the speech so the SNR is exact there.
    noise_rms = _rms(window[start:end])
    if noise_rms == 0:
        raise ValueError("noise is silent")
    speech_rms = _rms(speech[start:end])
    gain = speech_rms / (noise_rms * 10 ** (snr_db / 20))

    mixed = np.clip(np.round(speech + window * gain), INT16_MIN, INT16_MAX)
    _write_wav(out, mixed, RATE)


def apply_codec(clip: Path, codec: Literal["g711", "amr_nb"], out: Path) -> None:
    if codec not in ("g711", "amr_nb"):
        raise ValueError(f"unknown codec: {codec}")

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        if codec == "g711":
            encoded = work / "encoded.wav"
            _ffmpeg(
                "-i",
                str(clip),
                "-ac",
                "1",
                "-ar",
                "8000",
                "-c:a",
                "pcm_mulaw",
                str(encoded),
            )
        else:
            encoded = work / "encoded.amr"
            _ffmpeg(
                "-i",
                str(clip),
                "-ac",
                "1",
                "-ar",
                "8000",
                "-c:a",
                "libopencore_amrnb",
                "-b:a",
                "12.2k",
                str(encoded),
            )
        _ffmpeg(
            "-i", str(encoded), "-ac", "1", "-ar", "8000", "-c:a", "pcm_s16le", str(out)
        )
