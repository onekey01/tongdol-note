/**
 * 계약서 = **편람 서식2** 채우기 — B-2.
 *
 *   bun 계약서시험.ts
 *
 * ── 이 시험이 잡아낸 것 (2026-09-02) ──────────────────────────
 *
 * 처음 짠 것이 **서식 글자를 부쉈습니다** —
 *
 *     생년월일  →  생2026년월일
 *
 * 날짜 틀은 「년·월·일이 다 있는 글」이면 무엇이든 맞습니다. 그런데 hwpx 는
 * **표를 문단 안에 담기 때문에**, 표를 감싼 문단의 글자를 읽으면 표 안의
 * 글자가 전부 이어 붙어 나옵니다(계약서에서는 921자). 그 문단을 상대로
 * 채우니 표 안의 **「생년월일」 라벨**이 날짜 틀로 걸렸습니다.
 *
 * 그래서 이제 문서 단위로는 **홑문단**(다른 문단을 안 품은 문단)만 봅니다.
 *
 * ── 그래서 이 시험의 뼈대는 「원본과 견주기」입니다 ───────────
 *
 * 값이 잘 들어갔는지만 보면 저 사고를 못 잡습니다. **원본과 한 토막씩
 * 견주어, 우리가 채운 자리 말고는 한 글자도 안 바뀌었음**을 봅니다.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hwpx } from './server/hwpx'
import { Zip } from './server/zip'
import { find, plain, attr, kids } from './server/xml'
import { 서식폴더 } from './server/서식자리'
import { db, initDb } from './server/db'
import { 살피기 } from './서식열림시험'
initDb()

let 통과수 = 0, 실패수 = 0
const 통과 = (n: string, ok: unknown, d = '') => {
  if (ok) { 통과수++; console.log(`  통과  ${n}${d ? '   — ' + d : ''}`) }
  else { 실패수++; console.log(`✗ 실패  ${n}${d ? '   — ' + d : ''}`) }
}

const 원본길 = join(서식폴더(), '서비스 제공·이용 계약서(서식2).hwpx')
const 사람 = randomUUID()
const 민사람 = randomUUID()
let 의뢰만듦 = false
const 옛대표: any = db.query('SELECT ceo_name FROM organization WHERE id = 1').get()
const 옛프로필: any = db.query(
  `SELECT rp.id, rp.form_fix_year FROM region_profile rp
     JOIN organization o ON o.profile_id = rp.id WHERE o.id = 1`).get()

/** 문단들의 글자 — 표를 감싼 문단은 빼고 **홑문단만**. */
function 홑글들(buf: Buffer): string[] {
  const d = new Hwpx(buf)
  return find((d as any).doc.root, 'p')
    .filter((p) => find(p, 'p').length === 1)
    .map((p) => find(p, 't').map((t) => plain(t)).join(''))
}

