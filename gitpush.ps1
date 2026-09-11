<#
  통돌 Note — 소스를 GitHub 에 올리기

  「깃 올리기.bat」이 이 파일을 부릅니다.

  ── 이것은 「배포」가 아닙니다 ─────────────────────────────

  기관이 받는 새 버전은 **Release** 로 나갑니다 —
  version.json · version.json.sig · 통돌Note_1.xx.xx.zip 세 파일.
  그 셋은 지금도 GitHub Release 화면에 손으로 올리고 있고, 그 길은
  이 파일과 아무 상관이 없습니다.

  이 파일이 하는 일은 하나입니다 —
  **소스(만든 글)를 GitHub 저장소에 남겨 두는 것.**

  왜 남기나 —
    · 지금 이 프로그램은 **PC 한 대에만 있습니다.** 그 PC 가 죽으면 끝입니다.
    · 「어제는 됐는데 오늘 안 되네」일 때 **어제로 되돌릴** 수 있습니다.
    · 무엇을 언제 왜 고쳤는지가 날짜와 함께 남습니다.

  ── .bat 이 직접 git 을 안 부르는 까닭 ─────────────────────

  .bat 은 **한 글자도 한글이면 안 됩니다.** cmd.exe 는 .bat 의 바이트를
  기계 코드 페이지로 읽고 바이트 자리로 되짚어 가기 때문에, 한글이
  섞이면 어느 날 낱말 가운데부터 읽습니다. 그래서 한글이 드는 일은
  전부 .ps1 이 하고, 이 파일 이름도 ASCII 로만 지었습니다.
#>
$ErrorActionPreference = "Stop"
try { chcp 65001 > $null 2>&1 } catch { }
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$뿌리 = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $뿌리

function 말 { param([string]$t = "") Write-Output $t }
function 줄 { 말 "  ────────────────────────────────────────────────────" }

# git 을 부르고 (나온 말, 끝값) 을 돌려줍니다.
$script:깃코드 = 0
function 깃 {
  $이전 = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $결과 = & git @args 2>&1
  $script:깃코드 = $LASTEXITCODE
  $ErrorActionPreference = $이전
  if ($null -eq $결과) { return "" }
  return (($결과 | Out-String).Trim())
}

말 ""
말 "  통돌 Note — 소스를 GitHub 에 올리기"
줄
말 ""

# ── 0. git 이 깔려 있나 ────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  말 "  이 컴퓨터에 git 이 없습니다."
  말 ""
  말 "  git 은 「무엇을 언제 고쳤는지」를 남겨 두는 공짜 프로그램입니다."
  말 "  한 번만 깔면 됩니다."
  말 ""
  말 "    받는 곳   https://git-scm.com/download/win"
  말 "    고를 것   64-bit Git for Windows Setup"
  말 "    까는 법   묻는 것을 다 그대로 두고 Next 만 계속 누르면 됩니다"
  말 ""
  $열까 = (Read-Host "  받는 곳을 지금 열까요? (Y / N)").Trim()
  if ($열까 -match '^(y|Y|ㅛ)') { Start-Process "https://git-scm.com/download/win" }
  말 ""
  말 "  다 깔고 나면 **검은 창을 닫았다가**「깃 올리기.bat」을 다시 누르세요."
  말 "  (창을 닫아야 새로 깔린 git 을 찾습니다.)"
  말 ""
  exit 1
}

# ── 1. 저장소 준비 (처음 한 번) ────────────────────────────
$처음 = -not (Test-Path -LiteralPath (Join-Path $뿌리 ".git"))

if ($처음) {
  말 "  이 폴더는 아직 git 저장소가 아닙니다. 처음 한 번 준비하겠습니다."
  말 ""
}

# 올릴 주소 — server\업데이트열쇠.ts 에 박힌 주소에서 뽑습니다.
$원격 = ""
if (-not $처음) {
  $원격 = 깃 remote get-url origin
  if ($script:깃코드 -ne 0) { $원격 = "" }
}

