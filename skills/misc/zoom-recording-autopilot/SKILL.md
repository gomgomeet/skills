---
name: zoom-recording-autopilot
description: Set up or operate a local Zoom recording watcher that prepares lecture-editing jobs after class without rendering until the user approves cuts.
---

# Zoom Recording Autopilot

Use this skill when the user wants Zoom class recordings to be detected after a lesson,
queued for analysis, or prepared automatically for the lecture editing pipeline. This
skill coordinates the watcher and approval gates; use `lecture-video-editor` for the
actual cut analysis and rendering behavior. After an approved master exists, this skill
can also hand off to local privacy review and publish packaging commands.

## Boundaries

- Keep video and audio files local. Do not upload recordings to external services.
- Do not render a final edited video merely because a new recording appeared.
- Stop after `prepare` unless the user explicitly approves the cut list.
- Do not upload, email, or share publish packages by default.
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

6. Once a master or full-video output exists, continue with the applied post-edit
   skills:

   ```powershell
   python .\scripts\agent.py readiness "<output folder>"
   python .\scripts\agent.py privacy-review "<output folder>"
   python .\scripts\agent.py package "<output folder>" --target youtube
   python .\scripts\agent.py continue "<output folder>" --target youtube
   python .\scripts\agent.py youtube-upload "<output folder>" --dry-run --privacy-status private
   ```

   `readiness` stress-tests missing gates, `privacy-review` creates local frame and
   sensitive-text review artifacts, and `package` writes metadata/checklist files
   without copying large media unless `--copy-media` is explicit. `continue` runs the
   safe missing post-edit steps automatically and then stops at the human approval gate.
   `youtube-upload` writes a plan by default and performs the external upload only with
   OAuth credentials and explicit `--approve-upload`.

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
