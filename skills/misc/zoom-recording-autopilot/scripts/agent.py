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
import re
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
APPLIED_SKILLS = [
    {
        "name": "lecture-video-editor",
        "agent_use": "prepare, replan, transcribe, and render the local edit pipeline",
    },
    {
        "name": "zoom-recording-autopilot",
        "agent_use": "watch stable Zoom folders and stop at approval gates",
    },
    {
        "name": "lecture-privacy-review",
        "agent_use": "extract local review frames and write privacy_review.md before publishing",
    },
    {
        "name": "lecture-publish-packager",
        "agent_use": "build metadata, subtitle references, and upload checklist packages",
    },
    {
        "name": "lecture-youtube-uploader",
        "agent_use": "upload approved publish packages to a locked YouTube channel only after explicit upload and visibility approval",
    },
    {
        "name": "grill-me / grill-with-docs",
        "agent_use": "turn publish readiness into hard questions instead of silent assumptions",
    },
    {
        "name": "domain-modeling",
        "agent_use": "keep the job states and human approval gates explicit",
    },
    {
        "name": "to-spec / to-tickets",
        "agent_use": "emit next-action tickets with blocking edges in readiness and publish reports",
    },
]
SENSITIVE_TEXT_PATTERNS = [
    ("email", re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)),
    ("phone", re.compile(r"\b(?:\+?82[-.\s]?)?0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b")),
    ("zoom_link", re.compile(r"https?://[^\s]*zoom\.us/[^\s]+", re.I)),
    ("meeting_id", re.compile(r"(?:meeting\s*id|회의\s*id|회의\s*번호|암호|passcode)", re.I)),
    ("student_record", re.compile(r"(?:학번|출석|성적|점수|참가자|채팅|학생\s*이름|명단)")),
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


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def read_text(path: Path, default: str = "") -> str:
    if not path.exists():
        return default
    return path.read_text(encoding="utf-8", errors="replace")


def format_seconds(seconds: float | int | None) -> str:
    if seconds is None:
        return "unknown"
    seconds = max(0, int(round(float(seconds))))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def mb_from_bytes(value: str | int | None) -> float | None:
    if value is None:
        return None
    try:
        return int(value) / (1024 * 1024)
    except (TypeError, ValueError):
        return None


def sorted_existing(paths: list[Path]) -> list[Path]:
    existing = [p for p in paths if p.exists()]
    return sorted(existing, key=lambda p: (p.stat().st_mtime, p.name), reverse=True)


def ffprobe_format(video: Path) -> dict[str, Any]:
    require_command("ffprobe")
    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size",
            "-of",
            "json",
            str(video),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        raise AgentError(f"ffprobe failed for {video}: {proc.stderr.strip()}")
    return json.loads(proc.stdout or "{}").get("format") or {}


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


def infer_source_title(out_dir: Path) -> str:
    manifest = read_json(out_dir / "manifest.json", default={}) or {}
    source = manifest.get("source") or {}
    candidates = [
        source.get("recording_dir"),
        str(Path(source["main_video"]).parent) if source.get("main_video") else "",
    ]
    analysis = read_json(out_dir / "analysis.json", default={}) or {}
    if analysis.get("source"):
        candidates.append(str(Path(str(analysis["source"])).parent))

    for raw in candidates:
        if not raw:
            continue
        name = Path(str(raw)).name
        cleaned = re.sub(r"^\d{4}-\d{2}-\d{2}\s+\d{1,2}\.\d{2}\.\d{2}\s*", "", name)
        if cleaned and cleaned != ".":
            return cleaned
    return out_dir.name.replace("_", " ")


def locate_artifacts(out_dir: Path) -> dict[str, Any]:
    final_dir = out_dir / "완성본"
    review_dir = out_dir / "review"
    publish_dir = out_dir / "publish"

    full_videos = sorted_existing(list(final_dir.glob("*풀영상*.mp4")) if final_dir.exists() else [])
    part_videos = sorted(
        list(final_dir.glob("*part*.mp4")) if final_dir.exists() else [],
        key=lambda p: p.name,
    )
    master_videos = sorted_existing(list((out_dir / "master").glob("*_master.mp4")))
    all_mp4s = sorted_existing(list(out_dir.glob("*.mp4")) + list(final_dir.glob("*.mp4")) if final_dir.exists() else list(out_dir.glob("*.mp4")))

    subtitle_candidates = []
    for folder in [out_dir / "subtitles", out_dir / "subs", final_dir]:
        if folder.exists():
            subtitle_candidates.extend(folder.glob("*.srt"))
    subtitles = sorted(subtitle_candidates, key=lambda p: p.name)

    chapter_candidates = []
    for folder in [out_dir / "chapters", final_dir]:
        if folder.exists():
            chapter_candidates.extend(folder.glob("*.txt"))
            chapter_candidates.extend(folder.glob("*.md"))
    chapters = sorted(chapter_candidates, key=lambda p: p.name)

    transcript_candidates = []
    for pattern in ["final_script.md", "transcript.json", "subs/segments_master.json", "subs/segments_raw.json"]:
        candidate = out_dir / pattern
        if candidate.exists():
            transcript_candidates.append(candidate)

    privacy_review = review_dir / "privacy_review.md"
    readiness_report = review_dir / "readiness_report.md"
    existing_review_sheets = sorted(review_dir.glob("*.png"), key=lambda p: p.name) if review_dir.exists() else []
    render_logs = sorted_existing(
        [
            out_dir / "render_safe_log.json",
            out_dir / "render_master_log.json",
        ]
    )
    split_log = out_dir / "parts" / "split_log.json"

    return {
        "out_dir": out_dir,
        "title": infer_source_title(out_dir),
        "full_video": full_videos[0] if full_videos else None,
        "master_video": master_videos[0] if master_videos else None,
        "preferred_video": (full_videos[0] if full_videos else (master_videos[0] if master_videos else (all_mp4s[0] if all_mp4s else None))),
        "part_videos": part_videos,
        "subtitles": subtitles,
        "chapters": chapters,
        "transcripts": transcript_candidates,
        "review_dir": review_dir,
        "publish_dir": publish_dir,
        "privacy_review": privacy_review if privacy_review.exists() else None,
        "readiness_report": readiness_report if readiness_report.exists() else None,
        "review_sheets": existing_review_sheets,
        "render_logs": render_logs,
        "split_log": split_log if split_log.exists() else None,
    }


