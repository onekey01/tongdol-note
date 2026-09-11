# -*- coding: utf-8 -*-
"""
통돌 Note 문서 짓기 — 바탕(CSS)과 아이콘을 **한 파일 안에 심어서** 냅니다.

★ 왜 한 파일인가 —
  기관은 이 파일을 메일로 받거나 zip 에서 꺼내 두 번 누릅니다. CSS 를
  옆 파일로 두면 하나만 옮겨졌을 때 **글이 무너진 채로** 열립니다.
  그림도 마찬가지입니다. 그래서 다 심습니다.

★ 왜 웹 글꼴을 안 쓰나 —
  이 프로그램은 **인터넷이 없어도 되는 것**이 전제입니다. 웹 글꼴은
  인터넷이 없는 PC 에서 조용히 다른 글꼴로 바뀝니다.
"""
import sys, pathlib
뿌리 = pathlib.Path(__file__).parent
css = (뿌리 / "바탕.css").read_text(encoding="utf-8")
아이콘 = (뿌리 / "아이콘64.txt").read_text().strip()


# ── 화면 그림 ─────────────────────────────────────────────────
import base64, pathlib as _pl

화면방 = _pl.Path("/tmp/설명서화면-작게")

def 그림(파일, 설명="", 클래스=""):
    """찍어 둔 화면 한 장을 **파일 안에 심어서** 내놓습니다.

    파일을 옆에 두면 하나만 옮겨졌을 때 그림이 깨집니다. 기관은 이걸
    메일로 받아 두 번 눌러 엽니다 — 한 장이어야 합니다.
    """
    길 = 화면방 / 파일
    if not 길.exists():
        raise SystemExit(f"  화면 그림이 없습니다 — {길}\n"
                         f"  먼저  bun 도구/화면찍기.ts  를 돌려 주세요.")
    b64 = base64.b64encode(길.read_bytes()).decode()
    설명칸 = f"<figcaption>{설명}</figcaption>" if 설명 else ""
    반 = f" {클래스}" if 클래스 else ""
    return (f'<figure class="그림{반}">'
            f'<img src="data:image/png;base64,{b64}" alt="">{설명칸}</figure>')

def 머리(제목, 한줄, 꼬리):
    꼬리글 = "".join(f"<span>{k} <b>{v}</b></span>" for k, v in 꼬리)
    return f"""<div class="머리">
  <div class="표시">
    <img src="data:image/png;base64,{아이콘}" width="34" height="34" alt="">
    <b>통돌 Note</b>
  </div>
  <h1>{제목}</h1>
  <p class="한줄">{한줄}</p>
  <div class="꼬리">{꼬리글}</div>
</div>"""

def 짓기(파일, 제목, 탭이름, 한줄, 꼬리, 몸, 발):
    글 = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{탭이름}</title>
<style>
{css}
</style>
</head>
<body>
<div class="종이">
{머리(제목, 한줄, 꼬리)}
<div class="속">
{몸}
</div>
<div class="발">
{발}
</div>
</div>
</body>
</html>
"""
    (뿌리 / 파일).write_text(글, encoding="utf-8")
    print(f"  {파일}  —  {len(글):,} 글자")
