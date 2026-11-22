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
    s.addText("템플릿 · 버튼 · 데이터베이스 자동화로\n나만의 데이터베이스 자동화 완성하기", { x: 0.6, y: 2.35, w: 6.6, h: 0.95, fontFace: FONT, fontSize: 18, color: COL.sub, margin: 0, isTextBox: true });
    s.addShape(pres.shapes.LINE, { x: 0.6, y: 3.6, w: 5.2, h: 0, line: { color: COL.line, width: 1.5 } });
    s.addText([
      { text: "대상  ", options: { bold: true } }, { text: "노션으로 반복 업무를 줄이고 싶은 선생님 (온라인 라이브)", options: { breakLine: true } },
      { text: "일시  ", options: { bold: true } }, { text: "20__년 __월 __일 (__) __:__ ~ __:__", options: { breakLine: true } },
      { text: "강사  ", options: { bold: true } }, { text: "곰곰이쌤 이혜경 (단샘초등학교 교사 · Notion Creator)" },
    ], { x: 0.6, y: 3.75, w: 6.6, h: 1.2, fontFace: FONT, fontSize: 14, color: COL.ink, margin: 0, paraSpaceAfter: 4, isTextBox: true });
    s.addImage({ path: img("gomgom-bear"), x: 7.35, y: 0.55, w: 2.25, h: 2.25, altText: "곰곰이쌤 곰돌이 캐릭터" });
    const ia = pngSize(img("ill_auto"));
    s.addImage({ path: img("ill_auto"), x: 7.0, y: 3.05, w: 2.6, h: 2.6 * ia.h / ia.w, altText: "데이터베이스 자동화 일러스트" });
    s.addNotes("반갑습니다. 노션톡 라이브 챌린지 1기 웨비나에 오신 선생님들 환영합니다. 오늘은 교사로서 노션을 활용하는 큰 그림을 먼저 보고, 데이터베이스와 템플릿, 버튼 자동화, 데이터베이스 자동화를 차례로 배웁니다. 마지막에는 다음 주부터 시작하는 라이브 챌린지를 안내합니다.");
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
  capSlide({ section: "오프닝", kicker: "노션톡에서 함께 배워요", title: "오늘의 자료실: 노션 자동화 라이브 챌린지",
    lead: "오늘 수업과 챌린지 자료를 한 페이지에 모았어요",
    points: ["교사를 위한 노션 활용 한눈에 보기", "수업 목차와 PART별 실습 페이지", "라이브 챌린지 활동 안내와 온보딩"],
    image: img("hub_s02"), notes: "오늘 보시는 내용은 모두 이 노션 페이지에 정리되어 있습니다. 링크를 열어 두고 슬라이드와 함께 보시면 따라오기 쉽습니다." });

  // ===== 4. 노션 활용 개괄 =====
  {
    const s = newSlide("오프닝");
    header(s, "큰 그림", "교사를 위한 노션 활용, 한눈에 보기");
    const steps = [
      ["1", "기록하기", "페이지에 자유롭게 적기", "수업 일지, 회의 메모, 연수 정리"],
      ["2", "관리하기", "데이터베이스로 모으고 찾기", "업무 관리 DB, 출결·상담·관찰 기록 DB"],
      ["3", "자동화하기", "템플릿·버튼·자동화로 반복 줄이기", "버튼 하나로 출결 기록 추가, 완료 시각 자동 기록"],
    ];
    steps.forEach(([n, h, d, ex], i) => {
      const x = 0.45 + i * 3.07;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.3, w: 2.9, h: 2.7, rectRadius: 0.08, fill: { color: i === 2 ? COL.ink : COL.accentSoft }, line: { color: i === 2 ? COL.ink : COL.accentSoft } });
      const fg = i === 2 ? "FFFFFF" : COL.ink;
      s.addText(n, { x: x + 0.2, y: 1.42, w: 0.6, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: fg, margin: 0, isTextBox: true });
      s.addText(h, { x: x + 0.2, y: 2.05, w: 2.5, h: 0.45, fontFace: FONT, fontSize: 20, bold: true, color: fg, margin: 0, isTextBox: true });
      s.addText(d, { x: x + 0.2, y: 2.55, w: 2.5, h: 0.6, fontFace: FONT, fontSize: 14, color: fg, valign: "top", margin: 0, isTextBox: true });
      s.addText("예) " + ex, { x: x + 0.2, y: 3.2, w: 2.5, h: 0.7, fontFace: FONT, fontSize: 13, color: i === 2 ? "DDDDDD" : COL.sub, valign: "top", margin: 0, isTextBox: true });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 4.15, w: 9.1, h: 0.85, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.ink, width: 1.25, dashType: "dash" } });
    s.addText("노션이 사랑받는 이유는 반복 업무를 자동화하는 시스템 덕분이에요. 오늘은 3단계 '자동화하기'의 바탕이 되는 템플릿, 버튼, 데이터베이스 자동화를 하나씩 배웁니다.", { x: 0.65, y: 4.15, w: 8.7, h: 0.85, fontFace: FONT, fontSize: 14, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    s.addNotes("교사가 노션을 쓰는 단계를 세 가지로 나눠 보면, 기록하기, 관리하기, 자동화하기입니다. 처음에는 페이지에 적는 것부터 시작하지만, 데이터베이스로 모으고, 템플릿과 버튼으로 반복을 줄이면 업무가 눈에 띄게 가벼워집니다. 예를 들어 출결·상담·관찰 기록을 버튼 하나로 입력하고 학생 페이지에서 한 번에 모아 볼 수 있습니다.");
  }

  // ===== 5. 목표 =====
  {
    const s = newSlide("오프닝");
    header(s, "웨비나 목표", "오늘 이것만은 가져가세요");
    const goals = [
      ["인지적 목표", "템플릿·버튼·데이터베이스 자동화가 각각 ‘언제’ 실행되는지 구분한다."],
      ["행동적 목표", "내 업무 DB에 템플릿 1개와 버튼 또는 자동화 1개를 직접 만들어 작동시킨다."],
      ["정의적 목표", "반복 업무를 ‘자동화할 수 있는 일’로 바라보고 동료와 사례를 나눈다."],
    ];
    goals.forEach(([h, t], i) => {
      const x = 0.45 + i * 3.07;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.3, w: 2.9, h: 1.95, rectRadius: 0.08, fill: { color: COL.accentSoft }, line: { color: COL.accentSoft } });
      s.addText(h, { x: x + 0.2, y: 1.42, w: 2.5, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: COL.ink, margin: 0, isTextBox: true });
      s.addText(t, { x: x + 0.2, y: 1.85, w: 2.5, h: 1.3, fontFace: FONT, fontSize: 14, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 3.45, w: 9.1, h: 1.55, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.ink, width: 1.5 } });
    s.addText("오늘 들고 가실 것", { x: 0.7, y: 3.55, w: 3, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: COL.ink, margin: 0, isTextBox: true });
    const outs = ["자료 페이지 복제본", "내 업무 DB 아이디어 1개", "버튼·자동화 설계 1개", "챌린지 계획(계획하기)"];
    outs.forEach((t, i) => {
      const x = 0.7 + i * 2.2;
      s.addShape(pres.shapes.OVAL, { x, y: 4.1, w: 0.5, h: 0.5, fill: { color: COL.ink }, line: { color: COL.ink } });
      s.addText(String(i + 1), { x, y: 4.1, w: 0.5, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addText(t, { x: x + 0.58, y: 3.98, w: 1.55, h: 0.75, fontFace: FONT, fontSize: 13, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addNotes("기능 이름을 외우는 것보다 각 기능이 언제 실행되는지를 구분하는 것이 핵심입니다. 웨비나가 끝나면 네 가지를 들고 가시게 됩니다.");
  }

  // ===== 6. 타임테이블 =====
  {
    const s = newSlide("오프닝");
    header(s, "진행 순서 (90분 기준, 시간은 조정 가능)", "오늘의 타임테이블");
    const rows = [
      ["0:00~0:10", "오프닝 · 세팅", "노션 활용 큰 그림, 자료 페이지 복제", "자료 페이지 복제본"],
      ["0:10~0:15", "라이브 챌린지 안내", "계획하기 · 적용하기 · 나눔하기, 온보딩", "챌린지 일정"],
      ["0:15~0:35", "PART 1 DB와 템플릿", "데이터베이스 구성, 템플릿 설정", "DB 1개 + 템플릿 1개"],
      ["0:35~1:00", "PART 2 버튼 자동화", "템플릿 페이지 · 블록 입력 · DB 수정·입력", "버튼 1개"],
      ["1:00~1:15", "PART 3 DB 자동화", "트리거 → 동작 맛보기", "자동화 설계 1개"],
      ["1:15~1:25", "심화", "꼭 활용하면 좋은 노션 수식 7가지", "수식 1개"],
      ["1:25~1:30", "Q&A · 마무리", "질문, 적용 계획 공유", "다음 주 적용 1가지"],
    ];
    const head = ["시간", "블록", "활동", "산출물"].map(t => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: COL.ink }, align: "center" } }));
    const body = rows.map((r, i) => r.map((t, j) => ({ text: t, options: { color: COL.ink, bold: j === 1, fill: { color: i % 2 ? "FFFFFF" : "F5F5F5" }, align: j === 0 ? "center" : "left" } })));
    s.addTable([head, ...body], { x: 0.45, y: 1.25, w: 9.1, colW: [1.35, 2.25, 3.4, 2.1], rowH: 0.46, fontFace: FONT, fontSize: 13, border: { type: "solid", pt: 0.75, color: COL.line }, valign: "middle", margin: [0, 0.08, 0, 0.08] });
    s.addNotes("90분 기준 타임테이블입니다. 실제 웨비나 시간에 맞춰 조정하세요. PART 2가 가장 길고, 심화는 시간이 부족하면 자료 안내로 대신해도 됩니다.");
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



  // ===== 라이브 챌린지 안내 =====
  {
    const s = newSlide("라이브 챌린지");
    header(s, "라이브 챌린지 활동 안내", "오늘 배운 내용을 내 업무에 적용해요");
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 1.25, w: 9.1, h: 0.95, rectRadius: 0.08, fill: { color: COL.ink }, line: { color: COL.ink } });
    s.addText([{ text: "라이브 챌린지 온보딩   ", options: { bold: true, fontSize: 18 } }, { text: "11월 25일(수) 저녁 8:00 ~ 8:30", options: { bold: true, fontSize: 18, breakLine: true } }, { text: "챌린지 진행 방법과 인증 방법을 안내합니다.", options: { fontSize: 13, color: "DDDDDD" } }], { x: 0.7, y: 1.25, w: 8.7, h: 0.95, fontFace: FONT, color: "FFFFFF", valign: "middle", margin: 0, isTextBox: true });
    const st = [
      ["1. 계획하기", "내 반복 업무 찾기", "자동화하고 싶은 업무를 고르고 템플릿·버튼·DB 자동화 중 무엇을 쓸지 정해요."],
      ["2. 적용하기", "내 DB에 직접 만들기", "데이터베이스와 템플릿을 만들고 버튼 또는 자동화를 1개 이상 작동시켜요."],
      ["3. 나눔하기", "인증하고 함께 보기", "만들기 전·후 화면 한 장과 한 줄 소감을 공유해요."],
    ];
    st.forEach(([h, sub, t], i) => {
      const x = 0.45 + i * 3.07;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.4, w: 2.9, h: 2.6, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.line }, shadow: shadow() });
      s.addText(h, { x: x + 0.2, y: 2.52, w: 2.5, h: 0.45, fontFace: FONT, fontSize: 18, bold: true, color: COL.ink, margin: 0, isTextBox: true });
      s.addText(sub, { x: x + 0.2, y: 2.97, w: 2.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: COL.sub, margin: 0, isTextBox: true });
      s.addText(t, { x: x + 0.2, y: 3.4, w: 2.5, h: 1.45, fontFace: FONT, fontSize: 13, color: COL.ink, valign: "top", margin: 0, isTextBox: true });
      if (i < 2) s.addText("→", { x: x + 2.9, y: 3.4, w: 0.17, h: 0.5, fontSize: 16, bold: true, color: COL.ink, align: "center", margin: 0, isTextBox: true });
    });
    s.addNotes("오늘 수업이 끝나면 라이브 챌린지가 시작됩니다. 다음 주 수요일 11월 25일 저녁 8시부터 8시 30분까지 온보딩에서 진행 방법과 인증 방법을 자세히 안내합니다. 챌린지는 계획하기, 적용하기, 나눔하기 세 단계로 진행됩니다. 인증 화면에는 실제 학생 정보를 넣지 않도록 해 주세요.");
  }
  capSlide({ section: "라이브 챌린지", kicker: "라이브 챌린지 활동 안내", title: "노션 페이지에서 확인하기",
    lead: "온보딩 일정과 단계별 할 일이 수업 페이지에 정리되어 있어요",
    points: ["온보딩: 11월 25일(수) 저녁 8:00~8:30", "계획하기 → 적용하기 → 나눔하기", "인증은 가상 자료로"],
    tip: "인증 화면에는 실제 학생 이름, 상담 내용, 연락처를 넣지 않아요.",
    image: img("hub_s03"), notes: "자료 페이지의 라이브 챌린지 활동 안내 부분입니다. 온보딩 전에 한 번 읽어 와 주세요." });

  // ===== 수업 목차 =====
  {
    const s = newSlide("수업 목차");
    header(s, "오늘 수업 목차", "노션의 기본 자동화 시스템");
    const cards = [
      ["ill_tpl", "PART 1", "데이터베이스와 템플릿", "페이지를 만들 때 · 반복 시각", "DB 구성하기, 템플릿 설정"],
      ["ill_btn", "PART 2", "버튼 자동화", "선생님이 직접 누를 때", "템플릿 페이지 · 블록 입력 · DB 수정·입력"],
      ["ill_auto", "PART 3", "데이터베이스 자동화", "트리거가 생기면 저절로", "트리거 → 동작 맛보기"],
    ];
    cards.forEach(([im, p, h, when, what], i) => {
      const x = 0.45 + i * 3.07;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.25, w: 2.9, h: 3.25, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.line }, shadow: shadow() });
      const sz = pngSize(img(im));
      s.addImage({ path: img(im), x: x + 0.15, y: 1.35, w: 2.6, h: 2.6 * sz.h / sz.w, altText: h + " 일러스트" });
      s.addText([{ text: p + "  ", options: { bold: true, color: COL.sub } }, { text: h, options: { bold: true } }], { x: x + 0.15, y: 2.85, w: 2.6, h: 0.42, fontFace: FONT, fontSize: 15, color: COL.ink, margin: 0, isTextBox: true });
      s.addText([{ text: "언제? ", options: { bold: true } }, { text: when, options: { breakLine: true } }, { text: what, options: { color: COL.sub } }], { x: x + 0.15, y: 3.3, w: 2.6, h: 1.1, fontFace: FONT, fontSize: 13, color: COL.ink, valign: "top", margin: 0, isTextBox: true });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 4.62, w: 9.1, h: 0.42, rectRadius: 0.08, fill: { color: COL.accentSoft }, line: { color: COL.accentSoft } });
    s.addText([{ text: "심화  ", options: { bold: true } }, { text: "버튼 수식 · 변수 정의 · 꼭 활용하면 좋은 노션 수식 7가지" }], { x: 0.65, y: 4.62, w: 8.7, h: 0.42, fontFace: FONT, fontSize: 13, color: COL.ink, valign: "middle", margin: 0, isTextBox: true });
    s.addNotes("오늘 배울 기능을 스위치로 생각해 보세요. 템플릿은 만들 때 켜지는 스위치, 버튼은 직접 누르는 스위치, 데이터베이스 자동화는 트리거가 생기면 저절로 켜지는 스위치입니다. 시간이 되면 심화로 버튼 수식과 변수, 꼭 활용하면 좋은 수식 7가지를 살펴봅니다.");
  }
  // ===== PART 1 =====
  const P1 = "PART 1 DB와 템플릿";
  divider({ section: P1, part: "PART 1", title: "데이터베이스와\n템플릿", sub: "같은 모양의 기록을 모으고, 새 페이지마다 같은 틀과 기본값을 자동으로 채워요", ill: img("ill_tpl"), time: "20분" });
  capSlide({ section: P1, kicker: "PART 1 · 데이터베이스 구성하기", title: "어떤 속성을 쓸까요?",
    lead: "속성을 잘 설계하면 템플릿·버튼·자동화가 모두 그 위에서 움직여요",
    points: ["선택·상태: 유형, 진행 단계", "날짜·체크박스: 마감일, 서류 제출", "관계형: 다른 DB와 연결", "버튼·수식: 자동화와 계산"],
    image: img("db_s01"), notes: "데이터베이스는 같은 모양의 기록을 모으는 표이고, 표의 칸을 속성이라고 부릅니다. 어떤 속성을 쓰느냐가 이후 자동화를 결정합니다." });
  capSlide({ section: P1, kicker: "PART 1 · 데이터베이스 구성하기", title: "예시: 출결 DB 설계하기",
    lead: "내용 · 학생명렬DB · 유형 · 날짜 · 교시 · 서류",
    points: ["유형: 병결 / 병조퇴 / 병지각 / 체험학습", "교시는 병조퇴·병지각일 때만", "내용(제목)은 PART 3에서 자동 입력"],
    tip: "실습에서는 가상 이름만 사용해요.",
    image: img("db_s02"), notes: "오늘 수업은 출결 DB 하나로 템플릿, 버튼, 자동화까지 이어 갑니다." });
  capSlide({ section: P1, kicker: "PART 1 · 데이터베이스 구성하기", title: "학생 명렬표 DB와 관계형으로 연결하기",
    lead: "연결하면 학생 페이지에서 그 학생의 출결 기록이 모두 보여요",
    points: ["+ → 관계형 → 학생 명렬표 DB", "학생 명렬표 DB에 표시 켜기 (양방향)", "기록 한 줄에 학생 연결해 보기"],
    tip: "관계형 연결이 없어도 자동화는 가능해요. 학생별로 모아 보기 위해 연결합니다.",
    image: img("db_s03"), notes: "관계형으로 연결하면 학생별로 기록을 모아 볼 수 있습니다." });
  capSlide({ section: P1, kicker: "PART 1 · 데이터베이스 구성하기", title: "보기 만들기와 내 업무로 바꾸기",
    lead: "표 · 보드 · 캘린더 · 필터 표로 같은 데이터를 다르게 봐요",
    points: ["보드: 유형별로 모아 보기", "캘린더: 이번 달 출결 한눈에", "필터: 서류 미제출만 보기"],
    image: img("db_s04"), notes: "보기를 바꾸면 같은 데이터를 목적에 맞게 볼 수 있습니다. 출결 DB 대신 주간 업무, 수업 자료, 독서 기록 등 내 업무 DB로 같은 순서를 밟아도 됩니다." });
  capSlide({ section: P1, kicker: "PART 1 · 템플릿", title: "템플릿은 ‘같은 틀 + 기본값’ 자동 채우기",
    lead: "새 페이지를 만들 때마다 같은 틀과 기본값이 한 번에 준비돼요",
    points: ["제목 형식, 업무 영역, 상태가 미리 선택됨", "본문 틀이 함께 생김"],
    tip: "‘매번 복사해서 지우던 페이지’가 있다면 그게 바로 템플릿 후보예요.",
    image: img("tpl_s00"), notes: "템플릿은 가장 기본적인 자동화입니다." });
  capSlide({ section: P1, kicker: "PART 1 · 템플릿", title: "템플릿으로 할 수 있는 4가지",
    lead: "① 본문 틀  ② 속성 기본값  ③ 기본 템플릿  ④ 반복 생성",
    points: ["수업 성찰 질문 3개를 미리 넣기", "상담 기록 DB는 항상 상담 양식으로", "매주 월요일 주간 업무 페이지 자동 생성"],
    image: img("tpl_s02"), notes: "반복 설정은 새로 만들기 옆 화살표, 템플릿 옆 점 세 개, 반복에서 정합니다." });
  capSlide({ section: P1, kicker: "PART 1 · 함께 따라 하기 5분", title: "첫 템플릿 만들기",
    lead: "새로 만들기 ▼ → + 새 템플릿 → 이름·기본값·본문 틀 → ← 뒤로",
    points: ["템플릿 이름: 주간 업무", "기본값: 상태 시작 전", "본문: 이번 주 일정 / 처리할 업무 / 돌아보기"],
    tip: "성공 확인: 새로 만들기 ▼ → 주간 업무를 눌렀을 때 틀과 속성이 이미 채워져 있으면 성공!",
    image: img("tpl_s03"), notes: "함께 따라 해 보겠습니다. 다 되신 분은 채팅창에 성공을 남겨 주세요." });
  capSlide({ section: P1, kicker: "PART 1 · 활용 사례", title: "주간 업무 + 매주 반복",
    lead: "월요일 아침 출근하면 이번 주 페이지가 이미 준비되어 있어요",
    points: ["속성 기본값: 상태 진행 중", "반복: 매주 월요일 오전 7시"],
    image: img("tpl_s05"), notes: "반복 생성 결과는 정해 둔 시간이 지나야 확인할 수 있습니다." });

  // ===== PART 2 =====
  const P2 = "PART 2 버튼 자동화";
  divider({ section: P2, part: "PART 2", title: "버튼\n자동화", sub: "누르면 정해 둔 일이 한 번에 처리되는 ‘직접 누르는 스위치’", ill: img("ill_btn"), time: "25분" });
  capSlide({ section: P2, kicker: "PART 2-1 · 버튼으로 템플릿 페이지 자동화하기", title: "먼저 유형 템플릿 만들기",
    lead: "버튼이 불러올 템플릿을 먼저 준비해요",
    points: ["새 템플릿 → 유형 병결, 날짜 오늘", "••• → 복제로 병조퇴, 병지각, 체험학습"],
    tip: "칭찬은 노란색, 지도는 빨간색 아이콘으로 맞추면 고르기 쉬워요.",
    image: img("bt_s01"), notes: "버튼과 템플릿을 합치면 버튼 한 번에 정해진 양식의 페이지가 데이터베이스에 생깁니다." });
  capSlide({ section: P2, kicker: "PART 2-1 · 방법 ① 버튼 블록", title: "DB 밖에서 버튼으로 페이지 추가하기",
    lead: "/버튼 → 페이지 추가 위치: 출결 DB → 템플릿: 병결 → 페이지 열기",
    points: ["작업 추가 → 페이지, 양식 또는 URL 열기 → 페이지 추가됨", "버튼 복제 후 이름과 템플릿만 바꾸기"],
    image: img("bt_s02"), notes: "대시보드에 병결, 병조퇴 같은 버튼을 두면 누를 때마다 출결 기록이 생기고 바로 열립니다." });
  capSlide({ section: P2, kicker: "PART 2-1 · 방법 ② DB 버튼 속성", title: "학생 줄마다 버튼 두기",
    lead: "학생 줄에서 누르면 그 학생과 연결된 관찰 기록이 생겨요",
    points: ["페이지 추가 위치: 관찰 기록 DB, 템플릿: 수업 방해", "학생 명렬표 DB → 이 페이지", "페이지 열기 → 사이드 보기", "속성 복제로 버튼 5개"],
    image: img("bt_s03"), notes: "이 페이지를 고르면 버튼을 누른 학생이 자동으로 연결됩니다." });
  capSlide({ section: P2, kicker: "PART 2-1 · 정리", title: "버튼 블록 vs DB 버튼 속성",
    lead: "대시보드에서 빠르게는 버튼 블록, 학생·업무와 연결은 DB 버튼 속성",
    image: img("bt_s04"), notes: "두 방법의 차이를 정리합니다." });
  capSlide({ section: P2, kicker: "PART 2-2 · 버튼으로 블록 입력 자동화하기", title: "템플릿과 무엇이 다른가요?",
    lead: "템플릿은 새 페이지를, 블록 삽입 버튼은 지금 페이지 안에 블록을 넣어요",
    points: ["데이터베이스가 없어도 OK", "수업 일지, 회의 메모, 체크리스트에 딱"],
    image: img("blk_s01"), notes: "가장 쉬운 버튼 자동화입니다." });
  capSlide({ section: P2, kicker: "PART 2-2 · 함께 따라 하기", title: "블록 삽입 버튼 만들기",
    lead: "/버튼 → 새 작업 → 블록 삽입 → 위치 고르기 → 넣을 블록 작성",
    points: ["예: 오늘의 수업 기록, 동학년 협의회 메모", "준비물 체크리스트, 학생 관찰 한 줄 메모"],
    tip: "최신 기록이 위로 오게 하려면 위치를 ‘버튼 아래’로 정하세요.",
    image: img("blk_s02"), notes: "블록 삽입 동작에는 수식을 쓸 수 없습니다. 계산한 값이 필요하면 DB 버튼 속성의 속성 편집을 씁니다." });
  capSlide({ section: P2, kicker: "PART 2-3 · 버튼으로 DB 수정 및 입력하기", title: "페이지 버튼 vs 데이터베이스 버튼",
    lead: "페이지 버튼은 본문에 하나, DB 버튼은 모든 행에 하나씩",
    points: ["DB 버튼: 그 행의 상태 바꾸기, 후속 업무 만들기"],
    image: img("btn_s01"), notes: "DB 버튼은 속성 → 새 속성 → 버튼에서 만들고, 동작을 여러 개 이어 붙일 수 있습니다." });
  capSlide({ section: P2, kicker: "PART 2-3 · 버튼으로 DB 수정 및 입력하기", title: "버튼으로 할 수 있는 일",
    lead: "속성 편집 · 페이지 추가 · 알림 · 확인 창은 무료로 가능해요",
    points: ["이 페이지 속성 편집: 상태, 날짜", "다른 DB에 페이지 추가: 후속 업무", "알림 보내기, 확인 창"],
    tip: "메일 보내기·웹훅은 유료 동작이에요.",
    image: img("btn_s02"), notes: "버튼 동작을 교사 업무로 바꿔서 보면 쓸 곳이 바로 보입니다." });
  capSlide({ section: P2, kicker: "PART 2-3 · 시나리오", title: "업무 시작 / 업무 완료 버튼",
    lead: "클릭 한 번으로 속성 3개가 함께 바뀌어요",
    image: img("btn_s04"), notes: "시작 버튼과 완료 버튼 두 개만 있어도 업무 기록이 자동으로 정리됩니다." });
  capSlide({ section: P2, kicker: "PART 2-3 · 함께 따라 하기", title: "실습: 서류 완료 · 내용 입력 버튼",
    lead: "DB 버튼 속성은 트리거가 ‘버튼 클릭’이라 동작만 정하면 돼요",
    points: ["서류 완료: 속성 편집 → 서류 → 체크 표시됨", "내용 입력: 내용 → ∑ 수식으로 제목 채우기"],
    tip: "This page(이 페이지)와 속성은 수식 창 목록에서 골라 넣어요.",
    image: img("btn_prac"), notes: "출결 DB로 실습합니다. 내용 입력 버튼의 수식은 PART 3에서 자동화로 바꿔 봅니다." });

  // ===== PART 3 =====
  const P3 = "PART 3 DB 자동화";
  divider({ section: P3, part: "PART 3", title: "데이터베이스\n자동화", sub: "트리거가 생기면 다음 작업을 노션이 대신 처리하는 ‘조건 스위치’", ill: img("ill_auto"), time: "15분" });
  capSlide({ section: P3, kicker: "PART 3 · 데이터베이스 자동화", title: "자동화의 기본 공식: 트리거 → 동작",
    lead: "트리거(언제?) → 동작(무엇을?)",
    points: ["트리거: 상태가 완료로 바뀜, 페이지 추가", "동작: 완료 확인 체크, 제목 자동 입력", "버튼은 직접 누르는 스위치, DB 자동화는 조건 스위치"],
    image: img("auto_s01"), notes: "자동화는 언제와 무엇을, 두 가지만 정하면 됩니다." });
  capSlide({ section: P3, kicker: "PART 3 · 시작 전 확인", title: "요금제와 권한을 먼저 확인하세요",
    lead: "일반 DB 자동화 만들기·편집은 플러스 요금제 이상",
    points: ["무료: 자동화가 적용된 템플릿을 복제·초대받으면 사용 가능(편집 불가)", "무료라면 버튼으로 같은 흐름 만들기"],
    image: img("auto_s02"), notes: "무료 플랜 선생님은 시연을 보며 트리거와 동작을 설계해 보시고, 실제 작동은 버튼으로 구현해 보세요." });
  capSlide({ section: P3, kicker: "PART 3 · 시연", title: "첫 실습: 업무 완료 확인하기",
    lead: "⚡ → 새 자동화 → 트리거: 상태가 완료 → 동작: 완료 확인 체크",
    image: img("auto_s05"), notes: "상태를 되돌려도 체크는 자동으로 풀리지 않습니다." });
  capSlide({ section: P3, kicker: "PART 3 · 실습", title: "출결 제목 자동 입력하기",
    lead: "트리거: 페이지 추가 → 동작: 내용에 ‘유형-학생’ 자동 입력",
    points: ["수식 속 페이지 실행은 목록에서 선택", "편집된 모든 속성 트리거를 더하면 고칠 때도 갱신"],
    image: img("auto_s06"), notes: "PART 2에서 버튼으로 만든 내용 입력을 자동화로 바꾼 것입니다. 버튼의 This page 자리에 페이지 실행이 들어갑니다." });
  capSlide({ section: P3, kicker: "PART 3 · 정리", title: "DB 자동화와 버튼, 언제 무엇을 쓸까요?",
    lead: "반복되는 일은 DB 자동화, 원할 때 한 번은 버튼",
    image: img("auto_s07"), notes: "페이지 추가, 편집처럼 반복되는 일은 DB 자동화가, 확정이나 마감 처리처럼 원할 때 실행하고 싶은 일은 버튼이 잘 맞습니다." });

  // ===== 심화 =====
  const P4 = "심화";
  divider({ section: P4, part: "심화", title: "꼭 활용하면 좋은\n노션 수식 7가지", sub: "버튼 수식과 변수까지, 누르는 순간 계산해서 값을 써 넣어요", ill: img("ill_fx"), time: "10분" });
  capSlide({ section: P4, kicker: "심화 · 수식 7가지", title: "한눈에 보기",
    lead: "수식 속성 2 · 버튼 수식 2 · 변수 1 · DB 자동화 1 · 관계형 1",
    points: ["1 마감 상태  2 진행 막대", "3 칭찬 +1  4 과제 배부·완료 시각", "5 상담 후속 확인(변수)  6 출결 제목", "7 키워드 기록 개수"],
    image: img("fx7_s01"), notes: "노션 페이지의 심화 카드에서 수식을 복사해 쓸 수 있습니다." });
  capSlide({ section: P4, kicker: "심화 · 수식 속성", title: "수식 속성 vs 버튼 수식",
    lead: "수식 속성은 ‘지금 상태 보기’, 버튼 수식은 ‘이 순간을 기록하기’",
    image: img("p04_s01"), notes: "가장 헷갈리는 부분입니다. 수식 속성은 계속 계산해서 보여 주는 칸이고, 버튼 수식은 누르는 순간 계산해서 값을 써 넣습니다." });
  capSlide({ section: P4, kicker: "심화 · 수식 1", title: "완료 여부와 마감 상태 표시",
    lead: "끝난 일, 오늘 할 일, 놓친 일이 한 칸에 보여요",
    image: img("fx7_s02"), notes: "업무 DB에 가장 먼저 넣으면 좋은 수식입니다." });
  capSlide({ section: P4, kicker: "심화 · 수식 2", title: "목표 진행 막대",
    lead: "숫자를 그림처럼 보여 줘서 반응이 가장 좋아요",
    image: img("fx7_s03"), notes: "라이브 챌린지 인증 횟수에도 그대로 쓸 수 있습니다." });
  capSlide({ section: P4, kicker: "심화 · 수식 3", title: "칭찬 스티커 +1 (버튼 수식)",
    lead: "This page로 지금 값을 가져와 1을 더해요",
    image: img("fx7_s04"), notes: "실수로 누를 때를 대비해 −1 버튼도 함께 만들어 두세요." });
  capSlide({ section: P4, kicker: "심화 · 수식 5", title: "상담 후 2주 뒤 확인 업무 만들기 (변수)",
    lead: "한 번 계산한 날짜를 여러 동작에서 똑같이 써요",
    image: img("fx7_s08"), notes: "변수 정의는 동작 목록 맨 위에 둡니다. 확인 주기를 바꾸려면 변수의 14만 고치면 됩니다." });
  capSlide({ section: P4, kicker: "심화 · 챌린지 연결", title: "라이브 챌린지에서 이렇게 써 보세요",
    lead: "계획하기 1번 → 적용하기 3·4·5번 → 나눔하기 2번",
    image: img("fx7_s13"), notes: "챌린지 단계마다 수식 하나씩 적용해 보세요." });

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
    const flow = [["템플릿", "만들 때 자동으로"], ["버튼", "누를 때 한 번에"], ["DB 자동화", "트리거가 생기면 저절로"], ["수식·변수", "누르는 순간 계산"]];
    flow.forEach(([h, t], i) => {
      const x = 0.45 + i * 2.32;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.3, w: 2.05, h: 1.25, rectRadius: 0.08, fill: { color: COL.accentSoft }, line: { color: COL.accentSoft } });
      s.addText([{ text: h, options: { bold: true, fontSize: 16, breakLine: true } }, { text: t, options: { fontSize: 13 } }], { x, y: 1.3, w: 2.05, h: 1.25, fontFace: FONT, color: COL.ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
      if (i < 3) s.addText("→", { x: x + 2.05, y: 1.3, w: 0.27, h: 1.25, fontSize: 18, bold: true, color: COL.ink, align: "center", valign: "middle", margin: 0, isTextBox: true });
    });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 2.8, w: 9.1, h: 2.2, rectRadius: 0.08, fill: { color: COL.card }, line: { color: COL.ink, width: 1.5, dashType: "dash" } });
    s.addText("채팅창에 남겨 주세요: 나의 챌린지 계획하기", { x: 0.7, y: 2.92, w: 8.6, h: 0.45, fontFace: FONT, fontSize: 16, bold: true, color: COL.ink, margin: 0, isTextBox: true });
    s.addText([
      { text: "자동화하고 싶은 반복 업무: ______________________", options: { breakLine: true } },
      { text: "쓸 기능 (템플릿 / 버튼 / DB 자동화): ______________________", options: { breakLine: true } },
      { text: "11월 25일(수) 온보딩 전까지 준비할 것: ______________________" },
    ], { x: 0.7, y: 3.4, w: 8.6, h: 1.5, fontFace: FONT, fontSize: 15, color: COL.ink, paraSpaceAfter: 8, valign: "middle", margin: 0, isTextBox: true });
    s.addNotes("오늘 배운 네 가지를 다시 정리합니다. 채팅창에 자동화하고 싶은 업무와 쓸 기능을 남겨 주세요. 이것이 챌린지의 계획하기 단계입니다.");
  }

  // ===== Q&A · 마무리 =====
  {
    const s = newSlide("마무리");
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.18, fill: { color: COL.accent }, line: { color: COL.accent } });
    s.addImage({ path: img("gomgom-bear"), x: 0.7, y: 1.0, w: 2.6, h: 2.6, altText: "곰곰이쌤 캐릭터" });
    s.addText("Q & A", { x: 3.7, y: 1.0, w: 5.8, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: COL.accent, margin: 0, isTextBox: true });
    s.addText("혼자 하기 어려운 자동화, 라이브 챌린지로 함께 완성해요!", { x: 3.7, y: 1.95, w: 5.8, h: 0.6, fontFace: FONT, fontSize: 20, bold: true, color: COL.ink, margin: 0, isTextBox: true });
    s.addText([
      { text: "자료 페이지: 노션 자동화 라이브 챌린지", options: { breakLine: true } },
      { text: "커뮤니티: 노션톡 · 블로그: 곰곰이쌤", options: { breakLine: true } },
      { text: "챌린지 온보딩: 11월 25일(수) 저녁 8:00~8:30" },
    ], { x: 3.7, y: 2.7, w: 5.8, h: 1.3, fontFace: FONT, fontSize: 15, color: COL.sub, paraSpaceAfter: 6, margin: 0, isTextBox: true });
    s.addText("감사합니다 · 곰곰이쌤 이혜경", { x: 3.7, y: 4.35, w: 5.8, h: 0.45, fontFace: FONT, fontSize: 16, bold: true, color: COL.ink, margin: 0, isTextBox: true });
    s.addNotes("궁금한 점을 채팅창에 남겨 주세요. 웨비나 이후 질문은 노션톡 커뮤니티에 올려 주시면 함께 답해 드립니다. 라이브 챌린지에서 함께 완성해 봐요. 감사합니다.");
  }


  await pres.writeFile({ fileName: OUT });
  console.log("written", OUT, pageNo, "slides");
})();
