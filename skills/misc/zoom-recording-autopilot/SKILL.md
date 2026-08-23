---
name: zoom-recording-autopilot
description: Set up or operate a local Zoom recording watcher that prepares lecture-editing jobs after class without rendering until the user approves cuts.
---

# Zoom Recording Autopilot

Use this skill when the user wants Zoom class recordings to be detected after a lesson,
queued for analysis, or prepared automatically for the lecture editing pipeline. This
skill coordinates the watcher and approval gates; use `lecture-video-editor` for the
actual cut analysis and rendering behavior.

## Boundaries

- Keep video and audio files local. Do not upload recordings to external services.
- Do not render a final edited video merely because a new recording appeared.
- Stop after `prepare` unless the user explicitly approves the cut list.
- Treat cloud recording downloads, account APIs, or third-party storage as separate
  actions that require explicit user authorization.

## Workflow

1. Locate this skill folder and check dependencies with its local agent script:

   ```powershell
   python .\scripts\agent.py doctor
   ```

2. For one recording folder, run:

   ```powershell
   python .\scripts\agent.py prepare "<Zoom recording folder>"
   ```

3. For ongoing monitoring, watch the parent Zoom directory:

   ```powershell
   python .\scripts\agent.py watch "C:\Users\<user>\Documents\Zoom"
   ```

4. Tell the user where to review `edl.md`. If the user asks to modify cuts, use
   `replan` with `--keep-cuts`, `--confirm-cuts`, `--min-silence`, or `--pad`.

5. Render only after approval:

   ```powershell
   python .\scripts\agent.py render "<recording>\_lve_output" --approve-cuts
   ```

## Recording Completion Rules

Zoom may still be converting the recording after the meeting ends. A folder is ready
only when at least one MP4 exists and its size and modified time remain stable for the
configured stability window. Prefer a local drive for the watched folder; cloud-synced,
external, or network folders can cause partial or failed conversions.

## Status And Recovery

Each job keeps state in `_lve_output/logs/job_state.json`. Use `summary` before reruns:

```powershell
python .\scripts\agent.py summary "<recording>\_lve_output"
```

If a step fails, inspect `_lve_output/logs/*.json` and add a short note to the relevant
`TROUBLESHOOTING.md` before trying a new diagnosis.
