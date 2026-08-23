# 줌 수업 후 영상 편집 에이전트

`agent.py`는 기존 `lecture-video-editor` 스크립트 위에 감지, 상태 저장, 승인 게이트를
얹은 로컬 실행용 래퍼다. 원본 영상은 수정하지 않고, 분석과 렌더링은 모두 로컬에서
진행한다.

## 빠른 점검

```powershell
python .\skills\misc\zoom-recording-autopilot\scripts\agent.py doctor
```

`ffmpeg`, `ffprobe`, Python, `faster-whisper`, `lecture-video-editor` 스크립트를 확인한다.

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

## 상태 흐름

```text
prepare
  -> waiting_for_cut_approval
transcribe --approve-cuts
  -> waiting_for_script_approval
render --approve-cuts [--approve-script]
  -> completed
```

안전장치:

- 컷 승인 없이는 전사 보정이나 렌더링을 실행하지 않는다.
- `final_script.md`가 있으면 대본 승인 없이는 렌더링하지 않는다.
- 각 단계의 stdout/stderr는 `_lve_output/logs/*.json`에 남는다.
