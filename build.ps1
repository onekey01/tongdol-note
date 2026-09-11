# ─────────────────────────────────────────────────────────────
#  통돌 Note — 내보낼 것 만들기
#
#  「통돌Note 만들기.bat」을 두 번 누르면 이 파일이 돕니다.
#  손으로 할 일은 **버전 번호 정하기 하나뿐**입니다. 나머지는 이 파일이 합니다.
#
#  하는 일
#    1. 버전 번호를 묻습니다 (엔터 = 그대로)
#    2. 빠진 준비물이 있으면 **만들기 전에** 멈춥니다
#    3. 화면을 짓고 → 실행 파일 하나로 묶습니다
#    4. 「배포_0.1.0」 폴더를 꾸리고 → 압축 파일 한 개까지 만듭니다
#    5. 빠진 것이 없는지 **스스로 점검**하고 사람 말로 알려 줍니다
#
#  자료함(data)은 **절대 넣지 않습니다.** 자료는 기관 것입니다.
#
#  ── 이 파일을 고치실 때 ──────────────────────────────────
#  변수 이름은 **영문으로만** 씁니다. 한글로 쓰면 윈도우 PowerShell 5.1 이
#  이 파일을 CP949 로 잘못 읽어 통째로 깨집니다.
#  저장은 **UTF-8 BOM** 으로 해야 아래 한글 안내문이 안 깨집니다.
# ─────────────────────────────────────────────────────────────

try { & chcp.com 65001 | Out-Null } catch { }
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location -LiteralPath $root
try { [System.Environment]::CurrentDirectory = $root } catch { }

function Say([string]$t) { Write-Output $t }
function Stop-Here([string]$why) {
  Say ""
  Say "  ┌──────────────────────────────────────────────┐"
  Say "  │  만들지 않았습니다.                          │"
  Say "  └──────────────────────────────────────────────┘"
  Say ""
  Say $why
  Say ""
  Read-Host "  엔터를 누르면 닫힙니다"
  exit 1
}

Say ""
Say "  통돌 Note — 내보낼 것 만들기"
Say "  ─────────────────────────────────────────"
Say "  폴더  $root"
Say ""

# ── 0. bun 이 있는가 ─────────────────────────────────────────
$bun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bun) {
  Stop-Here @"
  bun 을 찾지 못했습니다.

  PowerShell 을 열고 아래 한 줄을 붙여 넣어 설치하신 뒤,
  창을 닫았다 새로 열고 이 파일을 다시 실행해 주세요.

      powershell -c "irm bun.sh/install.ps1 | iex"
"@
}
Say ("  bun   " + (& bun --version))

# ── 1. 버전 번호 ───────────────────────────────────────────────
# 버전 번호는 package.json **한 곳**에만 있습니다.
# 화면·자료함·갱신 전 백업 파일 이름이 모두 이 값을 씁니다.
$pkgPath = Join-Path $root "package.json"
if (-not (Test-Path -LiteralPath $pkgPath)) { Stop-Here "  package.json 이 없습니다. 프로젝트 폴더가 맞는지 봐 주세요." }

$pkgText = Get-Content -LiteralPath $pkgPath -Raw -Encoding UTF8
$verNow = ([regex]'"version"\s*:\s*"([^"]+)"').Match($pkgText).Groups[1].Value
if (-not $verNow) { Stop-Here "  package.json 에서 버전 번호를 찾지 못했습니다." }

<#
  버전 번호는 **세 자리**인데, 손으로 정하는 것은 **앞 두 자리뿐**입니다.
  맨 뒷자리는 자료함 구조 번호라 코드에서 저절로 따라붙습니다.

      v 1 . 2 . 15
        └─┬─┘   └── 자료함 구조 (프로그램이 붙입니다)
          └────── 여기만 사람이 정합니다

  뒷자리는 자료 칸이 바뀔 때만 움직이므로, **내보낼 때마다 앞 두 자리를
  올려야 합니다.** 안 올리면 다른 프로그램이 같은 번호를 갖게 됩니다.
