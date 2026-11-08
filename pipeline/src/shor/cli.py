import argparse
import os
import sys
from pathlib import Path

from .corpus import Clip, load_corpus
from .grid import (
    CONDITIONS,
    FIELD,
    condition_by_id,
    export_noise,
    export_web_audio,
    load_raw,
    run_grid,
    save_raw,
)
from .metrics import wer
from .normalize import entity_match

ROOT = Path(__file__).resolve().parents[3]
CORPUS = ROOT / "data" / "corpus.json"
CLIPS = ROOT / "data" / "clips"
NOISE = ROOT / "data" / "noise"
CACHE = ROOT / "pipeline" / ".cache"
WORK = ROOT / "pipeline" / ".work"
RESULTS = ROOT / "public" / "data" / "results.json"
AUDIO = ROOT / "public" / "audio"
NOISE_OUT = ROOT / "public" / "noise"
PILOT_CONDITIONS = ("clean", "street_snr10", "street_snr0")
DEFAULT_MODEL = "prisma-v3.0"


def _api_key() -> str:
    key = os.environ.get("GNANI_API_KEY", "").strip()
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            name, sep, value = line.strip().partition("=")
            if sep and name.strip().removeprefix("export ").strip() == "GNANI_API_KEY":
                key = value.strip().strip("'\"")
    if not key:
        sys.exit(f"GNANI_API_KEY is not set (checked the environment and {env})")
    return key


def _client(model: str):
    from .gnani import GnaniClient

    return GnaniClient(_api_key(), CACHE / model, model)


def _recorded(clips: list[Clip]) -> list[Clip]:
    have = [c for c in clips if c.wav.exists()]
    if len(have) < len(clips):
        print(
            f"{len(clips) - len(have)} of {len(clips)} clips have no wav yet; skipping them"
        )
    return have


def _usable(conditions):
    out = []
    for c in conditions:
        if c.kind == "noise" and not (NOISE / f"{c.noise}.wav").exists():
            print(f"warning: {NOISE / (c.noise + '.wav')} is missing; skipping {c.id}")
            continue
        out.append(c)
    return out


def _raw_path(model: str) -> Path:
    return WORK / f"raw-{model}.json"


def cmd_pilot(args) -> None:
    clips = _recorded(load_corpus(CORPUS, CLIPS))
    clips = [c for c in clips if not c.field][:5]
    if not clips:
        sys.exit(f"no recorded clips in {CLIPS}; run `shor record` first")
    conds = _usable([condition_by_id(i) for i in PILOT_CONDITIONS])
    client = _client(args.model)
    raw = run_grid(clips, conds, client, NOISE, WORK, None)
    save_raw(_raw_path(args.model), raw)
    by_id = {c.id: c for c in clips}
    print(f"\n{'clip':<8} {'condition':<14} {'entity':<7} {'wer':>5}  transcript")
    for r in raw:
        clip = by_id[r.clip_id]
        if r.error:
            print(
                f"{r.clip_id:<8} {r.condition_id:<14} {'-':<7} {'-':>5}  error: {r.error}"
            )
            continue
        ok = (
            all(entity_match(e, r.transcript) for e in clip.entities)
            if clip.entities
            else "-"
        )
        print(
            f"{r.clip_id:<8} {r.condition_id:<14} {str(ok):<7} "
            f"{wer(clip.text, r.transcript):>5.2f}  {r.transcript or '(no speech returned)'}"
        )


def cmd_run(args) -> None:
    clips = _recorded(load_corpus(CORPUS, CLIPS))
    conds = _usable([*CONDITIONS, FIELD])
    client = _client(args.model)
    path = _raw_path(args.model)
    raw = run_grid(
        clips,
        conds,
        client,
        NOISE,
        WORK,
        args.max_new_calls,
        on_result=lambda r: save_raw(path, [r]),
    )
    errors = sum(1 for r in raw if r.error)
    print(f"\n{len(raw)} results ({errors} errors) saved to {path}")


def cmd_score(args) -> None:
    from .score import score, write_results

    raw = [r for p in sorted(WORK.glob("raw-*.json")) for r in load_raw(p)]
    if not raw:
        sys.exit(f"no raw results in {WORK}; run `shor run` first")
    # The web contract only knows clean/noise/codec, so field rows stay in raw only.
    payload = score(load_corpus(CORPUS, CLIPS), raw, CONDITIONS)
    write_results(args.out, payload)
    print(
        f"wrote {args.out}: {len(payload['results'])} rows, "
        f"{len(payload['aggregates'])} cells, models {', '.join(payload['models'])}"
    )


def cmd_export_audio(args) -> None:
    export_web_audio(load_corpus(CORPUS, CLIPS), CONDITIONS, WORK, AUDIO)
    export_noise(NOISE, NOISE_OUT)
    print(f"audio written to {AUDIO} and {NOISE_OUT}")


def cmd_record(args) -> None:
    from .record import record_missing

    record_missing(CORPUS, CLIPS)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="shor", description="Noise stress test for Gnani Prisma"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("pilot", help="5 clips x clean, street 10 dB, street 0 dB")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.set_defaults(func=cmd_pilot)

    p = sub.add_parser("run", help="full grid; cached calls are free")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--max-new-calls", type=int, default=None)
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("score", help="score saved raw results (no network)")
    p.add_argument("--out", type=Path, default=RESULTS)
    p.set_defaults(func=cmd_score)

    p = sub.add_parser("export-audio", help="MP3s of featured clips and noise beds")
    p.set_defaults(func=cmd_export_audio)

    p = sub.add_parser("record", help="record clips that have no wav yet")
    p.set_defaults(func=cmd_record)

    args = parser.parse_args(argv)
    args.func(args)
