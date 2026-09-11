<#
  ═══════════════════════════════════════════════════════════
   통돌 Note — 설치
  ═══════════════════════════════════════════════════════════

  「통돌Note 설치.bat」이 이 파일을 부릅니다.

  ── 왜 설치 파일이 따로 있나 (2026-09-08 무무 지시) ──────────

  지금까지는 zip 을 풀고 폴더에 들어가 exe 를 두 번 누르는 것이
  전부였습니다. 그러다 **자료가 통째로 사라지는 길** 하나를 찾았습니다.

    ★ 윈도는 zip 안의 exe 를 두 번 누르면 **임시 폴더에 풀어서**
      실행해 줍니다. 프로그램은 잘 돕니다. 그런데 자료함(data\)이
      그 임시 폴더에 생깁니다. 컴퓨터를 끄거나 윈도가 임시 폴더를
      치우면 **한 달치 자료가 통째로 사라집니다.**

  「압축을 푸세요」라고 안내문에 적혀 있지만 **안 읽습니다.** 그리고
  안 읽었다는 사실을 아무도 모르다가 한 달 뒤에 압니다. 그래서
  **글이 아니라 프로그램이 막습니다.**

  ── 여기서 하는 일 다섯 ─────────────────────────────────────

   ① 지금 **어디서 돌고 있는지** 봅니다 — 임시 폴더면 거기서 멈춥니다
   ② C:\통돌Note 에 넣습니다 (Program Files 는 피합니다)
   ③ ★ **자료함(data\)은 손도 안 댑니다** — 다시 깔아도 자료는 그대로
   ④ 바탕화면 · 시작 메뉴에 **바로가기** (아이콘이 붙습니다)
   ⑤ ★ 「인터넷에서 받음」 **꼬리표를 뗍니다** — 그래야 다음부터
      「Windows의 PC 보호」 창이 안 뜹니다

  ⑤ 를 조금 더 — 그 파란 경고창은 파일이 바이러스라서 뜨는 것이
  아니라 **「인터넷에서 받은 파일」이라는 꼬리표**(Zone.Identifier)가
  붙어 있어서 뜹니다. 기관이 이미 설치를 누른 뒤이니, 우리가 방금
  복사해 넣은 우리 파일의 꼬리표를 떼는 것은 맞는 일입니다.
  **서명 인증서 없이 할 수 있는 유일한 길**이기도 합니다.

  ── 안 하는 것 ──────────────────────────────────────────────

  · 관리자 권한을 안 씁니다. 필요 없고, 물으면 그것대로 무섭습니다
  · 레지스트리를 안 건드립니다. 지울 때 **폴더만 지우면** 끝나야 합니다
  · 시작프로그램 등록을 여기서 안 합니다 — 설정 화면에 이미 있습니다
#>

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function 말([string]$t) { Write-Host $t }
function 멈춤([string]$t) {
  말 ""
  말 "  ────────────────────────────────────────────────────────"
  말 "  $t"
  말 "  ────────────────────────────────────────────────────────"
  말 ""
  Read-Host "  엔터를 누르면 닫힙니다" | Out-Null
  exit 1
}

$여기 = Split-Path -Parent $MyInvocation.MyCommand.Path

말 ""
말 "  ════════════════════════════════════════════════════════"
말 "    통돌 Note  설치"
말 "  ════════════════════════════════════════════════════════"
말 ""

# ── ① 압축을 안 풀고 돌리고 있나 ★ 제일 중요 ─────────────────
<#
  임시 폴더에서 돌고 있으면 **자료가 사라지는 길**입니다.
  윈도가 zip 안의 파일을 풀어 놓는 자리를 짚어 봅니다.