#>
$schema = 0
$schemaFile = Join-Path $root "server\schema.ts"
if (Test-Path -LiteralPath $schemaFile) {
  $m = [regex]::Match((Get-Content -LiteralPath $schemaFile -Raw), 'SCHEMA_VERSION\s*=\s*(\d+)')
  if ($m.Success) { $schema = [int]$m.Groups[1].Value }
}
$front = ($verNow -split '\.')[0..1] -join '.'

Say ""
Say "  지금 버전 번호는  v$front.$schema  입니다."
Say "  맨 뒷자리($schema)는 자료함 구조라 프로그램이 붙입니다 — 손대지 않습니다."
Say ""
Say "  고친 것을 내보내는 것이면 앞 두 자리를 올려 주세요 (예: $front → 1.3)."
Say "  그대로 두시려면 그냥 엔터."
$verNew = (Read-Host "  새 앞 두 자리").Trim()

if ($verNew) { $verNew = (($verNew -split '\.')[0..1] -join '.') }
if ($verNew -and $verNew -ne $front) {
  if ($verNew -notmatch '^\d+\.\d+$') {
    Stop-Here "  앞 두 자리는 숫자와 점으로만 적어 주세요. 예: 1.3"
  }
  $verNew = "$verNew.0"
  $backup = "$pkgPath.bak"
  Copy-Item -LiteralPath $pkgPath -Destination $backup -Force
  $patched = ([regex]'"version"\s*:\s*"[^"]+"').Replace($pkgText, ('"version": "' + $verNew + '"'), 1)
  <#
    BOM 없이 씁니다.
    윈도우 PowerShell 5.1 의 `Set-Content -Encoding UTF8` 은 파일 앞에
    눈에 안 보이는 표식(BOM)을 붙입니다. package.json 에 그것이 붙으면
    도구에 따라 **읽지 못합니다.** 여기서는 BOM 없는 UTF-8 을 못박아 씁니다.
  #>
  [System.IO.File]::WriteAllText($pkgPath, $patched, (New-Object System.Text.UTF8Encoding($false)))
  # 고친 뒤 **읽히는지 확인**합니다. 여기서 깨지면 프로그램이 아예 안 켜집니다.
  try {
    $check = (Get-Content -LiteralPath $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    if ($check.version -ne $verNew) { throw "버전 번호가 안 바뀌었습니다" }
    Remove-Item -LiteralPath $backup -Force
  } catch {
    Copy-Item -LiteralPath $backup -Destination $pkgPath -Force
    Remove-Item -LiteralPath $backup -Force
    Stop-Here "  package.json 을 고치다 잘못됐습니다. 원래대로 되돌렸습니다.`n  ($_)"
  }
  $ver = (($verNew -split '\.')[0..1] -join '.') + ".$schema"
  Say "  버전 번호  v$front.$schema → v$ver"
} else {
  $ver = "$front.$schema"
  Say "  버전 번호  v$ver (그대로)"
}

# ── 2. 준비물 점검 — **만들기 전에** 봅니다 ─────────────────
# 다 만들어 놓고 빠진 것을 아는 것보다, 시작 전에 멈추는 편이 낫습니다.
# Join-Path 를 겹쳐 씁니다 — 폴더 구분 기호를 손으로 적지 않기 위해서입니다.
$toolDir = Join-Path $root "도구"
$dll = Join-Path $toolDir "FilePathCheckerModuleExample.dll"
<#
  ── 도구 폴더에서 **기관에 가야 하는 것** ───────────────────
  이 둘은 프로그램이 **돌면서 찾습니다.** 나머지(파이썬 파일 등)는
  만들 때만 쓰는 것이라 안 보냅니다.

    한글PDF변환.ps1                  기록지를 PDF 로 뽑는 손발.
                                     **없으면 PDF 단추가 아예 안 열립니다.**
    FilePathCheckerModuleExample.dll 한글 보안 경고창을 막는 것.

  한 번 빠뜨려서 「PDF 를 고를 수가 없다」가 됐습니다 (2026-08-30).
  그때는 dll 만 챙기고 ps1 을 빠뜨렸습니다. 그래서 이제 **목록으로** 둡니다.
#>
$ps1 = Join-Path $toolDir "한글PDF변환.ps1"
$보낼도구 = @($dll, $ps1)

<#
  ── 아이콘도 같이 보냅니다 (2026-09-11) ────────────────────

  install.ps1 은 바로가기를 만들면서 `도구\아이콘.ico` 가 있으면
  거기에 댑니다. 그런데 **그 파일을 안 담고 있었습니다.** 그래서
  그 줄은 여태 한 번도 돌지 않았고, 바로가기는 늘 exe 안의
  아이콘 목차를 거쳤습니다 — 그 목차가 뿌옇던 까닭입니다
  (도구\아이콘만들기.py 맨 위에 적어 뒀습니다).

  담아 두면 바로가기가 .ico 를 곧장 쓰므로, exe 쪽이 어떻든
  바탕화면 아이콘은 제 크기로 나옵니다.
#>
$아이콘파일 = Join-Path $toolDir "아이콘.ico"
if (Test-Path -LiteralPath $아이콘파일) { $보낼도구 += $아이콘파일 }
if (-not (Test-Path -LiteralPath $dll)) {
  Stop-Here @"
  도구\FilePathCheckerModuleExample.dll 이 없습니다.

  이 파일이 없으면 기록지를 PDF 로 뽑을 때마다 한글이
  **보안 경고창**을 띄웁니다. 고객 입장에서는 굉장히 무서운 일입니다.
  그래서 이것 없이는 내보내지 않습니다.
"@
}

if (-not (Test-Path -LiteralPath $ps1)) {
  Stop-Here @"
  도구\한글PDF변환.ps1 이 없습니다.

  이 파일이 기록지를 PDF 로 뽑습니다. 없으면 화면에서
  **PDF 를 고를 수조차 없습니다.** 그래서 이것 없이는 내보내지 않습니다.
"@
}

$formDir = Join-Path $root "서식"
$forms = @(Get-ChildItem -LiteralPath $formDir -Filter "*.hwpx" -ErrorAction SilentlyContinue)
if ($forms.Count -lt 1) { Stop-Here "  서식 폴더에 hwpx 서식이 없습니다. (지자체 제출 서식은 손대지 않은 원본이어야 합니다.)" }

$fontDir = Join-Path $root "글꼴"
$fonts = @(Get-ChildItem -LiteralPath $fontDir -Filter "*.ttf" -ErrorAction SilentlyContinue)
if ($fonts.Count -lt 1) { Stop-Here "  글꼴 폴더에 ttf 글꼴이 없습니다. PDF 에 글자가 안 찍힙니다." }

Say ("  준비물  서식 " + $forms.Count + "개 · 글꼴 " + $fonts.Count + "개 · 한글 도구 2개 있음")

# ── 3. 준비물 받기 ───────────────────────────────────────────
if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules"))) {
  Say ""
  Say "  준비물을 받아 옵니다 (처음 한 번, 1~2분)…"
  & bun install
  if ($LASTEXITCODE -ne 0) { Stop-Here "  준비물 받기에 실패했습니다." }
}

