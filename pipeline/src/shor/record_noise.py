import shutil
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np

SECONDS = 60
MIN_KEEP_SECONDS = 20
RATE = 16000
SILENCE_DBFS = -60.0
CLIPPED_SHARE = 0.001


def _check(path: Path) -> tuple[float, float, float]:
    """Return (seconds, rms dBFS, share of clipped samples)."""
    with wave.open(str(path), "rb") as w:
        n = w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64) / 32768
        seconds = n / w.getframerate()
    if x.size == 0:
        return seconds, -120.0, 0.0
    rms = float(np.sqrt(np.mean(x**2)))
    db = 20 * np.log10(rms) if rms > 0 else -120.0
    clipped = float(np.mean(np.abs(x) >= 0.999))
    return seconds, db, clipped


def record_noise(name: str, noise_dir: Path, seconds: int = SECONDS) -> None:
    if shutil.which("arecord") is None:
        sys.exit("arecord is not installed")
    noise_dir.mkdir(parents=True, exist_ok=True)
    final = noise_dir / f"{name}.wav"
    tmp = noise_dir / f".{name}.recording.wav"
    if final.exists():
        answer = input(f"{final} already exists. Replace it? (y/N) ").strip().lower()
        if answer != "y":
            return

    print(f"\nRecording {seconds} s of {name} noise into {final}")
    print(
        "Keep the room quiet apart from that noise. Do not talk during the recording."
    )
    input("Press Enter to start... ")
    proc = subprocess.Popen(
        [
            "arecord",
            "-q",
            "-f",
            "S16_LE",
            "-r",
            str(RATE),
            "-c",
            "1",
            "-t",
            "wav",
            "-d",
            str(seconds),
            str(tmp),
        ]
    )
    try:
        for left in range(seconds, 0, -1):
            if proc.poll() is not None:
                break
            print(f"\r  {left:3d} s left ", end="", flush=True)
            time.sleep(1)
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        proc.wait()
        print("\nStopped early.")
    print()

    try:
        got, db, clipped = _check(tmp)
    except (wave.Error, EOFError, OSError):
        tmp.unlink(missing_ok=True)
        sys.exit("Could not read the recording. Check the mic and try again.")

    print(
        f"  length {got:.1f} s, level {db:.1f} dBFS, clipped {clipped * 100:.2f}% of samples"
    )
    problems = []
    if got < MIN_KEEP_SECONDS:
        problems.append(f"shorter than {MIN_KEEP_SECONDS} s")
    if db < SILENCE_DBFS:
        problems.append("almost silent; is the mic muted or the wrong input selected?")
    if clipped > CLIPPED_SHARE:
        problems.append("clipping; move the mic further from the noise")
    for p in problems:
        print(f"  warning: {p}")

    if shutil.which("aplay"):
        if input("Play the first 5 s back? (Y/n) ").strip().lower() != "n":
            subprocess.run(["aplay", "-q", "-d", "5", str(tmp)], check=False)
    if input("Keep it? (Y/n) ").strip().lower() == "n":
        tmp.unlink(missing_ok=True)
        print("Discarded. Run the command again to retry.")
        return
    tmp.replace(final)
    print(f"Saved {final}")
