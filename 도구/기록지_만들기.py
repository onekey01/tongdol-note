# -*- coding: utf-8 -*-
"""
모니터링 기록지 만들기 (매월 지자체 제출용).

방식: 서식의 행 구조를 **손대지 않습니다.**
서식에 딸려 있는 예시 5줄에 실제 자료를 덮어쓰고, 남는 줄은 비웁니다.

왜 행을 안 건드리나
  행을 복제하거나 지우면 한글이 파일을 열지 않습니다.
  (행 번호·행 개수를 다시 맞춰도 마찬가지였습니다.)
  글자만 바꾸는 것은 확실히 됩니다. 확실한 쪽을 씁니다.

한계
  한 대상자의 서비스가 5종을 넘으면 한 장에 못 담습니다.
  그 경우 장을 나눠 두 개 파일로 만듭니다.
"""
import sys
sys.path.insert(0, '/tmp')
from hwpx import Hwpx

ROWS_PER_SHEET = 5          # 서식이 가진 서비스 줄 수
R_NAME, R_ORG = 1, 2        # 대상자 기본사항 행
R_SVC = 5                   # 서비스 제공 현황 첫 줄
R_STATE, R_NOTE = 11, 12    # 서비스 제공 결과 행

상태값 = ['증상악화', '개선', '변화없음']


def 회차목록(dates, 시작회차=1):
    """['5. 28', '6. 2'] → '5. 28.(1회차)\\n6. 2.(2회차)'

    회차는 최초 제공일부터 **누적**입니다. 매달 다시 1부터 세지 않습니다.
    작성예시에서 7월 기록지에 5월 28일이 1회차로 적혀 있는 것이 그 뜻입니다.
    그래서 이 칸은 달이 갈수록 길어집니다. 손으로 쓰면 가장 고통스러운 칸이고,
    프로그램이 대신하면 가장 크게 줄어드는 칸입니다.
    """
    return '\n'.join(f'{d}.({시작회차 + i}회차)' for i, d in enumerate(dates))


def build(template, out, 대상자, 서비스들, 상태변화, 상세, 비고):
    """서비스 5종까지 한 장. 넘으면 여러 장으로 나눠 파일 여러 개를 만듭니다."""
    묶음 = [서비스들[i:i + ROWS_PER_SHEET]
            for i in range(0, max(len(서비스들), 1), ROWS_PER_SHEET)] or [[]]
    만든파일 = []

    for 장, 묶 in enumerate(묶음, start=1):
        doc = Hwpx(template)
        tbl = doc.tables()[1]
        rows = doc.rows(tbl)
        cell = lambda r, c: doc.cells(rows[r])[c]

        # 대상자 기본사항
        doc.set_cell(cell(R_NAME, 1), 대상자['name'])
        doc.set_cell(cell(R_NAME, 3), 대상자['birth'])
        doc.set_cell(cell(R_NAME, 5), 대상자['address'])
        doc.set_cell(cell(R_ORG, 1), 대상자['org'])
        doc.set_cell(cell(R_ORG, 3), 대상자['staff'])

        # 서비스 제공 현황 — 예시를 실제 자료로 덮어쓰고 남는 줄은 비웁니다
        for i in range(ROWS_PER_SHEET):
            vals = 묶[i] if i < len(묶) else [''] * 7
            for c, v in enumerate(vals):
                doc.set_cell(cell(R_SVC + i, c), v)

        # 서비스 제공 결과 — 마지막 장에만 넣습니다
        if 장 == len(묶음):
            표시 = lambda k: ('☑ ' if k == 상태변화 else '○ ') + k
            doc.set_cell(cell(R_STATE, 1), '  '.join(표시(k) for k in 상태값))
            doc.set_cell(cell(R_STATE, 3), '\n'.join(f'- {s}' for s in 상세))
            doc.set_cell(cell(R_NOTE, 1), '\n'.join(f'- {s}' for s in 비고))
        else:
            doc.set_cell(cell(R_STATE, 1), '')
            doc.set_cell(cell(R_STATE, 3), f'(다음 장에 이어짐 — {장}/{len(묶음)})')
            doc.set_cell(cell(R_NOTE, 1), '')

        path = out if len(묶음) == 1 else out.replace('.hwpx', f'_{장}.hwpx')
        doc.save(path)
        만든파일.append(path)

    return 만든파일


# ══ 견본 만들기 ════════════════════════════════════════════
if __name__ == '__main__':
    SRC = '/mnt/user-data/uploads/care-saas/서식/서비스 제공기관 기록지(서식).hwpx'

    대상자 = {'name': '김순자', 'birth': '1938-04-11',
              'address': '전남 해남군 해남읍 성내리 12',
              'org': '공룡복지관', 'staff': '박병섭'}

    서비스들 = [
        ['일상생활돌봄', '식사지원', '밑반찬 배달지원', '식사지원', '주 2회', '5. 4~',
         회차목록(['5. 28', '6. 2', '6. 4', '6. 9', '6. 11', '6. 16', '6. 18', '6. 23',
                   '6. 25', '6. 30', '7. 2', '7. 7', '7. 9', '7. 14', '7. 16', '7. 21',
                   '7. 23', '7. 28', '7. 30', '8. 4', '8. 6', '8. 11', '8. 13', '8. 18'])],
        ['일상생활돌봄', '방문이미용', '이미용서비스 제공', '이미용서비스', '월 1회', '5. 4~',
         '6. 7.(1회차)\n7. 24.(2회차)'],
        ['일상생활돌봄', '이동지원', '외출동행', '동행지원', '월 2회', '5. 4~',
         '(자녀 직접 동행으로 보류)'],
    ]

    상세 = [
        '주 2회 밑반찬 배달을 계획대로 제공하였으며, 8월 18일 24회차까지 대면 수령을 유지함.',
        '이미용서비스는 지침에 따른 최대 2회를 완료하여 해당 급여를 종결하고 안내함.',
        '외모 변화에 만족감을 표하셨고 정기 이용 의사를 명확히 표현하심.',
    ]
    비고 = [
        '서비스 개시 전 사전확인 전화로 관외 체류 여부를 선제적으로 파악함.',
        '보호자(아들)와 상담하여 가정 복귀 시점까지 일시 중단 조치 후 수시 모니터링함.',
        '외출동행은 자녀가 직접 동행 예정임을 확인하여 개시 여부를 보류·조율함.',
    ]

    made = build(SRC, '/tmp/2026-08_기록지_김순자.hwpx',
                 대상자, 서비스들, '변화없음', 상세, 비고)
    print('만든 파일:', made)

    # 확인
    from hwpx import ln
    chk = Hwpx(made[0])
    t = chk.tables()[1]
    rows = chk.rows(t)
    print('행 개수:', len(rows), '| 선언된 rowCnt:', t.attrib['rowCnt'])
    남은 = sum(1 for r in chk.root.iter()
               if ln(r.tag) == 'run' and r.attrib.get('charPrIDRef') == '10'
               and any(''.join(x.itertext()).strip() for x in r if ln(x.tag) == 't'))
    print('파란 기울임으로 남은 글자:', 남은, '개')
    for ri, r in enumerate(rows):
        txt = [' / '.join(''.join(x.itertext()) for x in c.iter() if ln(x.tag) == 't')
               for c in chk.cells(r)]
        print(f'r{ri}:', ' | '.join(s.replace('\n', '⏎')[:30] for s in txt))
