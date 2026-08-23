---
name: lecture-publish-packager
description: Package an approved lecture master video for YouTube, LMS, or drive sharing with subtitles, chapters, filenames, metadata, and a publish checklist.
---

# Lecture Publish Packager

Use this skill after an edited lecture master exists and the user wants publishing
materials, LMS upload files, YouTube metadata, Drive-ready folders, or a final handoff
package. This skill packages local artifacts; it does not upload unless the user
explicitly asks and an appropriate connected service is available.

## Inputs

Prefer a single `_lve_output` folder containing:

- `master/*_master.mp4`
- `subtitles/master.srt`
- `final_script.md`
- `render_master_log.json`
- optional `privacy_review.md`

If there are multiple master videos, ask or infer from the latest render log.

## Package Contents

Create a `publish/` folder with the requested target outputs:

```text
publish/
  video/
  subtitles/
  transcript/
  thumbnails/
  metadata.md
  upload-checklist.md
```

For YouTube-style publishing, prepare:

- cleaned title candidates
- description draft
- chapter timestamps
- tags or keyword groups
- pinned comment draft when useful
- SRT file path
- thumbnail candidate frame paths

If `lecture-title-hook-writer` is available, generate or read
`publish/title_hooks.md` after the full-video review and before treating
`metadata.md` title candidates as upload-ready.
If `lecture-visual-design-director` is available, generate or read
`publish/visual_design.md` after title hooks and before final upload checks so
thumbnail, intro card, overlay, and representative-frame direction match the
approved title.

For LMS or Drive-style sharing, prepare:

- stable filename using date, class, topic, and part number
- subtitle and transcript companion files
- short learner-facing summary
- teacher-facing upload checklist

## Safety Gate

Before packaging for public or semi-public publishing, check whether a privacy review
exists. If it does not, tell the user clearly that privacy review is recommended before
uploading student-facing or public content.

## Upload Boundary

Do not upload, email, or share files by default. If the user requests an upload, prefer
a connected plugin or official CLI/API. Confirm destination, visibility, and whether
the content may leave the local machine before moving any media file.
