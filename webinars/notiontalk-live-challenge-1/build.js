const pptxgen = require("pptxgenjs");
const QR = require("qrcode");
const fs = require("fs");
const path = require("path");

const SEC = path.join(__dirname, "assets");
const OUT = process.argv[2] || path.join(__dirname, "notiontalk-live-challenge-1-webinar.pptx");
const HUB = "https://judicious-ursinia-2c0.notion.site/412c5f01a4a4804cabd3c294d5d93fc9";

// ---------- palette ----------
const COL = {
  bg: "FFFFFF", card: "FFFFFF", ink: "111111", sub: "666666", accent: "111111",
  accentSoft: "F2F2F2", green: "111111", greenSoft: "F2F2F2", line: "D6D6D6",
  blue: "111111", blueSoft: "F2F2F2", purple: "111111", purpleSoft: "F2F2F2",
};
const FONT = "맑은 고딕";

// read PNG size from header
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function img(name) { return path.join(SEC, name + ".png"); }

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "곰곰이쌤 이혜경";
pres.title = "노션톡 라이브 챌린지 1기 웨비나: 노션 자동화의 모든 것";
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

let pageNo = 0; let lastSec = null;
function newSlide(section) {
  if (section !== lastSec) { pres.addSection({ title: section }); lastSec = section; }
  const s = pres.addSlide({ sectionTitle: section });
  s.background = { color: COL.bg };
  pageNo++;
  s.addText(`노션톡 라이브 챌린지 1기 · 곰곰이쌤    ${pageNo}`, {
    x: 6.2, y: 5.12, w: 3.5, h: 0.2, fontFace: FONT, fontSize: 9, color: COL.sub,
    align: "right", margin: 0, isTextBox: true,
  });
  return s;
}
function header(s, kicker, title, color = COL.accent) {
  if (kicker) s.addText(kicker, { x: 0.45, y: 0.28, w: 6, h: 0.28, fontFace: FONT, fontSize: 12, bold: true, color, margin: 0, isTextBox: true });
  s.addText(title, { x: 0.45, y: 0.56, w: 9.1, h: 0.56, fontFace: FONT, fontSize: 24, bold: true, color: COL.ink, margin: 0, valign: "middle", isTextBox: true });
}
function shadow() { return { type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.12 }; }

// image placed inside box keeping aspect ratio, framed as a card
function framedImage(s, file, box) {
  const { w: pw, h: ph } = pngSize(file);
  const pad = 0.08;
  const bw = box.w - pad * 2, bh = box.h - pad * 2;
  let w = bw, h = bw * ph / pw;
  if (h > bh) { h = bh; w = bh * pw / ph; }
  const x = box.x + (box.w - w) / 2, y = box.y + (box.h - h) / 2;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.line, width: 1 }, shadow: shadow() });
  s.addImage({ path: file, x, y, w, h, altText: "노션 페이지 캡처" });
}

// standard capture slide: left = key message, right = Notion capture
function capSlide({ section, kicker, title, lead, points = [], tip, image, notes, color = COL.accent, soft = COL.accentSoft }) {
  const s = newSlide(section);
  header(s, kicker, title, color);
  const sz = pngSize(image);
  const ia = image.replace(/\.png$/, "_a.png"), ib = image.replace(/\.png$/, "_b.png");
  const split = fs.existsSync(ia) && fs.existsSync(ib);
  if (split || sz.w / sz.h >= 1.6) {
    // wide capture: lead strip on top, capture as large as possible below
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 1.2, w: 9.1, h: 0.55, rectRadius: 0.08, fill: { color: soft }, line: { color: soft } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.45, y: 1.2, w: 0.08, h: 0.55, fill: { color }, line: { color } });
    s.addText(lead, { x: 0.65, y: 1.2, w: 8.8, h: 0.55, fontFace: FONT, fontSize: 15, bold: true, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    if (split) {
      framedImage(s, ia, { x: 0.45, y: 1.85, w: 4.5, h: 3.2 });
      framedImage(s, ib, { x: 5.05, y: 1.85, w: 4.5, h: 3.2 });
    } else framedImage(s, image, { x: 0.45, y: 1.85, w: 9.1, h: 3.2 });
    const extra = [...points, ...(tip ? ["TIP: " + tip] : [])].join("\n");
    s.addNotes((notes || "") + (extra ? "\n\n[화면 핵심]\n" + extra : ""));
    return s;
  }
  // lead box
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 1.25, w: 3.95, h: 0.85, rectRadius: 0.08, fill: { color: soft }, line: { color: soft } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.45, y: 1.25, w: 0.08, h: 0.85, fill: { color }, line: { color } });
  s.addText(lead, { x: 0.65, y: 1.25, w: 3.7, h: 0.85, fontFace: FONT, fontSize: 15, bold: true, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
  if (points.length) {
    s.addText(points.map((p, i) => ({ text: p, options: { bullet: { indent: 14 }, breakLine: i < points.length - 1, paraSpaceAfter: 6 } })), {
      x: 0.45, y: 2.2, w: 3.95, h: tip ? 1.75 : 2.85, fontFace: FONT, fontSize: 14, color: COL.ink, valign: "middle", margin: [0, 2, 0, 2], isTextBox: true,
    });
  }
  if (tip) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 4.05, w: 3.95, h: 0.95, rectRadius: 0.08, fill: { color: COL.card }, line: { color, width: 1.25, dashType: "dash" } });
    s.addText([{ text: "TIP  ", options: { bold: true, color } }, { text: tip, options: { color: COL.ink } }], {
      x: 0.6, y: 4.05, w: 3.7, h: 0.95, fontFace: FONT, fontSize: 13, valign: "middle", margin: 0, isTextBox: true,
    });
  }
  framedImage(s, image, { x: 4.6, y: 1.2, w: 5.1, h: 3.85 });
  if (notes) s.addNotes(notes);
  return s;
}

