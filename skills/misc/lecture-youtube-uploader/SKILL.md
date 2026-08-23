---
name: lecture-youtube-uploader
description: Upload an approved local lecture publish package to YouTube with explicit OAuth, visibility, audience, and upload approval gates.
---

# Lecture YouTube Uploader

Use this skill when the user wants an approved lecture video package uploaded to
YouTube. This skill starts after `lecture-publish-packager`: it expects a local
output folder with a full/master video, `publish/metadata.md`, an upload checklist,
and a passed privacy/readiness gate.

## Boundaries

- Do not upload by default. First create or show the upload plan.
- Upload only after explicit user approval of destination, visibility, audience,
  and whether captions should be uploaded.
- Keep OAuth files local. Never commit or print `client_secrets.json`, access tokens,
  or refresh tokens.
- Use `private` as the safest visibility unless the user explicitly chooses
  `unlisted` or `public`. Public upload requires a separate explicit confirmation.
- Do not claim that a video is public if the YouTube API project is unaudited:
  YouTube may restrict uploads from unverified API projects created after
  2020-07-28 to private viewing.
- Caption upload is optional and separate from video upload.

## YouTube API Facts To Preserve

- Video upload uses YouTube Data API `videos.insert` with OAuth and media upload.
- The narrow video upload scope is
  `https://www.googleapis.com/auth/youtube.upload`.
- Caption upload uses `captions.insert`, costs more quota than the video insert,
  and requires `https://www.googleapis.com/auth/youtube.force-ssl` or partner scope.
- `videos.insert` supports setting `status.privacyStatus`,
  `status.selfDeclaredMadeForKids`, and `status.containsSyntheticMedia`.
- Resumable uploads are preferred for large lecture files.

Official references:

- https://developers.google.com/youtube/v3/guides/uploading_a_video
- https://developers.google.com/youtube/v3/docs/videos/insert
- https://developers.google.com/youtube/v3/docs/captions/insert
- https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol

## Workflow

1. Confirm the package is ready:

   ```powershell
   python .\scripts\agent.py continue "<output folder>" --target youtube
   ```

2. Check optional YouTube dependencies:

   ```powershell
   python .\scripts\agent.py youtube-doctor
   ```

3. Create an upload plan without uploading:

   ```powershell
   python .\scripts\agent.py youtube-upload "<output folder>" --dry-run --privacy-status private
   ```

4. Upload only when the user has explicitly approved the upload and the YouTube
   visibility. Require OAuth client secrets from the user's own Google Cloud project:

   ```powershell
   python .\scripts\agent.py youtube-upload "<output folder>" `
     --client-secrets "<local client_secrets.json>" `
     --privacy-status unlisted `
     --made-for-kids no `
     --contains-synthetic-media no `
     --approve-upload
   ```

5. For public uploads, require `--approve-public` as well:

   ```powershell
   python .\scripts\agent.py youtube-upload "<output folder>" `
     --client-secrets "<local client_secrets.json>" `
     --privacy-status public `
     --made-for-kids no `
     --contains-synthetic-media no `
     --approve-upload --approve-public
   ```

6. If captions should be uploaded through the API, add `--upload-captions`.
   This requires broader OAuth scope and may force re-authentication if the stored
   token was created with only the upload scope.

## Stop Conditions

- Stop before upload if readiness gates are not all passing.
- Stop before upload if `--made-for-kids` or `--contains-synthetic-media` is unset.
- Stop before upload if `--client-secrets` is missing.
- Stop before public upload if `--approve-public` is missing.
- Stop after writing `publish/youtube_upload_plan.json` when approval is absent.
