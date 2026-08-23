---
name: work-closeout-publisher
description: Finish a repo task by writing markdown handoff and PR summaries, then safely committing, merging, and pushing when the user asks for closeout.
---

# Work Closeout Publisher

Use this skill when the user asks to wrap up a work session with markdown
documentation, PR summary cleanup, commit, merge, and push. Korean requests such
as "업무 마무리", "md/pr 정리", "커밋 및 머지 푸쉬", or "내일 이어서 할 일 정리" are in scope.

## Outcome

Leave the repository in a clear end-of-task state:

- a markdown handoff or next-work note exists when there is follow-up work;
- a PR summary, release note, or merge note exists where the repo expects it;
- only intended changes are committed;
- merge and push happen only when explicitly requested and the branch state is
  safe;
- the final response names the commit, branch, pushed refs, verification, and
  anything intentionally left undone.

## Closeout Workflow

1. Identify the active repo, current branch, target branch, remote, and dirty
   files before editing. Work with existing user changes; do not revert or
   overwrite unrelated work.
2. Read existing docs, PR templates, changeset conventions, and nearby feature
   folders before deciding where markdown belongs. Prefer established paths over
   inventing a new documentation layout.
3. Write the minimum useful markdown:
   - handoff/next-work note: current stop point, local artifacts, next order of
     work, stop conditions, and useful commands;
   - PR summary: summary, changed files or capabilities, verification, risks,
     not included, and merge note;
   - keep local-only or sensitive values as placeholders such as
     `%USERPROFILE%`, `<queue json>`, `<channel id>`, or `<output folder>`.
4. Before committing, inspect the diff and run cheap checks:
   - `git diff --check`;
   - a focused secret scan for tokens, OAuth secrets, private keys, account IDs,
     and local credential files;
   - project-specific validation or tests when the touched files warrant it.
5. Stage only files that belong to the closeout. If there are unrelated dirty
   files, leave them unstaged and mention them.
6. Commit with a concise message that describes the closeout artifact or final
   task state.
7. If the user asked to merge, fetch the target remote and compare branches.
   Prefer a fast-forward merge into the target branch. Stop instead of forcing
   when branches diverge, conflicts appear, checks fail, or the target branch is
   protected in a way that requires a hosted PR flow.
8. If the user asked to push, push the exact refs that were updated and verify
   with `git status --short --branch`, `git branch -vv`, or a short log.

## PR Handling

If a GitHub, GitLab, or CLI PR tool is available and the user specifically asks
to update a hosted PR, update the PR body or comment from the local summary.
Otherwise, create or update a local PR markdown file and report that no hosted
PR was modified.

Do not invent PR URLs, issue numbers, reviewers, approval status, or CI results.

## Safety Boundaries

- Do not include generated media, lecture recordings, OAuth client secrets,
  refresh tokens, access tokens, private keys, or personal credential paths in a
  committed closeout document.
- Do not run `git reset --hard`, `git clean`, force-push, delete branches, or
  rewrite history unless the user explicitly requests that exact operation.
- Do not merge if the worktree is dirty with unrelated changes that could be
  swept into the merge result.
- Do not treat "commit" as permission to push, or "push branch" as permission to
  merge into the target branch. Each external mutation should match the user's
  request.

## Final Report

Keep the final response compact. Include:

- markdown files created or updated;
- commit hash and message;
- merge result and target branch, if performed;
- pushed refs, if performed;
- validation that passed or could not be run;
- next manual step, only when something remains.