# ── 4. 화면 짓기 ─────────────────────────────────────────────
# 내보낼 때는 **언제나 새로** 짓습니다.
# 「분명히 고쳤는데 안 바뀐 화면」이 그대로 기관에 가는 일을 막습니다.
Say ""
Say "  화면을 새로 짓습니다…"
& bunx vite build
if ($LASTEXITCODE -ne 0) { Stop-Here "  화면 짓기에 실패했습니다. 위에 뜬 빨간 글을 보내 주세요." }

$indexHtml = Join-Path (Join-Path $root "dist-web") "index.html"
if (-not (Test-Path -LiteralPath $indexHtml)) { Stop-Here "  화면은 지어졌다는데 dist-web\index.html 이 없습니다." }

# ── 5. 실행 파일 하나로 묶기 ─────────────────────────────────
# 파일 이름은 **영문으로** 만듭니다. 만든 뒤에 한글 이름으로 복사합니다.
Say ""
Say "  실행 파일로 묶습니다 (30초쯤 걸립니다)…"

<#
  ── exe 에 새겨 넣는 것 ────────────────────────────────────
  서명이 없어도 **이름과 만든 곳은 새길 수 있습니다.**
  「알 수 없는 게시자」 창에서 파일 이름 말고 아무것도 안 뜨는 것과,
  「통돌 Note · 통돌Note」가 뜨는 것은 받는 사람에게 전혀 다릅니다.
  인증서는 나중 일이고, 이건 오늘 공짜로 됩니다.

  아이콘은 **있으면 넣고 없으면 그냥 갑니다.** 도구\아이콘.ico 를 놓아
  두시면 다음 만들기부터 저절로 붙습니다.