function divider({ section, part, title, sub, ill, time, color = COL.accent }) {
  const s = newSlide(section);
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 4.3, h: 5.625, fill: { color }, line: { color } });
  s.addText(part, { x: 0.5, y: 1.3, w: 3.4, h: 0.5, fontFace: FONT, fontSize: 18, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
  s.addText(title, { x: 0.5, y: 1.85, w: 3.5, h: 1.4, fontFace: FONT, fontSize: 30, bold: true, color: "FFFFFF", margin: 0, valign: "top", isTextBox: true });
  if (time) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 3.5, w: 1.6, h: 0.45, rectRadius: 0.2, fill: { color: "FFFFFF" }, line: { color: "FFFFFF" } });
    s.addText(time, { x: 0.5, y: 3.5, w: 1.6, h: 0.45, fontFace: FONT, fontSize: 14, bold: true, color, align: "center", valign: "middle", margin: 0, isTextBox: true });
  }
  s.addText(sub, { x: 4.75, y: 4.15, w: 4.9, h: 0.8, fontFace: FONT, fontSize: 15, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
  framedImage(s, ill, { x: 4.75, y: 0.5, w: 4.9, h: 3.5 });
  return s;
}

(async () => {
  // ===== 1. 표지 =====
  {
    const s = newSlide("오프닝");
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.18, fill: { color: COL.accent }, line: { color: COL.accent } });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 0.75, w: 3.3, h: 0.45, rectRadius: 0.2, fill: { color: COL.accentSoft }, line: { color: COL.accentSoft } });
    s.addText("노션톡 라이브 챌린지 1기 · 웨비나", { x: 0.6, y: 0.75, w: 3.3, h: 0.45, fontFace: FONT, fontSize: 14, bold: true, color: COL.accent, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText("노션 자동화의 모든 것", { x: 0.6, y: 1.4, w: 6.6, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: COL.ink, margin: 0, isTextBox: true });
    s.addText("템플릿 · 버튼 · 버튼 수식 · 변수 · DB 자동화로\n나만의 데이터베이스 자동화 완성하기", { x: 0.6, y: 2.35, w: 6.6, h: 0.95, fontFace: FONT, fontSize: 18, color: COL.sub, margin: 0, isTextBox: true });
    s.addShape(pres.shapes.LINE, { x: 0.6, y: 3.6, w: 5.2, h: 0, line: { color: COL.line, width: 1.5 } });
    s.addText([
      { text: "대상  ", options: { bold: true, color: COL.accent } }, { text: "노션으로 반복 업무를 줄이고 싶은 선생님 (온라인 라이브)", options: { breakLine: true } },
      { text: "일시  ", options: { bold: true, color: COL.accent } }, { text: "20__년 __월 __일 (__) __:__ ~ __:__", options: { breakLine: true } },
      { text: "강사  ", options: { bold: true, color: COL.accent } }, { text: "곰곰이쌤 이혜경 (단샘초등학교 교사 · Notion Creator)" },
    ], { x: 0.6, y: 3.75, w: 6.6, h: 1.2, fontFace: FONT, fontSize: 14, color: COL.ink, margin: 0, paraSpaceAfter: 4, isTextBox: true });
    s.addImage({ path: img("gomgom-bear"), x: 7.35, y: 0.55, w: 2.25, h: 2.25, altText: "곰곰이쌤 곰돌이 캐릭터" });
    s.addImage({ path: img("ill_auto"), x: 7.0, y: 3.05, w: 2.6, h: 2.6 * 384 / 689, altText: "데이터베이스 자동화 일러스트" });
    s.addNotes("반갑습니다. 노션톡 라이브 챌린지 1기 웨비나에 오신 선생님들 환영합니다. 오늘은 템플릿부터 버튼, 버튼 수식, 변수, 데이터베이스 자동화까지 노션 자동화의 전체 흐름을 한 번에 살펴보고, 2주 동안 나만의 자동화 DB를 완성하는 챌린지를 시작합니다.");
  }

  // ===== 2. 강사 소개 =====
  {
    const s = newSlide("오프닝");
    header(s, "강사 소개", "곰곰이쌤 이혜경입니다");
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 1.3, w: 4.35, h: 3.7, rectRadius: 0.1, fill: { color: COL.accentSoft }, line: { color: COL.accentSoft } });
    s.addImage({ path: img("gomgom-bear"), x: 0.7, y: 1.5, w: 1.15, h: 1.15, altText: "곰곰이쌤 캐릭터" });
    s.addText([{ text: "이혜경", options: { fontSize: 22, bold: true, breakLine: true } }, { text: "단샘초등학교 교사 · 교육경력 25년", options: { fontSize: 14, color: COL.sub } }], { x: 2.0, y: 1.55, w: 2.7, h: 1.05, fontFace: FONT, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    s.addText([
      { text: "Notion Creator · 지식샘터 노션 강사", options: { bullet: true, breakLine: true } },
      { text: "네이버 블로그 ‘곰곰이쌤’", options: { bullet: true, breakLine: true } },
      { text: "노션톡 운영진 · 마켓플레이스 gomgom", options: { bullet: true, breakLine: true } },
      { text: "노션러 5년차", options: { bullet: true, bold: true } },
    ], { x: 0.7, y: 2.85, w: 3.95, h: 1.95, fontFace: FONT, fontSize: 14, color: COL.ink, paraSpaceAfter: 6, valign: "middle", margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.05, y: 1.3, w: 4.5, h: 3.7, rectRadius: 0.1, fill: { color: COL.card }, line: { color: COL.line }, shadow: shadow() });
    s.addText("주요 경력", { x: 5.3, y: 1.42, w: 4, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: COL.accent, margin: 0, isTextBox: true });
    const career = [
      ["2024", "교실 혁명 선도교사 · 디지털 연구 모임 리더교사"],
      ["2024", "교육청 에듀테크 강사(노션팀) · AIDT 연수 강사"],
      ["2024~25", "찾아가는 학교 컨설팅"],
      ["2025", "디지털 교과 연구회 회장"],
      ["2025", "지식샘터 연말결산 스타 지식샘"],
      ["2025", "디지털 교육 혁신 교육부 장관상"],
      ["2025~26", "교사를 위한 노션 템플릿 제작"],
    ];
    s.addTable(career.map(([y, t]) => [
      { text: y, options: { bold: true, color: COL.accent } }, { text: t, options: { color: COL.ink } },
    ]), { x: 5.3, y: 1.9, w: 4.1, colW: [0.85, 3.25], rowH: 0.42, fontFace: FONT, fontSize: 12, border: { type: "none" }, valign: "middle", margin: [0, 0.04, 0, 0.04] });
    s.addNotes("간단히 제 소개를 드리면, 초등학교에서 25년째 아이들을 만나고 있고 노션으로 교무수첩, 학급 운영 템플릿을 만들어 나누고 있습니다. 오늘 보여 드리는 모든 예시는 교실과 교무실에서 바로 쓸 수 있는 사례로 준비했습니다.");
  }

  // ===== 3. 오늘의 자료실 =====
  capSlide({
    section: "오프닝", kicker: "노션톡에서 함께 배워요", title: "오늘의 자료실: 노션 자동화 라이브 챌린지",
    lead: "연수 자료 5개 + 챌린지 2주 + 수식 모음집을 한 페이지에 모았어요",
    points: ["노션 자동화 연수: 템플릿 → 버튼 → 버튼 수식 → 변수 → DB 자동화", "노션 라이브 챌린지: 1주차 DB 구축, 2주차 자동화 완성", "교사를 위한 수식 모음집 24종"],
    tip: "웨비나 중 링크를 열어 두고 슬라이드와 함께 보시면 따라오기 쉬워요.",
    image: img("hub_cards"),
    notes: "오늘 보시는 내용은 모두 이 노션 페이지에 정리되어 있습니다. 위쪽은 개념을 배우는 연수 자료, 아래쪽은 2주 동안 진행할 챌린지 페이지, 맨 아래에는 바로 복사해 쓸 수 있는 수식 모음집이 있어요.",
  });

  // ===== 4. 목표 =====
  {
    const s = newSlide("오프닝");
    header(s, "웨비나 목표", "오늘 이것만은 가져가세요");
    const goals = [
      ["인지적 목표", "템플릿·버튼·버튼 수식·변수·DB 자동화가 각각 ‘언제’ 실행되는지 구분한다.", COL.blue, COL.blueSoft],
      ["행동적 목표", "내 업무 DB에 템플릿 1개와 버튼 또는 자동화 1개를 직접 만들어 작동시킨다.", COL.green, COL.greenSoft],
      ["정의적 목표", "반복 업무를 ‘자동화할 수 있는 일’로 바라보고 동료와 사례를 나눈다.", COL.purple, COL.purpleSoft],
    ];
    goals.forEach(([h, t, c, soft], i) => {
      const x = 0.45 + i * 3.07;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.3, w: 2.9, h: 1.95, rectRadius: 0.08, fill: { color: soft }, line: { color: soft } });
      s.addText(h, { x: x + 0.2, y: 1.42, w: 2.5, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: c, margin: 0, isTextBox: true });
      s.addText(t, { x: x + 0.2, y: 1.85, w: 2.5, h: 1.3, fontFace: FONT, fontSize: 14, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 3.45, w: 9.1, h: 1.55, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.accent, width: 1.5 } });
    s.addText("오늘 들고 가실 것", { x: 0.7, y: 3.55, w: 3, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: COL.accent, margin: 0, isTextBox: true });
    const outs = ["자동화 자료 페이지 (복제본)", "나의 업무 DB 아이디어 1개", "버튼·자동화 설계 카드 1장", "2주 챌린지 실천 계획"];
    outs.forEach((t, i) => {
      const x = 0.7 + i * 2.2;
      s.addShape(pres.shapes.OVAL, { x, y: 4.1, w: 0.5, h: 0.5, fill: { color: COL.accent }, line: { color: COL.accent } });
      s.addText(String(i + 1), { x, y: 4.1, w: 0.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addText(t, { x: x + 0.58, y: 3.98, w: 1.55, h: 0.75, fontFace: FONT, fontSize: 13, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addNotes("오늘의 목표는 세 가지입니다. 기능 이름을 외우는 것보다 각 기능이 언제 실행되는지를 구분하는 것이 핵심이에요. 그리고 웨비나가 끝나면 네 가지를 들고 가시게 됩니다.");
  }

  // ===== 5. 타임테이블 =====
  {
    const s = newSlide("오프닝");
    header(s, "진행 순서 (90분 기준, 시간은 조정 가능)", "오늘의 타임테이블");
    const rows = [
      ["0:00~0:10", "오프닝 · 세팅", "인사, 자료 페이지 열기·복제", "자료 페이지 복제본"],
      ["0:10~0:25", "PART 1 템플릿", "본문 틀 · 기본값 · 반복 생성", "템플릿 1개"],
      ["0:25~0:40", "PART 2 버튼", "페이지 버튼 vs DB 버튼, 시나리오", "버튼 설계 카드"],
      ["0:40~1:00", "PART 3 버튼 수식·변수", "now() · dateAdd() · 변수 정의", "완료 기록 버튼"],
      ["1:00~1:12", "PART 4 DB 자동화", "트리거 → 동작, 요금제 확인", "자동화 설계 카드"],
      ["1:12~1:25", "PART 5 챌린지 안내", "1주차 · 2주차 미션과 인증 방법", "2주 실천 계획"],
      ["1:25~1:30", "Q&A · 마무리", "질문, 적용 계획 공유", "다음 주 적용 1가지"],
    ];
    const head = ["시간", "블록", "활동", "산출물"].map(t => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: COL.accent }, align: "center" } }));
    const body = rows.map((r, i) => r.map((t, j) => ({ text: t, options: { color: COL.ink, bold: j === 1, fill: { color: i % 2 ? "FFFFFF" : "F5F5F5" }, align: j === 0 ? "center" : "left" } })));
    s.addTable([head, ...body], { x: 0.45, y: 1.25, w: 9.1, colW: [1.35, 2.25, 3.4, 2.1], rowH: 0.46, fontFace: FONT, fontSize: 13, border: { type: "solid", pt: 0.75, color: COL.line }, valign: "middle", margin: [0, 0.08, 0, 0.08] });
    s.addNotes("90분 기준 타임테이블입니다. 실제 웨비나 시간에 맞춰 조정하세요. 실습 시간이 부족하면 PART 2 시나리오를 2개로 줄이고 챌린지 안내 시간을 지켜 주세요.");
  }

  // ===== 6. 세팅 =====
  {
    const s = newSlide("오프닝");
    header(s, "5분 · 시작 전 세팅", "자료 페이지 열고 복제하기");
    const steps = [
      ["QR 또는 채팅창 링크로 ‘노션 자동화 라이브 챌린지’ 페이지를 엽니다."],
      ["오른쪽 위 ‘복제’ 아이콘을 눌러 내 워크스페이스로 가져옵니다."],
      ["복제가 끝나면 채팅창에 ‘완료’를 남겨 주세요."],
    ];
    steps.forEach(([t], i) => {
      const y = 1.35 + i * 1.18;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y, w: 5.9, h: 1.0, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.line }, shadow: shadow() });
      s.addShape(pres.shapes.OVAL, { x: 0.65, y: y + 0.2, w: 0.6, h: 0.6, fill: { color: COL.accent }, line: { color: COL.accent } });
      s.addText(String(i + 1), { x: 0.65, y: y + 0.2, w: 0.6, h: 0.6, fontFace: FONT, fontSize: 20, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addText(t, { x: 1.45, y, w: 4.75, h: 1.0, fontFace: FONT, fontSize: 15, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    });
    const qr = await QR.toDataURL(HUB, { margin: 1, width: 600, color: { dark: "000000", light: "FFFFFF" } });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.7, y: 1.3, w: 2.85, h: 3.7, rectRadius: 0.1, fill: { color: COL.card }, line: { color: COL.accent, width: 1.5 } });
    s.addImage({ data: qr.replace("data:", ""), x: 6.95, y: 1.5, w: 2.35, h: 2.35, altText: "자료 페이지 QR 코드" });
    s.addText("자료 페이지 QR", { x: 6.7, y: 3.95, w: 2.85, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: COL.accent, align: "center", margin: 0, isTextBox: true });
    s.addText("휴대폰 카메라로 찍어도 열려요", { x: 6.7, y: 4.35, w: 2.85, h: 0.4, fontFace: FONT, fontSize: 12, color: COL.sub, align: "center", margin: 0, isTextBox: true });
    s.addNotes("온라인이라 낙오되는 분이 없도록 채팅창으로 완료를 확인합니다. 복제 버튼이 보이지 않으면 노션에 로그인되어 있는지 먼저 확인해 주세요. 링크는 채팅창에도 함께 올려 드립니다.");
  }

  // ===== 7. 자동화 3가지 스위치 =====
  {
    const s = newSlide("오프닝");
    header(s, "큰 그림", "노션 자동화의 3가지 스위치");
    const cards = [
      ["ill_tpl", "템플릿", "페이지를 만들 때 · 정해진 반복 시각", "주간 업무 양식 준비", COL.accent, COL.accentSoft],
      ["ill_btn", "버튼 (+수식·변수)", "선생님이 직접 누를 때", "업무 완료 버튼 누르기", COL.blue, COL.blueSoft],
      ["ill_auto", "DB 자동화", "정해 둔 변화가 생기거나 주기가 되면", "상태가 완료면 체크하기", COL.green, COL.greenSoft],
    ];
    cards.forEach(([im, h, when, ex, c, soft], i) => {
      const x = 0.45 + i * 3.07;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.25, w: 2.9, h: 3.75, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.line }, shadow: shadow() });
      s.addImage({ path: img(im), x: x + 0.15, y: 1.38, w: 2.6, h: 2.6 * 348 / 626, altText: h + " 일러스트" });
      s.addText(h, { x: x + 0.15, y: 2.92, w: 2.6, h: 0.42, fontFace: FONT, fontSize: 17, bold: true, color: c, margin: 0, isTextBox: true });
      s.addText([{ text: "언제? ", options: { bold: true } }, { text: when }], { x: x + 0.15, y: 3.36, w: 2.6, h: 0.72, fontFace: FONT, fontSize: 13, color: COL.ink, valign: "top", margin: 0, isTextBox: true });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.15, y: 4.18, w: 2.6, h: 0.65, rectRadius: 0.06, fill: { color: soft }, line: { color: soft } });
      s.addText("예) " + ex, { x: x + 0.25, y: 4.18, w: 2.4, h: 0.65, fontFace: FONT, fontSize: 13, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addNotes("오늘 배울 기능을 스위치로 생각해 보세요. 템플릿은 만들 때 켜지는 스위치, 버튼은 직접 누르는 스위치, DB 자동화는 조건이 생기면 저절로 켜지는 스위치입니다. 이 차이만 기억하면 어떤 기능을 쓸지 고를 수 있어요.");
  }

  // ===== PART 1 템플릿 =====
  const P1 = "PART 1 템플릿";
  divider({ section: P1, part: "PART 1", title: "나만의 노션\n템플릿 만들기", sub: "새 페이지마다 같은 틀과 기본값을 자동으로 채우는, 가장 기본적인 자동화", ill: img("ill_tpl"), time: "15분" });
  capSlide({ section: P1, kicker: "PART 1 · 템플릿", title: "템플릿은 ‘같은 틀 + 기본값’ 자동 채우기",
    lead: "새 페이지를 만들 때마다 같은 틀과 기본값이 한 번에 준비돼요",
    points: ["제목 형식, 업무 영역, 상태가 미리 선택됨", "본문의 이번 주 일정 / 처리할 업무 / 돌아보기 칸이 함께 생김"],
    tip: "‘매번 복사해서 지우던 페이지’가 있다면 그게 바로 템플릿 후보예요.",
    image: img("p02_s00"), notes: "템플릿은 새 페이지를 만들 때마다 같은 틀과 기본값을 자동으로 채워 주는 기능입니다. 지난주 페이지를 복사해서 내용을 지우고 계셨다면 오늘부터는 템플릿으로 바꿔 보세요." });
  capSlide({ section: P1, kicker: "PART 1 · 템플릿", title: "왜 ‘가장 기본적인 자동화’일까요?",
    lead: "손으로 하던 4가지 반복 작업이 사라져요",
    points: ["본문 틀이 자동으로 들어감", "속성 기본값이 자동으로 채워짐", "새 버튼 하나로 깨끗한 틀 생성", "반복 설정으로 정해진 날 자동 생성"],
    image: img("p02_s01"), notes: "왼쪽은 우리가 매번 손으로 하던 일, 오른쪽은 템플릿을 쓰면 달라지는 모습입니다." });
  capSlide({ section: P1, kicker: "PART 1 · 템플릿", title: "템플릿으로 할 수 있는 4가지",
    lead: "① 본문 틀  ② 속성 기본값  ③ 기본 템플릿  ④ 반복 생성",
    points: ["수업 성찰 질문 3개를 미리 넣기", "과목 국어, 상태 준비를 기본값으로", "상담 기록 DB는 항상 상담 양식으로", "매주 월요일 주간 업무 페이지 자동 생성"],
    tip: "반복 설정: 새로 만들기 옆 ▼ → 템플릿 옆 ••• → 반복",
    image: img("p02_s02"), notes: "네 가지 기능을 교사 예시와 함께 보세요. 특히 반복 생성은 월요일 아침에 이번 주 페이지가 이미 준비되어 있게 만들어 줍니다." });
  capSlide({ section: P1, kicker: "PART 1 · 함께 따라 하기 5분", title: "첫 템플릿 만들기",
    lead: "새로 만들기 ▼ → + 새 템플릿 → 이름·기본값·본문 틀 → ← 뒤로",
    points: ["템플릿 이름: 주간 업무", "기본값: 상태 시작 전, 업무 영역 행정", "본문: 이번 주 일정 / 수업 준비 / 처리할 업무 / 돌아보기"],
    tip: "성공 확인: 새로 만들기 ▼ → 주간 업무를 눌렀을 때 틀과 속성이 이미 채워져 있으면 성공!",
    image: img("p02_s03"), notes: "함께 따라 해 보겠습니다. 데이터베이스 오른쪽 위 새로 만들기 옆 화살표를 누르고 새 템플릿을 선택하세요. 다 되신 분은 채팅창에 성공을 남겨 주세요." });
  capSlide({ section: P1, kicker: "PART 1 · 활용 사례", title: "사례 ① 주간 업무 + 매주 반복",
    lead: "월요일 아침 출근하면 이번 주 페이지가 이미 준비되어 있어요",
    points: ["속성 기본값: 상태 진행 중", "본문: 이번 주 일정 / 수업 준비 / 처리할 업무 / 돌아보기", "반복: 매주 월요일 오전 7시"],
    image: img("p02_s05"), notes: "가장 추천하는 첫 사례입니다. 반복 생성 결과는 정해 둔 시간이 지나야 확인할 수 있으니 다음 주 월요일에 꼭 확인해 보세요." });
  capSlide({ section: P1, kicker: "PART 1 · 활용 사례", title: "사례 ③ 학생 상담 기록 양식 (기본 템플릿)",
    lead: "기본 템플릿으로 지정하면 새로 만들기만 눌러도 같은 양식으로 시작해요",
    points: ["상담 일시 · 방법 · 요청자", "상담 내용 · 함께 정한 약속", "다음 확인할 일"],
    tip: "연수·실습에서는 반드시 가상 학생 이름만 사용해요.",
    image: img("p02_s07"), notes: "상담 기록처럼 항상 같은 양식을 쓰는 DB는 기본 템플릿으로 지정해 두면 편합니다. 실습할 때는 꼭 가상 이름을 써 주세요." });

  // ===== PART 2 버튼 =====
  const P2 = "PART 2 버튼";
  divider({ section: P2, part: "PART 2", title: "버튼 사용의\n모든 것", sub: "누르면 그 줄에 정해 둔 일이 한 번에 처리되는 ‘직접 누르는 스위치’", ill: img("ill_btn"), time: "15분", color: COL.blue });
  capSlide({ section: P2, kicker: "PART 2 · 버튼", title: "데이터베이스 버튼, 이렇게 생각하면 쉬워요", color: COL.blue, soft: COL.blueSoft,
    lead: "업무 한 줄마다 붙어 있는 버튼, 누르면 그 줄의 일이 한 번에!",
    points: ["과제 확인 버튼을 누르면", "상태 → 확인 완료 / 확인일 → 오늘 / 확인자 → 누른 선생님"],
    tip: "여러 속성을 한 번에 바꾸는 것이 버튼의 힘이에요.",
    image: img("p03_s00"), notes: "데이터베이스 버튼은 행마다 하나씩 붙는 버튼입니다. 누르는 순간 그 행의 여러 속성이 동시에 바뀝니다." });
  capSlide({ section: P2, kicker: "PART 2 · 버튼", title: "페이지 버튼 vs 데이터베이스 버튼", color: COL.blue, soft: COL.blueSoft,
    lead: "페이지 버튼은 본문에 하나, DB 버튼은 모든 행에 하나씩",
    points: ["페이지 버튼: 체크리스트·양식 넣기 (수업 준비 시작)", "DB 버튼: 그 행의 상태 바꾸기, 후속 업무 만들기 (업무 시작, 제출 확인)"],
    tip: "DB 버튼 만들기: 속성 → 새 속성 → 버튼. 동작을 여러 개 이어 붙일 수 있어요.",
    image: img("p03_s01"), notes: "두 버튼의 차이를 먼저 정리하고 갑니다. 오늘 챌린지에서는 주로 데이터베이스 버튼을 사용합니다." });
  capSlide({ section: P2, kicker: "PART 2 · 버튼", title: "버튼으로 할 수 있는 일, 교사 업무로 바꿔 보기", color: COL.blue, soft: COL.blueSoft,
    lead: "속성 편집 · 페이지 추가 · 알림 · 확인 창은 무료로 가능해요",
    points: ["이 페이지 속성 편집: 상태 진행 중, 날짜 오늘", "다른 DB에 페이지 추가: 후속 업무 만들기", "알림 보내기: 동학년에 ‘자료 올렸어요’", "확인 창: ‘정말 완료할까요?’"],
    tip: "메일 보내기·웹훅은 유료 동작이에요.",
    image: img("p03_s02"), notes: "버튼 동작을 교사 업무로 바꿔서 보면 쓸 곳이 바로 보입니다. 메일과 웹훅은 유료라는 점만 기억해 주세요." });
  capSlide({ section: P2, kicker: "PART 2 · 시나리오 ①", title: "업무 관리 DB: 업무 시작 / 업무 완료", color: COL.blue, soft: COL.blueSoft,
    lead: "클릭 한 번으로 속성 3개가 함께 바뀌어요",
    points: ["시작: 상태 진행 중, 시작일 오늘, 담당자 누른 사람", "완료: 확인 창 → 상태 완료, 완료일 오늘"],
    tip: "완료 버튼에는 확인 창을 넣어 실수로 누르는 것을 막아요.",
    image: img("p03_s04"), notes: "가장 기본적인 시나리오입니다. 시작 버튼과 완료 버튼 두 개만 있어도 업무 기록이 자동으로 정리됩니다." });
  capSlide({ section: P2, kicker: "PART 2 · 시나리오 ②", title: "완료 + 후속 업무 만들기", color: COL.blue, soft: COL.blueSoft,
    lead: "현장체험학습 계획을 마치면 다음 업무가 바로 생겨요",
    points: ["상태 → 완료", "업무 DB에 ‘가정통신문 안내하기’ 추가", "업무 DB에 ‘참가 동의서 회수하기’ 추가"],
    tip: "버튼은 원할 때만 실행돼서, 무료 플랜에서 자동화를 대신하기 좋아요.",
    image: img("p03_s05"), notes: "자동화와 비슷한 효과를 무료로 낼 수 있는 방법입니다. 자동화는 상태가 바뀌면 저절로 실행되지만 버튼은 선생님이 누를 때만 실행됩니다." });
  capSlide({ section: P2, kicker: "PART 2 · 시나리오 ③", title: "과제 제출 DB: 제출 확인 / 재제출 요청", color: COL.blue, soft: COL.blueSoft,
    lead: "표에서 위에서부터 내려가며 버튼만 누르면 확인 끝!",
    points: ["확인: 제출 상태 확인 완료, 확인일 오늘", "다시: 제출 상태 재제출, 피드백 필요 체크", "재제출 필터 보기로 지도할 학생 모아 보기"],
    image: img("p03_s06"), notes: "학급 과제 확인에 바로 쓸 수 있는 사례입니다. 실습에는 가상 이름을 써 주세요." });
  capSlide({ section: P2, kicker: "PART 2 · 설계 카드", title: "버튼 설계 공식 (선생님용 설계 카드)", color: COL.blue, soft: COL.blueSoft,
    lead: "버튼을 만들기 전에 5가지 질문에 먼저 답해 보세요",
    points: ["① 언제 누르나요?  ② 무엇이 바뀌나요?", "③ 새로 생길 것은?  ④ 누구에게 알리나요?", "⑤ 실수는 어떻게 막나요?"],
    tip: "이 카드를 챌린지 미션의 계획 단계에 그대로 써 보세요.",
    image: img("p03_s10"), notes: "기능을 먼저 찾지 말고 내 업무 흐름을 먼저 적어 보세요. 다섯 질문에 답하면 버튼 설정은 그대로 옮기기만 하면 됩니다." });

  // ===== PART 3 버튼 수식 + 변수 =====
  const P3 = "PART 3 버튼 수식·변수";
  divider({ section: P3, part: "PART 3", title: "버튼 수식 &\n변수 정의", sub: "누르는 순간 계산해서 값을 써 넣고, 계산한 값은 메모지(변수)에 담아 재사용", ill: img("ill_fx"), time: "20분", color: COL.purple });
  capSlide({ section: P3, kicker: "PART 3 · 버튼 수식", title: "수식 속성 vs 버튼 수식", color: COL.purple, soft: COL.purpleSoft,
    lead: "수식 속성은 ‘지금 상태 보기’, 버튼 수식은 ‘이 순간을 기록하기’",
    points: ["수식 속성: 항상 저절로 계산, 보여 주기만 함 (D-day, 신호등)", "버튼 수식: 누를 때만 계산, 실제 값을 넣음 (점수 +1, 마감 연장)"],
    image: img("p04_s01"), notes: "가장 헷갈리는 부분입니다. 수식 속성은 계속 계산해서 보여 주는 칸이고, 버튼 수식은 누르는 순간 계산해서 값을 써 넣는 기능입니다." });
  capSlide({ section: P3, kicker: "PART 3 · 버튼 수식", title: "버튼에 수식 넣는 방법", color: COL.purple, soft: COL.purpleSoft,
    lead: "값 칸에서 ∑ 를 누르면 수식 창이 열려요",
    points: ["This page: 버튼을 누른 그 줄의 페이지", "now(): 버튼을 누른 순간", "버튼을 누른 사람: 클릭한 선생님"],
    tip: "This page는 직접 타이핑하지 말고 목록에서 골라 넣으세요. 칩 모양이면 성공!",
    image: img("p04_s02"), notes: "수식 창에서 This page 같은 항목은 반드시 목록에서 골라 넣어야 합니다. 직접 타이핑하면 오류가 나는 경우가 많아요." });
  capSlide({ section: P3, kicker: "PART 3 · 버튼 수식 활용", title: "숫자 쌓기: 칭찬 +1, 독서 쪽수 쌓기", color: COL.purple, soft: COL.purpleSoft,
    lead: "칭찬 +1 버튼을 누르면 4점 → 5점으로 저장돼요",
    points: ["비어 있으면 1, 있으면 +1 (if + empty)", "min()으로 전체 쪽수를 넘지 않게 쌓기", "응용: 독서 권수, 과제 완료 횟수, 줄넘기 +10"],
    tip: "−1 버튼도 함께 만들어 두면 실수를 바로 되돌릴 수 있어요.",
    image: img("p04_s05"), notes: "숫자 쌓기는 학급 운영에서 가장 반응이 좋은 예시입니다. 실수로 눌렀을 때를 대비해 빼기 버튼도 함께 만들어 두세요." });
  capSlide({ section: P3, kicker: "PART 3 · 버튼 수식 활용", title: "날짜 계산: 과제 배부 · 마감 3일 연장", color: COL.purple, soft: COL.purpleSoft,
    lead: "배부일은 now(), 마감일은 dateAdd(now(), 7, \"days\")",
    points: ["마감 3일 연장: 마감일이 없으면 오늘부터, 있으면 원래 마감일에서 3일 뒤", "누를 때마다 3일씩 늘어나요"],
    tip: "연장 버튼에는 확인 창을 꼭 함께 넣어 주세요.",
    image: img("p04_s06"), notes: "날짜 계산은 dateAdd 하나만 알면 대부분 해결됩니다. 연장 버튼은 누를 때마다 늘어나니 확인 창을 꼭 넣어 주세요." });
  capSlide({ section: P3, kicker: "PART 3 · 변수 정의", title: "변수는 버튼이 먼저 적어 두는 메모지", color: COL.purple, soft: COL.purpleSoft,
    lead: "한 번 계산하고, 여러 곳에서 이름만 불러 써요",
    points: ["메모지 이름: 마감 = 오늘부터 7일 뒤", "마감일 칸, 알림 메시지, 새 페이지에 ‘마감’만 불러 쓰기", "7일을 5일로 바꿀 때 변수 1곳만 고치면 끝"],
    image: img("p05_s01"), notes: "변수를 쓰는 이유는 두 가지입니다. 같은 수식을 여러 번 쓰지 않아도 되고, 나중에 고칠 때 한 곳만 바꾸면 됩니다." });
  capSlide({ section: P3, kicker: "PART 3 · 변수 예시 ①", title: "가장 쉬운 변수: 과제 배부 버튼", color: COL.purple, soft: COL.purpleSoft,
    lead: "변수 정의 → 이 페이지 편집 → 알림 보내기",
    points: ["1. 변수 ‘마감’ = dateAdd(now(), 7, \"days\")", "2. 배부일 now(), 마감일 → 변수 마감", "3. 알림: 과제명 + 마감: MM/DD"],
    tip: "결과(11/8에 누른 경우): 배부일 11/08, 마감일 11/15, 알림 ‘독서 감상문 마감: 11/15’",
    image: img("p05_s04"), notes: "버튼 설정 순서가 중요합니다. 변수 정의 동작이 맨 위에 있어야 아래 동작들에서 그 변수를 불러 쓸 수 있어요." });
  capSlide({ section: P3, kicker: "PART 3 · 실습실 7분", title: "변수 정의 실습실에서 직접 해 보기", color: COL.purple, soft: COL.purpleSoft,
    lead: "DB와 속성은 준비되어 있어요. 버튼 동작만 직접 설정합니다",
    points: ["열 이름 → 속성 편집 → 새 동작 → 변수 정의", "Variable 1 → 이름을 ‘마감’으로", "∑ 에 수식 넣고 → 이 페이지 속성 편집 추가"],
    tip: "수식은 코드 칸 오른쪽 위 복사 버튼으로 가져가세요.",
    image: img("p11_s04"), notes: "복제한 자료 페이지 안의 변수 정의 실습실을 열어 주세요. 실습 1번 과제 배부 버튼을 함께 만들어 보고, 표의 버튼을 눌러 결과를 확인합니다." });
  capSlide({ section: P3, kicker: "보너스 자료", title: "교사를 위한 수식 모음집 24종", color: COL.purple, soft: COL.purpleSoft,
    lead: "수업·학급 10 · 업무 일정 7 · 평가·기록 7",
    points: ["칭찬 스티커 표시, 목표 진행 막대", "마감일까지 D-day, 3일 이내 마감 체크", "평가 영역별 합계, 소수 첫째 자리 반올림"],
    tip: "각 카드에 ‘필요한 속성 → 복사할 수식 → 결과 예시 → 적용 방법’이 들어 있어요.",
    image: img("p10_top"), notes: "수식이 어렵게 느껴지시면 이 모음집에서 복사해서 쓰시면 됩니다. 난이도도 쉬움과 보통으로 표시해 두었어요." });

  // ===== PART 4 DB 자동화 =====
  const P4 = "PART 4 DB 자동화";
  divider({ section: P4, part: "PART 4", title: "데이터베이스\n자동화", sub: "미리 정한 일이 생기면 다음 작업을 노션이 대신 처리하는 ‘조건 스위치’", ill: img("ill_auto"), time: "12분", color: COL.green });
  capSlide({ section: P4, kicker: "PART 4 · DB 자동화", title: "자동화의 기본 공식: 트리거 → 동작", color: COL.green, soft: COL.greenSoft,
    lead: "트리거(언제?) → 동작(무엇을?)",
    points: ["트리거: 업무 상태가 완료로 바뀜", "동작: 완료 확인 체크하기", "버튼은 직접 누르는 스위치, DB 자동화는 조건이 생기면 작동하는 스위치"],
    image: img("p06_s01"), notes: "자동화는 언제와 무엇을, 두 가지만 정하면 됩니다. 오늘 배운 템플릿, 버튼과 비교해서 언제 실행되는지를 다시 확인해 보세요." });
  capSlide({ section: P4, kicker: "PART 4 · 시작 전 확인", title: "요금제와 권한을 먼저 확인하세요", color: COL.green, soft: COL.greenSoft,
    lead: "일반 DB 자동화는 유료 플랜 + DB 전체 허용 권한이 필요해요",
    points: ["무료 플랜: Slack 알림 자동화만 새로 만들 수 있음", "템플릿에 포함된 자동화는 사용 가능, 편집 불가", "무료라면 버튼으로 비슷한 작업을 직접 실행"],
    tip: "실습은 연습용 DB와 가상 이름으로! 학생 개인정보·상담 내용은 넣지 않아요.",
    image: img("p06_s02"), notes: "무료 플랜을 쓰시는 선생님은 강사 시연을 보면서 조건과 동작을 설계해 보시고, 실제 작동은 버튼으로 구현해 보세요." });
  capSlide({ section: P4, kicker: "PART 4 · 시연", title: "첫 실습: 업무 완료 확인하기", color: COL.green, soft: COL.greenSoft,
    lead: "자동화 아이콘 → 새 자동화 → 트리거: 상태가 완료 → 동작: 완료 확인 체크",
    points: ["자동화 아이콘이 안 보이면 ••• → 자동화 확인", "자동화 이름: 업무 완료 확인", "연습 행의 상태를 완료로 바꿔 체크 확인"],
    tip: "상태를 되돌려도 체크는 자동으로 풀리지 않아요. 필요하면 별도 자동화를 만들어요.",
    image: img("p06_s05"), notes: "강사 화면으로 시연합니다. 유료 플랜을 쓰시는 분은 함께 따라 해 보세요." });
  capSlide({ section: P4, kicker: "PART 4 · 활용 예시", title: "수업이 끝나면 돌아보기 페이지 만들기", color: COL.green, soft: COL.greenSoft,
    lead: "국어 3차시를 완료로 바꾸면 수업 성찰 DB에 새 페이지가 생겨요",
    points: ["출발 DB: 수업 아카이브 (수업명, 상태)", "도착 DB: 수업 성찰", "트리거: 상태가 완료로 바뀔 때"],
    tip: "같은 일을 버튼으로 만들면 ‘수업 끝’ 버튼이 돼요. 플랜에 맞게 골라 쓰세요.",
    image: img("p06_s08"), notes: "PART 2의 수업 끝 버튼과 같은 결과를 자동화로 만든 예시입니다. 버튼과 자동화 중 내 상황에 맞는 것을 고르시면 됩니다." });

  // ===== PART 5 챌린지 =====
  const P5 = "PART 5 라이브 챌린지";
  divider({ section: P5, part: "PART 5", title: "노션 라이브\n챌린지 안내", sub: "2주 동안 나만의 데이터베이스 자동화를 완성하고 함께 인증해요", ill: img("ill_w1"), time: "13분" });
  {
    const s = newSlide(P5);
    header(s, "라이브 챌린지 로드맵", "2주 동안 이렇게 진행해요");
    const wk = [
      ["ill_w1", "1주차", "계획 및 데이터베이스 구축", "내 업무 DB 1개 + 재사용 템플릿 1개", COL.accent, COL.accentSoft],
      ["ill_w2", "2주차", "데이터베이스 자동화 완성 및 공유", "업무 관리 DB + 하루 기록 DB + 작동하는 버튼 수식 또는 DB 자동화 1개", COL.green, COL.greenSoft],
    ];
    wk.forEach(([im, w, t, out, c, soft], i) => {
      const x = 0.45 + i * 4.65;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.25, w: 4.45, h: 3.75, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.line }, shadow: shadow() });
      s.addImage({ path: img(im), x: x + 0.2, y: 1.4, w: 1.9, h: 1.9 * 348 / 626, altText: w + " 일러스트" });
      s.addText([{ text: w, options: { fontSize: 20, bold: true, color: c, breakLine: true } }, { text: t, options: { fontSize: 14, bold: true, color: COL.ink } }], { x: x + 2.2, y: 1.4, w: 2.1, h: 1.06, fontFace: FONT, valign: "middle", margin: 0, isTextBox: true });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.2, y: 2.6, w: 4.05, h: 1.15, rectRadius: 0.06, fill: { color: soft }, line: { color: soft } });
      s.addText([{ text: "완성 결과  ", options: { bold: true, color: c } }, { text: out }], { x: x + 0.35, y: 2.6, w: 3.8, h: 1.15, fontFace: FONT, fontSize: 14, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
      s.addText([{ text: "인증  ", options: { bold: true, color: c } }, { text: "화면 캡처 1장 + 한 줄 문장 공유" }], { x: x + 0.35, y: 3.9, w: 3.8, h: 0.9, fontFace: FONT, fontSize: 14, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addNotes("챌린지는 2주 과정입니다. 1주차에는 내 업무에 맞는 데이터베이스와 템플릿을 만들고, 2주차에는 그 DB에 버튼 수식이나 자동화를 더해 완성합니다. 매주 화면 한 장과 한 줄 문장으로 인증해 주세요.");
  }
  capSlide({ section: P5, kicker: "1주차 · 계획 및 데이터베이스 구축", title: "1주차 미션: 내 DB 1개 + 템플릿 1개",
    lead: "자주 쓰는 데이터베이스를 하나 완성하고, 반복해서 쓸 템플릿을 만들어요",
    points: ["예: 수업 자료 모음 DB에 과목별 자료 쌓기", "‘수업 자료 정리’ 템플릿으로 같은 틀로 기록", "매번 항목을 새로 만들지 않아도 돼요"],
    image: img("p08_s00"), notes: "1주차 미션입니다. 거창한 DB보다 내가 매주 쓰게 될 DB 하나를 고르는 것이 가장 중요합니다." });
  capSlide({ section: P5, kicker: "1주차 · 주제 고르기", title: "어떤 데이터베이스를 만들까요?",
    lead: "수업 자료 모음 · 주간 업무 관리 · 독서 기록장 · 학급 운영 아이디어",
    points: ["수업 자료를 찾아 헤맨다면 → 수업 자료 모음", "할 일을 한곳에서 보고 싶다면 → 주간 업무 관리", "아이디어를 모은다면 → 학급 운영 아이디어"],
    tip: "처음이라면 ‘주간 업무 관리’ 예시를 그대로 만든 뒤 내 상황에 맞게 바꿔 보세요.",
    image: img("p08_s02"), notes: "네 가지 주제 중에 하나를 골라 보세요. 처음이시면 자료 페이지의 주간 업무 관리 예시를 그대로 따라 만드시면 됩니다." });
  capSlide({ section: P5, kicker: "1주차 · 함께 따라 하기", title: "주간 업무 관리 DB + 업무 준비 카드",
    lead: "DB 만들기 → 속성 추가 → 가상 업무 입력 → 새 템플릿 → 내 업무에 맞게 수정",
    points: ["속성: 상태, 마감일, 업무 영역", "템플릿 ‘업무 준비 카드’, 상태 기본값 시작 전", "체크리스트 항목을 하나 이상 내 업무로 수정"],
    tip: "성공: 템플릿으로 새 페이지를 만들면 준비한 틀이 나타나요.",
    image: img("p08_s07"), notes: "일곱 단계를 그대로 따라 하시면 됩니다. 여유가 있으면 템플릿 반복 설정도 살펴보세요." });
  capSlide({ section: P5, kicker: "1주차 · 적용하고 인증하기", title: "한 주 동안 적용하고 인증하기",
    lead: "DB 또는 템플릿 화면 한 장 + 한 줄 문장 공유",
    points: ["주제를 골라 DB 만들기, 속성·가상 자료 입력", "재사용 템플릿 1개 만들고 적용하기", "다음 주에 이 DB를 언제 쓸지 정하기"],
    tip: "예) 저는 주간 업무 관리 DB를 만들었어요. 다음 주부터 학년 회의 준비를 기록할 때 쓰겠습니다.",
    image: img("p08_s08"), notes: "인증 문장 예시를 그대로 활용하셔도 좋습니다. 공유 화면에는 실제 학생 이름, 상담 내용, 연락처를 넣지 않습니다." });
  capSlide({ section: P5, kicker: "2주차 · 데이터베이스 자동화 완성 및 공유", title: "2주차 미션: 나의 다이어리 완성하기", color: COL.green, soft: COL.greenSoft,
    lead: "업무 관리 DB + 하루 기록 DB + 작동하는 버튼 수식 또는 DB 자동화 1개",
    points: ["업무 관리: 할 일과 처리 상태 확인", "하루 기록: 오늘의 계획과 돌아보기", "완료 기록 버튼 → 상태 완료 + 완료 시각 기록"],
    tip: "1주차에 만든 업무 DB가 있다면 새로 만들지 말고 그 DB를 활용해요.",
    image: img("p09_s01"), notes: "2주차에는 1주차 DB를 확장해 다이어리를 완성합니다. 업무 관리와 하루 기록 두 DB를 연결해 쓰는 구조예요." });
  capSlide({ section: P5, kicker: "2주차 · 기본 실습", title: "완료 버튼에 날짜 수식 넣기", color: COL.green, soft: COL.greenSoft,
    lead: "버튼 한 번으로 상태와 완료 시각을 함께 기록해요",
    points: ["완료 시각 날짜 속성 추가", "완료 기록 버튼 → 이 페이지 속성 편집", "상태 → 완료, 완료 시각 → ∑ now()"],
    tip: "다시 누르면 완료 시각이 새로 기록될 수 있어요. 연습용 행으로 먼저 확인!",
    image: img("p09_s05"), notes: "오늘 PART 3에서 배운 버튼 수식을 그대로 적용하는 실습입니다. now() 하나면 완료 시각이 기록됩니다." });
  capSlide({ section: P5, kicker: "2주차 · 도전 실습", title: "후속 업무 자동으로 만들기", color: COL.green, soft: COL.greenSoft,
    lead: "현장체험학습 계획을 완료하면 ‘가정통신문 안내하기’가 새 업무로 생겨요",
    points: ["적용 범위를 실습용 보기로 제한", "트리거: 상태가 완료로 바뀔 때", "동작: 업무 DB에 페이지 추가", "테스트 후 자동화 일시 정지·정리"],
    tip: "무료 플랜은 DB 버튼으로 후속 업무를 직접 만드는 방식으로 참여해요.",
    image: img("p09_s06"), notes: "도전 실습입니다. 다른 업무까지 자동화가 적용되지 않는지, 중복 생성되지 않는지 꼭 확인해 주세요." });
  capSlide({ section: P5, kicker: "2주차 · 확장과 인증", title: "내 다이어리에 맞게 골라 확장하기", color: COL.green, soft: COL.greenSoft,
    lead: "모두 만들 필요는 없어요. 기능 1가지만 제대로 작동해도 성공!",
    points: ["날짜 기록: now()로 완료 시각", "숫자 기록: 독서 쪽수·완료 횟수 더하기", "같은 값 재사용: 변수 정의", "다음 업무 만들기: DB 자동화"],
    tip: "인증: 다이어리 화면 또는 버튼 실행 전·후 화면 + 한 줄 문장",
    image: img("p09_s07"), notes: "네 가지 확장 중 하나만 골라 완성해도 충분합니다. 인증할 때는 버튼 실행 전과 후 화면을 함께 올려 주시면 다른 선생님들께 큰 도움이 됩니다." });

  // ===== 유의사항 =====
  {
    const s = newSlide("마무리");
    header(s, "꼭 지켜 주세요", "실습·인증 유의사항");
    const items = [
      ["01", "개인정보 보호", "실제 학생 이름, 상담 내용, 연락처는 실습·인증 화면에 넣지 않아요. 가상 자료로 실습합니다."],
      ["02", "연습용 행으로 먼저 테스트", "버튼·자동화는 반복 실행되면 기존 값을 바꿀 수 있어요. 연습 행에서 확인한 뒤 실제 DB에 적용해요."],
      ["03", "요금제 확인", "일반 DB 자동화와 메일·웹훅 버튼은 유료예요. 무료 플랜은 버튼으로 같은 흐름을 만들어요."],
      ["04", "중복 실행 막기", "후속 업무가 중복 생성되지 않는지, 다른 업무에 적용되지 않는지 확인하고 확인 창을 넣어요."],
    ];
    items.forEach(([ic, h, t], i) => {
      const x = 0.45 + (i % 2) * 4.62, y = 1.25 + Math.floor(i / 2) * 1.9;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.48, h: 1.75, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.line }, shadow: shadow() });
      s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.18, w: 0.55, h: 0.55, fill: { color: COL.ink }, line: { color: COL.ink } });
      s.addText(ic, { x: x + 0.2, y: y + 0.18, w: 0.55, h: 0.55, fontFace: FONT, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addText(h, { x: x + 0.85, y: y + 0.15, w: 3.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: COL.accent, valign: "middle", margin: 0, isTextBox: true });
      s.addText(t, { x: x + 0.85, y: y + 0.65, w: 3.5, h: 1.0, fontFace: FONT, fontSize: 13, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addNotes("마지막으로 꼭 지켜 주셔야 할 네 가지입니다. 특히 인증 화면에 학생 정보가 보이지 않도록 한 번 더 확인해 주세요.");
  }

  // ===== 정리 & 적용 계획 =====
  {
    const s = newSlide("마무리");
    header(s, "정리", "오늘 배운 것, 이렇게 이어 가요");
    const flow = [["템플릿", "만들 때 자동으로"], ["버튼", "누를 때 한 번에"], ["버튼 수식·변수", "누르는 순간 계산"], ["DB 자동화", "조건이 생기면 저절로"]];
    flow.forEach(([h, t], i) => {
      const x = 0.45 + i * 2.32;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.3, w: 2.05, h: 1.25, rectRadius: 0.08, fill: { color: COL.accentSoft }, line: { color: COL.accentSoft } });
      s.addText([{ text: h, options: { bold: true, fontSize: 16, color: COL.accent, breakLine: true } }, { text: t, options: { fontSize: 13, color: COL.ink } }], { x, y: 1.3, w: 2.05, h: 1.25, fontFace: FONT, align: "center", valign: "middle", margin: 0, isTextBox: true });
      if (i < 3) s.addText("→", { x: x + 2.05, y: 1.3, w: 0.27, h: 1.25, fontSize: 18, bold: true, color: COL.accent, align: "center", valign: "middle", margin: 0, isTextBox: true });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 2.8, w: 9.1, h: 2.2, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.accent, width: 1.5, dashType: "dash" } });
    s.addText("채팅창에 남겨 주세요: 나의 적용 계획", { x: 0.7, y: 2.92, w: 8.6, h: 0.45, fontFace: FONT, fontSize: 16, bold: true, color: COL.accent, margin: 0, isTextBox: true });
    s.addText([
      { text: "1주차에 만들 DB 주제: ______________________", options: { breakLine: true } },
      { text: "가장 먼저 자동화하고 싶은 반복 업무: ______________________", options: { breakLine: true } },
      { text: "다음 주에 이 DB를 쓸 시간: ______________________" },
    ], { x: 0.7, y: 3.4, w: 8.6, h: 1.5, fontFace: FONT, fontSize: 15, color: COL.ink, paraSpaceAfter: 8, valign: "middle", margin: 0, isTextBox: true });
    s.addNotes("오늘 배운 네 가지 스위치를 다시 정리합니다. 채팅창에 1주차 DB 주제와 가장 먼저 자동화하고 싶은 업무를 남겨 주세요. 서로의 계획을 보면 아이디어가 더 늘어납니다.");
  }

  // ===== Q&A · 마무리 =====
  {
    const s = newSlide("마무리");
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.18, fill: { color: COL.accent }, line: { color: COL.accent } });
    s.addImage({ path: img("gomgom-bear"), x: 0.7, y: 1.0, w: 2.6, h: 2.6, altText: "곰곰이쌤 캐릭터" });
    s.addText("Q & A", { x: 3.7, y: 1.0, w: 5.8, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: COL.accent, margin: 0, isTextBox: true });
    s.addText("혼자 하기 어려운 자동화, 2주 동안 함께 완성해요!", { x: 3.7, y: 1.95, w: 5.8, h: 0.6, fontFace: FONT, fontSize: 20, bold: true, color: COL.ink, margin: 0, isTextBox: true });
    s.addText([
      { text: "자료 페이지: 노션 자동화 라이브 챌린지", options: { breakLine: true } },
      { text: "커뮤니티: 노션톡 · 블로그: 곰곰이쌤", options: { breakLine: true } },
      { text: "1주차 인증 마감: __월 __일 (__)" },
    ], { x: 3.7, y: 2.7, w: 5.8, h: 1.3, fontFace: FONT, fontSize: 15, color: COL.sub, paraSpaceAfter: 6, margin: 0, isTextBox: true });
    s.addText("감사합니다 · 곰곰이쌤 이혜경", { x: 3.7, y: 4.35, w: 5.8, h: 0.45, fontFace: FONT, fontSize: 16, bold: true, color: COL.ink, margin: 0, isTextBox: true });
    s.addNotes("궁금한 점을 채팅창에 남겨 주세요. 웨비나 이후 질문은 노션톡 커뮤니티에 올려 주시면 함께 답해 드립니다. 2주 동안 함께 완성해 봐요. 감사합니다.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("written", OUT, pageNo, "slides");
})();
