---
name: lecture-privacy-review
description: Review local lecture videos before publishing for student information, notifications, browser tabs, participant names, and other screen-exposure risks.
---

# Lecture Privacy Review

Use this skill when the user asks to check a Zoom class recording, edited master,
screenshare video, or lecture export for privacy or accidental screen exposure before
publishing. This is a review and reporting skill; do not mutate the video unless the
user separately asks for redaction or masking.

## Core Rules

- Keep all media local. Do not send frames, audio, or full transcripts to external APIs.
- Review the edited master when it exists. Use the source recording only when the risk
  is about something cut out or when the master is missing.
- Produce a concise risk report with timestamps, frame image paths, risk labels, and
  recommended action.
- For education content, treat student names, faces, chat messages, email addresses,
  account IDs, file paths, grades, and attendance lists as sensitive.

## What To Inspect

- First 30 seconds, final 30 seconds, and every cut boundary.
- Regular interval samples across the full video.
- Frames around screen-share transitions, browser switches, notification popups, chat
  panels, participant panels, and desktop/file explorer views.
- Subtitle and transcript text for names, emails, phone numbers, meeting links, or
  student-identifying phrases.

## Local Review Approach

Use local tools such as `ffprobe` and `ffmpeg` to extract frames. If OCR is available
locally, it may be used, but visual sampling plus human-readable frame contact sheets
is acceptable and often safer.

Suggested output structure:

```text
review/
  privacy_frames/
  privacy_contact_sheet.jpg
  privacy_review.md
```

`privacy_review.md` should group findings by severity:

- **Blocker**: do not publish until fixed.
- **Review**: user should inspect before publishing.
- **Clear**: sampled and no issue found.

## Redaction Boundary

If the user asks to fix findings, propose a redaction plan first. Prefer precise local
masking, trimming, or re-rendering from the master timeline. Never overwrite the source
or approved master; write a new redacted export.