#>
$icon = Join-Path $toolDir "아이콘.ico"
$exeArgs = @(
  "build", "server/index.ts", "--compile", "--outfile", "tongdol-note",
  "--windows-title=통돌 Note",
  "--windows-publisher=통돌Note",
  "--windows-description=통합돌봄 서비스 제공기관 업무 프로그램",
  "--windows-version=$ver.0"
)
if (Test-Path -LiteralPath $icon) {
  $exeArgs += "--windows-icon=$icon"
  Say "  아이콘  도구\아이콘.ico 를 넣습니다"
} else {
  Say "  아이콘  아직 없습니다 (도구\아이콘.ico 를 놓으면 저절로 붙습니다)"
}
& bun @exeArgs
if ($LASTEXITCODE -ne 0) { Stop-Here "  묶기에 실패했습니다. 위에 뜬 빨간 글을 보내 주세요." }

$exeMade = Join-Path $root "tongdol-note.exe"
if (-not (Test-Path -LiteralPath $exeMade)) { $exeMade = Join-Path $root "tongdol-note" }
if (-not (Test-Path -LiteralPath $exeMade)) { Stop-Here "  실행 파일이 만들어지지 않았습니다." }

# ── 6. 내보낼 폴더 꾸리기 ────────────────────────────────────
<#
  내보내는 이름은 **프로그램 이름 + 버전 번호**입니다.
  기관이 받는 파일에 「배포」라고 적혀 있으면 무엇인지 알 수 없습니다.
  받는 사람 쪽 말로 적습니다.
#>
$outName = "통돌Note_$ver"
$out = Join-Path $root $outName
if (Test-Path -LiteralPath $out) {
  Say ""
  Say "  $outName 폴더가 이미 있습니다. 지우고 새로 만듭니다."
  Remove-Item -LiteralPath $out -Recurse -Force
}
New-Item -ItemType Directory -Path $out | Out-Null

Copy-Item -LiteralPath $exeMade -Destination (Join-Path $out "통돌Note.exe") -Force
Copy-Item -LiteralPath (Join-Path $root "dist-web") -Destination (Join-Path $out "dist-web") -Recurse -Force
<#
  서식은 **지금 쓰는 것만** 보냅니다.
  「서식\이전」에는 갈아 끼우기 전 서식이 들어 있는데, 그것까지 딸려 가면
  기관이 어느 것이 진짜인지 헷갈립니다. 그래서 폴더째 복사하지 않고
  맨 위의 hwpx 파일만 골라 넣습니다.
#>
New-Item -ItemType Directory -Path (Join-Path $out "서식") | Out-Null
foreach ($f in $forms) {
  Copy-Item -LiteralPath $f.FullName -Destination (Join-Path (Join-Path $out "서식") $f.Name) -Force
}
Copy-Item -LiteralPath $fontDir -Destination (Join-Path $out "글꼴") -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $out "도구") | Out-Null
foreach ($t in $보낼도구) {
  Copy-Item -LiteralPath $t -Destination (Join-Path (Join-Path $out "도구") (Split-Path $t -Leaf)) -Force
}

<#
  ── 설치 파일 한 쌍 (2026-09-08 무무 지시) ─────────────────

  기관이 zip 을 풀고 **폴더를 찾아 들어가 exe 를 누르는** 길에는
  자료가 통째로 사라지는 구멍이 있었습니다 — 압축을 안 풀고 zip
  안에서 바로 실행하면 자료함이 **임시 폴더**에 생기고, 윈도가
  임시 폴더를 치울 때 함께 사라집니다.

  그래서 「통돌Note 설치.bat」을 함께 보냅니다. 그것이 ① 압축을
  안 푼 자리인지 보고 ② C:\통돌Note 에 넣고 ③ 자료함은 손 안 대고
  ④ 바탕화면 바로가기를 만들고 ⑤ 「인터넷에서 받음」 꼬리표를 떼어
  「Windows의 PC 보호」 창이 안 뜨게 합니다.

  ★ **둘은 한 쌍입니다.** 하나만 보내면 눌러도 아무 일이 없고,
    기관은 그것을 고장으로 봅니다. 아래 점검에서 둘 다 셉니다.
