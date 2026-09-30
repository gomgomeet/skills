---
name: notion-feedback-writer
description: Write per-student feedback into a Notion database property. Use when the user points at a Notion database or view and asks to record feedback for students (학생별 피드백, 댓글 활동 피드백, 의견쓰기 피드백, 세특 초안), and whenever Korean text written to Notion needs proofreading after the write.
---

# Notion Feedback Writer

Use this skill when the user points at a Notion database or view and asks to write
feedback into a property: 학생별 피드백, 댓글 활동 피드백, 의견쓰기 피드백, 활동 내용
피드백, 세특 초안, and similar. It covers reading the student work, resolving which
student each row belongs to, writing the feedback, and verifying the written text.

The non-negotiable part is the last step. Korean text can arrive in Notion corrupted
even when the write returns success. A write that has not been read back is not done.

## Core Rules

- Never report the work finished until you have re-read every value you wrote and
  proofread it character by character.
- Write only into the property the user named. Student records are not a place to
  improvise a different target.
- Resolve student identity from a relation or an account identifier, never from a
  free-text field the student typed.
- Leave a row blank when the student submitted nothing. Blank is information.
- Never guess an identity you cannot confirm. Report the unresolved rows instead.

## Workflow

### 1. Open the database, not just the page

Fetch the database to get its data source URL and the exact property names. Property
names carry spaces and underscores that must match exactly (`사회 댓글활동 피드백`,
`의견쓰기_피드백`, `활동 내용_피드백`). A view URL also works and gives the filtered
row set the user is actually looking at.

### 2. Read the student work

Query rows for the source columns. If the property values are empty, the student work
may live somewhere else:

- Notion comments on the page (fetch with `include_discussions`, then read the threads
  with `include_all_blocks` and `include_resolved` set).
- A related database reachable through a relation property.
- Page body content rather than properties.

Check all three before concluding a student did not participate.

### 3. Resolve who wrote what

Ranked from most to least reliable:

1. A relation property pointing at the roster row.
2. The comment author account or email (`...d250016@...` mapping to roster number 16).
3. A number property the teacher maintains.
4. A title or text field the student typed. **Treat this as a hint only.**

Cross-check at least two signals. Students mistype their own names and numbers, and
they pick the wrong name from relation pickers. When signals disagree, prefer the
relation, and say so in your report.

Corroborating evidence inside the work itself is legitimate: a comment naming a
classmate ("소담이의 의견처럼") confirms who the previous commenter was.

### 4. Draft the feedback

Default form is 칭찬 + 다음 단계, two to three sentences:

- Quote a short phrase of the student's own writing, so the feedback is clearly about
  their work and not a template.
- Name the specific thinking move they made (근거 제시, 기사 간 연결, 반대 관점,
  경험 연결, 조건부 판단).
- Close with one concrete next step, not a general exhortation.

Confirm the form with the user before a large batch if they have not specified one.

### 5. Write in small batches

Write four or five rows, then verify before continuing. Do not write forty values and
verify at the end; you will rewrite all forty.

### 6. Verify and proofread

Re-read what you wrote with a query that returns the full text, then proofread it.
This step catches real corruption. Observed failure patterns, all from writes that
returned success:

| Written | Arrived |
|---|---|
| 축제를 | 옥제를 |
| 좋겠습니다 | 좋겚습니다 |
| 스스로 | 스실로 |
| 청소년 | 음소년 |
| 살펴보는 | 살해보는 |
| 국민이니까 | 국밑이니까 |
| 써 보면 | 썼 보면 |
| 뽑아야 | 등아야 |

Proofreading checklist:

- Read every sentence for a syllable that is not a word. Corruption produces plausible
  looking but nonexistent syllables, so scanning for "looks Korean" is not enough.
- Verify quoted student phrases match the source text exactly.
- Check verb endings (밝히고 not 밝혀 하고, 쓸 때 not 썰 때).
- Check the student's name and number.

### 7. Fix by rewording, not by retrying

Re-sending the same word usually reproduces the same corruption. Replace the damaged
word with a synonym you have already seen render correctly in this session:

- 토론 → 서로 이야기를 나누는
- 쉬는 시간 → 놀이 시간
- 적응 → 익숙해지다
- 분명히 → (drop it)
- 아쉽다 → (drop the clause)

Build on vocabulary that already verified clean. Shorter sentences with common words
corrupt less often than long ones with rare syllables.

## Reporting

Tell the user:

- Which database and property you wrote to, with a link.
- How many rows you filled and how many you left blank, and why.
- Any row whose student you could not identify, with the text so they can assign it.
- Two or three students worth their attention, with what the student actually did.

## What Not To Do

- Do not write to a different database because the named one is unreachable. Report the
  access problem and ask.
- Do not fill in non-participants with placeholder text.
- Do not claim a batch is verified when you checked a sample.