if (-not $원격) {
  $주인 = ""
  $저장소이름 = "tongdol-note"
  $열쇠파일 = Join-Path $뿌리 "server\업데이트열쇠.ts"
  if (Test-Path -LiteralPath $열쇠파일) {
    $글 = Get-Content -LiteralPath $열쇠파일 -Raw -Encoding UTF8
    if ($글 -match 'https://github\.com/([^/"]+)/([^/"]+)/releases') {
      $주인 = $Matches[1]
      $저장소이름 = $Matches[2]
    }
  }
  if (-not $주인) {
    말 "  GitHub 주인 이름을 적어 주세요. (이메일이 아니라 계정 이름입니다)"
    $주인 = (Read-Host "  GitHub 주인 이름").Trim()
    if (-not $주인) { 말 ""; 말 "  이름이 없어 그만둡니다."; 말 ""; exit 1 }
  }
  $넣을것 = "https://github.com/$주인/$저장소이름.git"

  말 "  소스를 올릴 자리"
  말 "    $넣을것"
  말 ""
  말 "  ※ 이 저장소는 **공개**라야 합니다. 기관 프로그램이 로그인 없이"
  말 "     Release 를 받아 가야 하기 때문입니다. 그래서 여기에 올린"
  말 "     소스도 **누구나 볼 수 있게 됩니다.**"
  말 "     소스는 남에게 안 보이게 두고 싶으시면, 여기에 **다른(비공개)**"
  말 "     저장소 주소를 치세요. Release 는 지금 쓰던 저장소 그대로입니다."
  말 ""
  $다른 = (Read-Host "  이 주소로 올릴까요? (엔터 = 예 / 다른 주소면 여기 붙여넣기)").Trim()
  if ($다른) { $넣을것 = $다른 }
  $원격 = $넣을것

  if ($처음) { 깃 init | Out-Null }
  깃 remote remove origin 2>&1 | Out-Null
  깃 remote add origin $원격 | Out-Null
  말 ""
}

<#
  한글 파일 이름이 \354\227\205... 처럼 보이지 않게 합니다.
  이 프로젝트는 파일 이름이 거의 다 한글이라, 이것이 없으면
  「무엇이 올라가는지」 목록이 아무 뜻 없는 숫자 줄이 됩니다.
#>
깃 config core.quotepath false | Out-Null

# 남길 이름과 메일 (처음 한 번)
<#
  ── 이름과 메일은 **받고 나서 봅니다** (2026-09-11) ────────

  실제로 이 두 칸에 버전 번호(v1.21.36)가 들어간 일이 있었습니다.
  그대로 두면 올린 기록마다 만든 이가 「v1.21.36」으로 남고,
  이미 올린 것은 고치기 번거롭습니다. 그래서 모양을 봅니다.
#>
function 이름괜찮나 { param([string]$v)
  if ([string]::IsNullOrWhiteSpace($v)) { return $false }
  if ($v.Trim().Length -lt 2) { return $false }
  if ($v -match '^v?\d+(\.\d+)+$') { return $false }   # 버전 번호 모양
  return $true
}
function 메일괜찮나 { param([string]$v)
  if ([string]::IsNullOrWhiteSpace($v)) { return $false }
  return ($v -match '^[^@\s]+@[^@\s]+\.[^@\s]+$')
}

$쓴이 = 깃 config user.name
while (-not (이름괜찮나 $쓴이)) {
  if (-not [string]::IsNullOrWhiteSpace($쓴이)) {
    말 "  지금 적힌 이름이 «$쓴이» 입니다 — 사람 이름이나 GitHub 계정 이름이라야 합니다."
  }
  말 "  기록에 남길 이름을 적어 주세요. (GitHub 계정 이름이면 됩니다. 버전 번호가 아닙니다)"
  $쓴이 = (Read-Host "  이름").Trim()
  말 ""
}
깃 config user.name $쓴이 | Out-Null

