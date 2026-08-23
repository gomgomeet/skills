# 줌 수업 편집 에이전트 추가 스킬 조사

## 조사 요약

기존 `lecture-video-editor`는 컷 편집과 자막 중심의 핵심 파이프라인으로 유지하고,
앞뒤 운영 업무를 별도 스킬로 분리하는 편이 좋다.

근거:

- Zoom 공식 문서는 로컬 녹화가 컴퓨터에 저장되며 기본 위치가 Windows의
  `C:\Users\<Username>\Documents\Zoom`이라고 안내한다.
- Zoom 녹화 파일은 MP4, M4A, TXT, VTT 계열로 나뉘며, 채팅과 자막/전사 파일이
  함께 생길 수 있다.
- Zoom은 로컬 녹화 저장 위치를 클라우드 동기화 폴더, 외장 드라이브, 네트워크
  저장소로 지정하면 저장/변환 문제가 생길 수 있다고 경고한다.
- FFmpeg는 무음 감지와 화면 정지 감지 필터를 제공하므로 로컬 분석 기반의
  편집/검수 흐름이 적합하다.
- faster-whisper는 단어 단위 타임스탬프를 제공하므로 컷 경계 보정과 자막 생성에
  계속 쓰기 좋다.
- YouTube 업로드는 공개된 CLI 도구가 여럿 있지만, 수업 영상과 OAuth 토큰을 다루므로
  외부 업로더를 그대로 설치하기보다 공식 YouTube Data API와 Google API Python client
  패턴을 에이전트 내부에 흡수하는 편이 안전하다.

## 필요한 스킬

### 1. zoom-recording-autopilot

수업 종료 후 새 녹화 폴더를 감지하고 `prepare`까지만 자동 실행하는 스킬.
렌더링은 컷 승인 뒤에만 진행한다.

저장 위치: `skills/misc/zoom-recording-autopilot/SKILL.md`

### 2. lecture-privacy-review

게시 전 화면 노출, 학생 정보, 알림 팝업, 참가자 패널, 브라우저 탭 등을 로컬에서
검수하는 스킬. 교육 영상은 이 검수 단계가 별도 스킬로 분리될 만큼 중요하다.

저장 위치: `skills/misc/lecture-privacy-review/SKILL.md`

### 3. lecture-publish-packager

마스터 영상, 자막, 대본을 유튜브/LMS/드라이브용 산출물 폴더로 정리하고 제목,
설명, 챕터, 체크리스트를 만드는 스킬. 실제 업로드는 명시 승인 전에는 하지 않는다.

저장 위치: `skills/misc/lecture-publish-packager/SKILL.md`

### 4. lecture-youtube-uploader

승인된 게시 패키지를 YouTube로 업로드하는 스킬. OAuth, 공개 범위, 아동 대상 여부,
합성 콘텐츠 여부, 채널 잠금, 실제 업로드 승인을 분리한다. 인터넷 검색으로 확인한
Google 공식 Python 업로드 샘플의 지수 백오프 재시도와 Google API Python client의
chunked resumable upload 패턴을 도입했다.

저장 위치: `skills/misc/lecture-youtube-uploader/SKILL.md`

## 보류한 스킬

- `korean-subtitle-polisher`: 기존 `lecture-video-editor`의 전사/자막 단계와 겹친다.
  교육 용어 사전이 커지면 나중에 분리한다.
- `lecture-shorts-extractor`: 쇼츠 추출 기준이 아직 불명확하다. 실제 수업 영상 몇 개를
  처리한 뒤 어떤 장면이 쇼츠로 유효한지 패턴을 보고 만든다.
- `third-party-youtube-uploader-adapter`: `youtube-upload`, `youtubeuploader` 같은 공개 CLI는
  참고 가치가 있지만, 로컬 수업 영상과 OAuth 토큰 저장 모델을 외부 도구에 맡기는 것은
  아직 과하다. 필요하면 사용자가 특정 도구를 승인한 뒤 별도 어댑터로 분리한다.

## 참고한 자료

- Zoom Support: Managing computer recordings
  https://support.zoom.com/hc/en/article?id=zm_kb&onlycontent=1&platform=mac&product=zoom&sysparm_article=KB0063423
- Zoom Support: Understanding recording file formats
  https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0064394
- Zoom Support: Starting a computer recording
  https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0076922
- FFmpeg Filters Documentation
  https://ffmpeg.org/ffmpeg-filters.html
- SYSTRAN faster-whisper README
  https://github.com/SYSTRAN/faster-whisper
- YouTube Data API: Upload a Video
  https://developers.google.com/youtube/v3/guides/uploading_a_video
- YouTube Data API: Resumable Uploads
  https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
- Google API Python Client: Media Upload
  https://googleapis.github.io/google-api-python-client/docs/media.html
- tokland/youtube-upload
  https://github.com/tokland/youtube-upload
- porjo/youtubeuploader
  https://github.com/porjo/youtubeuploader