#>
foreach ($n in @("통돌Note 설치.bat", "install.ps1")) {
  $src = Join-Path $root $n
  if (Test-Path -LiteralPath $src) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $out $n) -Force
  }
}

<#
  ── 갈아끼우기 (2026-09-11 에 빠져 있던 것을 찾았습니다) ──────

  기관이 화면에서 「지금 업데이트」를 누르면 프로그램이 스스로 꺼지고
  이 .bat 이 파일을 바꿔 낀 뒤 다시 켭니다(`server/업데이트.ts` 의
  `갈아끼우기()` 가 `process.cwd()\통돌Note 갈아끼우기.bat` 을 찾습니다).

  ★ 그런데 이 파일이 **배포본에 안 들어가고 있었습니다.** 그러면 —
    새 버전을 받기까지는 다 되고, 띠도 뜨고, 단추도 눌리는데,
    마지막에 「갈아끼우기.bat 이 프로그램 폴더에 없습니다」로 끝납니다.
    자동 업데이트가 **끝에서 한 걸음 앞에서** 멎는 셈입니다.

  「설치.bat」과 달리 이것은 **깔린 폴더에 남아 있어야** 합니다.
  install.ps1 은 data· 설치 한 쌍만 빼고 나머지를 다 옮기므로,
  여기서 담기만 하면 제자리로 갑니다.
#>
$갈아끼우기 = Join-Path $root "통돌Note 갈아끼우기.bat"
if (Test-Path -LiteralPath $갈아끼우기) {
  Copy-Item -LiteralPath $갈아끼우기 -Destination (Join-Path $out "통돌Note 갈아끼우기.bat") -Force
}

<#
  ── 안내문과 설명서 (2026-09-08 · HTML 로 바꿈) ────────────

  전에는 `설치 안내.txt` 하나였습니다. **상품으로 파는 것**이라
  메모장 글씨로는 안 된다는 무무 님 지시로 HTML 두 장으로 바꿨습니다.

    설치 안내.html    받아서 켜기까지
    사용설명서.html   첫 달을 혼자 마무리하기까지

  ★ 둘 다 **그림·글꼴·모양이 파일 하나 안에 다 들어** 있습니다.
    기관은 이 파일을 메일로 받거나 zip 에서 꺼내 두 번 누릅니다.
    옆에 딸린 파일이 있으면 하나만 옮겨졌을 때 **글이 무너진 채로**
    열립니다. 웹 글꼴도 안 씁니다 — 인터넷이 없는 PC 에서 조용히
    다른 글꼴로 바뀌기 때문입니다.

  그냥 복사하지 않고 **버전 번호를 찍어서** 넣습니다.
  안내문에 버전이 없으면 「몇 버전 안내문을 보고 계세요?」에 답할 수
  없고, 손으로 적어 두면 반드시 어느 날 실제 버전과 어긋납니다.
#>
$문서들 = @("설치 안내.html", "사용설명서.html")
$문서넣음 = 0
foreach ($d in $문서들) {
  $src = Join-Path $root $d
  if (-not (Test-Path -LiteralPath $src)) { continue }
  $glob = Get-Content -LiteralPath $src -Raw -Encoding UTF8
  $glob = $glob -replace '\{버전\}', "v$ver"
  [System.IO.File]::WriteAllText(
    (Join-Path $out $d), $glob, (New-Object System.Text.UTF8Encoding($true)))
  $문서넣음++
}
$guideCopied = ($문서넣음 -eq $문서들.Count)

# ── 7. 스스로 점검 ───────────────────────────────────────────
# 사람이 눈으로 세는 대신 **여기서 셉니다.** 빠뜨림은 늘 조용합니다.
Say ""
Say "  점검"
Say "  ─────────────────────────────────────────"
$bad = 0
function Check([string]$label, [bool]$ok, [string]$note) {
  if ($ok) { Say ("    있음   " + $label + $(if ($note) { "   — $note" } else { "" })) }
  else { Say ("  ✗ 없음   " + $label); $script:bad++ }
}

