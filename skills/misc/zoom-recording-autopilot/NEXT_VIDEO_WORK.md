# Next Video Work Handoff

Date prepared: 2026-08-23
Target continuation date: 2026-08-24

## Current Stop Point

The Zoom lecture editing agent and supporting skills are ready for the next
publishing pass.

Completed before stopping:

- Segment-only upload strategy selected; full lecture masters should not be
  uploaded by default.
- Hook-title generation was added to the agent flow and should run after full
  segment review.
- Visual direction was added after title hooks and before packaging.
- Local thumbnail, proof-frame, and intro-card assets were generated from
  `visual_design.md` for the prepared segment queue.
- YouTube upload remains stopped; no external upload was performed at this
  checkpoint.

Local handoff artifacts, outside this repository:

- `%USERPROFILE%\Videos\_lve\_upload_ready\youtube_upload_queue.json`
- `%USERPROFILE%\Videos\_lve\_upload_ready\visual_assets_manifest.json`
- `%USERPROFILE%\Videos\_lve\_upload_ready\thumbnail_intro_assets.md`

## Tomorrow's Order Of Work

1. Review the generated asset summary.
   - Confirm that every queued segment has a proof frame, 1280x720 thumbnail,
     1920x1080 thumbnail, and 1920x1080 intro card.
   - Check the first and last segment in each lecture group visually.

2. Check title and card fit.
   - Keep upload titles as one-line metadata titles.
   - Keep thumbnail and intro-card titles as a small label plus two large lines.
   - Revise any title that promises more than the segment actually teaches.

3. Confirm publish readiness.
   - Use segment videos only.
   - Re-check privacy review notes before upload.
   - Confirm `made_for_kids` and synthetic-media answers before any real upload.

4. Prepare private YouTube uploads.
   - Use the locked YouTube channel only.
   - Start with dry-run upload plans when metadata or readiness is uncertain.
   - Upload only private videos unless a separate public approval is given.

5. Record the result.
   - Update each publish folder with upload result JSON only after a successful
     upload.
   - Keep failed upload errors with the matching segment so the retry can resume
     safely.

## Stop Conditions

Stop and ask for review if:

- A generated thumbnail exposes private browser tabs, chat, student names, or
  unrelated personal information.
- A title does not match the actual segment content.
- The OAuth-authenticated channel does not match the locked channel.
- YouTube returns quota, verification, or authorization errors.
- The video file is a full lecture master instead of a finished segment clip.

## Useful Agent Commands

These examples use placeholders because local paths and account identifiers
should stay outside the shared skill repository.

```powershell
python .\scripts\agent.py visual-design "<output folder>" --queue-file "<queue json>" --parts-only
```

```powershell
python .\scripts\agent.py youtube-upload "<output folder>" `
  --video-file "<output folder>\parts\<segment>.mp4" `
  --privacy-status private `
  --made-for-kids no `
  --contains-synthetic-media no `
  --dry-run
```

```powershell
python .\scripts\agent.py youtube-upload "<output folder>" `
  --video-file "<output folder>\parts\<segment>.mp4" `
  --privacy-status private `
  --made-for-kids no `
  --contains-synthetic-media no `
  --approve-upload
```
