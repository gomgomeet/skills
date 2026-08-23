# PR Summary: Zoom Lecture Agent Publishing Flow

## Summary

This branch upgrades the local Zoom lecture workflow from an editing helper into
a publish-preparation agent for Korean lecture videos.

The branch adds:

- a Zoom recording autopilot skill and local agent script;
- privacy review guidance before publishing;
- publish packaging guidance for metadata, subtitles, chapters, and checklists;
- hook-focused Korean YouTube title guidance;
- OpenDesign-informed visual direction for thumbnails, intro cards, overlays,
  representative frames, and short-clip handoff;
- YouTube upload planning and guarded private-upload support through the
  official YouTube Data API.

## Publishing Policy

- Work with finished segment videos by default, not full lecture masters.
- Keep lecture media local unless the user explicitly approves an external
  upload.
- Require readiness checks before upload.
- Lock YouTube uploads to the intended channel before any real upload.
- Require separate public approval for public uploads.

## Local Follow-Up State

The user's local machine has prepared visual assets for the current segment
queue. Those generated media files are intentionally not committed to this
skills repository.

Local continuation files:

- `%USERPROFILE%\Videos\_lve\_upload_ready\youtube_upload_queue.json`
- `%USERPROFILE%\Videos\_lve\_upload_ready\visual_assets_manifest.json`
- `%USERPROFILE%\Videos\_lve\_upload_ready\thumbnail_intro_assets.md`

## Verification

Checks run during the branch work:

- Python compile check for the Zoom lecture agent script.
- Skill validation script for the added and updated lecture skills.
- Secret scan of the pending diff before commit.
- Local visual asset generation check for the prepared segment queue.
- Dimension check for generated 1280x720 thumbnails, 1920x1080 thumbnails, and
  1920x1080 intro cards.

## Not Included

- No lecture videos are committed.
- No generated thumbnails or intro cards are committed.
- No OAuth client secrets, refresh tokens, access tokens, or channel-specific
  credentials are committed.
- No real YouTube upload is included in the repository change.

## Suggested Merge Note

Merge this branch after confirming that the skill repository should carry the
lecture publishing workflow. Continue local video work from
`misc/zoom-recording-autopilot/NEXT_VIDEO_WORK.md`.
