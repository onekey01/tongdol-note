# -*- coding: utf-8 -*-
"""
한글 서식(.hwpx) 채우기.

.hwpx 는 zip 안에 XML 이 든 공개 형식입니다(한글 2014 이상).
서식의 선·글꼴·여백은 건드리지 않고 글자만 바꿔 넣으므로
지자체가 받는 모습은 기관이 지금 쓰는 것과 똑같습니다.

주의 두 가지
1) 서식에 들어있는 '예시 행'은 파란 기울임체입니다. 반드시 지우고
   실제 자료로 행을 새로 만듭니다. 남겨두면 예시가 그대로 제출됩니다.
2) 글자를 넣을 때 글자모양 번호를 본문용으로 바꿔 줍니다.
   안 그러면 넣은 값도 파란 기울임체가 됩니다.
"""
import zipfile, copy, re, unicodedata
from xml.etree import ElementTree as ET

HP = 'http://www.hancom.co.kr/hwpml/2011/paragraph'


def ln(tag):
    return tag.split('}')[-1]


def _register_all(xml_text):
    """
    원본에 선언된 이름표(namespace)를 그대로 등록합니다.

    이걸 안 하면 파이썬이 hs:sec 을 ns0:sec 으로 바꾸고
    쓰지 않는 선언은 지워버립니다. 사람 눈에는 같은 XML 이지만
    한글은 '변조되었을 가능성이 있다'며 열지 않습니다.
    """
    head = xml_text[:xml_text.find('>', xml_text.find('<', xml_text.find('?>')))]
    for prefix, uri in re.findall(r'xmlns:([\w.-]+)="([^"]+)"', head):
        ET.register_namespace(prefix, uri)


def _root_tag(xml_text):
    """원본의 여는 태그를 통째로 돌려줍니다 (선언 목록 포함)."""
    start = xml_text.find('<', xml_text.find('?>') + 2)
    return xml_text[start:xml_text.find('>', start) + 1]