def render_drift_ok(out_dir: Path) -> tuple[bool | None, str]:
    for candidate in [out_dir / "render_safe_log.json", out_dir / "render_master_log.json"]:
        payload = read_json(candidate, default=None)
        if not payload:
            continue
        drift = payload.get("drift_sec")
        if drift is None:
            expected = payload.get("expected_sec")
            actual = payload.get("actual_sec")
            if expected is not None and actual is not None:
                drift = abs(float(actual) - float(expected))
        if drift is None:
            return None, f"{candidate.name} has no drift value"
        return abs(float(drift)) <= 1.0, f"{candidate.name} drift {float(drift):.3f}s"
    return None, "no render drift log found"


def redact_sensitive_preview(text: str) -> str:
    text = SENSITIVE_TEXT_PATTERNS[0][1].sub("[email]", text)
    text = SENSITIVE_TEXT_PATTERNS[1][1].sub("[phone]", text)
    text = SENSITIVE_TEXT_PATTERNS[2][1].sub("[zoom-link]", text)
    return text.strip()[:160]


def scan_sensitive_text(paths: list[Path], max_matches: int = 12) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for path in paths:
        if not path.exists() or path.suffix.lower() not in {".srt", ".md", ".txt", ".json"}:
            continue
        text = read_text(path)
        lines = text.splitlines()
        for label, pattern in SENSITIVE_TEXT_PATTERNS:
            for line_no, line in enumerate(lines, start=1):
                if not pattern.search(line):
                    continue
                findings.append(
                    {
                        "file": str(path),
                        "line": line_no,
                        "label": label,
                        "preview": redact_sensitive_preview(line),
                    }
                )
                if len(findings) >= max_matches:
                    return findings
    return findings


def build_sample_times(duration: float, out_dir: Path, interval_sec: float, max_frames: int) -> list[float]:
    times: set[float] = set()
    for value in [5, 15, 30, duration - 30, duration - 15, duration - 5]:
        if 0 <= value <= duration:
            times.add(round(value, 2))

    step = max(60.0, float(interval_sec))
    cursor = step
    while cursor < duration:
        times.add(round(cursor, 2))
        cursor += step

    split_log = read_json(out_dir / "parts" / "split_log.json", default={}) or {}
    for bound in split_log.get("bounds") or []:
        for offset in [-1.0, 0.0, 1.0]:
            value = float(bound) + offset
            if 0 <= value <= duration:
                times.add(round(value, 2))

    ordered = sorted(times)
    if max_frames > 0 and len(ordered) > max_frames:
        keep = {ordered[0], ordered[-1]}
        span = len(ordered) - 1
        for idx in range(max_frames - 2):
            keep.add(ordered[round((idx + 1) * span / (max_frames - 1))])
        ordered = sorted(keep)
    return ordered


