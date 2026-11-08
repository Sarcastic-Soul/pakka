import json
import shutil
import subprocess
import wave
from pathlib import Path

MIN_SECONDS = 0.5
MAX_SECONDS = 12.0


def _duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def _record_once(tmp: Path) -> None:
    input("  Press Enter to start recording... ")
    proc = subprocess.Popen(
        [
            "arecord",
            "-q",
            "-f",
            "S16_LE",
            "-r",
            "16000",
            "-c",
            "1",
            "-t",
            "wav",
            str(tmp),
        ]
    )
    try:
        input("  Recording. Press Enter to stop... ")
    finally:
        proc.terminate()
        proc.wait()


def record_missing(corpus: Path, clips_dir: Path) -> None:
    clips = json.loads(Path(corpus).read_text(encoding="utf-8"))
    clips_dir = Path(clips_dir)
    clips_dir.mkdir(parents=True, exist_ok=True)
    total = len(clips)
    can_play = shutil.which("aplay") is not None
    tmp = clips_dir / ".recording.tmp.wav"
    try:
        for n, clip in enumerate(clips, start=1):
            final = clips_dir / f"{clip['id']}.wav"
            if final.exists():
                continue
            print(f"\n[{n}/{total}] {clip['id']}")
            print(clip["text"])
            while True:
                _record_once(tmp)
                try:
                    seconds = _duration(tmp)
                except (wave.Error, EOFError, OSError):
                    print("  Could not read the recording. Try again.")
                    continue
                if seconds > MAX_SECONDS:
                    print(
                        f"  Too long ({seconds:.1f} s, max {MAX_SECONDS:.0f} s). Try again."
                    )
                    continue
                if seconds < MIN_SECONDS:
                    print(f"  Too short ({seconds:.1f} s). Try again.")
                    continue
                print(f"  Recorded {seconds:.1f} s.")
                if can_play:
                    subprocess.run(["aplay", "-q", str(tmp)], check=False)
                answer = input("  keep (Enter) or redo (r)? ").strip().lower()
                if answer == "r":
                    continue
                tmp.replace(final)
                break
    except (KeyboardInterrupt, EOFError):
        print("\nStopped. Finished clips are kept; run again to resume.")
    finally:
        tmp.unlink(missing_ok=True)