$exeOut = Join-Path $out "통돌Note.exe"
$exeMB = if (Test-Path -LiteralPath $exeOut) { [math]::Round((Get-Item -LiteralPath $exeOut).Length / 1MB, 1) } else { 0 }
Check "통돌Note.exe" (Test-Path -LiteralPath $exeOut) "$exeMB MB"
if ($exeMB -lt 20) { Say "  ✗ 이상   실행 파일이 너무 작습니다. 제대로 묶이지 않았을 수 있습니다."; $bad++ }

Check "dist-web\index.html" (Test-Path -LiteralPath (Join-Path (Join-Path $out "dist-web") "index.html")) ""
Check "서식" (@(Get-ChildItem -LiteralPath (Join-Path $out "서식") -Filter "*.hwpx" -ErrorAction SilentlyContinue).Count -ge 1) ("" + $forms.Count + "개")
Check "글꼴" (@(Get-ChildItem -LiteralPath (Join-Path $out "글꼴") -Filter "*.ttf" -ErrorAction SilentlyContinue).Count -ge 1) ("" + $fonts.Count + "개")
Check "도구\한글PDF변환.ps1 (기록지를 PDF 로 뽑는 것)" (Test-Path -LiteralPath (Join-Path (Join-Path $out "도구") "한글PDF변환.ps1")) ""
Check "도구\FilePathCheckerModuleExample.dll (한글 경고창 막는 것)" (Test-Path -LiteralPath (Join-Path (Join-Path $out "도구") "FilePathCheckerModuleExample.dll")) ""
Check "도구\아이콘.ico (바탕화면 바로가기가 대는 그림)" (Test-Path -LiteralPath (Join-Path (Join-Path $out "도구") "아이콘.ico")) ""

# 제출 서식이 **한 글자도 안 바뀌었는지** 봅니다.
# 지자체에 내는 서식은 마음대로 고치는 것이 아닙니다.
$formSame = $true
foreach ($f in $forms) {
  $there = Join-Path (Join-Path $out "서식") $f.Name
  if (-not (Test-Path -LiteralPath $there)) { $formSame = $false; break }
  if ((Get-FileHash -LiteralPath $f.FullName).Hash -ne (Get-FileHash -LiteralPath $there).Hash) { $formSame = $false; break }
}
Check "제출 서식이 원본과 한 글자도 다르지 않음" $formSame ""

# 자료함은 **들어가면 안 됩니다.**
$dataIn = Test-Path -LiteralPath (Join-Path $out "data")
if ($dataIn) { Say "  ✗ 이상   data 폴더가 들어갔습니다. 자료는 기관 것입니다."; $bad++ }
else { Say "    없음   data (맞습니다 — 처음 켤 때 저절로 생깁니다)" }

Check "설치 안내.html · 사용설명서.html (버전 번호를 찍어 넣습니다)" $guideCopied "$문서넣음 장"

# 설치 파일은 **한 쌍**이라야 합니다. 하나만 있으면 눌러도 아무 일이 없습니다.
$설치bat = Test-Path -LiteralPath (Join-Path $out "통돌Note 설치.bat")
$설치ps1 = Test-Path -LiteralPath (Join-Path $out "install.ps1")
Check "통돌Note 설치.bat (기관이 제일 먼저 누르는 것)" $설치bat ""
Check "install.ps1 (설치.bat 이 부르는 짝)" $설치ps1 ""
if ($설치bat -ne $설치ps1) {
  Say "  ✗ 이상   설치 파일이 한 쌍이 아닙니다. 하나만 보내면 눌러도 아무 일이 없습니다."
  $bad++
}

# 갈아끼우기가 빠지면 자동 업데이트가 **마지막 한 걸음에서** 멎습니다.
$갈bat = Test-Path -LiteralPath (Join-Path $out "통돌Note 갈아끼우기.bat")
Check "통돌Note 갈아끼우기.bat (자동 업데이트가 마지막에 부르는 것)" $갈bat ""
if (-not $갈bat) { $bad++ }