def extract_frame(video: Path, timestamp: float, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{timestamp:.3f}",
        "-i",
        str(video),
        "-frames:v",
        "1",
        "-vf",
        "scale=960:-1",
        "-q:v",
        "3",
        "-y",
        str(output),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise AgentError(f"Frame extraction failed at {timestamp:.2f}s: {proc.stderr.strip()}")


def make_contact_sheet(frames: list[Path], output: Path) -> Path | None:
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None

    if not frames:
        return None

    thumbs = []
    for frame in frames:
        image = Image.open(frame).convert("RGB")
        image.thumbnail((360, 210))
        canvas = Image.new("RGB", (380, 250), "white")
        canvas.paste(image, ((380 - image.width) // 2, 8))
        draw = ImageDraw.Draw(canvas)
        draw.text((10, 222), frame.stem[-28:], fill=(0, 0, 0))
        thumbs.append(canvas)

    cols = 3
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 380, rows * 250), "white")
    for idx, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((idx % cols) * 380, (idx // cols) * 250))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=88)
    return output


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


def run_skills(args: argparse.Namespace) -> int:
    print("Applied skill map")
    for item in APPLIED_SKILLS:
        print(f"  - {item['name']}: {item['agent_use']}")
    return 0


def readiness_checks(out_dir: Path) -> tuple[list[dict[str, str]], dict[str, Any]]:
    artifacts = locate_artifacts(out_dir)
    checks: list[dict[str, str]] = []

    def add(status: str, gate: str, detail: str) -> None:
        checks.append({"status": status, "gate": gate, "detail": detail})

    video = artifacts["preferred_video"]
    if video:
        info = ffprobe_format(video)
        duration = float(info.get("duration") or 0)
        size_mb = mb_from_bytes(info.get("size"))
        detail = f"{video} ({format_seconds(duration)}"
        if size_mb is not None:
            detail += f", {size_mb:.1f} MB"
        detail += ")"
        add("pass", "edited video", detail)
    else:
        add("blocker", "edited video", "no full or master MP4 found")

    drift_ok, drift_detail = render_drift_ok(out_dir)
    if drift_ok is True:
        add("pass", "render drift", drift_detail)
    elif drift_ok is False:
        add("blocker", "render drift", drift_detail)
    else:
        add("review", "render drift", drift_detail)

    if artifacts["subtitles"]:
        add("pass", "subtitles", f"{len(artifacts['subtitles'])} SRT file(s)")
    else:
        add("review", "subtitles", "no SRT subtitles found")

    if artifacts["part_videos"]:
        add("pass", "split videos", f"{len(artifacts['part_videos'])} part video(s)")
    else:
        add("review", "split videos", "no split part videos found")

    if artifacts["chapters"]:
        add("pass", "chapters", f"{len(artifacts['chapters'])} chapter file(s)")
    else:
        add("review", "chapters", "no chapter file found")

    if artifacts["privacy_review"]:
        privacy_text = read_text(artifacts["privacy_review"])
        if re.search(r"clear_for_publish\s*:\s*(yes|true)", privacy_text, re.I):
            add("pass", "privacy review", str(artifacts["privacy_review"]))
        else:
            add("review", "privacy review", f"{artifacts['privacy_review']} exists; set CLEAR_FOR_PUBLISH: yes after human review")
    elif artifacts["review_sheets"]:
        add("review", "privacy review", f"{len(artifacts['review_sheets'])} existing review sheet(s), no privacy_review.md")
    else:
        add("blocker", "privacy review", "run privacy-review before public or student-facing publish")

    checklist = artifacts["publish_dir"] / "upload-checklist.md"
    if checklist.exists():
        add("pass", "publish package", str(checklist))
    else:
        add("review", "publish package", "run package to create metadata and checklist")

    return checks, artifacts


def build_readiness_markdown(out_dir: Path, checks: list[dict[str, str]], artifacts: dict[str, Any]) -> str:
    blockers = [c for c in checks if c["status"] == "blocker"]
    reviews = [c for c in checks if c["status"] == "review"]
    title = artifacts["title"]
    lines = [
        f"# Publish Readiness - {title}",
        "",
        f"- Generated: {now_iso()}",
        f"- Output folder: `{out_dir}`",
        "",
        "## Gate Checks",
        "",
        "| Status | Gate | Detail |",
        "| --- | --- | --- |",
    ]
    for check in checks:
        lines.append(f"| {check['status']} | {check['gate']} | {check['detail']} |")

    lines += [
        "",
        "## Grill Questions",
        "",
    ]
    if blockers or reviews:
        lines.append("Answer these before upload:")
        for idx, check in enumerate(blockers + reviews, start=1):
            lines.append(f"{idx}. {check['gate']}: {check['detail']}")
    else:
        lines.append("No open readiness questions from local artifacts.")

    lines += [
        "",
        "## Agent Tickets",
        "",
        "1. Privacy review",
        "   - Blocked by: edited video",
        "   - Delivers: local frame samples and sensitive-text scan for human inspection",
        "2. Publish package",
        "   - Blocked by: privacy review decision",
        "   - Delivers: metadata, subtitles, chapters, and upload checklist",
        "3. Upload decision",
        "   - Blocked by: checklist completion and visibility choice",
        "   - Delivers: explicit go/no-go for YouTube, LMS, or Drive",
        "",
        "## Applied Skills",
        "",
    ]
    for item in APPLIED_SKILLS:
        lines.append(f"- `{item['name']}`: {item['agent_use']}")
    return "\n".join(lines)


def run_readiness(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir).expanduser().resolve()
    if not out_dir.exists():
        raise AgentError(f"Output directory not found: {out_dir}")

    checks, artifacts = readiness_checks(out_dir)
    report = build_readiness_markdown(out_dir, checks, artifacts)
    report_path = Path(args.report).expanduser().resolve() if args.report else out_dir / "review" / "readiness_report.md"
    if not args.no_write:
        write_text(report_path, report)
        print(f"Readiness report: {report_path}")
    print("\nReadiness")
    for check in checks:
        print(f"  {check['status']:7} {check['gate']:16} {check['detail']}")
    blockers = [c for c in checks if c["status"] == "blocker"]
    return 2 if blockers else 0


def run_privacy_review(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir).expanduser().resolve()
    if not out_dir.exists():
        raise AgentError(f"Output directory not found: {out_dir}")
    artifacts = locate_artifacts(out_dir)
    video = Path(args.video).expanduser().resolve() if args.video else artifacts["preferred_video"]
    if not video or not video.exists():
        raise AgentError("No video found for privacy review. Pass --video explicitly.")

    require_command("ffmpeg")
    info = ffprobe_format(video)
    duration = float(info.get("duration") or 0)
    if duration <= 0:
        raise AgentError(f"Could not determine video duration: {video}")

    review_dir = out_dir / "review"
    frames_dir = review_dir / "privacy_frames"
    times = build_sample_times(duration, out_dir, args.interval_sec, args.max_frames)
    frames: list[Path] = []
    if not args.no_extract:
        for timestamp in times:
            frame = frames_dir / f"{video.stem}_{int(round(timestamp * 1000)):08d}ms.jpg"
            extract_frame(video, timestamp, frame)
            frames.append(frame)

    contact_sheet = make_contact_sheet(frames, review_dir / "privacy_contact_sheet.jpg")
    scan_paths = artifacts["subtitles"] + artifacts["transcripts"] + artifacts["chapters"]
    text_findings = scan_sensitive_text(scan_paths)

    lines = [
        f"# Privacy Review - {artifacts['title']}",
        "",
        f"- Generated: {now_iso()}",
        f"- Reviewed video: `{video}`",
        f"- Duration: {format_seconds(duration)}",
        f"- Extracted frames: {len(frames)}",
        "- CLEAR_FOR_PUBLISH: no",
    ]
    if contact_sheet:
        lines.append(f"- Contact sheet: `{contact_sheet}`")
    if artifacts["review_sheets"]:
        lines.append(f"- Existing review sheets: {len(artifacts['review_sheets'])}")

    lines += [
        "",
        "## Blocker",
        "",
        "- None automatically confirmed. This agent does not perform OCR or face recognition.",
        "",
        "## Review",
        "",
        "- Inspect the extracted frames for participant names, chat panels, browser tabs, notifications, account IDs, and file paths.",
    ]
    if contact_sheet:
        lines.append("- Start with the contact sheet, then open individual frames for close inspection.")
    if text_findings:
        lines.append("- Sensitive text patterns were found in local text artifacts:")
        for finding in text_findings:
            lines.append(
                f"  - `{finding['label']}` in `{finding['file']}` line {finding['line']}: {finding['preview']}"
            )
    else:
        lines.append("- No email, phone, Zoom link, meeting-id, or student-record keywords were found in scanned text artifacts.")

    lines += [
        "",
        "## Clear",
        "",
        "- The review package was generated locally.",
        "- No media was uploaded or sent to an external service.",
        "",
        "## Recommended Action",
        "",
        "- Mark this review clear only after a human checks the frames/contact sheet.",
        "- If a blocker is found, create a redacted export instead of overwriting the master.",
    ]
    report_path = review_dir / "privacy_review.md"
    write_text(report_path, "\n".join(lines))
    update_state(out_dir, status="privacy_review_ready", privacy_review=str(report_path))
    print(f"Privacy review: {report_path}")
    if contact_sheet:
        print(f"Contact sheet  : {contact_sheet}")
    print(f"Frames         : {frames_dir}")
    return 0


def copied_asset(src: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    shutil.copy2(src, dest)
    return dest


def build_chapter_block(chapters: list[Path]) -> str:
    if not chapters:
        return "Chapters: not available yet."
    preferred = next((p for p in chapters if "풀영상" in p.name), chapters[0])
    content = read_text(preferred).strip()
    return content or f"See chapter file: {preferred}"


def run_package(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir).expanduser().resolve()
    if not out_dir.exists():
        raise AgentError(f"Output directory not found: {out_dir}")
    artifacts = locate_artifacts(out_dir)
    video = artifacts["preferred_video"]
    if not video:
        raise AgentError("No full or master video found to package.")

    publish_dir = Path(args.publish_dir).expanduser().resolve() if args.publish_dir else artifacts["publish_dir"]
    for name in ["video", "subtitles", "transcript", "thumbnails"]:
        (publish_dir / name).mkdir(parents=True, exist_ok=True)

    video_ref = video
    if args.copy_media:
        video_ref = copied_asset(video, publish_dir / "video")

    copied_subtitles = [copied_asset(path, publish_dir / "subtitles") for path in artifacts["subtitles"]]
    copied_chapters = [copied_asset(path, publish_dir / "transcript") for path in artifacts["chapters"]]
    for path in artifacts["transcripts"]:
        if path.suffix.lower() in {".md", ".txt"}:
            copied_asset(path, publish_dir / "transcript")

    info = ffprobe_format(video)
    duration = float(info.get("duration") or 0)
    size_mb = mb_from_bytes(info.get("size"))
    title = artifacts["title"]
    chapter_block = build_chapter_block(artifacts["chapters"])
    privacy_review = out_dir / "review" / "privacy_review.md"

    metadata = [
        f"# Publish Metadata - {title}",
        "",
        "## Title Candidates",
        "",
        f"1. {title}",
        f"2. {title} - 풀영상",
        f"3. {title} 다시보기",
        "",
        "## Description Draft",
        "",
        f"{title} 수업 녹화 편집본입니다.",
        "",
        chapter_block,
        "",
        "## Tags",
        "",
        "교무수업, 줌수업, 강의다시보기, 수업활용, 교육",
        "",
        "## Assets",
        "",
        f"- Video: `{video_ref}`",
        f"- Duration: {format_seconds(duration)}",
    ]
    if size_mb is not None:
        metadata.append(f"- Size: {size_mb:.1f} MB")
    if copied_subtitles:
        metadata.append(f"- Subtitles: {', '.join(str(p) for p in copied_subtitles)}")
    if copied_chapters:
        metadata.append(f"- Chapters/transcript assets: {', '.join(str(p) for p in copied_chapters)}")
    metadata += [
        "",
        "## Pinned Comment Draft",
        "",
        "필요한 부분은 챕터를 눌러 다시 볼 수 있습니다. 질문은 댓글이나 수업 채널에 남겨 주세요.",
    ]
    write_text(publish_dir / "metadata.md", "\n".join(metadata))

    checklist = [
        f"# Upload Checklist - {title}",
        "",
        f"- [ ] Target selected: {args.target}",
        f"- [ ] Privacy review checked: `{privacy_review}`",
        "- [ ] Participant names, chat, notifications, browser tabs, account IDs checked",
        "- [ ] Title and description reviewed",
        "- [ ] Chapters pasted into description",
        "- [ ] Korean subtitles attached and spot-checked",
        "- [ ] Visibility selected intentionally",
        "- [ ] Original/master video kept unchanged",
        "",
        "## Blocking Edges",
        "",
        "- Upload is blocked by privacy review approval.",
        "- Public publishing is blocked by visibility confirmation.",
    ]
    write_text(publish_dir / "upload-checklist.md", "\n".join(checklist))

    tickets = [
        f"# Agent Tickets - {title}",
        "",
        "## 01 Privacy decision",
        "",
        "**Blocked by:** local review frames generated",
        "",
        "- [ ] Human reviewed privacy frames/contact sheet",
        "- [ ] Blockers are either absent or assigned to redaction",
        "",
        "## 02 Publish metadata",
        "",
        "**Blocked by:** 01 Privacy decision",
        "",
        "- [ ] Title, description, tags, and chapters approved",
        "- [ ] Subtitle file selected",
        "",
        "## 03 Upload handoff",
        "",
        "**Blocked by:** 02 Publish metadata",
        "",
        "- [ ] Destination and visibility approved",
        "- [ ] Upload performed outside this local packaging command",
    ]
    write_text(publish_dir / "agent-tickets.md", "\n".join(tickets))

    manifest = {
        "created_at": now_iso(),
        "target": args.target,
        "source_output": str(out_dir),
        "video": str(video_ref),
        "copied_media": bool(args.copy_media),
        "subtitles": [str(p) for p in copied_subtitles],
        "chapters": [str(p) for p in copied_chapters],
        "metadata": str(publish_dir / "metadata.md"),
        "checklist": str(publish_dir / "upload-checklist.md"),
    }
    write_json(publish_dir / "publish_manifest.json", manifest)
    update_state(out_dir, status="publish_package_ready", publish_dir=str(publish_dir))

    print(f"Publish package: {publish_dir}")
    print(f"Metadata       : {publish_dir / 'metadata.md'}")
    print(f"Checklist      : {publish_dir / 'upload-checklist.md'}")
    return 0


def run_continue(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir).expanduser().resolve()
    if not out_dir.exists():
        raise AgentError(f"Output directory not found: {out_dir}")

    actions: list[str] = []
    update_state(out_dir, status="auto_continuing")
    artifacts = locate_artifacts(out_dir)
    if not artifacts["preferred_video"]:
        raise AgentError("No edited video found. Run prepare/render first or pass the correct output folder.")

    if args.refresh_privacy or not artifacts["privacy_review"]:
        privacy_args = argparse.Namespace(
            out_dir=str(out_dir),
            video=args.video,
            interval_sec=args.interval_sec,
            max_frames=args.max_frames,
            no_extract=args.no_extract,
        )
        run_privacy_review(privacy_args)
        actions.append("privacy-review")
    else:
        actions.append("privacy-review: skipped existing report")

    artifacts = locate_artifacts(out_dir)
    checklist = artifacts["publish_dir"] / "upload-checklist.md"
    if args.refresh_package or not checklist.exists():
        package_args = argparse.Namespace(
            out_dir=str(out_dir),
            target=args.target,
            publish_dir=args.publish_dir,
            copy_media=args.copy_media,
        )
        run_package(package_args)
        actions.append("package")
    else:
        actions.append("package: skipped existing package")

    checks, artifacts = readiness_checks(out_dir)
    report = build_readiness_markdown(out_dir, checks, artifacts)
    report_path = out_dir / "review" / "readiness_report.md"
    write_text(report_path, report)
    actions.append("readiness")

    blockers = [c for c in checks if c["status"] == "blocker"]
    reviews = [c for c in checks if c["status"] == "review"]
    state_status = "blocked" if blockers else ("waiting_for_human_gate" if reviews else "ready_for_publish_decision")
    update_state(
        out_dir,
        status=state_status,
        continue_actions=actions,
        readiness_report=str(report_path),
        open_gates=checks,
    )
    write_json(
        out_dir / "logs" / "continue.json",
        {
            "created_at": now_iso(),
            "actions": actions,
            "status": state_status,
            "checks": checks,
        },
    )

    print("\nAuto-continue actions")
    for action in actions:
        print(f"  - {action}")
    print(f"\nReadiness report: {report_path}")
    print("\nOpen gates")
    if not blockers and not reviews:
        print("  none")
    for check in blockers + reviews:
        print(f"  {check['status']:7} {check['gate']:16} {check['detail']}")
    if reviews:
        print("\nStopped at human approval gate.")
    return 2 if blockers else 0


def optional_module(name: str) -> tuple[bool, str]:
    spec = importlib.util.find_spec(name)
    return bool(spec), "installed" if spec else "missing"


def run_youtube_doctor(args: argparse.Namespace) -> int:
    checks = [
        ("googleapiclient", *optional_module("googleapiclient")),
        ("google_auth_oauthlib", *optional_module("google_auth_oauthlib")),
        ("google.oauth2", *optional_module("google.oauth2")),
    ]
    print("YouTube upload dependency check")
    for name, ok, detail in checks:
        mark = "OK" if ok else "MISSING"
        print(f"  {mark:7} {name:24} {detail}")
    print("\nRequired OAuth scope for video upload:")
    print("  https://www.googleapis.com/auth/youtube.upload")
    print("Channel lock verification additionally needs:")
    print("  https://www.googleapis.com/auth/youtube.readonly")
    print("Caption upload additionally needs:")
    print("  https://www.googleapis.com/auth/youtube.force-ssl")
    return 0 if all(ok for _, ok, _ in checks) else 1


def parse_publish_metadata(metadata_path: Path) -> dict[str, Any]:
    text = read_text(metadata_path)
    title = ""
    description_lines: list[str] = []
    tags: list[str] = []
    section = ""
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if line.startswith("## "):
            section = line[3:].strip().lower()
            continue
        if section == "title candidates" and not title:
            match = re.match(r"\d+\.\s*(.+)", line)
            if match:
                title = match.group(1).strip()
        elif section == "description draft":
            if line and not line.startswith("#"):
                description_lines.append(raw_line.rstrip())
        elif section == "tags" and line:
            tags.extend([tag.strip() for tag in line.split(",") if tag.strip()])
    return {
        "title": title,
        "description": "\n".join(description_lines).strip(),
        "tags": tags,
    }


def default_youtube_token_file() -> Path:
    return Path.home() / ".opencodex" / "youtube_upload_token.json"


def default_youtube_channel_lock_file() -> Path:
    return Path.home() / ".opencodex" / "youtube_channel_lock.json"


def resolve_channel_lock_file(path: Path | None) -> Path:
    return Path(path).expanduser().resolve() if path else default_youtube_channel_lock_file()


def read_youtube_channel_lock(path: Path) -> dict[str, Any]:
    data = read_json(path, default={}) or {}
    return data if isinstance(data, dict) else {}


def validate_youtube_channel_id(channel_id: str) -> None:
    if not re.match(r"^UC[A-Za-z0-9_-]{20,40}$", channel_id):
        raise AgentError(
            "YouTube channel lock requires the canonical channel ID, usually starting with UC. "
            "Open YouTube Studio > Settings > Channel > Advanced settings to copy it."
        )


def run_youtube_channel_lock(args: argparse.Namespace) -> int:
    lock_path = resolve_channel_lock_file(args.channel_lock_file)
    existing = read_youtube_channel_lock(lock_path)
    has_updates = any(
        [
            args.youtube_user_id,
            args.channel_id,
            args.channel_title,
            args.channel_handle,
        ]
    )
    if not has_updates:
        print(f"YouTube channel lock: {lock_path}")
        if not existing:
            print("  status     : not configured")
            print("  next step  : add --channel-id UC... and --youtube-user-id <account label>")
            return 0
        print(f"  status     : configured")
        print(f"  user id    : {existing.get('youtube_user_id') or 'not set'}")
        print(f"  channel id : {existing.get('channel_id') or 'not set'}")
        print(f"  title      : {existing.get('channel_title') or 'not set'}")
        print(f"  handle     : {existing.get('channel_handle') or 'not set'}")
        print(f"  updated    : {existing.get('updated_at') or existing.get('created_at') or 'unknown'}")
        return 0

    channel_id = (args.channel_id or existing.get("channel_id") or "").strip()
    if not channel_id:
        raise AgentError("Set --channel-id UC... before locking YouTube uploads.")
    validate_youtube_channel_id(channel_id)

    now = now_iso()
    lock = {
        "created_at": existing.get("created_at") or now,
        "updated_at": now,
        "youtube_user_id": (args.youtube_user_id or existing.get("youtube_user_id") or "").strip(),
        "channel_id": channel_id,
        "channel_title": (args.channel_title or existing.get("channel_title") or "").strip(),
        "channel_handle": (args.channel_handle or existing.get("channel_handle") or "").strip(),
        "enforced_by": "channel_id",
        "user_id_note": (
            "Stored for human-readable account pinning. The YouTube upload OAuth scope does not expose "
            "the Google account email, so upload blocking is enforced by channel_id."
        ),
    }
    write_json(lock_path, lock)
    print(f"YouTube channel lock saved: {lock_path}")
    print(f"  user id    : {lock['youtube_user_id'] or 'not set'}")
    print(f"  channel id : {lock['channel_id']}")
    print(f"  title      : {lock['channel_title'] or 'not set'}")
    print(f"  handle     : {lock['channel_handle'] or 'not set'}")
    return 0


def youtube_scopes(upload_captions: bool) -> list[str]:
    scopes = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
    ]
    if upload_captions:
        scopes.append("https://www.googleapis.com/auth/youtube.force-ssl")
    return scopes


def bool_from_choice(value: str | None, *, field: str, required: bool) -> bool | None:
    if value is None:
        if required:
            raise AgentError(f"{field} must be explicitly set to yes or no before upload.")
        return None
    return value == "yes"


def select_caption_file(artifacts: dict[str, Any]) -> Path | None:
    subtitles: list[Path] = artifacts.get("subtitles") or []
    if not subtitles:
        return None
    full = [p for p in subtitles if "풀영상" in p.name or "master" in p.name]
    return sorted(full or subtitles, key=lambda p: p.name)[0]


def build_youtube_upload_plan(args: argparse.Namespace, out_dir: Path) -> dict[str, Any]:
    artifacts = locate_artifacts(out_dir)
    video = artifacts["preferred_video"]
    if not video:
        raise AgentError("No video found for YouTube upload.")

    checks, _ = readiness_checks(out_dir)
    not_pass = [c for c in checks if c["status"] != "pass"]
    state = read_json(state_path(out_dir), default={}) or {}
    if not args.force and (not_pass or state.get("status") != "ready_for_publish_decision"):
        raise AgentError(
            "YouTube upload requires all readiness gates to pass and state ready_for_publish_decision. "
            "Run `continue` first or pass --force after reviewing the risk."
        )

    publish_dir = artifacts["publish_dir"]
    metadata = parse_publish_metadata(publish_dir / "metadata.md")
    title = args.title or metadata["title"] or artifacts["title"]
    description = metadata["description"]
    if args.description_file:
        description = read_text(Path(args.description_file).expanduser().resolve()).strip()
    tags = [tag.strip() for tag in (args.tags.split(",") if args.tags else metadata["tags"]) if tag.strip()]
    caption_file = Path(args.caption_file).expanduser().resolve() if args.caption_file else select_caption_file(artifacts)

    upload_required = bool(args.approve_upload)
    made_for_kids = bool_from_choice(args.made_for_kids, field="--made-for-kids", required=upload_required)
    contains_synthetic = bool_from_choice(
        args.contains_synthetic_media,
        field="--contains-synthetic-media",
        required=upload_required,
    )
    if args.privacy_status == "public" and not args.approve_public:
        raise AgentError("Public YouTube upload requires --approve-public.")
    if upload_required and not args.client_secrets:
        raise AgentError("YouTube upload requires --client-secrets pointing to a local OAuth client secrets JSON file.")
    channel_lock_file = resolve_channel_lock_file(args.channel_lock_file)
    channel_lock = read_youtube_channel_lock(channel_lock_file)
    if upload_required and not channel_lock.get("channel_id"):
        raise AgentError(
            "YouTube upload requires a fixed channel lock. Run "
            "`youtube-channel-lock --channel-id UC... --youtube-user-id <account label>` first."
        )

    plan = {
        "created_at": now_iso(),
        "source_output": str(out_dir),
        "video": str(video),
        "title": title,
        "description": description,
        "tags": tags,
        "category_id": args.category_id,
        "privacy_status": args.privacy_status,
        "notify_subscribers": bool(args.notify_subscribers),
        "self_declared_made_for_kids": made_for_kids,
        "contains_synthetic_media": contains_synthetic,
        "caption_file": str(caption_file) if caption_file else None,
        "upload_captions": bool(args.upload_captions),
        "client_secrets": str(Path(args.client_secrets).expanduser().resolve()) if args.client_secrets else None,
        "token_file": str(Path(args.token_file).expanduser().resolve() if args.token_file else default_youtube_token_file()),
        "channel_lock_file": str(channel_lock_file),
        "channel_lock": channel_lock or None,
        "api_notes": [
            "videos.insert uses YouTube Data API OAuth and resumable media upload.",
            "caption upload is separate and uses captions.insert with a broader scope.",
            "No upload is performed unless --approve-upload is present.",
            "Approved uploads are blocked unless the authenticated YouTube channel ID matches the channel lock.",
        ],
    }
    return plan


def get_youtube_service(client_secrets: Path, token_file: Path, upload_captions: bool):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    scopes = youtube_scopes(upload_captions)
    creds = None
    if token_file.exists():
        creds = Credentials.from_authorized_user_file(str(token_file), scopes)
    if creds and creds.valid and not creds.has_scopes(scopes):
        raise AgentError(f"Existing token lacks required YouTube scopes. Delete or replace: {token_file}")
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets), scopes)
        creds = flow.run_local_server(port=0)
    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.write_text(creds.to_json(), encoding="utf-8")
    return build("youtube", "v3", credentials=creds)


def verify_youtube_channel_lock(youtube: Any, lock: dict[str, Any]) -> dict[str, Any]:
    expected_id = str(lock.get("channel_id") or "").strip()
    if not expected_id:
        raise AgentError("Missing YouTube channel lock in upload plan.")

    response = youtube.channels().list(part="id,snippet", mine=True).execute()
    items = response.get("items") or []
    if not items:
        raise AgentError("Authenticated YouTube account did not return a channel for mine=true.")

    active = next((item for item in items if item.get("id") == expected_id), None)
    if not active:
        seen = ", ".join(item.get("id") or "unknown" for item in items)
        raise AgentError(
            "Authenticated YouTube channel does not match the fixed channel lock. "
            f"Expected {expected_id}, got {seen or 'unknown'}."
        )

    active_id = active.get("id") or ""
    snippet = active.get("snippet") or {}
    active_channel = {
        "channel_id": active_id,
        "channel_title": snippet.get("title") or "",
        "channel_handle": snippet.get("customUrl") or "",
    }
    return active_channel


def execute_youtube_upload(plan: dict[str, Any]) -> dict[str, Any]:
    from googleapiclient.http import MediaFileUpload

    client_secrets = Path(plan["client_secrets"])
    token_file = Path(plan["token_file"])
    youtube = get_youtube_service(client_secrets, token_file, bool(plan["upload_captions"]))
    active_channel = verify_youtube_channel_lock(youtube, plan.get("channel_lock") or {})
    body = {
        "snippet": {
            "title": plan["title"],
            "description": plan["description"],
            "tags": plan["tags"],
            "categoryId": plan["category_id"],
            "defaultLanguage": "ko",
        },
        "status": {
            "privacyStatus": plan["privacy_status"],
            "selfDeclaredMadeForKids": plan["self_declared_made_for_kids"],
            "containsSyntheticMedia": plan["contains_synthetic_media"],
        },
    }
    media = MediaFileUpload(plan["video"], chunksize=-1, resumable=True)
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
        notifySubscribers=plan["notify_subscribers"],
    )
    response = None
    while response is None:
        _, response = request.next_chunk()
    video_id = response["id"]
    result = {
        "created_at": now_iso(),
        "video_id": video_id,
        "watch_url": f"https://youtu.be/{video_id}",
        "privacy_status": plan["privacy_status"],
        "caption_id": None,
        "channel": active_channel,
    }

    if plan["upload_captions"] and plan["caption_file"]:
        caption_body = {
            "snippet": {
                "videoId": video_id,
                "language": "ko",
                "name": "Korean",
                "isDraft": False,
            }
        }
        caption_media = MediaFileUpload(plan["caption_file"], mimetype="application/octet-stream", resumable=True)
        caption_response = youtube.captions().insert(
            part="snippet",
            body=caption_body,
            media_body=caption_media,
        ).execute()
        result["caption_id"] = caption_response.get("id")
    return result