$메일 = 깃 config user.email
while (-not (메일괜찮나 $메일)) {
  if (-not [string]::IsNullOrWhiteSpace($메일)) {
    말 "  지금 적힌 메일이 «$메일» 입니다 — 골뱅이(@)가 든 주소라야 합니다."
  }
  말 "  기록에 남길 메일 주소를 적어 주세요. (GitHub 에 쓰시는 그 주소)"
  $메일 = (Read-Host "  메일").Trim()
  말 ""
}
깃 config user.email $메일 | Out-Null

# 가지(branch) 이름 — 저장소가 쓰는 것을 그대로 따릅니다.
$가지 = "main"
$심 = 깃 ls-remote --symref $원격 HEAD
if ($script:깃코드 -eq 0 -and $심 -match 'ref:\s+refs/heads/(\S+)\s+HEAD') {
  $가지 = $Matches[1]
} elseif ($script:깃코드 -ne 0) {
  말 "  저장소를 열어 보지 못했습니다 —"
  말 "    $원격"
  말 ""
  말 "  ① 주소가 맞는지  ② 그 저장소가 GitHub 에 실제로 있는지 보세요."
  말 "  (비공개 저장소면 곧 로그인 창이 뜹니다. 그건 정상입니다.)"
  말 ""
}

if (-not $처음) {
  $현재가지 = 깃 rev-parse --abbrev-ref HEAD
  if ($script:깃코드 -eq 0 -and $현재가지 -and $현재가지 -ne "HEAD") { $가지 = $현재가지 }
}

if ($처음) {
  깃 fetch origin --quiet | Out-Null
  깃 rev-parse --verify --quiet "refs/remotes/origin/$가지" | Out-Null
  if ($script:깃코드 -eq 0) {
    <#
      저장소에 이미 무언가 있습니다 (GitHub 화면에서 만든 README 같은 것).
      그 위에 얹되 **이 폴더의 파일은 한 개도 건드리지 않습니다.**
        update-ref/symbolic-ref  지금 자리를 GitHub 쪽과 같게 맞춤
        reset --mixed            목록만 맞춤 (작업 파일은 그대로)
        checkout-index -a        저장소에만 있던 파일을 꺼내 놓음
                                 — 이미 있는 파일은 덮어쓰지 않습니다
      checkout -B 를 쓰면 「덮어쓰게 되니 그만둡니다」로 멎습니다.
    #>
    깃 update-ref "refs/heads/$가지" "origin/$가지" | Out-Null
    깃 symbolic-ref HEAD "refs/heads/$가지" | Out-Null
    깃 reset --mixed | Out-Null
    깃 checkout-index -a | Out-Null
  } else {
    깃 symbolic-ref HEAD "refs/heads/$가지" | Out-Null
  }
  말 "  준비 끝. 가지 이름은 $가지 입니다."
  말 ""
}

# ── 2. 올릴 것 모으기 ──────────────────────────────────────
깃 add -A | Out-Null

$올라갈것 = @()
깃 rev-parse --verify --quiet HEAD | Out-Null
if ($script:깃코드 -eq 0) {
  $나온말 = 깃 diff --cached --name-only
} else {
  # 아직 기록이 하나도 없습니다 — 담긴 것이 곧 올라갈 것입니다.
  $나온말 = 깃 ls-files --cached
}
if ($나온말) { $올라갈것 = @($나온말 -split "`r?`n" | Where-Object { $_.Trim() }) }

<#
  ── 3. ★ 열쇠가 딸려 가지 않는지 ───────────────────────────

  2026-09-11 에 실제로 새어 나갔습니다. 이름만 보고 있었기 때문입니다 —
  `_to_delete\_ship.tgz` **묶음 안에** `.env` 가 들어 있었고, 이름은
  `.tgz` 였으니 그냥 지나갔습니다. 공개 저장소였습니다.

  그래서 세 겹으로 봅니다 —

    ① 이름   .env · .pem · 열쇠처럼 보이는 파일 이름
    ② 묶음   .tgz · .zip 같은 것은 **아예 안 올립니다.**
             안을 들여다보는 것보다 이쪽이 확실합니다. 묶음은 소스가
             아니고, 소스 저장소에 있을 까닭이 없습니다.
    ③ 속     올라갈 글 파일의 **내용**을 훑어 열쇠 모양을 찾습니다.
             열쇠를 .ts 나 .md 한가운데 붙여 넣어도 걸립니다.
