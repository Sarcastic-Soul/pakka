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
from .normalize import entity_match, extract_numbers, parse_spoken_numbers

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


def cmd_denoise_run(args) -> None:
    """Clean every noisy (and clean) clip with one method, then send it to Prisma.
    Rows are saved under the model label `<model>+<method>`."""
    from .denoise import check_tools, cleaned_copy
    from .gnani import GnaniError, OutOfCredit
    from .grid import RawResult, _audio_for

    check_tools(args.method)
    clips = [c for c in _recorded(load_corpus(CORPUS, CLIPS)) if not c.field]
    conds = [c for c in _usable(CONDITIONS) if c.kind in ("clean", "noise")]
    if args.only:
        conds = [c for c in conds if c.id in args.only]
        clips = [c for c in clips if not args.clips or c.id in args.clips]
    client = _client(args.model)
    label = f"{args.model}+{args.method}"
    path = _raw_path(label)
    done = {(r.clip_id, r.condition_id) for r in load_raw(path) if r.error is None}
    new_calls = 0
    for cond in conds:
        for clip in clips:
            if (clip.id, cond.id) in done:
                continue
            if args.max_new_calls is not None and new_calls >= args.max_new_calls:
                print(f"new-call budget of {args.max_new_calls} spent")
                return
            tag = f"{clip.id} {cond.id} {args.method}"
            try:
                noisy = _audio_for(clip, cond, NOISE, WORK)
                audio = cleaned_copy(noisy, args.method, WORK, cond.id, clip.id)
            except Exception as exc:  # noqa: BLE001 - one bad file must not stop the run
                print(f"{tag}: could not prepare audio ({type(exc).__name__})")
                save_raw(
                    path, [RawResult(clip.id, cond.id, label, "", f"audio: {exc}")]
                )
                continue
            try:
                t = client.transcribe(audio, language_code="hi-IN", fmt="transcribe")
            except OutOfCredit as exc:
                print(f"{tag}: {exc}. Stopping; finished calls are kept.")
                return
            except GnaniError as exc:
                print(f"{tag}: {exc}")
                save_raw(path, [RawResult(clip.id, cond.id, label, "", str(exc))])
                continue
            if not t.cached:
                new_calls += 1
            save_raw(path, [RawResult(clip.id, cond.id, label, t.transcript, None)])
            print(
                f"{tag} {'[cache]' if t.cached else '[new]'} {t.transcript}", flush=True
            )
    print(f"done; {new_calls} new calls; saved to {path}")


def _heard_numbers(text: str) -> set[str]:
    return set(extract_numbers(text)) | {str(n) for n in parse_spoken_numbers(text)}


def cmd_catch(args) -> None:
    """How often the app's double-hearing check flags a wrong entry.

    Uses the same rule as the app: flag when the numbers heard in the raw and
    the cleaned transcript differ, or the raw transcript is empty. No network.
    """
    from .score import write_results

    clips = {c.id: c for c in _recorded(load_corpus(CORPUS, CLIPS)) if not c.field and c.entities}
    raw = {(r.clip_id, r.condition_id): r for r in load_raw(_raw_path(args.model)) if r.error is None}
    label = f"{args.model}+{args.method}"
    cleaned = {(r.clip_id, r.condition_id): r for r in load_raw(_raw_path(label)) if r.error is None}
    rows = []
    for (clip_id, cond_id), r in sorted(raw.items()):
        c = cleaned.get((clip_id, cond_id))
        clip = clips.get(clip_id)
        if clip is None or c is None:
            continue
        rows.append(
            {
                "clip": clip_id,
                "condition": cond_id,
                "wrong": not all(entity_match(e, r.transcript) for e in clip.entities),
                "flagged": _heard_numbers(r.transcript) != _heard_numbers(c.transcript)
                or not r.transcript.strip(),
                "raw": r.transcript,
                "cleaned": c.transcript,
            }
        )
    summary = []
    for cond_id in sorted({x["condition"] for x in rows}):
        cell = [x for x in rows if x["condition"] == cond_id]
        wrong = [x for x in cell if x["wrong"]]
        right = [x for x in cell if not x["wrong"]]
        summary.append(
            {
                "condition": cond_id,
                "wrong": len(wrong),
                "caught": sum(x["flagged"] for x in wrong),
                "right": len(right),
                "false_alarms": sum(x["flagged"] for x in right),
            }
        )
    payload = {"model": args.model, "cleaner": args.method, "rule": "numbers differ or raw empty", "summary": summary, "rows": rows}
    write_results(args.out, payload)
    for s in summary:
        print(
            f"{s['condition']:<14} caught {s['caught']:>2} of {s['wrong']:>2} wrong"
            f"   false alarms {s['false_alarms']:>2} of {s['right']:>2} right"
        )
    print(f"wrote {args.out}")


def cmd_export_audio(args) -> None:
    export_web_audio(load_corpus(CORPUS, CLIPS), CONDITIONS, WORK, AUDIO)
    export_noise(NOISE, NOISE_OUT)
    print(f"audio written to {AUDIO} and {NOISE_OUT}")


def cmd_record(args) -> None:
    from .record import record_missing

    record_missing(CORPUS, CLIPS)


def cmd_record_noise(args) -> None:
    from .record_noise import record_noise

    record_noise(args.name, NOISE, args.seconds)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="shor", description="Shor Meter: noise benchmark for Gnani Prisma"
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

    p = sub.add_parser(
        "denoise-run", help="clean noisy clips, then send them to Prisma"
    )
    p.add_argument("method", choices=["rnnoise", "deepfilter"])
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--max-new-calls", type=int, default=None)
    p.add_argument("--only", nargs="*", help="condition ids to run")
    p.add_argument("--clips", nargs="*", help="clip ids to run (with --only)")
    p.set_defaults(func=cmd_denoise_run)

    p = sub.add_parser("catch", help="how often raw-vs-cleaned disagreement flags a wrong entry")
    p.add_argument("method", nargs="?", default="deepfilter", choices=["rnnoise", "deepfilter"])
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--out", type=Path, default=ROOT / "public" / "data" / "catch.json")
    p.set_defaults(func=cmd_catch)

    p = sub.add_parser("export-audio", help="MP3s of featured clips and noise beds")
    p.set_defaults(func=cmd_export_audio)

    p = sub.add_parser("record", help="record clips that have no wav yet")
    p.set_defaults(func=cmd_record)

    p = sub.add_parser("record-noise", help="record a noise bed, e.g. the ceiling fan")
    p.add_argument("name", choices=["fan", "street"])
    p.add_argument("--seconds", type=int, default=60)
    p.set_defaults(func=cmd_record_noise)

    args = parser.parse_args(argv)
    args.func(args)
