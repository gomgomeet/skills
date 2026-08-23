# 줌 수업 후 영상 편집 에이전트

`agent.py`는 기존 `lecture-video-editor` 스크립트 위에 감지, 상태 저장, 승인 게이트를
얹은 로컬 실행용 래퍼다. 원본 영상은 수정하지 않고, 분석과 렌더링은 모두 로컬에서
진행한다.

## 빠른 점검

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py doctor
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py skills
```

`ffmpeg`, `ffprobe`, Python, `faster-whisper`, `lecture-video-editor` 스크립트를 확인한다.
`skills`는 에이전트에 적용된 보조 스킬과 사용 지점을 보여준다.

## 1. 녹화 폴더 분석

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py prepare "C:\Users\<사용자>\Documents\Zoom\<수업 폴더>"
```

결과는 녹화 폴더 안의 `_lve_output`에 생성된다.

- `edl.md`: 사용자가 확인할 컷 리스트
- `edl.json`: 렌더링에 사용할 편집 결정
- `logs/job_state.json`: 현재 작업 상태

## 2. 컷 리스트 수정

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py replan "<수업 폴더>\_lve_output" --keep-cuts 3,7
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py replan "<수업 폴더>\_lve_output" --confirm-cuts 5
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py replan "<수업 폴더>\_lve_output" --min-silence 2.0
```

## 3. 자막과 대본 생성

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py transcribe "<수업 폴더>\_lve_output" --approve-cuts --model medium
```

기본 모델은 `large-v3`이지만, 첫 실행 다운로드와 메모리 부담을 줄이려면 `medium`으로
시작하는 편이 좋다.

## 4. 마스터 렌더

대본을 만들지 않은 경우:

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py render "<수업 폴더>\_lve_output" --approve-cuts --preset master
```

대본과 자막을 만든 경우에는 `final_script.md`를 검수한 뒤 승인 플래그를 추가한다.

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py render "<수업 폴더>\_lve_output" --approve-cuts --approve-script --preset master
```

## 5. 줌 폴더 감시

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py watch "C:\Users\<사용자>\Documents\Zoom"
```

새 녹화 폴더가 생기고 영상 파일 크기가 일정 시간 동안 변하지 않으면 자동으로
`prepare`까지만 실행한다. 렌더링은 컷 승인 뒤에 별도로 실행한다.

## 6. 게시 전 검수와 패키징

이미 완성본이 있는 출력 폴더는 바로 게시 준비 상태를 점검할 수 있다.

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py readiness "<출력 폴더>"
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py privacy-review "<출력 폴더>"
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py package "<출력 폴더>" --target youtube
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py continue "<출력 폴더>" --target youtube
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py youtube-channel-lock --channel-id UC... --youtube-user-id "<YouTube 계정 표시값>"
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py youtube-upload "<출력 폴더>" --dry-run --privacy-status private
```

- `readiness`: 마스터 영상, 렌더 드리프트, 자막, 분할본, 챕터, 개인정보 검수,
  게시 패키지의 누락 상태를 `review/readiness_report.md`로 정리한다.
- `privacy-review`: 영상 프레임을 로컬로 추출하고, 자막/대본에서 이메일, 전화번호,
  Zoom 링크, 명단 관련 키워드를 찾아 `review/privacy_review.md`를 만든다.
  contact sheet를 사람이 확인한 뒤 공개 가능하면 보고서의 `CLEAR_FOR_PUBLISH: no`를
  `CLEAR_FOR_PUBLISH: yes`로 바꾼다.
- `package`: 원본 영상을 복사하지 않고 경로를 참조한 채 `publish/metadata.md`,
  `publish/upload-checklist.md`, `publish/agent-tickets.md`를 만든다. 영상까지 복사하려면
  `--copy-media`를 명시한다.
- `continue`: 개인정보 검수와 게시 패키지 중 빠진 작업을 자동으로 진행하고,
  `review/readiness_report.md`를 갱신한 뒤 사람 승인 게이트에서 멈춘다.
- `youtube-channel-lock`: 업로드 대상 YouTube 채널 ID와 사용자 표시값을
  `%USERPROFILE%\.opencodex\youtube_channel_lock.json`에 저장한다.
- `youtube-upload`: YouTube 업로드 계획을 만들고, OAuth client secrets,
  고정 채널 일치, `--approve-upload`가 모두 있을 때만 외부 업로드를 실행한다.

실제 업로드 전 점검:

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py youtube-doctor
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py youtube-channel-lock --channel-id UC... --youtube-user-id "<YouTube 계정 표시값>"
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py youtube-upload "<출력 폴더>" --dry-run --privacy-status private
```

실제 업로드 예시:

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py youtube-upload "<출력 폴더>" `
  --client-secrets "<local client_secrets.json>" `
  --privacy-status unlisted `
  --made-for-kids no `
  --contains-synthetic-media no `
  --chunk-size-mb 64 `
  --max-upload-retries 10 `
  --approve-upload
```

## 상태 흐름

```text
prepare
  -> waiting_for_cut_approval
transcribe --approve-cuts
  -> waiting_for_script_approval
render --approve-cuts [--approve-script]
  -> completed
privacy-review
  -> privacy_review_ready
package
  -> publish_package_ready
continue
  -> waiting_for_human_gate | ready_for_publish_decision
youtube-upload --approve-upload
  -> youtube_uploaded
```

안전장치:

- 컷 승인 없이는 전사 보정이나 렌더링을 실행하지 않는다.
- `final_script.md`가 있으면 대본 승인 없이는 렌더링하지 않는다.
- 각 단계의 stdout/stderr는 `_lve_output/logs/*.json`에 남는다.
- 개인정보 검수와 게시 패키징은 로컬 파일만 만들며 업로드는 수행하지 않는다.
- YouTube 업로드는 `--approve-upload`, OAuth 설정, 고정 채널 일치 없이는 실행하지 않는다.
- YouTube 업로드는 기본 64MB 청크와 지수 백오프 재시도로 긴 강의 파일의
  일시적 네트워크 실패를 복구한다.

## 적용된 보조 스킬

- `lecture-privacy-review`: 업로드 전 프레임 샘플과 민감 텍스트 점검을 별도 보고서로 분리
- `lecture-publish-packager`: 자막, 챕터, 메타데이터, 체크리스트 패키징
- `lecture-youtube-uploader`: 승인된 게시 패키지를 고정된 YouTube 채널로만
  업로드하되 OAuth, 공개 범위, 아동 대상 여부, 합성 콘텐츠 여부를 명시 승인으로 통제
- `grill-me / grill-with-docs`: 게시 준비 단계에서 남은 질문과 블로커를 강하게 드러냄
- `domain-modeling`: `waiting_for_cut_approval`, `privacy_review_ready`,
  `publish_package_ready`처럼 상태와 승인 게이트를 명시
- `to-spec / to-tickets`: `readiness_report.md`와 `agent-tickets.md`에 다음 작업과
  blocking edge를 남김
