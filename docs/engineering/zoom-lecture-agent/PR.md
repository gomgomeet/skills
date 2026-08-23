# PR: 줌 수업 후 영상 편집 에이전트 MVP

## Summary

- 줌 녹화 폴더를 분석하고 컷 리스트를 제안하는 로컬 에이전트 CLI를 추가했습니다.
- 컷 승인 전 렌더링을 막는 승인 게이트와 작업 상태 파일을 추가했습니다.
- `grill-me`, `domain-modeling`, `to-spec/to-tickets` 패턴을 에이전트의 readiness
  게이트와 다음 작업 티켓으로 적용했습니다.
- 개인정보 검수와 게시 패키징 명령을 추가해 완성본 이후 작업까지 이어지게 했습니다.
- YouTube 업로드 스킬과 `youtube-upload` 실행 게이트를 추가했습니다.
- YouTube 사용자 표시값과 채널 ID를 로컬 잠금 파일로 고정하고, 실제 업로드 전
  OAuth로 인증된 채널 ID가 다르면 업로드를 중단하게 했습니다.
- 인터넷으로 YouTube 업로드 도구와 공식 샘플을 조사한 뒤, 외부 CLI 설치 대신
  공식 Google API Python client의 chunked resumable upload와 지수 백오프 재시도를
  에이전트에 도입했습니다.
- 합성 줌 녹화로 `prepare → replan → render(draft)` 흐름을 검증했습니다.
- 편집 전후 운영을 분리하기 위해 보조 Codex 스킬 3개를 만들고 설치했습니다.

## Changes

### Local Agent

- `skills/misc/zoom-recording-autopilot/scripts/agent.py`
  - `doctor`: `ffmpeg`, `ffprobe`, Python, `faster-whisper`, 기존 `lecture-video-editor` 스크립트 확인
  - `prepare`: 인제스트, 무음/화면정지 분석, 컷 리스트 생성
  - `replan`: 컷 살리기, 확인 필요 컷 승인, 기준 조정
  - `transcribe`: 컷 승인 후 로컬 전사, 컷 보정, SRT/대본 생성
  - `render`: 승인된 컷으로 마스터 렌더
  - `watch`: 줌 녹화 폴더 감시 후 안정화된 녹화만 `prepare`
  - `summary`: 작업 상태 요약
  - `skills`: 에이전트에 적용된 보조 스킬 맵 표시
  - `readiness`: 완성본, 렌더 드리프트, 자막, 분할본, 챕터, 개인정보 검수, 게시 패키지 게이트 점검
  - `privacy-review`: 로컬 프레임 샘플/contact sheet 및 민감 텍스트 스캔 보고서 생성
  - `package`: 업로드 메타데이터, 체크리스트, 다음 작업 티켓 생성
  - `continue`: 누락된 로컬 후속 작업을 자동 실행하고 사람 승인 게이트에서 정지
  - `youtube-doctor`: YouTube 업로드용 선택 의존성 및 OAuth scope 점검
  - `youtube-channel-lock`: YouTube 사용자 표시값과 고정 채널 ID 저장
  - `youtube-upload`: 업로드 계획 생성, 고정 채널 검증, 명시 승인 후 chunked resumable 업로드

### Documentation

- `CONTEXT.md`: 승인 게이트, 개인정보 검수, 게시 패키지 용어 추가
- `docs/engineering/zoom-lecture-agent/README.md`: 실행 방법과 승인 흐름 문서화
- `docs/engineering/zoom-lecture-agent/config.example.json`: 기본 설정 예시
- `docs/engineering/zoom-lecture-agent/TROUBLESHOOTING.md`: 한글 Windows 콘솔 인코딩 문제 기록
- `docs/engineering/zoom-lecture-agent/skill-gap-analysis.md`: 추가 스킬 조사 및 판단 근거
- `zoom-lecture-editing-agent-plan.md`: 설계안과 현재 구현 상태 업데이트

### Candidate Skills

- `skills/misc/zoom-recording-autopilot/SKILL.md`
  - 수업 종료 후 새 녹화 감지 및 `prepare` 자동 실행
- `skills/misc/lecture-privacy-review/SKILL.md`
  - 학생 정보, 참가자 패널, 알림, 브라우저 탭 등 게시 전 노출 검수
- `skills/misc/lecture-publish-packager/SKILL.md`
  - 마스터 영상, 자막, 대본, 챕터, 업로드 체크리스트 패키징
- `skills/misc/lecture-youtube-uploader/SKILL.md`
  - 승인된 게시 패키지를 YouTube로 업로드하되 OAuth, 공개 범위, 아동 대상 여부,
    합성 콘텐츠 여부, 실제 업로드 승인, 고정 채널 검증을 분리

로컬 Codex에는 동일한 스킬을 `C:\Users\이혜경교육대초등영어교육\.codex\skills` 아래에도 설치해 검증했습니다.

## Verification

실행한 검증:

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py doctor
python -m py_compile .\skills\misc\zoom-recording-autopilot\scripts\agent.py
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py prepare "<합성 줌 녹화 폴더>"
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py replan "<합성 줌 녹화 폴더>\_lve_output" --confirm-cuts 3
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py render "<합성 줌 녹화 폴더>\_lve_output" --approve-cuts --preset draft
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py skills
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py privacy-review "<합성 줌 녹화 폴더>\_lve_output" --max-frames 5 --interval-sec 20
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py package "<합성 줌 녹화 폴더>\_lve_output" --target youtube
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py readiness "<합성 줌 녹화 폴더>\_lve_output"
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py continue "<합성 줌 녹화 폴더>\_lve_output" --target youtube
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py youtube-channel-lock --channel-lock-file ".\zoom_lecture_agent_test\youtube_channel_lock.json" --channel-id "UC0000000000000000000000" --youtube-user-id "test@example.com"
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py youtube-upload "<실제 출력 폴더>" --dry-run --privacy-status private --chunk-size-mb 64 --max-upload-retries 10
python "<skill-creator>\scripts\quick_validate.py" "<각 후보 스킬 폴더>"
```

검증 결과:

- 의존성 확인 통과
- 에이전트 문법 검사 통과
- 합성 60초 줌 녹화에서 컷 후보 5개 생성
- 확인 필요 컷 승인 후 42초 draft 마스터 렌더 성공
- 개인정보 검수 보고서, contact sheet, 게시 메타데이터, 체크리스트 생성 성공
- `continue`가 기존 산출물을 재사용하고 readiness를 갱신한 뒤 승인 게이트에서 정지함
- `youtube-upload --dry-run`이 실제 업로드 없이 `publish/youtube_upload_plan.json` 생성
- `youtube-channel-lock`이 로컬 잠금 파일을 만들고 업로드 계획에 고정 채널 정보를 포함함
- `youtube-upload --dry-run` 계획에 chunk size와 max retry 설정이 포함됨
- readiness 게이트가 완성본, 개인정보 검수, 게시 패키지를 인식하고,
  개인정보 검수는 `CLEAR_FOR_PUBLISH: yes` 전까지 review 상태로 유지함
- 후보 스킬 3개 모두 `quick_validate.py` 통과

## Notes

- 테스트 산출물 `zoom_lecture_agent_test/`는 검증용 로컬 출력이므로 커밋 대상에서 제외하는 것이 좋습니다.

## Suggested Commit Message

```text
Add Zoom lecture editing agent MVP
```
