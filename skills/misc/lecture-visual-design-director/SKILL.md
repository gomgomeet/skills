---
name: lecture-visual-design-director
description: Create OpenDesign-informed visual direction for lecture video thumbnails, intro cards, overlays, representative frames, and short-clip handoff after title hooks and chapter review.
---

# Lecture Visual Design Director

Use this skill after `lecture-title-hook-writer` and before publish packaging
when a lecture video needs thumbnail, title-card, overlay, representative-frame,
or short-clip direction.

This skill adapts useful OpenDesign patterns for local lecture editing:

- `video-hyperframes`: turn a segment into hook, proof, recap, and CTA frames.
- `youtube-clipper`: identify highlight/short-clip candidates from local
  chapters and subtitles, not from external downloads.
- `chat-motion-overlay`: create transparent, transcript-driven callouts without
  exposing student names, chat screenshots, or private messages.
- `vfx-text-cursor`: use cursor/text reveal effects only with real lecture
  wording or approved title copy.
- `brand-extract`, `color-expert`, `creative-director`, and `design-brief`:
  define audience, visual posture, information density, motion tone, palette,
  and anti-patterns before making assets.

Relevant source references:

- https://github.com/nexu-io/open-design/tree/main/skills/video-hyperframes
- https://github.com/nexu-io/open-design/tree/main/skills/youtube-clipper
- https://github.com/nexu-io/open-design/tree/main/skills/chat-motion-overlay
- https://github.com/nexu-io/open-design/tree/main/skills/vfx-text-cursor
- https://github.com/nexu-io/open-design/tree/main/skills/brand-extract

## Timing

- Run after the edited video, chapters, privacy review, and title hooks have
  been inspected enough to know each segment's actual promise.
- Produce or update `publish/visual_design.md` before `publish/metadata.md` and
  `publish/upload-checklist.md` are treated as final.
- For `continue`, run this after `hook-title` and before `package`.

## Inputs To Inspect

Prefer local artifacts in this order:

1. `publish/title_hooks.md` for the approved upload title and two-line screen
   layout.
2. Chapter files, split logs, subtitles, or transcripts for actual teaching
   flow.
3. `review/privacy_review.md` and contact sheets for visibility constraints.
4. Existing brand kit, channel style guide, or user-provided reference assets.
5. Video filenames only as supporting context.

Keep lecture media local. Do not upload frames, screenshots, student chat, or
private screen content to external design services unless the user explicitly
approves that transfer.

## Output

Write:

```text
publish/visual_design.md
```

Include:

- a one-line design read: audience, content posture, visual posture, motion
  posture, and information density;
- global visual tokens or clearly marked provisional tokens when no brand kit is
  available;
- per-segment thumbnail phrase, small label, two title lines, representative
  proof frame, overlay notes, and recap/CTA frame;
- short-clip guidance when a segment contains a self-contained moment;
- preflight checks for privacy, contrast, mobile thumbnail readability, and
  promise/content alignment.

## Visual Rules

- Upload titles stay one line. Thumbnail and intro text use a small label plus
  two large lines.
- A frame should carry one concept or one operation. Do not cram a chapter list
  into a title card.
- Use real screen moments or final results as proof frames. Avoid generic
  decorative backgrounds when the viewer needs to understand a tool workflow.
- Overlays must not cover the demonstrated UI, duplicate captions, or reveal
  participant/chat/private information.
- Use measured brand colors and fonts when a brand source exists. If not, mark
  tokens as provisional and keep contrast high.
- Avoid generic AI-purple gradients, empty cards, stock-like abstraction, and
  motion that slows the lesson.

## Boundaries

- This skill creates direction and local planning files. It does not render
  thumbnails, create Remotion assets, or upload anything by itself.
- Do not invent quotes, testimonials, student questions, or brand facts.
- Do not treat OpenDesign catalogue entries as permission to install third-party
  uploaders or send local lecture media out of the machine.