try {
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [사람, JSON.stringify({
      name: '김순자', birth: '1938-05-11', gender: '여',
      address: '전남 해남군 해남읍 중앙1로 12', addressDetail: '301호',
      phone: '010-1234-5678', phoneHome: '061-530-1111',
      guardians: [
        { relation: '자녀', name: '박영수', phone: '010-2222-3333' },
        { relation: '이웃', name: '최덕배', phone: '010-4444-5555' }],
    }), '해남읍', '이용', '2026-09-01', 'x'])
  db.run(`INSERT INTO recipient (id,payload,dong,status,created_at,updated_at)
          VALUES (?,?,?,?,?,?)`,
    [민사람, JSON.stringify({ name: '빈자료' }), '해남읍', '이용', '2026-09-01', 'x'])

  const sv: any = db.query('SELECT id FROM service WHERE active = 1 LIMIT 1').get()
  db.run(`INSERT INTO referral (recipient_id,service_id,period_from,period_to,
            cycle_text,batch_label,created_at) VALUES (?,?,?,?,?,?,?)`,
    [사람, sv.id, '2026-09-01', '2026-12-31', '주 2회', '시험', 'x'])
  의뢰만듦 = true
  db.run('UPDATE organization SET ceo_name = ? WHERE id = 1', ['박대표'])

  const { 모으기, build, 파일이름 } = await import('./server/계약서2')
  const v = 모으기(사람, {
    담당자: '박병섭', 담당자연락처: '061-000-0000',
    제공인력: '홍길동', 계약일: '2026-09-02',
  })
  const 나온것 = build(v)

  console.log('\n── 1. 값이 제자리에 들어갔나 ─────────────────────────\n')
  const d = new Hwpx(나온것)
  const t = d.tables()[1]
  const 칸글 = (r: number, c: number) =>
    find(d.cell(t, r, c), 'p').map((p) => find(p, 't').map((x) => plain(x)).join('')).join(' / ')

  for (const [이름, r, c, 바람] of [
    ['성명', 1, 1, '김순자'], ['생년월일', 1, 3, '1938-05-11'], ['성별', 1, 5, '여'],
    ['주소', 2, 1, '중앙1로 12'], ['서비스', 6, 1, '주 2회'],
    ['기관명', 7, 1, '해남시험기관'], ['대표자', 7, 3, '박대표'],
  ] as const) 통과(`${이름} 칸`, 칸글(r, c).includes(바람), 칸글(r, c))

  통과('전화 — 집·핸드폰이 각각', 칸글(3, 1).includes('061-530-1111') && 칸글(3, 1).includes('010-1234-5678'), 칸글(3, 1))
  /*
   * ── 대리인은 **비어 있어야** 합니다 (2026-09-02) ──────────────
   * 계약 자리에서 얼굴을 보고 확인하며 손으로 적는 자리입니다. 자료함의
   * 대리인이 낡았을 수 있고, 그날 실제로 서명하는 사람은 그 자리에서
   * 정해집니다. 미리 찍으면 **틀린 이름 위에 남이 서명하는 종이**가 됩니다.
   * 그래서 자료가 있어도 안 찍는지를 봅니다 — 시험 자료에는 둘 다 있습니다.
   */
  통과('**대리인 1 자리는 비어 있다** — 이름표만',
    !['자녀', '박영수', '010-2222-3333'].some((x) => 칸글(3, 3).includes(x)), 칸글(3, 3))
  통과('**대리인 2 자리도 비어 있다**',
    !['이웃', '최덕배', '010-4444-5555'].some((x) => 칸글(3, 5).includes(x)), 칸글(3, 5))
  통과('그래도 이름표는 남는다 — 손으로 적을 자리입니다',
    ['(관  계)', '(성  명)', '(연락처)'].every((x) => 칸글(3, 3).includes(x)), 칸글(3, 3))
  통과('담당자·연락처', 칸글(8, 1).includes('박병섭') && 칸글(8, 2).includes('061-000-0000'))

  console.log('\n── 2. 서식 글자를 안 부쉈나 (원본과 견주기) ────────────\n')
  const 전 = 홑글들(readFileSync(원본길))
  const 후 = 홑글들(나온것)
  통과('홑문단 개수가 같다', 전.length === 후.length, `${전.length} → ${후.length}`)

  /*
   * **이것이 이 시험의 핵심입니다.**
   * 바뀐 문단은 우리가 채운 곳뿐이어야 하고, 바뀐 문단도 **원래 글자를
   * 여전히 품고** 있어야 합니다 — 「생년월일」이 「생2026년월일」이 되면
   * 「생년월일」이라는 말이 사라지므로 여기서 걸립니다.
   */
  const 부순것 = 후.filter((글0, i) => {
    /*
     * 「□ 확인」 → 「☑ 확인」은 **일부러 한 바꿈**이라 되돌려 놓고 견줍니다.
     * 이 한 가지만 빼고, 나머지는 한 글자도 사라지면 안 됩니다.
     */
    const 글 = 글0.split('☑ 확인').join('□ 확인')
    const 원 = 전[i]
    if (원 === 글) return false
    const 뼈 = 원.replace(/\s+/g, '')       // 빈칸은 값이 들어가며 줄어듭니다
    if (!뼈) return false                    // 원래 빈 칸이면 무엇이 들어와도 됩니다
    // 날짜·기간 틀은 숫자 자체가 바뀌므로 따로 봅니다
    if (/^\d{4}\.|^\d{4}년/.test(원.trim())) return false
    return !뼈.split('').every((ch) => 글.includes(ch))
  })
  통과('**서식 글자를 하나도 안 부쉈다**', 부순것.length === 0,
    부순것.slice(0, 3).map((x) => JSON.stringify(x.slice(0, 60))).join(' · ') || '부순 것 없음')

  통과('**「생년월일」 라벨이 살아 있다** — 한때 「생2026년월일」이 됐습니다',
    후.some((g) => g === '생년월일'))

  const 조항 = [
    /*
     * 가운뎃점을 넣지 마세요 — 서식의 「한시적·일시적」에 쓰인 것은
     * **U+0387(그리스 문자)** 이고 우리가 흔히 치는 U+00B7 이 아닙니다.
     * 눈으로는 같아 보여 한참 헤맵니다.
     */
    '인격적으로 존중', '돌봄 위기를 돕는', '비용을 추가로 요구할 수 없습니다',
    '1인당 연간 지원한도액에서 차감', '가족이나 동거인 등에게는 제공하지 않습니다',
    '김장담그기', '3회 연속 대면 수령하지 않은 경우', '은행 업무 동행은 불가',
    '파마·손발톱 관리', '시공 후 환불이 불가능', 'CCTV', '반려동물',
    '단정한 옷차림', '미리 안내합니다', '질 높은 서비스', '개인정보',
    '귀책 사유',
  ]
  const 사라진조항 = 조항.filter((c) => !후.some((g) => g.includes(c)))
  통과(`**조항 ${조항.length}가지가 그대로 있다**`, 사라진조항.length === 0,
    사라진조항.join(' · ') || '전부 있음')

  console.log('\n── 3. 확인 표시와 서명 자리 ───────────────────────────\n')
  /*
   * ── 「□ 확인」 → 「☑ 확인」 (2026-09-02, 무무 님 지시) ────────
   * 조항을 하나씩 읽어 드리고 표시하는 것이 현장 절차이니 미리 찍혀
   * 나오는 편이 실제와 맞다고 하셨습니다. **말은 그대로 두고 표시만**
   * 바꿉니다 — 두 글자 다 한 자리라 길이도 그대로입니다.
   */
  const 친것 = 후.filter((g) => g.includes('☑ 확인')).length
  const 안친것 = 후.filter((g) => g.includes('□ 확인')).length
  통과('**「☑ 확인」이 열일곱 군데 다 찍혔다**', 친것 === 17, `${친것}군데`)
  통과('**「□」가 하나도 안 남았다**', 안친것 === 0, `${안친것}군데`)
  통과('**「확인」이라는 말은 그대로다** — 표시만 바꿉니다',
    후.filter((g) => g.includes('확인')).length >= 17)
  통과('**「(서명 또는 인)」 세 군데가 남아 있다**',
    후.filter((g) => g.includes('(서명 또는 인)')).length === 3)
  통과('**직인을 안 찍는다** — 계약서의 서명은 셋 다 자필입니다',
    !new Zip(나온것).names().some((n) => n.startsWith('BinData/')))

  console.log('\n── 4. 맨 아래 서명란 ───────────────────────────────────\n')
  const 줄 = (앵커: string) => 후.find((g) => g.includes(앵커)) ?? ''
  통과('계약일이 들어갔다', /2026년\s+9월\s+2일/.test(줄('2026년')), 줄('2026년'))
  통과('**해를 두 번 안 쓴다** — 한때 「20262026년」이 됐습니다',
    !줄('2026년').includes('20262026'))
  통과('본인 성명', 줄('본 인').includes('김순자'), 줄('본 인').trim())
  통과('**서명란의 대리인 줄도 비어 있다**',
    !줄('대리인 (관계)').includes('자녀') && !줄('대리인 (관계)').includes('박영수'),
    줄('대리인 (관계)').trim())
  통과('서명란 기관명 — 위 표의 라벨이 아니라 **아래 서명란**에',
    줄('  기 관 명').includes('해남시험기관'), 줄('  기 관 명').trim())
  // 「제공인력」만으로 찾으면 맨 위 머리글(「<서식2> 서비스 제공인력 ➜ …」)이 먼저 걸립니다.
  통과('제공인력 성명', 줄('제공인력   (성명)').includes('홍길동'),
    줄('제공인력   (성명)').trim())

  console.log('\n── 5. 계약기간의 「2025」 ──────────────────────────────\n')
  /*
   * 서식2 의 계약기간 칸만 「2025」로 인쇄돼 있습니다(군의 오타).
   * 예전에는 설정으로 끄고 켤 수 있었는데, **끄면 2026년 계약서에 2025 가
   * 찍혀 나갑니다.** 고를 일이 아니라 틀린 것이라 **늘 고칩니다**
   * (2026-09-04 무무 님 지시).
   */
  const 기간글 = () => 칸글(6, 3)
  통과('**늘 실제 해로 고친다** — 2026',
    기간글().includes('2026') && !기간글().includes('2025'), 기간글())
  통과('시작·종료가 다 들어갔다',
    /9\..*1\./.test(기간글()) && /12\..*31\./.test(기간글()))
  {
    // 설정 칸을 0 으로 두어도 **바뀌지 않아야** 합니다 — 이제 선택이 아닙니다.
    db.run('UPDATE region_profile SET form_fix_year = 0 WHERE id = ?', [옛프로필.id])
    const 그래도 = new Hwpx(build(모으기(사람, { 계약일: '2026-09-02' })))
    const 그기간 = find(그래도.cell(그래도.tables()[1], 6, 3), 'p')
      .map((p) => find(p, 't').map((x) => plain(x)).join('')).join('')
    통과('**옛 설정값이 0 이어도 실제 해로 나온다** (필수로 바뀜)',
      그기간.includes('2026') && !그기간.includes('2025'), 그기간)
    db.run('UPDATE region_profile SET form_fix_year = ? WHERE id = ?',
      [옛프로필.form_fix_year, 옛프로필.id])
  }

  console.log('\n── 5-2. 표가 「글자처럼 취급」에서 풀렸는가 ────────────\n')
  {
    /*
     * 안 풀면 표가 한 쪽에 안 들어가는 순간 **통째로 다음 쪽으로** 넘어가
     * 앞쪽이 텅 빈 채 나옵니다 (2026-09-04 무무 님 지적).
     */
    const 원본 = new Hwpx(readFileSync(원본길))
    const 켜진것 = 원본.tables()
      .filter((t) => attr(kids(t, 'pos')[0]!, 'treatAsChar') === '1').length
    통과('원본은 글자처럼 취급이었다', 켜진것 > 0, `${켜진것}개`)
    const 푼것 = d.tables()
      .filter((t) => attr(kids(t, 'pos')[0]!, 'treatAsChar') !== '0').length
    통과('**만든 것은 표가 다 풀렸다**', 푼것 === 0, `안 풀린 표 ${푼것}개`)
    통과('쪽 경계에서 칸 단위로 나눔',
      d.tables().every((x) => attr(x, 'pageBreak') === 'CELL'))
  }

  console.log('\n── 6. 자료가 비어도 성한가 ────────────────────────────\n')
  let 빈것: Buffer | null = null
  try { 빈것 = build(모으기(민사람, {})) } catch (e: any) {
    통과(`자료가 비면 터짐 — ${e?.message ?? e}`, false)
  }
  if (빈것) {
    const 빈후 = 홑글들(빈것)
    통과('**자료가 없어도 계약서가 나온다** (빈칸으로)', true)
    통과('빈 값이면 이름표만 남는다',
      빈후.some((g) => g.trim() === '(집)') && 빈후.some((g) => g.trim() === '(핸드폰)'))
    통과('그래도 조항은 다 있다', 조항.every((c) => 빈후.some((g) => g.includes(c))))
    통과('빈 계약서도 성한 파일이다', 살피기(빈것).length === 0, 살피기(빈것).join(' · '))
  }

  console.log('\n── 7. 파일 자체 ───────────────────────────────────────\n')
  const 흠 = 살피기(나온것)
  통과('**모든 XML 이 XML 로 읽힌다**', 흠.length === 0, 흠.join(' · ') || '흠 없음')
  통과('파일 이름', 파일이름(v) === '서비스 제공·이용 계약서_김순자_2026-09-02.hwpx', 파일이름(v))
} catch (e: any) {
  통과(`시험 도중 터짐 — ${e?.message ?? e}`, false)
} finally {
  if (의뢰만듦) db.run('DELETE FROM referral WHERE recipient_id = ?', [사람])
  db.run('DELETE FROM recipient WHERE id IN (?, ?)', [사람, 민사람])
  db.run('UPDATE organization SET ceo_name = ? WHERE id = 1', [옛대표?.ceo_name ?? null])
  console.log(`\n${통과수 + 실패수}가지 중 ${통과수}가지 통과, ${실패수}가지 실패\n`)
  process.exit(실패수 ? 1 : 0)
}