def run_youtube_upload(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir).expanduser().resolve()
    if not out_dir.exists():
        raise AgentError(f"Output directory not found: {out_dir}")
    plan = build_youtube_upload_plan(args, out_dir)
    publish_dir = out_dir / "publish"
    plan_path = publish_dir / "youtube_upload_plan.json"
    write_json(plan_path, plan)
    print(f"YouTube upload plan: {plan_path}")
    print(f"  video      : {plan['video']}")
    print(f"  title      : {plan['title']}")
    print(f"  visibility : {plan['privacy_status']}")
    print(f"  captions   : {plan['caption_file'] if plan['upload_captions'] else 'not requested'}")
    lock = plan.get("channel_lock") or {}
    print(f"  channel id : {lock.get('channel_id') or 'not locked'}")
    print(f"  user id    : {lock.get('youtube_user_id') or 'not set'}")
    if args.dry_run or not args.approve_upload:
        print("\nDry run only. Add --approve-upload to perform the external YouTube upload.")
        return 0

    result = execute_youtube_upload(plan)
    result_path = publish_dir / "youtube_upload_result.json"
    write_json(result_path, result)
    update_state(
        out_dir,
        status="youtube_uploaded",
        youtube_url=result["watch_url"],
        youtube_upload_result=str(result_path),
    )
    print(f"\nUploaded: {result['watch_url']}")
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

    youtube_doctor = sub.add_parser("youtube-doctor", help="check optional YouTube upload dependencies")
    youtube_doctor.set_defaults(func=run_youtube_doctor)

    youtube_lock = sub.add_parser("youtube-channel-lock", help="set or show the fixed YouTube upload account/channel")
    youtube_lock.add_argument("--channel-lock-file", type=Path, default=None)
    youtube_lock.add_argument("--youtube-user-id", default="")
    youtube_lock.add_argument("--channel-id", default="")
    youtube_lock.add_argument("--channel-title", default="")
    youtube_lock.add_argument("--channel-handle", default="")
    youtube_lock.set_defaults(func=run_youtube_channel_lock)

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

    skills = sub.add_parser("skills", help="show the applied skill map")
    skills.set_defaults(func=run_skills)

    readiness = sub.add_parser("readiness", help="check publish readiness and write a gate report")
    readiness.add_argument("out_dir", help="existing output directory")
    readiness.add_argument("--report", type=Path, default=None)
    readiness.add_argument("--no-write", action="store_true")
    readiness.set_defaults(func=run_readiness)

    privacy = sub.add_parser("privacy-review", help="extract local review frames and write privacy_review.md")
    privacy.add_argument("out_dir", help="existing output directory")
    privacy.add_argument("--video", type=Path, default=None)
    privacy.add_argument("--interval-sec", type=float, default=600.0)
    privacy.add_argument("--max-frames", type=int, default=24)
    privacy.add_argument("--no-extract", action="store_true")
    privacy.set_defaults(func=run_privacy_review)

    package = sub.add_parser("package", help="create local publish metadata and checklist")
    package.add_argument("out_dir", help="existing output directory")
    package.add_argument("--target", choices=["youtube", "lms", "drive"], default="youtube")
    package.add_argument("--publish-dir", type=Path, default=None)
    package.add_argument("--copy-media", action="store_true")
    package.set_defaults(func=run_package)

    cont = sub.add_parser("continue", help="continue safe local video work until a human gate")
    cont.add_argument("out_dir", help="existing output directory")
    cont.add_argument("--target", choices=["youtube", "lms", "drive"], default="youtube")
    cont.add_argument("--publish-dir", type=Path, default=None)
    cont.add_argument("--copy-media", action="store_true")
    cont.add_argument("--video", type=Path, default=None)
    cont.add_argument("--interval-sec", type=float, default=600.0)
    cont.add_argument("--max-frames", type=int, default=24)
    cont.add_argument("--no-extract", action="store_true")
    cont.add_argument("--refresh-privacy", action="store_true")
    cont.add_argument("--refresh-package", action="store_true")
    cont.set_defaults(func=run_continue)

    youtube_upload = sub.add_parser("youtube-upload", help="plan or perform an approved YouTube upload")
    youtube_upload.add_argument("out_dir", help="existing output directory")
    youtube_upload.add_argument("--client-secrets", type=Path, default=None)
    youtube_upload.add_argument("--token-file", type=Path, default=None)
    youtube_upload.add_argument("--channel-lock-file", type=Path, default=None)
    youtube_upload.add_argument("--privacy-status", choices=["private", "unlisted", "public"], default="private")
    youtube_upload.add_argument("--approve-upload", action="store_true")
    youtube_upload.add_argument("--approve-public", action="store_true")
    youtube_upload.add_argument("--dry-run", action="store_true")
    youtube_upload.add_argument("--force", action="store_true")
    youtube_upload.add_argument("--title", default="")
    youtube_upload.add_argument("--description-file", type=Path, default=None)
    youtube_upload.add_argument("--tags", default="")
    youtube_upload.add_argument("--category-id", default="27")
    youtube_upload.add_argument("--made-for-kids", choices=["yes", "no"], default=None)
    youtube_upload.add_argument("--contains-synthetic-media", choices=["yes", "no"], default=None)
    youtube_upload.add_argument("--notify-subscribers", action="store_true")
    youtube_upload.add_argument("--upload-captions", action="store_true")
    youtube_upload.add_argument("--caption-file", type=Path, default=None)
    youtube_upload.set_defaults(func=run_youtube_upload)

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