#>
$임시자리 = @()
foreach ($v in @($env:TEMP, $env:TMP, "$env:LOCALAPPDATA\Temp")) {
  if ($v) { $임시자리 += [IO.Path]::GetFullPath($v).TrimEnd('\') }
}
$여기전체 = [IO.Path]::GetFullPath($여기).TrimEnd('\')
$임시인가 = $false
foreach ($t in $임시자리) {
  if ($여기전체.StartsWith($t, [StringComparison]::OrdinalIgnoreCase)) { $임시인가 = $true }
}
<#
  압축 프로그램마다 푸는 자리가 다릅니다 — 「Temp\Rar$…」·「Temp\7z…」·
  「AppData\…\INetCache」. 이름으로도 한 번 더 봅니다.

  ★ 빗금을 **둘 다** 봅니다(\ 와 /). 윈도는 \ 를 쓰지만, 시늉으로
    돌려 보는 자리(리눅스)는 / 를 씁니다 — 한쪽만 보면 **시험이
    이 길을 못 지킵니다.** 자료가 사라지는 길이라 반드시 지켜야 합니다.
#>
if ($여기전체 -match '[\\/](Temp|INetCache|Temporary Internet Files)[\\/]') { $임시인가 = $true }

if ($임시인가) {
  말 "  ✗ 압축을 아직 안 푸셨습니다."
  말 ""
  말 "     지금 이 파일은 임시 폴더에서 돌고 있습니다 —"
  말 "     $여기전체"
  말 ""
  말 "     이대로 쓰시면 적어 넣은 자료가 어느 날 통째로 사라집니다."
  말 "     윈도가 임시 폴더를 치우면서 같이 지우기 때문입니다."
  말 ""
  말 "  ── 이렇게 해 주세요 ────────────────────────────────────"
  말 ""
  말 "     ① 받으신 zip 파일을 오른쪽 눌러 「압축 풀기」"
  말 "     ② 풀린 폴더에 들어가서"
  말 "     ③ 거기 있는 「통돌Note 설치.bat」을 두 번 누르기"
  말 ""
  멈춤 "압축을 푸신 뒤에 다시 눌러 주세요."
}

# ── 챙겨 갈 것이 다 있나 ─────────────────────────────────────
$exe = Join-Path $여기 "통돌Note.exe"
if (-not (Test-Path -LiteralPath $exe)) {
  말 "  ✗ 이 폴더에 통돌Note.exe 가 없습니다."
  말 ""
  말 "     $여기"
  말 ""
  말 "     압축을 푼 폴더 안에 있는 「통돌Note 설치.bat」을"
  말 "     눌러 주세요. 바탕화면에 따로 꺼내 두신 것이면 안 됩니다."
  멈춤 "폴더를 확인해 주세요."
}

$챙길것 = @("통돌Note.exe", "dist-web", "서식", "글꼴", "도구",
            "설치 안내.html", "사용설명서.html", "통돌Note 갈아끼우기.bat")
$없는것 = @()
foreach ($n in $챙길것) {
  if (-not (Test-Path -LiteralPath (Join-Path $여기 $n))) { $없는것 += $n }
}
# 안내문과 갈아끼우기는 없어도 프로그램은 돕니다 — 알리기만 합니다.
<#
  ★ **없으면 안 되는 것**과 없어도 되는 것을 가릅니다.

    dist-web  없으면 켜도 **흰 화면**만 나옵니다
    서식      없으면 군에 낼 **종이를 못 뽑습니다**
    글꼴      없으면 뽑은 종이의 **글자가 깨집니다**

  반쪽만 깔아 놓고 「다 됐습니다」라고 하면, 기관은 한참 뒤에
  못 쓰는 것을 압니다. **여기서 멈추는 편이 낫습니다.**
#>
$꼭 = @("통돌Note.exe", "dist-web", "서식", "글꼴")
$까닭 = @{
  "dist-web" = "켜도 흰 화면만 나옵니다"
  "서식"     = "군에 낼 종이를 못 뽑습니다"
  "글꼴"     = "뽑은 종이의 글자가 깨집니다"
}
foreach ($n in $없는것) {
  if ($꼭 -contains $n) {
    $덧 = if ($까닭.ContainsKey($n)) { " — " + $까닭[$n] } else { "" }
    멈춤 "$n 이(가) 없습니다$덧. 압축이 덜 풀렸을 수 있습니다."
  }
}

# ── ② 어디에 넣나 ────────────────────────────────────────────
<#
  Program Files 를 피하는 까닭 — 그 안은 **관리자만 쓸 수 있어**
  프로그램이 자기 옆의 data\ 에 자료를 못 씁니다. 윈도가 몰래
  다른 자리로 돌려놓기도 하는데(가상화), 그러면 자료가 어디 있는지
  아무도 모르게 됩니다.
#>
$기본자리 = "C:\통돌Note"
말 "  어디에 넣을까요?"
말 ""
말 "     그냥 엔터를 누르시면  $기본자리"
말 ""
$고른자리 = Read-Host "  다른 곳에 넣으시려면 여기에 적어 주세요"
if ([string]::IsNullOrWhiteSpace($고른자리)) { $고른자리 = $기본자리 }
$고른자리 = $고른자리.Trim().Trim('"')

if ($고른자리 -match '^[A-Za-z]:\\Program Files') {
  멈춤 "Program Files 안에는 넣을 수 없습니다. 그 안에서는 자료를 저장하지 못합니다."
}
try { $놓을곳 = [IO.Path]::GetFullPath($고른자리) }
catch { 멈춤 "그 자리를 알아볼 수 없습니다 — $고른자리" }

if ($놓을곳.TrimEnd('\') -eq $여기전체) {
  말 "  이미 여기 있습니다. 자리를 옮기지 않고 바로가기만 만듭니다."
  $놓을곳 = $여기전체
  $옮기나 = $false
} else { $옮기나 = $true }

# ── ③ 복사 — ★ data\ 는 손도 안 댑니다 ──────────────────────
if ($옮기나) {
  $이미있나 = Test-Path -LiteralPath (Join-Path $놓을곳 "통돌Note.exe")
  New-Item -ItemType Directory -Path $놓을곳 -Force | Out-Null

  말 ""
  if ($이미있나) {
    말 "  이미 깔려 있습니다. 프로그램만 갈아 끼웁니다."
    말 "  자료함(data\)은 건드리지 않습니다."
  } else {
    말 "  넣는 중입니다… (95MB 라 스무 걸음쯤 걸립니다)"
  }

  <#
    ★ **data\ 를 복사 목록에 넣지 않습니다.**
    배포 폴더에는 원래 data\ 가 없지만(만들기.bat 이 확인합니다),
    누가 손으로 넣어 두었을 수도 있습니다. 그것이 기관의 자료함을
    덮어쓰면 **한 달치가 남의 자료로 바뀝니다.** 이름으로 막습니다.
  #>
  foreach ($것 in Get-ChildItem -LiteralPath $여기 -Force) {
    if ($것.Name -eq "data") { continue }
    <#
      설치 파일 **한 쌍**은 안 따라갑니다. 하나만 따라가면 깔린 폴더에
      「통돌Note 설치.bat」이 있는데 눌러도 아무 일이 없습니다 —
      기관은 그것을 고장으로 봅니다. 둘 다 두고 옵니다.
    #>
    if ($것.Name -eq "install.ps1") { continue }
    if ($것.Name -eq "통돌Note 설치.bat") { continue }
    Copy-Item -LiteralPath $것.FullName -Destination $놓을곳 -Recurse -Force
  }
  말 "  넣었습니다  →  $놓을곳"
}

# ── ⑤ 「인터넷에서 받음」 꼬리표 떼기 ────────────────────────
<#
  ★ 이것이 「Windows의 PC 보호」 파란 창을 **안 뜨게** 합니다.

  그 창은 파일이 바이러스라서 뜨는 것이 아니라, 인터넷에서 받은
  파일에 붙는 **꼬리표**(Zone.Identifier) 때문에 뜹니다. 기관이 이미
  설치를 누른 뒤이니 우리가 방금 넣은 **우리 파일의** 꼬리표를 떼는
  것은 맞는 일이고, **서명 인증서 없이 할 수 있는 유일한 길**입니다.

  못 떼어도 프로그램은 돕니다 — 경고창이 한 번 더 뜰 뿐이라
  여기서 멈추지 않습니다.
#>
$뗀수 = 0
try {
  foreach ($f in Get-ChildItem -LiteralPath $놓을곳 -Recurse -File -Force -ErrorAction SilentlyContinue) {
    try { Unblock-File -LiteralPath $f.FullName -ErrorAction Stop; $뗀수++ } catch { }
  }
} catch { }
말 ("  꼬리표를 뗐습니다 ({0}개) — 「Windows의 PC 보호」 창이 안 뜹니다" -f $뗀수)

# ── ④ 바로가기 ───────────────────────────────────────────────
<#
  폴더를 찾아 들어가 exe 를 누르게 두면, 언젠가 **폴더를 옮겨 놓고**
  못 찾습니다. 바탕화면에 있으면 그 일이 안 납니다.

  아이콘 파일(도구\아이콘.ico)이 있으면 붙입니다. exe 에 이미
  박혀 있지만, 바로가기에 따로 대 두면 아이콘이 더 빨리 뜹니다.
#>
$새exe = Join-Path $놓을곳 "통돌Note.exe"
$아이콘 = Join-Path $놓을곳 "도구\아이콘.ico"
$만든바로가기 = @()

function 바로가기만들기([string]$자리, [string]$이름) {
  try {
    if (-not (Test-Path -LiteralPath $자리)) { return $null }
    $lnk = Join-Path $자리 "$이름.lnk"
    $ws = New-Object -ComObject WScript.Shell
    $s = $ws.CreateShortcut($lnk)
    $s.TargetPath = $새exe
    $s.WorkingDirectory = $놓을곳          # ★ 자료함이 여기 생깁니다
    $s.Description = "통돌 Note — 통합돌봄 서비스 제공기관 업무 프로그램"
    if (Test-Path -LiteralPath $아이콘) { $s.IconLocation = $아이콘 }
    $s.Save()
    return $lnk
  } catch { return $null }
}

$바탕 = [Environment]::GetFolderPath("Desktop")
$l1 = 바로가기만들기 $바탕 "통돌 Note"
if ($l1) { $만든바로가기 += "바탕화면" }

<#
  ★ 시작 메뉴 자리는 **없을 수도 있습니다.**
  (2026-09-08 — 시늉으로 돌려 보다 여기서 터졌습니다. 복사까지 다 해
   놓고 마지막에 죽으면, 기관 화면에는 빨간 글만 남고 **깔린 건지
   아닌지 알 수가 없습니다.** 바로가기 하나 때문에 그러면 안 됩니다.)
#>
if ($env:APPDATA) {
  $시작 = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
  $l2 = 바로가기만들기 $시작 "통돌 Note"
  if ($l2) { $만든바로가기 += "시작 메뉴" }
}

if ($만든바로가기.Count -gt 0) {
  말 ("  바로가기를 만들었습니다 — " + ($만든바로가기 -join " · "))
} else {
  말 "  바로가기는 못 만들었습니다. $놓을곳 안의 통돌Note.exe 를 쓰시면 됩니다."
}

# ── 스스로 점검 ─────────────────────────────────────────────
말 ""
말 "  점검"
말 "  ─────────────────────────────────────────"
$탈 = 0
function 봄([string]$무엇, [bool]$됨, [string]$덧말) {
  if ($됨) { 말 ("    있음   " + $무엇 + $(if ($덧말) { "   — $덧말" } else { "" })) }
  else { 말 ("  ✗ 없음   " + $무엇); $script:탈++ }
}
$exeMB = if (Test-Path -LiteralPath $새exe) { [math]::Round((Get-Item -LiteralPath $새exe).Length / 1MB, 1) } else { 0 }
봄 "통돌Note.exe" (Test-Path -LiteralPath $새exe) "$exeMB MB"
if ($exeMB -lt 20) { 말 "  ✗ 이상   실행 파일이 너무 작습니다."; $탈++ }
봄 "dist-web\index.html" (Test-Path -LiteralPath (Join-Path $놓을곳 "dist-web\index.html")) ""
봄 "서식" ((@(Get-ChildItem -LiteralPath (Join-Path $놓을곳 "서식") -Filter "*.hwpx" -ErrorAction SilentlyContinue)).Count -ge 1) ""
봄 "글꼴" ((@(Get-ChildItem -LiteralPath (Join-Path $놓을곳 "글꼴") -Filter "*.ttf" -ErrorAction SilentlyContinue)).Count -ge 1) ""

# 자료함은 **여기서 만들지 않습니다** — 프로그램이 처음 켤 때 만듭니다.
if (Test-Path -LiteralPath (Join-Path $놓을곳 "data")) {
  말 "    있음   data (쓰시던 자료함입니다 — 그대로 두었습니다)"
} else {
  말 "    없음   data (맞습니다 — 처음 켤 때 저절로 생깁니다)"
}

if ($탈 -gt 0) { 멈춤 "$탈 가지가 어긋납니다. 압축을 다시 풀고 해 보세요." }

# ── 켜기 ────────────────────────────────────────────────────
말 ""
말 "  ════════════════════════════════════════════════════════"
말 "    다 됐습니다."
말 ""
말 "    다음부터는 바탕화면의 「통돌 Note」를 두 번 누르시면 됩니다."
말 "    이 폴더는 옮기거나 지우지 마세요 — 자료함이 이 안에 있습니다."
말 "  ════════════════════════════════════════════════════════"
말 ""
$켤까 = Read-Host "  지금 켤까요? (엔터 = 켬 / n = 안 켬)"
if ($켤까 -notmatch '^[nN]') {
  말 "  켭니다… 브라우저가 저절로 열립니다."
  Start-Process -FilePath $새exe -WorkingDirectory $놓을곳
  Start-Sleep -Seconds 2
} else {
  Read-Host "  엔터를 누르면 닫힙니다" | Out-Null
}
