---
name: lecture-title-hook-writer
description: Create hook-focused Korean YouTube title candidates for lecture videos after the full edited video, transcript, chapters, or privacy review has been inspected.
---

# Lecture Title Hook Writer

Use this skill when a lecture video needs a stronger YouTube title, especially
after editing, privacy review, full-video review, or before packaging/upload.

## Timing

- Run this immediately after the whole edited video has been reviewed enough to
  know its actual teaching arc: privacy contact sheet, transcript, chapters,
  split log, final script, or a full manual review.
- Do not finalize a title before reviewing the full content. Early working
  titles may be placeholders only.
- Produce or update `publish/title_hooks.md` before `publish/metadata.md` is
  treated as ready for upload.

## Inputs To Inspect

Prefer local artifacts in this order:

1. Part-specific title/description notes already written by the user.
2. Chapter files and split logs that show the teaching sequence.
3. Final script, transcript, or subtitle files.
4. Privacy/readiness reports for context about what was actually checked.
5. The video filename and duration as supporting context, not as the main basis.

Keep media local. Do not send the lecture video or audio to external services.

## Title Criteria

Good lecture titles should make the viewer immediately see:

- the learner level or audience, such as `왕초보`, `교사`, `수업 준비`;
- the concrete outcome, not only the tool name;
- the strongest topic from the video, based on what the video actually covers;
- the part number when the upload is one segment in a sequence.

Use a hook, but avoid clickbait. Do not promise results the video does not show.
Avoid vague titles such as `노션 강의 1부` unless paired with a clear outcome.

## Title Creation Method

Create titles in this order:

1. Extract the concrete viewer outcome from the full reviewed video.
2. Identify the audience or level: `왕초보`, `교사`, `수업 준비`, or another
   real audience visible from the content.
3. Choose the strongest topic from the actual chapters, not from the filename.
4. Generate at least three angles:
   - Searchable: clear topic and expected lesson.
   - Outcome-led: what the viewer can do after watching.
   - Curiosity-led: a useful tension or misconception without exaggeration.
5. Score candidates by accuracy, click reason, search keyword strength, beginner
   friendliness, and clickbait risk.
6. Pick one recommended upload title and keep the best alternatives.

## Upload Title vs Screen Layout

Separate the YouTube metadata title from the visual title used in thumbnails,
intro cards, or end screens:

- **Upload title:** one-line title for YouTube metadata. Keep the most important
  words at the front, with series/part information at the end when needed.
- **Screen layout:** split the same idea into a clean visual hierarchy.

Preferred screen layout:

```text
Small label: 노션 왕초보 1부
Line 1: 노션 첫 페이지 만들기
Line 2: 블록부터 수업일지까지
```

Do not put `[노션 왕초보 1부]` as large text at the end of the title card.
Use it as a small label above or beside the main title. The two large lines
should carry the promise: first the outcome, then the scope or path.

## Output

Write concise Korean title candidates with short rationale:

```text
publish/title_hooks.md
```

Include:

- a recommended title;
- 5-8 alternatives grouped by angle when useful;
- title rationale in one sentence;
- a screen layout with `label`, `line 1`, and `line 2`;
- a thumbnail phrase that is shorter than the title and matches the promise;
- required follow-up checks, such as playlist link, part number, or thumbnail
  wording that should match the title.

When an upload command needs a title, use the recommended title only after it
has been checked against the actual video segment being uploaded.
