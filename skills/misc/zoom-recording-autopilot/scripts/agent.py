#!/usr/bin/env python3
"""Local Zoom lecture editing agent.

This wraps the existing lecture-video-editor scripts with job state, dependency
checks, recording-folder watching, and explicit approval gates.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any


SKILL_NAME = "lecture-video-editor"
DEFAULT_SKILL_DIR = Path.home() / ".agents" / "skills" / SKILL_NAME
REQUIRED_SCRIPTS = [
    "ingest.py",
    "analyze.py",
    "plan_cuts.py",
    "transcribe.py",
    "refine_cuts.py",
    "make_subtitles.py",
    "render_master.py",
]


class AgentError(RuntimeError):
    """A recoverable agent failure with a user-facing message."""


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def read_json(path: Path, default: Any | None = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def skill_dir_from_args(args: argparse.Namespace) -> Path:
    raw = args.skill_dir or os.environ.get("LVE_SKILL_DIR")
    return Path(raw).expanduser().resolve() if raw else DEFAULT_SKILL_DIR


def scripts_dir(skill_dir: Path) -> Path:
    path = skill_dir / "scripts"
    missing = [name for name in REQUIRED_SCRIPTS if not (path / name).exists()]
    if missing:
        raise AgentError(
            f"{SKILL_NAME} scripts not found under {path}. Missing: {', '.join(missing)}"
        )
    return path


def require_command(name: str) -> str:
    found = shutil.which(name)
    if not found:
        raise AgentError(f"Required command not found: {name}")
    return found


def default_output_dir(source: Path) -> Path:
    source = source.expanduser().resolve()
    if source.is_dir():
        return source / "_lve_output"
    return source.with_name(f"{source.stem}_lve_output")


def state_path(out_dir: Path) -> Path:
    return out_dir / "logs" / "job_state.json"


def update_state(out_dir: Path, **patch: Any) -> dict[str, Any]:
    state = read_json(state_path(out_dir), default={}) or {}
    if patch.get("status") and patch.get("status") != "failed":
        state.pop("failed_step", None)
    state.update(patch)
    state["updated_at"] = now_iso()
    write_json(state_path(out_dir), state)
    return state


def append_failure(out_dir: Path, label: str, message: str) -> None:
    trouble = out_dir / "logs" / "TROUBLESHOOTING.md"
    trouble.parent.mkdir(parents=True, exist_ok=True)
    previous = trouble.read_text(encoding="utf-8") if trouble.exists() else ""
    entry = (
        f"## {now_iso()} - {label}\n\n"
        f"- Symptom: command failed during `{label}`.\n"
        f"- Cause: {message.strip() or 'unknown'}\n"
        "- Response: inspect the step log in this folder before retrying.\n\n"
    )
    trouble.write_text(entry + previous, encoding="utf-8")


def run_step(
    label: str,
    cmd: list[str],
    *,
    cwd: Path,
    out_dir: Path,
    dry_run: bool = False,
) -> subprocess.CompletedProcess[str]:
    log_dir = out_dir / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_name = label.lower().replace(" ", "_").replace("/", "_")
    log_path = log_dir / f"{log_name}.json"

    print(f"\n== {label}")
    print(" ".join(cmd))
    if dry_run:
        payload = {
            "label": label,
            "cwd": str(cwd),
            "command": cmd,
            "dry_run": True,
            "created_at": now_iso(),
        }
        write_json(log_path, payload)
        return subprocess.CompletedProcess(cmd, 0, "", "")

    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("PYTHONUTF8", "1")

    proc = subprocess.run(
        cmd,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    payload = {
        "label": label,
        "cwd": str(cwd),
        "command": cmd,
        "returncode": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
        "created_at": now_iso(),
    }
    write_json(log_path, payload)

    if proc.stdout:
        print(proc.stdout.rstrip())
    if proc.stderr:
        print(proc.stderr.rstrip(), file=sys.stderr)
    if proc.returncode != 0:
        append_failure(out_dir, label, proc.stderr or proc.stdout)
        update_state(out_dir, status="failed", failed_step=label)
        raise AgentError(f"{label} failed. See {log_path}")
    return proc


def build_plan_args(args: argparse.Namespace) -> list[str]:
    extra: list[str] = []
    for attr, flag in [
        ("min_silence", "--min-silence"),
        ("pad", "--pad"),
        ("min_cut", "--min-cut"),
        ("head_threshold", "--head-threshold"),
        ("tail_threshold", "--tail-threshold"),
        ("keep_cuts", "--keep-cuts"),
        ("confirm_cuts", "--confirm-cuts"),
    ]:
        value = getattr(args, attr, None)
        if value not in (None, ""):
            extra += [flag, str(value)]
    if getattr(args, "ignore_freeze", False):
        extra.append("--ignore-freeze")
    return extra


def load_edl_summary(out_dir: Path) -> dict[str, Any]:
    edl = read_json(out_dir / "edl.json", default={}) or {}
    stats = edl.get("stats") or {}
    cuts = edl.get("cuts") or []
    confirm = [c for c in cuts if c.get("category") == "confirm"]
    return {
        "cut_count": len(cuts),
        "applied_count": stats.get("applied_count"),
        "confirm_count": len(confirm),
        "original_sec": stats.get("original_sec"),
        "final_sec": stats.get("final_sec"),
        "removed_ratio": stats.get("removed_ratio"),
    }


def print_job_summary(out_dir: Path) -> None:
    manifest = read_json(out_dir / "manifest.json", default={}) or {}
    summary = load_edl_summary(out_dir)
    source = ((manifest.get("source") or {}).get("main_video")) or "unknown"

    print("\nJob summary")
    print(f"  source      : {source}")
    print(f"  output      : {out_dir}")
    print(f"  edl         : {out_dir / 'edl.md'}")
    print(f"  cuts        : {summary['cut_count']} total")
    print(f"  applied     : {summary['applied_count']}")
    print(f"  need review : {summary['confirm_count']}")
    if summary["original_sec"] is not None and summary["final_sec"] is not None:
        print(f"  duration    : {summary['original_sec']:.1f}s -> {summary['final_sec']:.1f}s")


def run_prepare(args: argparse.Namespace) -> int:
    require_command("ffmpeg")
    require_command("ffprobe")

    source = Path(args.source).expanduser().resolve()
    if not source.exists():
        raise AgentError(f"Recording source does not exist: {source}")
    out_dir = Path(args.out).expanduser().resolve() if args.out else default_output_dir(source)
    sdir = scripts_dir(skill_dir_from_args(args))

    existing_state = read_json(state_path(out_dir), default={}) or {}
    update_state(
        out_dir,
        job_id=out_dir.parent.name,
        recording_dir=str(source),
        output_dir=str(out_dir),
        status="preparing",
        created_at=existing_state.get("created_at", now_iso()),
        approvals={"cuts": False, "script": False, "publish": False},
    )

    run_step(
        "ingest",
        [sys.executable, "ingest.py", str(source), "-o", str(out_dir)],
        cwd=sdir,
        out_dir=out_dir,
    )

    analyze_cmd = [sys.executable, "analyze.py", str(out_dir / "manifest.json")]
    if args.no_freeze:
        analyze_cmd.append("--no-freeze")
    if args.noise:
        analyze_cmd += ["--noise", args.noise]
    run_step("analyze", analyze_cmd, cwd=sdir, out_dir=out_dir)

    plan_cmd = [
        sys.executable,
        "plan_cuts.py",
        str(out_dir / "analysis.json"),
        *build_plan_args(args),
    ]
    run_step("plan_cuts", plan_cmd, cwd=sdir, out_dir=out_dir)

    update_state(
        out_dir,
        status="waiting_for_cut_approval",
        edl=str(out_dir / "edl.json"),
        edl_md=str(out_dir / "edl.md"),
        summary=load_edl_summary(out_dir),
    )
    print_job_summary(out_dir)
    print("\nNext: review edl.md, then run `render` with --approve-cuts.")
    return 0


def run_replan(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir).expanduser().resolve()
    analysis = out_dir / "analysis.json"
    if not analysis.exists():
        raise AgentError(f"analysis.json not found: {analysis}")
    sdir = scripts_dir(skill_dir_from_args(args))

    update_state(out_dir, status="replanning")
    cmd = [sys.executable, "plan_cuts.py", str(analysis), *build_plan_args(args)]
    run_step("plan_cuts", cmd, cwd=sdir, out_dir=out_dir)
    update_state(
        out_dir,
        status="waiting_for_cut_approval",
        approvals={"cuts": False, "script": False, "publish": False},
        summary=load_edl_summary(out_dir),
    )
    print_job_summary(out_dir)
    return 0


def run_transcribe_stage(args: argparse.Namespace) -> int:
    if not args.approve_cuts:
        raise AgentError("Transcription/refinement requires --approve-cuts.")

    out_dir = Path(args.out_dir).expanduser().resolve()
    manifest = out_dir / "manifest.json"
    edl = out_dir / "edl.json"
    if not manifest.exists() or not edl.exists():
        raise AgentError(f"manifest.json and edl.json are required in {out_dir}")
    sdir = scripts_dir(skill_dir_from_args(args))

    if importlib.util.find_spec("faster_whisper") is None:
        raise AgentError("Python module not found: faster_whisper")

    update_state(
        out_dir,
        status="transcribing",
        approvals={"cuts": True, "script": False, "publish": False},
    )
    transcribe_cmd = [
        sys.executable,
        "transcribe.py",
        str(manifest),
        "--model",
        args.model,
        "--device",
        args.device,
        "--compute-type",
        args.compute_type,
        "--language",
        args.language,
    ]
    run_step("transcribe", transcribe_cmd, cwd=sdir, out_dir=out_dir)
    run_step("refine_cuts", [sys.executable, "refine_cuts.py", str(edl)], cwd=sdir, out_dir=out_dir)
    run_step("make_subtitles", [sys.executable, "make_subtitles.py", str(edl)], cwd=sdir, out_dir=out_dir)
    update_state(
        out_dir,
        status="waiting_for_script_approval",
        transcript=str(out_dir / "transcript.json"),
        final_script=str(out_dir / "final_script.md"),
        subtitles=str(out_dir / "subtitles" / "master.srt"),
    )
    print("\nTranscript stage complete.")
    print(f"  script    : {out_dir / 'final_script.md'}")
    print(f"  subtitles : {out_dir / 'subtitles' / 'master.srt'}")
    print("Next: review final_script.md, then run `render` with --approve-script.")
    return 0


def run_render(args: argparse.Namespace) -> int:
    if not args.approve_cuts:
        raise AgentError("Rendering requires --approve-cuts.")

    out_dir = Path(args.out_dir).expanduser().resolve()
    edl = out_dir / "edl.json"
    if not edl.exists():
        raise AgentError(f"edl.json not found: {edl}")
    if (out_dir / "final_script.md").exists() and not args.approve_script:
        raise AgentError("final_script.md exists. Review it, then pass --approve-script.")

    require_command("ffmpeg")
    require_command("ffprobe")
    sdir = scripts_dir(skill_dir_from_args(args))

    update_state(
        out_dir,
        status="rendering",
        approvals={
            "cuts": True,
            "script": bool(args.approve_script),
            "publish": False,
        },
    )
    cmd = [sys.executable, "render_master.py", str(edl), "--preset", args.preset]
    if args.out:
        cmd += ["-o", str(Path(args.out).expanduser().resolve())]
    if args.max_terms:
        cmd += ["--max-terms", str(args.max_terms)]
    if args.force_cfr:
        cmd += ["--force-cfr", str(args.force_cfr)]
    if args.dry_run:
        cmd.append("--dry-run")

    run_step("render_master", cmd, cwd=sdir, out_dir=out_dir, dry_run=False)
    log = {} if args.dry_run else (read_json(out_dir / "render_master_log.json", default={}) or {})
    update_state(
        out_dir,
        status="render_dry_run" if args.dry_run else "completed",
        master_video=log.get("output"),
        render_log=str(out_dir / "render_master_log.json"),
    )
    if log.get("output"):
        print(f"\nMaster video: {log['output']}")
    return 0


def folder_video_candidates(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    preferred = folder / "zoom_0.mp4"
    if preferred.exists():
        return [preferred]
    return sorted(folder.glob("*.mp4"), key=lambda p: p.stat().st_size, reverse=True)


def is_stable(paths: list[Path], stable_sec: float) -> bool:
    first = {str(p): (p.stat().st_size, p.stat().st_mtime) for p in paths if p.exists()}
    if not first:
        return False
    time.sleep(stable_sec)
    second = {str(p): (p.stat().st_size, p.stat().st_mtime) for p in paths if p.exists()}
    return first == second


def run_watch(args: argparse.Namespace) -> int:
    zoom_dir = Path(args.zoom_dir).expanduser().resolve()
    if not zoom_dir.exists():
        raise AgentError(f"Zoom directory does not exist: {zoom_dir}")
    require_command("ffmpeg")
    require_command("ffprobe")
    scripts_dir(skill_dir_from_args(args))

    state_file = Path(args.state_file).expanduser().resolve() if args.state_file else zoom_dir / ".zoom_lecture_agent_state.json"
    watch_state = read_json(state_file, default={"processed": []}) or {"processed": []}
    processed = set(watch_state.get("processed") or [])

    print(f"Watching: {zoom_dir}")
    while True:
        prepared = False
        for folder in sorted([p for p in zoom_dir.iterdir() if p.is_dir()]):
            key = str(folder.resolve())
            if key in processed:
                continue
            candidates = folder_video_candidates(folder)
            if not candidates:
                continue
            print(f"Candidate recording: {folder}")
            if not is_stable(candidates, args.stable_sec):
                print("  still changing; will check again later")
                continue

            prep_args = argparse.Namespace(**vars(args))
            prep_args.source = str(folder)
            prep_args.out = None
            prep_args.no_freeze = args.no_freeze
            prep_args.noise = args.noise
            prep_args.keep_cuts = ""
            prep_args.confirm_cuts = ""
            run_prepare(prep_args)
            processed.add(key)
            watch_state["processed"] = sorted(processed)
            watch_state["updated_at"] = now_iso()
            write_json(state_file, watch_state)
            prepared = True
            if args.once:
                return 0
        if args.once:
            if not prepared:
                print("No stable recording found.")
            return 0
        time.sleep(args.poll_sec)


def run_doctor(args: argparse.Namespace) -> int:
    checks: list[tuple[str, bool, str]] = []

    for command in ["ffmpeg", "ffprobe"]:
        found = shutil.which(command)
        checks.append((command, bool(found), found or "missing"))

    python_version = sys.version.split()[0]
    checks.append(("python", True, python_version))
    checks.append(
        (
            "faster_whisper",
            importlib.util.find_spec("faster_whisper") is not None,
            "installed" if importlib.util.find_spec("faster_whisper") else "missing",
        )
    )

    skill_dir = skill_dir_from_args(args)
    try:
        sdir = scripts_dir(skill_dir)
        checks.append((SKILL_NAME, True, str(sdir)))
    except AgentError as exc:
        checks.append((SKILL_NAME, False, str(exc)))

    print("Dependency check")
    for name, ok, detail in checks:
        mark = "OK" if ok else "MISSING"
        print(f"  {mark:7} {name:18} {detail}")

    required_ok = all(ok for name, ok, _ in checks if name in {"ffmpeg", "ffprobe", "python", SKILL_NAME})
    return 0 if required_ok else 1


def run_summary(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir).expanduser().resolve()
    if not out_dir.exists():
        raise AgentError(f"Output directory not found: {out_dir}")
    print_job_summary(out_dir)
    state = read_json(state_path(out_dir), default={}) or {}
    if state:
        print(f"  status      : {state.get('status')}")
    return 0


def add_common_plan_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--min-silence", type=float, default=None)
    parser.add_argument("--pad", type=float, default=None)
    parser.add_argument("--min-cut", type=float, default=None)
    parser.add_argument("--head-threshold", type=float, default=None)
    parser.add_argument("--tail-threshold", type=float, default=None)
    parser.add_argument("--keep-cuts", default="")
    parser.add_argument("--confirm-cuts", default="")
    parser.add_argument("--ignore-freeze", action="store_true")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Zoom lecture editing agent")
    parser.add_argument("--skill-dir", type=Path, default=None, help="lecture-video-editor skill path")

    sub = parser.add_subparsers(dest="command", required=True)

    doctor = sub.add_parser("doctor", help="check local dependencies")
    doctor.set_defaults(func=run_doctor)

    prepare = sub.add_parser("prepare", help="ingest, analyze, and propose cuts")
    prepare.add_argument("source", help="Zoom recording folder or video file")
    prepare.add_argument("-o", "--out", type=Path, default=None, help="output directory")
    prepare.add_argument("--noise", default="-35dB")
    prepare.add_argument("--no-freeze", action="store_true")
    add_common_plan_options(prepare)
    prepare.set_defaults(func=run_prepare)

    replan = sub.add_parser("replan", help="rebuild cut list from existing analysis.json")
    replan.add_argument("out_dir", help="existing _lve_output directory")
    add_common_plan_options(replan)
    replan.set_defaults(func=run_replan)

    transcribe = sub.add_parser("transcribe", help="run local transcript, refine cuts, and make subtitles")
    transcribe.add_argument("out_dir", help="existing _lve_output directory")
    transcribe.add_argument("--approve-cuts", action="store_true")
    transcribe.add_argument("--model", default="large-v3")
    transcribe.add_argument("--device", default="auto")
    transcribe.add_argument("--compute-type", default="auto")
    transcribe.add_argument("--language", default="ko")
    transcribe.set_defaults(func=run_transcribe_stage)

    render = sub.add_parser("render", help="render approved master video")
    render.add_argument("out_dir", help="existing _lve_output directory")
    render.add_argument("--approve-cuts", action="store_true")
    render.add_argument("--approve-script", action="store_true")
    render.add_argument("--preset", default="master")
    render.add_argument("-o", "--out", type=Path, default=None)
    render.add_argument("--max-terms", type=int, default=None)
    render.add_argument("--force-cfr", type=int, default=None)
    render.add_argument("--dry-run", action="store_true")
    render.set_defaults(func=run_render)

    watch = sub.add_parser("watch", help="watch a Zoom directory and prepare stable recordings")
    watch.add_argument("zoom_dir", help="directory containing Zoom recording folders")
    watch.add_argument("--poll-sec", type=float, default=30.0)
    watch.add_argument("--stable-sec", type=float, default=120.0)
    watch.add_argument("--once", action="store_true")
    watch.add_argument("--state-file", type=Path, default=None)
    watch.add_argument("--noise", default="-35dB")
    watch.add_argument("--no-freeze", action="store_true")
    add_common_plan_options(watch)
    watch.set_defaults(func=run_watch)

    summary = sub.add_parser("summary", help="show job summary")
    summary.add_argument("out_dir", help="existing _lve_output directory")
    summary.set_defaults(func=run_summary)

    return parser


def main(argv: list[str] | None = None) -> int:
    configure_stdio()
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except AgentError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