<#
  ── .bat 은 ASCII · CRLF 여야 합니다 ──────────────────────────

  cmd.exe 는 .bat 의 바이트를 기계 코드 페이지로 읽고 **바이트 자리로**
  되짚어 갑니다. 한글이 섞이거나 줄끝이 LF 뿐이면 자리가 어긋나
  **낱말 가운데부터** 다시 읽습니다. 그러면 'ote' 'project' 같은
  토막을 명령으로 실행하려 듭니다 (2026-09-11 에 실제로 그랬습니다).

  기관 PC 에서 이런 일이 나면 아무도 못 고칩니다. 여기서 막습니다.
#>
foreach ($b in (Get-ChildItem -LiteralPath $out -Filter "*.bat" -File)) {
  $바이트 = [System.IO.File]::ReadAllBytes($b.FullName)
  $높은바이트 = @($바이트 | Where-Object { $_ -gt 127 }).Count
  $줄끝 = ($바이트 -join ",")
  $cr = @($바이트 | Where-Object { $_ -eq 13 }).Count
  $lf = @($바이트 | Where-Object { $_ -eq 10 }).Count
  if ($높은바이트 -gt 0) {
    Say "  ✗ 이상   $($b.Name) 안에 한글(또는 ASCII 밖 글자)이 있습니다."
    $bad++
  } elseif ($cr -lt $lf) {
    Say "  ✗ 이상   $($b.Name) 의 줄끝이 CRLF 가 아닙니다 (CR $cr · LF $lf)."
    $bad++
  } else {
    Say "    좋음   $($b.Name)  — ASCII · CRLF"
  }
}

if ($bad -gt 0) {
  Say ""
  Say "  $bad 가지가 어긋납니다. 이대로 보내지 마세요."
  Read-Host "  엔터를 누르면 닫힙니다"
  exit 1
}

# ── 8. 압축 한 개로 ──────────────────────────────────────────
# 기관에 보낼 때 파일 하나면 됩니다. 폴더째 보내면 한둘이 빠집니다.
$zip = Join-Path $root ("$outName.zip")
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
<#
  방금 만든 94MB 짜리 실행 파일은 **백신이 곧바로 훑습니다.**
  그동안은 파일이 잡혀 있어 「다른 프로세스가 사용 중」으로 압축이 실패합니다.
  한 번 실패했다고 포기하지 않고 **세 번까지, 5초씩 쉬며** 다시 해 봅니다.
  실제로 이것 때문에 처음 돌렸을 때 zip 이 안 나왔습니다 (2026-08-30).
#>
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipDone = $false
$zipWhy = ""
for ($try = 1; $try -le 3 -and -not $zipDone; $try++) {
  try {
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    # 한글 파일 이름이 깨지지 않게 UTF-8 을 **명시**합니다.
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
      $out, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $true, [System.Text.Encoding]::UTF8)
    $zipMB = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1)
    Say ("    묶음   $outName.zip   — $zipMB MB" + $(if ($try -gt 1) { "   ($try 번째에 됐습니다)" } else { "" }))
    $zipDone = $true
  } catch {
    $zipWhy = $_.Exception.Message
    if ($try -lt 3) {
      Say ("    묶음   백신이 파일을 훑는 중인 듯합니다. 5초 쉬고 다시 해 봅니다… ($try/3)")
      Start-Sleep -Seconds 5
    }
  }
}
if (-not $zipDone) {
  Say ""
  Say "  ✗ 압축을 못 했습니다 — $zipWhy"
  Say "    폴더($outName)는 멀쩡합니다. 폴더에서 오른쪽 눌러"
  Say "    「보내기 → 압축(ZIP) 폴더」로 직접 묶으셔도 됩니다."
  Say ""
}

# ── 8-나. 업데이트 올릴 것 ───────────────────────────────────
<#
  ── 왜 여기서 같이 만드나 ──────────────────────────────────
  따로 돌리는 것으로 두면 **잊습니다.** 잊으면 새 버전을 올려도 기관의
  프로그램은 「새 버전이 있다」를 영영 모릅니다. 조용히 아무 일도 안
  일어나는 고장이라 몇 달 뒤에나 알아챕니다. 그래서 zip 을 만든
  그 자리에서 같이 만듭니다.

  서명 열쇠가 아직 없으면 **그냥 건너뜁니다.** zip 은 이미 멀쩡히
  만들어져 있으니, 손으로 건네는 길은 그대로 살아 있습니다.
