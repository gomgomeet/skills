# PR: 줌 수업 후 영상 편집 에이전트 MVP

## Summary

- 줌 녹화 폴더를 분석하고 컷 리스트를 제안하는 로컬 에이전트 CLI를 추가했습니다.
- 컷 승인 전 렌더링을 막는 승인 게이트와 작업 상태 파일을 추가했습니다.
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

### Documentation

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

로컬 Codex에는 동일한 스킬을 `C:\Users\이혜경교육대초등영어교육\.codex\skills` 아래에도 설치해 검증했습니다.

## Verification

실행한 검증:

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py doctor
python -m py_compile .\skills\misc\zoom-recording-autopilot\scripts\agent.py
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py prepare "<합성 줌 녹화 폴더>"
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py replan "<합성 줌 녹화 폴더>\_lve_output" --confirm-cuts 3
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py render "<합성 줌 녹화 폴더>\_lve_output" --approve-cuts --preset draft
python "<skill-creator>\scripts\quick_validate.py" "<각 후보 스킬 폴더>"
```

검증 결과:

- 의존성 확인 통과
- 에이전트 문법 검사 통과
- 합성 60초 줌 녹화에서 컷 후보 5개 생성
- 확인 필요 컷 승인 후 42초 draft 마스터 렌더 성공
- 후보 스킬 3개 모두 `quick_validate.py` 통과

## Notes

- 테스트 산출물 `zoom_lecture_agent_test/`는 검증용 로컬 출력이므로 커밋 대상에서 제외하는 것이 좋습니다.

## Suggested Commit Message

```text
Add Zoom lecture editing agent MVP
```
