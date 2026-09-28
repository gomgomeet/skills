#!/usr/bin/env python3
"""반별 누적 차시 계산기.

여러 반을 가르치는 중·고 교사의 주당 기본 시간표와 학사일정을 받아,
각 반이 실제로 수업하는 날에 차시 번호(1, 2, 3 ...)를 순서대로 붙인다.
공휴일·행사·시험 기간에 걸린 슬롯은 자동으로 빠지므로, 반별 누적 차시가
얼마나 어긋나는지 정확히 드러난다.

핵심 개념: 진도는 "날짜"가 아니라 "차시 순번"으로 관리한다. 마스터 진도표는
차시 순번(내용·쪽·성취기준)으로 한 벌만 만들고, 이 스크립트가 반별로 그 차시가
며칠에 걸리는지, 특정 날짜 기준 각 반이 몇 차시까지 왔는지 계산해 준다.

사용법:
    python schedule.py config.json                # 표로 출력
    python schedule.py config.json --asof 2026-05-08
    python schedule.py config.json --json         # JSON으로 출력

config.json 예시는 이 파일 맨 아래 주석과 references/table-format.md 참고.
"""
import json
import sys
from datetime import date, timedelta

# 한글 요일 -> Python weekday() (월=0 ... 일=6)
DAY_TO_IDX = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4, "토": 5, "일": 6}


def parse_date(s):
    y, m, d = (int(x) for x in s.split("-"))
    return date(y, m, d)


def daterange(start, end):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def build_blocked(config):
    """수업이 없는 날짜의 집합과, 날짜 -> 사유 라벨 맵을 만든다."""
    blocked = set()
    labels = {}
    for s in config.get("no_class_dates", []):
        if isinstance(s, dict):
            d = parse_date(s["date"])
            labels[d] = s.get("label", "")
        else:
            d = parse_date(s)
        blocked.add(d)
    for r in config.get("no_class_ranges", []):
        start, end = parse_date(r["start"]), parse_date(r["end"])
        for d in daterange(start, end):
            blocked.add(d)
            labels[d] = r.get("label", "")
    return blocked, labels


def compute(config):
    start = parse_date(config["semester"]["start"])
    end = parse_date(config["semester"]["end"])
    classes = config.get("classes")
    timetable = config["timetable"]
    blocked, labels = build_blocked(config)

    # class -> [ {date, day, period, 차시} ] in chronological, period order
    result = {}
    if not classes:
        classes = sorted({e["class"] for e in timetable})
    for c in classes:
        result[c] = []

    for d in daterange(start, end):
        if d in blocked:
            continue
        day_idx = d.weekday()
        # 그 날 열리는 슬롯을 교시 순으로
        slots = [e for e in timetable if DAY_TO_IDX.get(e["day"]) == day_idx]
        slots.sort(key=lambda e: e.get("period", 0))
        for e in slots:
            c = e["class"]
            if c not in result:
                result[c] = []
            result[c].append(
                {
                    "date": d.isoformat(),
                    "day": e["day"],
                    "period": e.get("period"),
                    "차시": len(result[c]) + 1,
                }
            )
    return result, labels


def status_asof(result, asof):
    """특정 날짜(포함)까지 각 반이 도달한 차시 수와 반 간 격차."""
    counts = {}
    for c, rows in result.items():
        counts[c] = sum(1 for r in rows if parse_date(r["date"]) <= asof)
    if counts:
        hi, lo = max(counts.values()), min(counts.values())
    else:
        hi = lo = 0
    return counts, hi - lo


def print_tables(result, labels, asof):
    for c, rows in result.items():
        total = len(rows)
        print(f"\n## {c} (총 {total}차시)")
        print("| 차시 | 날짜 | 요일·교시 |")
        print("| --- | --- | --- |")
        for r in rows:
            print(f"| {r['차시']} | {r['date']} | {r['day']}{r['period']}교시 |")

    if asof:
        counts, gap = status_asof(result, asof)
        print(f"\n## {asof.isoformat()} 기준 반별 누적 차시")
        print("| 반 | 현재 차시 |")
        print("| --- | --- |")
        for c, n in counts.items():
            print(f"| {c} | {n}차시 |")
        if gap == 0:
            print(f"\n반 간 격차 없음 (모두 같은 차시). 정렬 양호.")
        else:
            print(
                f"\n반 간 격차 {gap}차시. 격차가 1을 넘으면 앞선 반은 예비(버퍼) "
                f"차시로 정리·심화하고, 늦은 반이 따라잡도록 진도를 맞춘다."
            )


def main():
    args = sys.argv[1:]
    if not args:
        print("사용법: python schedule.py config.json [--asof YYYY-MM-DD] [--json]")
        sys.exit(1)
    cfg_path = args[0]
    as_json = "--json" in args
    asof = None
    if "--asof" in args:
        asof = parse_date(args[args.index("--asof") + 1])
    elif "asof" in _load(cfg_path):
        asof = parse_date(_load(cfg_path)["asof"])

    config = _load(cfg_path)
    result, labels = compute(config)

    if as_json:
        counts, gap = status_asof(result, asof) if asof else ({}, 0)
        print(
            json.dumps(
                {"schedule": result, "asof": asof.isoformat() if asof else None,
                 "status": counts, "gap": gap},
                ensure_ascii=False, indent=2,
            )
        )
    else:
        print_tables(result, labels, asof)


_cache = {}


def _load(path):
    if path not in _cache:
        with open(path, encoding="utf-8") as f:
            _cache[path] = json.load(f)
    return _cache[path]


if __name__ == "__main__":
    main()

# config.json 예시:
# {
#   "semester": {"start": "2026-03-02", "end": "2026-07-17"},
#   "classes": ["1반", "2반", "3반"],
#   "timetable": [
#     {"day": "월", "period": 2, "class": "1반"},
#     {"day": "화", "period": 3, "class": "1반"},
#     {"day": "수", "period": 1, "class": "2반"},
#     {"day": "수", "period": 5, "class": "2반"},
#     {"day": "목", "period": 2, "class": "3반"},
#     {"day": "금", "period": 4, "class": "3반"}
#   ],
#   "no_class_dates": [
#     {"date": "2026-03-01", "label": "삼일절"},
#     {"date": "2026-05-05", "label": "어린이날"}
#   ],
#   "no_class_ranges": [
#     {"start": "2026-04-27", "end": "2026-05-01", "label": "중간고사"}
#   ],
#   "asof": "2026-05-08"
# }
