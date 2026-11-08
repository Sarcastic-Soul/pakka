import wave
from pathlib import Path

import numpy as np
import pytest

from shor.degrade import apply_codec, mix_at_snr

RATE = 16000
SILENCE_S = 0.3
SPEECH_S = 2.0


def write_wav(path: Path, samples: np.ndarray, rate: int = RATE) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(samples.astype("<i2").tobytes())


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as w:
        assert w.getnchannels() == 1
        assert w.getsampwidth() == 2
        return np.frombuffer(
            w.readframes(w.getnframes()), dtype="<i2"
        ), w.getframerate()


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x.astype(np.float64) ** 2)))


def make_clip(path: Path) -> np.ndarray:
    gap = np.zeros(int(SILENCE_S * RATE))
    t = np.arange(int(SPEECH_S * RATE)) / RATE
    tone = 6000 * np.sin(2 * np.pi * 440 * t) * (1 + 0.3 * np.sin(2 * np.pi * 3 * t))
    samples = np.concatenate([gap, tone, gap]).round().astype(np.int16)
    write_wav(path, samples)
    return samples


def make_noise(path: Path, seconds: float) -> None:
    rng = np.random.default_rng(0)
    noise = rng.normal(0, 3000, int(seconds * RATE)).round().astype(np.int16)
    write_wav(path, noise)


@pytest.fixture
def clip(tmp_path: Path) -> Path:
    p = tmp_path / "clip.wav"
    make_clip(p)
    return p


@pytest.fixture
def noise(tmp_path: Path) -> Path:
    p = tmp_path / "noise.wav"
    make_noise(p, 3.0)
    return p


@pytest.mark.parametrize("snr_db", [20, 10, 5, 0])
def test_mix_hits_requested_snr(clip: Path, noise: Path, tmp_path: Path, snr_db: float):
    out = tmp_path / "out.wav"
    mix_at_snr(clip, noise, snr_db, out)

    clean, _ = read_wav(clip)
    mixed, rate = read_wav(out)
    assert rate == RATE
    assert len(mixed) == len(clean)

    start = int(SILENCE_S * RATE)
    end = start + int(SPEECH_S * RATE)
    added = mixed.astype(np.float64) - clean.astype(np.float64)
    measured = 20 * np.log10(rms(clean[start:end]) / rms(added[start:end]))
    assert measured == pytest.approx(snr_db, abs=0.3)


def test_short_noise_is_looped(clip: Path, tmp_path: Path):
    short = tmp_path / "short.wav"
    make_noise(short, 0.5)
    out = tmp_path / "out.wav"
    mix_at_snr(clip, short, 10, out)

    clean, _ = read_wav(clip)
    mixed, _ = read_wav(out)
    assert len(mixed) == len(clean)

    added = mixed.astype(np.int64) - clean.astype(np.int64)
    period = int(0.5 * RATE)
    assert np.abs(added[:period] - added[period : 2 * period]).max() <= 1


def test_silent_clip_raises(noise: Path, tmp_path: Path):
    silent = tmp_path / "silent.wav"
    write_wav(silent, np.zeros(RATE, dtype=np.int16))
    with pytest.raises(ValueError, match="clip is silent"):
        mix_at_snr(silent, noise, 10, tmp_path / "out.wav")


def test_quiet_clip_below_threshold_raises(noise: Path, tmp_path: Path):
    quiet = tmp_path / "quiet.wav"
    write_wav(quiet, np.full(RATE, 100, dtype=np.int16))
    with pytest.raises(ValueError, match="clip is silent"):
        mix_at_snr(quiet, noise, 10, tmp_path / "out.wav")


def test_mix_clips_instead_of_wrapping(tmp_path: Path, noise: Path):
    loud = tmp_path / "loud.wav"
    t = np.arange(RATE) / RATE
    write_wav(loud, (32000 * np.sin(2 * np.pi * 200 * t)).round().astype(np.int16))
    out = tmp_path / "out.wav"
    mix_at_snr(loud, noise, 20, out)

    clean, _ = read_wav(loud)
    mixed, _ = read_wav(out)
    assert mixed.max() == 32767 and mixed.min() == -32768
    # At 20 dB the noise is small, so only a wraparound could flip the sign of a near-full-scale sample.
    big = np.abs(clean) > 30000
    assert np.all(np.sign(mixed[big]) == np.sign(clean[big]))


def test_mix_is_deterministic(clip: Path, noise: Path, tmp_path: Path):
    a = tmp_path / "a.wav"
    b = tmp_path / "b.wav"
    mix_at_snr(clip, noise, 5, a)
    mix_at_snr(clip, noise, 5, b)
    assert a.read_bytes() == b.read_bytes()


def test_g711_is_8khz_mono_wav(clip: Path, tmp_path: Path):
    out = tmp_path / "g711.wav"
    apply_codec(clip, "g711", out)
    samples, rate = read_wav(out)
    assert rate == 8000
    assert abs(len(samples) / rate - (SPEECH_S + 2 * SILENCE_S)) < 0.1


def test_amr_is_8khz_and_same_duration(clip: Path, tmp_path: Path):
    out = tmp_path / "amr.wav"
    apply_codec(clip, "amr_nb", out)
    samples, rate = read_wav(out)
    assert rate == 8000
    assert abs(len(samples) / rate - (SPEECH_S + 2 * SILENCE_S)) < 0.1