#>
$올릴것 = Join-Path $root "올릴것"
$바뀐것파일 = Join-Path $root "이번에 바뀐 것.txt"
$집 = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
$개인열쇠 = Join-Path $집 "통돌Note-서명열쇠\개인열쇠.pem"

if (-not $zipDone) {
  Say ""
  Say "  업데이트 올릴 것은 만들지 않았습니다 (압축이 없어서)."
} elseif (-not (Test-Path -LiteralPath $개인열쇠)) {
  Say ""
  Say "  ⚠ 서명 열쇠가 없습니다 —「서명열쇠 만들기.bat」을 한 번 눌러 주세요."
  Say ""
  Say "    이대로 내보내면 그 기관은 새 버전 알림을 영영 못 받습니다."
  Say "    기관 화면에는 아무 표시도 안 뜹니다 — 조용히 아무 일도 안"
  Say "    일어나는 고장이라, 알아채는 사람이 없습니다."
  Say ""
  Say "    (zip 은 멀쩡히 만들어졌습니다. 손으로 건네는 길은 그대로 됩니다.)"
} elseif (-not (Test-Path -LiteralPath $바뀐것파일)) {
  Say ""
  Say "  업데이트 올릴 것은 만들지 않았습니다."
  Say "    「이번에 바뀐 것.txt」가 없습니다. 무엇이 바뀌었는지"
  Say "    한 줄에 하나씩 적어 두고 다시 눌러 주세요."
} else {
  Say ""
  Say "  업데이트 올릴 것"
  Say "  ─────────────────────────────────────────"
  <#
    「꼭 해야 하는 버전」인가 — 셈이 틀렸던 것을 고친 버전만 예입니다.
    아무 버전에나 붙이면 그 표시가 아무 뜻도 없어집니다.
  #>
  Say "  이 버전은 셈이 틀리던 것을 고친 버전입니까?"
  Say "  (그런 버전을 안 깔면 엉뚱한 청구서가 어르신께 갑니다.)"
  $꼭 = (Read-Host "  꼭 해야 하는 버전이면 y, 아니면 그냥 엔터").Trim()
  $꼭값 = if ($꼭 -match '^[yY]') { "1" } else { "0" }

  & bun (Join-Path $root "도구\버전정보만들기.ts") $zip $ver $꼭값
  if ($LASTEXITCODE -ne 0) {
    Say ""
    Say "  ✗ 버전정보를 못 만들었습니다. 올리지 마세요."
    Say "    zip 자체는 멀쩡하니 손으로 건네시는 것은 됩니다."
  }
}

# ── 9. 끝 ────────────────────────────────────────────────────
Say ""
Say "  ─────────────────────────────────────────"
Say "  다 됐습니다."
Say ""
Say "    폴더    $outName"
if (Test-Path -LiteralPath $zip) {
  Say "    압축    $outName.zip   ← 기관에는 이 파일 하나만 보내면 됩니다"
} else {
  Say "    압축    (못 만들었습니다 — 폴더째 보내시면 됩니다)"
}
Say ""
Say "  이제 개발 도구가 없는 컴퓨터에서 확인해 주세요."
Say "    1. 압축을 풀고 통돌Note.exe 를 두 번 누른다"
Say "    2. 브라우저가 하나만 열린다"
Say "    3. 기관 정보·관리자 계정을 넣는다"
Say "    4. 대상자 한 명 넣고 기록지를 PDF 로 뽑는다 — 경고창이 안 떠야 합니다"
Say "    5. 설정 → 이 프로그램에 버전 번호 $ver 이 보인다"
Say ""

$올릴것폴더 = Join-Path $root "올릴것"
if (Test-Path -LiteralPath $올릴것폴더) {
  Say "    올릴것  ← GitHub 에 이 폴더 안의 세 파일을 올리시면 됩니다"
  Say "            (자세한 것은 「업데이트 올리는 법.md」)"
  Say ""
}

$show = if (Test-Path -LiteralPath $올릴것폴더) { $올릴것폴더 }
        elseif (Test-Path -LiteralPath $zip) { $zip } else { $out }
try { Start-Process explorer.exe -ArgumentList ('/select,"' + $show + '"') } catch { }
Read-Host "  엔터를 누르면 닫힙니다"