#>
$이미든것 = @()
$나온말2 = 깃 ls-files
if ($나온말2) { $이미든것 = @($나온말2 -split "`r?`n" | Where-Object { $_.Trim() }) }

$봐야할것 = @($올라갈것) + @($이미든것) | Select-Object -Unique

function 멈춤 { param([string]$머리, [string[]]$줄들, [string]$꼬리)
  깃 reset | Out-Null
  말 ""
  말 "  ████ 멈췄습니다 — $머리 ████"
  말 ""
  foreach ($x in $줄들) { 말 "    $x" }
  말 ""
  말 $꼬리
  말 ""
  말 "  아무것도 올리지 않았습니다."
  말 ""
  exit 1
}

# ── ① 이름으로 ────────────────────────────────────────────
$위험 = @($봐야할것 | Where-Object {
  ($_ -match '(^|/)\.env($|\.)' -or $_ -match '\.env$' -or $_ -match '\.pem$' -or
   $_ -match '\.p12$' -or $_ -match '\.pfx$' -or $_ -match '\.key$' -or
   $_ -match '(^|/)id_rsa' -or $_ -match '개인열쇠') -and
  ($_ -notmatch '\.env\.보기$')
} | Select-Object -Unique)
if ($위험.Count -gt 0) {
  멈춤 "열쇠가 든 파일이 올라갈 뻔했습니다" $위험 `
    "  이런 파일은 한 번 GitHub 에 올라가면 **나중에 지워도 기록에 남습니다.**`r`n  .gitignore 에 이 파일을 막는 줄을 넣고 다시 눌러 주세요."
}

# ── ② 묶음 파일은 안 올립니다 ─────────────────────────────
$묶음 = @($봐야할것 | Where-Object {
  $_ -match '\.(tgz|tar|tar\.gz|zip|7z|rar|gz|bz2|xz)$'
} | Select-Object -Unique)
if ($묶음.Count -gt 0) {
  $보일것 = if ($묶음.Count -gt 12) { $묶음[0..11] + "… 그리고 $($묶음.Count - 12) 개 더" } else { $묶음 }
  멈춤 "묶음 파일은 소스 저장소에 안 올립니다" $보일것 `
    "  묶음 안에 무엇이 들었는지는 이름만 봐서 알 수 없습니다.`r`n  2026-09-11 에 이 자리로 .env 가 새어 나갔습니다.`r`n  .gitignore 에 이렇게 넣으시면 됩니다 —`r`n      _to_delete/`r`n      *.tgz`r`n      *.zip"
}

# ── ③ 속을 훑습니다 ───────────────────────────────────────
<#
  글 파일만 봅니다 (2MB 넘는 것과 그림·소리는 건너뜁니다).
  찾는 모양은 **값이 붙어 있는 것**만입니다 — 소스 주석에 나오는
  「sb_secret_」 같은 낱말만으로는 안 걸립니다.