class Hwpx:
    def __init__(self, path):
        self.zin = zipfile.ZipFile(path)
        raw = self.zin.read('Contents/section0.xml').decode('utf-8')
        _register_all(raw)
        self.src_decl = raw[:raw.find('?>') + 2]
        self.src_root_tag = _root_tag(raw)
        self.root = ET.fromstring(raw)
        self.src_parts = self._count()
        self.header = ET.fromstring(
            self.zin.read('Contents/header.xml').decode('utf-8'))
        self._parents = None
        self._seq = 900000000          # 복제한 문단에 새로 붙일 번호

        # 글자모양 번호는 건드리지 않는 것이 기본입니다.
        # 예전에는 서식의 예시 글자가 파란 기울임이라 번호를 갈아끼웠는데,
        # 그게 한글이 파일을 거부하는 원인 중 하나였습니다.
        # 지금은 서식 자체를 검정·기울임 없음으로 고쳐 두었으므로 필요 없습니다.
        # 서식이 색을 갖고 있으면 한글에서 서식을 고치세요. 코드로 바꾸지 마세요.
        self.body_char = None

    # ── 본문용 글자모양 고르기 ─────────────────────────────
    def _pick_body_char(self):
        """예시용(파랑·기울임) 글자모양과 크기·글꼴이 같으면서
        검정이고 기울임이 아닌 것을 찾습니다."""
        chars = {}
        for cp in self.header.iter():
            if ln(cp.tag) != 'charPr':
                continue
            kids = {ln(c.tag): c.attrib for c in cp}
            chars[cp.attrib['id']] = {
                'height': cp.attrib.get('height'),
                'color': (cp.attrib.get('textColor') or '').upper(),
                'italic': 'italic' in kids,
                'bold': 'bold' in kids,
                'font': kids.get('fontRef', {}).get('hangul'),
            }
        # 파랑·기울임 = 예시용
        sample = [i for i, c in chars.items() if c['italic'] or c['color'] == '#0000FF']
        want = chars[sample[0]] if sample else None

        best = None
        for i, c in chars.items():
            if c['italic'] or c['color'] not in ('#000000', ''):
                continue
            if want and c['height'] == want['height'] and c['font'] == want['font']:
                return i
            if best is None:
                best = i
        return best or '0'

    def _count(self):
        """문서 안의 부품 개수를 셉니다. 저장 전 자체 점검에 씁니다."""
        n = {'colPr': 0, 'ctrl': 0, 'tbl': 0, 'tr': 0, 'tc': 0, 'run': 0, 'p': 0}
        for e in self.root.iter():
            k = ln(e.tag)
            if k in n:
                n[k] += 1
        return n

    # ── 표·행·칸 ───────────────────────────────────────────
    def tables(self):
        return [e for e in self.root.iter() if ln(e.tag) == 'tbl']

    def rows(self, tbl):
        return [e for e in tbl.iter() if ln(e.tag) == 'tr']

    def cells(self, tr):
        return [e for e in tr if ln(e.tag) == 'tc']

    def parent(self, node):
        if self._parents is None:
            self._parents = {id(c): p for p in self.root.iter() for c in p}
        return self._parents.get(id(node))

    def _forget_parents(self):
        self._parents = None

    # ── 행 복제·삭제 ───────────────────────────────────────
    #
    # 주의: 표의 칸마다 '내가 몇 번째 행인지'가 박혀 있고(cellAddr),
    #       표 머리에는 '행이 몇 개인지'가 적혀 있습니다(rowCnt).
    #       행을 늘리거나 줄인 뒤 이 둘을 다시 맞춰주지 않으면
    #       한글이 "손상된 파일"이라며 열지 않습니다.
    #       → 행을 건드린 표는 반드시 normalize_table() 을 부르세요.

    def clone_row(self, tr, after=None):
        """행을 통째로 복제해 뒤에 넣습니다. 서식(선·높이)이 그대로 따라옵니다."""
        parent = self.parent(tr)
        new = copy.deepcopy(tr)
        for p in new.iter():
            if ln(p.tag) == 'p' and 'id' in p.attrib:
                self._seq += 1
                p.set('id', str(self._seq))
        idx = list(parent).index(after if after is not None else tr) + 1
        parent.insert(idx, new)
        self._forget_parents()
        return new

    def drop_row(self, tr):
        p = self.parent(tr)
        if p is not None:
            p.remove(tr)
            self._forget_parents()

    def normalize_table(self, tbl):
        """행 번호와 행 개수를 실제 모양에 맞춰 다시 매깁니다."""
        rows = self.rows(tbl)
        tbl.set('rowCnt', str(len(rows)))
        for ri, tr in enumerate(rows):
            for tc in self.cells(tr):
                for addr in tc:
                    if ln(addr.tag) == 'cellAddr':
                        addr.set('rowAddr', str(ri))

    # ── 글자 폭 재기 ───────────────────────────────────────
    @staticmethod
    def _char_width(ch):
        """한글·한자는 한 칸, 영문·숫자·기호는 반 칸으로 봅니다."""
        return 1000 if unicodedata.east_asian_width(ch) in ('W', 'F') else 500

    @classmethod
    def _wrap(cls, line, limit):
        """
        칸 너비를 넘지 않게 미리 끊어 줍니다.

        왜 필요한가:
        한글은 글자가 칸을 넘어 접히면 접힌 줄마다 위치를 따로 적습니다.
        우리는 접힘을 정확히 계산할 수 없으므로, 아예 접히지 않을 만큼
        짧게 끊어서 '한 문단 = 한 줄'로 만듭니다.
        그러면 줄 위치를 한 개씩만 적으면 되고 겹쳐 보이지 않습니다.

        여유를 둡니다(실제 글꼴이 이 계산보다 조금 좁습니다).
        """
        if limit <= 0 or not line:
            return [line]
        out, cur, w = [], '', 0
        for word in line.split(' '):
            piece = (word if not cur else ' ' + word)
            pw = sum(cls._char_width(c) for c in piece)
            if cur and w + pw > limit:
                out.append(cur)
                cur, w = word, sum(cls._char_width(c) for c in word)
            else:
                cur += piece
                w += pw
            # 띄어쓰기 없이 긴 덩어리는 글자 단위로 자릅니다
            while w > limit and len(cur) > 1:
                keep = ''
                kw = 0
                for c in cur:
                    cw = cls._char_width(c)
                    if kw + cw > limit:
                        break
                    keep += c
                    kw += cw
                out.append(keep)
                cur = cur[len(keep):]
                w = sum(cls._char_width(c) for c in cur)
        if cur:
            out.append(cur)
        return out or ['']

    # ── 칸에 글자 넣기 ─────────────────────────────────────
    def set_cell(self, tc, text, wrap=True):
        """줄바꿈(\\n)은 문단으로 나눠 넣습니다. 표 칸은 자동으로 늘어납니다."""
        paras = [e for e in tc.iter() if ln(e.tag) == 'p']
        if not paras:
            return
        first = paras[0]
        holder = self.parent(first)

        for p in paras[1:]:
            pp = self.parent(p)
            if pp is not None:
                pp.remove(p)
        self._forget_parents()

        base, step, horz = self._lineseg(first)

        lines = str(text).split('\n') or ['']
        if wrap and horz:
            limit = int(horz * 0.88)   # 실제 글꼴이 조금 좁아 여유를 둡니다
            out = []
            for l in lines:
                # '- ' 로 시작하는 항목은 이어지는 줄을 들여씁니다
                pad = '  ' if l.startswith('- ') else ''
                parts = self._wrap(l, limit)
                out.append(parts[0])
                out.extend(pad + p for p in parts[1:])
            lines = out

        self._write(first, lines[0])
        self._one_lineseg(first, base)

        prev = first
        for i, line in enumerate(lines[1:], start=1):
            clone = copy.deepcopy(first)
            # 둘째 줄부터는 부품(colPr 등)을 떼어냅니다.
            # 한 칸 안에 같은 부품이 두 번 들어가면 안 됩니다.
            for r in [e for e in clone if ln(e.tag) == 'run' and not self._is_plain(e)]:
                clone.remove(r)
            self._write(clone, line)
            self._one_lineseg(clone, base + step * i)
            holder.insert(list(holder).index(prev) + 1, clone)
            prev = clone
        self._forget_parents()

    @staticmethod
    def _one_lineseg(p, vertpos):
        """
        문단의 '줄 정보'를 한 개만 남기고 맨 앞으로 되돌립니다.

        한글은 글자가 칸 너비를 넘어 접히면 줄 정보를 여러 개 적어 둡니다.
        예: '청소하기, 빨래하기, 식사준비, 기타' → textpos=0 과 textpos=12 두 개.
        여기에 짧은 글자를 넣으면 '12번째 글자부터 둘째 줄'이라는 기록만 남아
        실제 글자 수와 어긋나고, 한글은 그 문서를 열지 않습니다.

        줄 정보는 화면에 그리기 위한 계산 결과일 뿐이므로,
        하나만 남겨 두면 한글이 열 때 알아서 다시 계산합니다.
        """
        for lsa in p:
            if ln(lsa.tag) != 'linesegarray':
                continue
            segs = list(lsa)
            for extra in segs[1:]:
                lsa.remove(extra)
            if segs:
                segs[0].set('textpos', '0')
                segs[0].set('vertpos', str(vertpos))

    @staticmethod
    def _lineseg(p):
        """문단의 첫 줄 위치, 한 줄 높이, 칸 너비를 알아냅니다."""
        for lsa in p:
            if ln(lsa.tag) != 'linesegarray':
                continue
            for s in lsa:
                vert = int(s.get('vertpos', 0))
                size = int(s.get('vertsize', 1000))
                gap = int(s.get('spacing', 500))
                horz = int(s.get('horzsize', 0))
                return vert, size + gap, horz
        return 0, 1500, 0

    @staticmethod
    def _is_plain(run):
        """글자만 든 run 인가? (ctrl 같은 부품이 들어 있으면 아님)"""
        return all(ln(g.tag) == 't' for g in run)

    def _write(self, p, text):
        """
        문단에 글자를 넣습니다.

        절대 건드리면 안 되는 것: <hp:ctrl> 이 들어 있는 run.
        여기에는 colPr(단 설정) 같은 부품이 들어 있고, 문단 맨 앞에 있어야 합니다.
        이걸 지우거나 글자를 그 앞에 끼워 넣으면 한글이 파일을 열지 않습니다.
        → 부품이 든 run 은 그대로 두고, '글자만 든 run' 에만 씁니다.
        """
        runs = [e for e in p if ln(e.tag) == 'run']
        if not runs:
            return

        parts = [r for r in runs if not self._is_plain(r)]   # 부품 든 run — 보존
        plains = [r for r in runs if self._is_plain(r)]      # 글자용 run

        # run 은 늘리지도 줄이지도 않습니다. 남는 것은 글자만 비웁니다.
        # (원본에 있던 빈 run 하나를 지웠더니 한글이 파일을 열지 않았습니다)
        target = plains[0] if plains else None
        for extra in plains[1:]:
            for t in [e for e in extra if ln(e.tag) == 't']:
                extra.remove(t)

        if target is None:
            # 글자용 run 이 없으면 부품 run '뒤에' 새로 만듭니다
            target = ET.Element(f'{{{HP}}}run')
            target.set('charPrIDRef',
                       parts[-1].get('charPrIDRef', self.body_char or '0'))
            p.insert(list(p).index(parts[-1]) + 1, target)

        if self.body_char:
            target.set('charPrIDRef', self.body_char)   # ← 파란 기울임 방지

        ts = [e for e in target if ln(e.tag) == 't']
        if text == '':
            for t in ts:
                target.remove(t)
            return

        for extra in ts[1:]:
            target.remove(extra)
        if ts:
            for child in list(ts[0]):
                ts[0].remove(child)
            ts[0].text = text
        else:
            ET.SubElement(target, f'{{{HP}}}t').text = text

    # ── 저장 전 자체 점검 ──────────────────────────────────
    def audit(self):
        """한글이 싫어하는 모양이 남아 있는지 스스로 확인합니다."""
        # (빈 <hp:t/> 는 원본에도 있으므로 문제가 아닙니다 — 확인함)
        bad = []

        # 부품(colPr·ctrl)은 하나도 늘거나 줄면 안 됩니다.
        # 글자만 바꾸는 것이 원칙이므로, 개수가 달라졌다면 뭔가 부순 것입니다.
        now = self._count()
        for k in ('colPr', 'ctrl', 'tbl', 'tc'):
            if now[k] != self.src_parts[k]:
                bad.append(f'{k} 개수 {self.src_parts[k]} → {now[k]}')

        # 줄을 늘린 만큼만 문단이 늘고, run 도 딱 그만큼만 늘어야 합니다.
        if now['run'] - self.src_parts['run'] != now['p'] - self.src_parts['p']:
            bad.append(f"run·문단 증가가 어긋남 "
                       f"(run {self.src_parts['run']}→{now['run']}, "
                       f"문단 {self.src_parts['p']}→{now['p']})")

        # (run 안의 글자·부품 순서는 원본도 뒤섞여 있으므로 규칙이 아닙니다 — 확인함)
        for tbl in self.tables():
            rows = self.rows(tbl)
            if tbl.attrib.get('rowCnt') != str(len(rows)):
                bad.append(f"행 개수 불일치 {tbl.attrib.get('rowCnt')} ≠ {len(rows)}")
            for ri, tr in enumerate(rows):
                for tc in self.cells(tr):
                    for a in tc:
                        if ln(a.tag) == 'cellAddr' and a.attrib['rowAddr'] != str(ri):
                            bad.append(f'행 번호 어긋남 r{ri}')
        return bad

    # ── 저장 ───────────────────────────────────────────────
    def save(self, out):
        problems = self.audit()
        if problems:
            raise ValueError('한글이 열지 못할 모양입니다: '
                             + ', '.join(sorted(set(problems))))

        body = ET.tostring(self.root, encoding='unicode')
        # 파이썬이 새로 만든 여는 태그를 원본 것으로 되돌립니다.
        body = self.src_root_tag + body[body.find('>') + 1:]
        # 빈 태그를 원본과 같은 모양으로 (<a /> → <a/>)
        body = re.sub(r'(<[^<>]*?[^\s<>]) />', r'\1/>', body)
        body = self.src_decl + body
        # 포장(zip) 도 원본 그대로 다시 만듭니다.
        # 항목 순서, 압축 방식, 날짜, 속성까지 하나라도 다르면
        # 한글이 '변조'로 봅니다. 특히 version.xml 과 그림은 무압축입니다.
        with zipfile.ZipFile(out, 'w') as zo:
            for item in self.zin.infolist():
                data = (body.encode('utf-8')
                        if item.filename == 'Contents/section0.xml'
                        else self.zin.read(item.filename))
                zi = zipfile.ZipInfo(item.filename, date_time=item.date_time)
                zi.compress_type = item.compress_type
                zi.create_system = item.create_system
                zi.create_version = item.create_version
                zi.extract_version = item.extract_version
                zi.external_attr = item.external_attr
                zi.internal_attr = item.internal_attr
                zo.writestr(zi, data)