#>
$열쇠모양 = @(
  @{ 이름 = "Supabase 열쇠";      꼴 = 'sb_secret_[A-Za-z0-9_\-]{12,}' },
  @{ 이름 = "잠긴 열쇠(PEM)";     꼴 = '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  @{ 이름 = "토큰(JWT)";          꼴 = 'eyJhbGciOi[A-Za-z0-9_\-]{24,}' },
  @{ 이름 = "GitHub 토큰";        꼴 = '(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})' },
  @{ 이름 = "AWS 열쇠";           꼴 = 'AKIA[0-9A-Z]{16}' },
  @{ 이름 = "Slack 토큰";         꼴 = 'xox[baprs]-[A-Za-z0-9\-]{10,}' }
)
$글아닌것 = '\.(png|jpg|jpeg|gif|ico|pdf|ttf|otf|woff2?|hwpx|xlsx|docx|pptx|exe|dll|db|zip|tgz|mp4|mp3|wav|b64)$'
$새는것 = @()
foreach ($f in $올라갈것) {
  if ($f -match $글아닌것) { continue }
  $온길 = Join-Path $뿌리 $f
  $것 = Get-Item -LiteralPath $온길 -Force -ErrorAction SilentlyContinue
  if (-not $것 -or $것.Length -gt 2MB) { continue }
  $속 = Get-Content -LiteralPath $온길 -Raw -ErrorAction SilentlyContinue
  if (-not $속) { continue }
  <#
    ── 그림 덩어리는 먼저 걷어 냅니다 (2026-09-11) ───────────

    설명서 HTML 에는 화면 그림이 **base64 글자 덩어리**로 박혀 있습니다.
    1.8MB 짜리 뜻 없는 글자라, 어떤 열쇠 모양이든 **우연히 걸립니다.**
    실제로 「AWS 열쇠가 들었다」며 멈췄고, 뜯어 보니 그림 한가운데의
    `AkiAEuQlwtZ5L9ufPHlS` 였습니다.

    걷어 내도 잃는 것이 없습니다 — 열쇠를 그림 속에 숨겨 올릴 일은
    없고, 덩어리 밖의 글은 그대로 다 봅니다.
  #>
  $속 = [regex]::Replace($속, 'data:[A-Za-z0-9.+\-/]+;base64,[A-Za-z0-9+/=\s]+', 'data:...')
  $속 = [regex]::Replace($속, '[A-Za-z0-9+/=]{200,}', '...')
  foreach ($모양 in $열쇠모양) {
    # ★ -cmatch 라야 합니다. -match 는 **대소문자를 안 가립니다** —
    #   그래서 AKIA 가 akia·AkiA 에도 걸려 헛걸림이 났습니다.
    if ($속 -cmatch $모양.꼴) { $새는것 += ("{0}   ← {1}" -f $f, $모양.이름); break }
  }
}
if ($새는것.Count -gt 0) {
  멈춤 "파일 **안에** 열쇠가 적혀 있습니다" $새는것 `
    "  그 줄을 지우고 값은 .env 에만 두세요.`r`n  이미 남에게 보인 열쇠라면 **지우는 것으로는 안 되고 바꿔야** 합니다."
}

# 너무 큰 파일 — GitHub 는 100MB 를 아예 안 받습니다.
$너무큰것 = @()
foreach ($f in $올라갈것) {
  $온길 = Join-Path $뿌리 $f
  if (Test-Path -LiteralPath $온길) {
    # -Force 가 있어야 숨김 표시가 붙은 파일도 집힙니다.
    $것 = Get-Item -LiteralPath $온길 -Force -ErrorAction SilentlyContinue
    $크기 = if ($것) { $것.Length } else { 0 }
    if ($크기 -gt 95MB) { $너무큰것 += ("{0}  ({1:N0} MB)" -f $f, ($크기 / 1MB)) }
  }
}
if ($너무큰것.Count -gt 0) {
  깃 reset | Out-Null
  말 ""
  말 "  멈췄습니다 — GitHub 가 안 받는 큰 파일이 있습니다 (100MB 넘음)."
  말 ""
  foreach ($f in $너무큰것) { 말 "    $f" }
  말 ""
  말 "  .gitignore 에 그 파일을 막는 줄을 넣고 다시 눌러 주세요."
  말 ""
  exit 1
}

# ── 4. 무엇이 올라가는지 보여 주기 ─────────────────────────
if ($올라갈것.Count -eq 0) {
  말 "  고친 파일이 없습니다."
  말 "  아직 안 올라간 몫이 있는지만 보겠습니다."
  말 ""
} else {
  말 "  올라갈 파일 $($올라갈것.Count) 개"
  줄
  $보일것 = $올라갈것
  if ($보일것.Count -gt 25) { $보일것 = $보일것[0..24] }
  foreach ($f in $보일것) { 말 "    $f" }
  if ($올라갈것.Count -gt 25) { 말 "    … 그리고 $($올라갈것.Count - 25) 개 더" }
  줄
  말 ""

  $판 = ""
  $꾸러미 = Join-Path $뿌리 "package.json"
  if (Test-Path -LiteralPath $꾸러미) {
    $글2 = Get-Content -LiteralPath $꾸러미 -Raw -Encoding UTF8
    if ($글2 -match '"version"\s*:\s*"([^"]+)"') { $판 = $Matches[1] }
  }
  $기본말 = if ($판) { "v$판 손질" } else { "손질" }

  말 "  무엇을 고쳤는지 한 줄로 적어 주세요."
  말 "  (나중에 「어디서부터 틀어졌지」를 찾을 때 이 한 줄을 보게 됩니다)"
  $할말 = (Read-Host "  한 줄 설명 (그냥 엔터 = $기본말)").Trim()
  if (-not $할말) { $할말 = $기본말 }
  $할말 = $할말 -replace '"', "'"

  말 ""
  깃 commit -m $할말 | Out-Null
  if ($script:깃코드 -ne 0) {
    말 "  기록으로 묶지 못했습니다."
    말 (깃 status --short)
    말 ""
    exit 1
  }
  말 "  기록으로 묶었습니다 — $할말"
  말 ""
}

# ── 5. GitHub 로 보내기 ────────────────────────────────────
말 "  GitHub 로 보냅니다..."
말 "  (처음이면 로그인 창이 한 번 뜹니다. GitHub 계정으로 들어가시면 됩니다.)"
말 ""

$나온것 = 깃 push -u origin $가지
if ($script:깃코드 -ne 0) {
  # 흔한 까닭 하나 — GitHub 쪽에 이쪽에 없는 것이 있습니다. 받아서 얹고 다시.
  말 "  한 번에 안 갔습니다. GitHub 쪽 것을 받아 얹고 다시 해 보겠습니다."
  말 ""
  $받은말 = 깃 pull --rebase origin $가지
  if ($script:깃코드 -ne 0) {
    깃 rebase --abort 2>&1 | Out-Null
    말 "  ██ 보내지 못했습니다 ██"
    말 ""
    말 $받은말
    말 ""
    말 "  GitHub 쪽에서 고친 것과 이 폴더에서 고친 것이 **같은 줄에서**"
    말 "  부딪쳤습니다. 되돌려 놨으니 이 폴더는 그대로입니다."
    말 "  GitHub 화면에서 무엇을 고치셨는지 보시고 알려 주세요."
    말 ""
    exit 1
  }
  $나온것 = 깃 push -u origin $가지
}

if ($script:깃코드 -ne 0) {
  말 "  ██ 보내지 못했습니다 ██"
  말 ""
  말 $나온것
  말 ""
  말 "  자주 있는 까닭"
  말 "    · 로그인 창을 닫았다  → 다시 누르면 창이 또 뜹니다"
  말 "    · 주소가 틀렸다       → 지금 주소는  $원격"
  말 "    · 그 저장소가 없다    → GitHub 에서 저장소를 먼저 만드세요"
  말 ""
  exit 1
}

# ── 6. 다 됐습니다 ─────────────────────────────────────────
$몇개 = 깃 rev-list --count $가지
$보는곳 = $원격 -replace '\.git$', ''

말 "  다 됐습니다."
말 ""
말 "    올린 자리   $보는곳"
말 "    가지        $가지"
말 "    쌓인 기록   $몇개 개"
말 ""
말 "  ※ 이것으로 **기관에 새 버전이 가지는 않습니다.**"
말 "     기관이 받는 것은 Release 입니다 —「새 버전 내보내기」의 다음 단계로."
말 ""
exit 0
