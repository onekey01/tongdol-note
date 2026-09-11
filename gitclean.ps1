<#
  통돌 Note — GitHub 저장소에서 잘못 올라간 것 지우기 (한 번만)

  「깃 청소.bat」이 이 파일을 부릅니다.

  ── 왜 있나 (2026-09-11) ───────────────────────────────────

  첫 올림에서 `_to_delete` 폴더가 통째로 올라갔습니다. 그 안의
  `_ship.tgz` · `_ship2.tgz` **묶음 안에 .env 가 들어 있었고**,
  그 저장소는 공개였습니다.

  이 파일이 하는 일 —
    ① .gitignore 에 묶음과 _to_delete 를 막는 줄이 있는지 보고
    ② 지금 폴더의 모습으로 **기록을 처음부터 다시 써서**
    ③ GitHub 을 그것으로 **덮어씁니다**

  그러면 저장소의 main 에는 그 묶음들이 **한 번도 없던 것처럼** 됩니다.

  ★ 그래도 열쇠는 바꾸셔야 합니다. 올라가 있던 동안 누가 받아 갔는지
    알 수 없고, GitHub 이 옛 덩어리를 얼마간 더 갖고 있을 수도 있습니다.
    **지우는 것은 마무리이고, 바꾸는 것이 해결입니다.**

  ── .bat 이 직접 git 을 안 부르는 까닭 ─────────────────────
  .bat 은 한 글자도 한글이면 안 됩니다. 그래서 한글이 드는 일은
  .ps1 이 하고, 이 파일 이름도 ASCII 로만 지었습니다.
#>
$ErrorActionPreference = "Stop"
try { chcp 65001 > $null 2>&1 } catch { }
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$뿌리 = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $뿌리

function 말 { param([string]$t = "") Write-Output $t }
function 줄 { 말 "  ────────────────────────────────────────────────────" }

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
말 "  통돌 Note — GitHub 저장소 청소 (한 번만)"
줄
말 ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  말 "  이 컴퓨터에 git 이 없습니다. 「깃 올리기.bat」을 먼저 한 번 눌러 주세요."
  말 ""
  exit 1
}
if (-not (Test-Path -LiteralPath (Join-Path $뿌리 ".git"))) {
  말 "  이 폴더는 아직 git 저장소가 아닙니다. 청소할 것이 없습니다."
  말 ""
  exit 0
}

$원격 = 깃 remote get-url origin
if ($script:깃코드 -ne 0 -or -not $원격) {
  말 "  올릴 자리(origin)가 없습니다. 「깃 올리기.bat」을 먼저 한 번 눌러 주세요."
  말 ""
  exit 1
}

$가지 = 깃 rev-parse --abbrev-ref HEAD
if ($script:깃코드 -ne 0 -or -not $가지 -or $가지 -eq "HEAD") { $가지 = "main" }

말 "  저장소   $($원격 -replace '\.git$','')"
말 "  가지     $가지"
말 ""

# ── 1. .gitignore 에 막는 줄이 있나 ────────────────────────
$무시길 = Join-Path $뿌리 ".gitignore"
$무시 = if (Test-Path -LiteralPath $무시길) { Get-Content -LiteralPath $무시길 -Raw } else { "" }
$넣을줄 = @()
foreach ($줄하나 in @("_to_delete/", "*.tgz", "*.tar", "*.tar.gz", "*.zip", "*.7z", "*.rar")) {
  if ($무시 -notmatch [regex]::Escape($줄하나)) { $넣을줄 += $줄하나 }
}
if ($넣을줄.Count -gt 0) {
  말 "  .gitignore 에 막는 줄을 넣습니다 —"
  foreach ($x in $넣을줄) { 말 "    $x" }
  $덧 = "`r`n# ── 묶음과 치울 것 (깃 청소.bat 이 넣었습니다) ──────────────`r`n" +
        ($넣을줄 -join "`r`n") + "`r`n"
  Add-Content -LiteralPath $무시길 -Value $덧 -Encoding UTF8
  말 ""
}

# ── 2. 이름과 메일이 제대로인지 ────────────────────────────
function 이름괜찮나 { param([string]$v)
  if ([string]::IsNullOrWhiteSpace($v)) { return $false }
  if ($v.Trim().Length -lt 2) { return $false }
  if ($v -match '^v?\d+(\.\d+)+$') { return $false }
  return $true
}
function 메일괜찮나 { param([string]$v)
  if ([string]::IsNullOrWhiteSpace($v)) { return $false }
  return ($v -match '^[^@\s]+@[^@\s]+\.[^@\s]+$')
}
$쓴이 = 깃 config user.name
$메일 = 깃 config user.email
if (-not (이름괜찮나 $쓴이) -or -not (메일괜찮나 $메일)) {
  말 "  지금 기록에 남는 이름·메일이 이렇습니다 —"
  말 "    이름  $쓴이"
  말 "    메일  $메일"
  말 "  다시 적어 주세요. (이름은 GitHub 계정 이름, 메일은 @ 가 든 주소)"
  말 ""
  while (-not (이름괜찮나 $쓴이)) { $쓴이 = (Read-Host "  이름").Trim() }
  while (-not (메일괜찮나 $메일)) { $메일 = (Read-Host "  메일").Trim() }
  깃 config user.name $쓴이 | Out-Null
  깃 config user.email $메일 | Out-Null
  말 ""
}

# ── 3. 무엇이 남을지 먼저 보여 줍니다 ──────────────────────
말 "  이제 할 일"
줄
말 "    · 지금 이 폴더의 모습으로 **기록을 처음부터 다시 씁니다**"
말 "    · GitHub 의 $가지 를 그것으로 **덮어씁니다**"
말 "    · 지난 기록은 없어집니다 (묶음이 올라갔던 기록도 같이)"
줄
말 ""
말 "  ★ 이 폴더의 파일은 하나도 안 지웁니다. GitHub 쪽 기록만 다시 씁니다."
말 ""
$답 = (Read-Host "  진행할까요? 하시려면 «네» 라고 치세요").Trim()
if ($답 -ne "네") {
  말 ""
  말 "  그만뒀습니다. 아무것도 바꾸지 않았습니다."
  말 ""
  exit 0
}
말 ""

# ── 4. 새 기록 하나로 다시 쓰기 ────────────────────────────
말 "  기록을 다시 씁니다..."
깃 checkout --orphan __clean | Out-Null
if ($script:깃코드 -ne 0) {
  말 "  새 가지를 만들지 못했습니다."
  말 (깃 status --short)
  말 ""
  exit 1
}
깃 reset | Out-Null
깃 add -A | Out-Null

$올라갈것 = @()
$나온말 = 깃 diff --cached --name-only
if (-not $나온말) { $나온말 = 깃 ls-files --cached }
if ($나온말) { $올라갈것 = @($나온말 -split "`r?`n" | Where-Object { $_.Trim() }) }

# ── 5. 다시 쓰기 전에 한 번 더 훑습니다 ────────────────────
$나쁜이름 = @($올라갈것 | Where-Object {
  ($_ -match '(^|/)\.env($|\.)' -or $_ -match '\.env$' -or $_ -match '\.pem$' -or
   $_ -match '\.(tgz|tar|tar\.gz|zip|7z|rar)$') -and ($_ -notmatch '\.env\.보기$')
})
if ($나쁜이름.Count -gt 0) {
  말 ""
  말 "  ████ 멈췄습니다 — 아직도 올라갈 것이 남아 있습니다 ████"
  말 ""
  foreach ($x in $나쁜이름) { 말 "    $x" }
  말 ""
  말 "  .gitignore 를 더 손보고 다시 눌러 주세요."
  깃 checkout $가지 | Out-Null
  깃 branch -D __clean | Out-Null
  말 ""
  exit 1
}

깃 commit -m "소스 (2026-09-11 기록 다시 씀 — 잘못 올라간 묶음 제거)" | Out-Null
if ($script:깃코드 -ne 0) {
  말 "  기록으로 묶지 못했습니다."
  말 (깃 status --short)
  말 ""
  exit 1
}
깃 branch -M $가지 | Out-Null

말 "  올라갈 파일 $($올라갈것.Count) 개 · 기록 1 개로 다시 썼습니다."
말 ""

# ── 6. GitHub 덮어쓰기 ─────────────────────────────────────
말 "  GitHub 을 덮어씁니다..."
$나온것 = 깃 push --force -u origin $가지
if ($script:깃코드 -ne 0) {
  말 ""
  말 "  ██ 덮어쓰지 못했습니다 ██"
  말 ""
  말 $나온것
  말 ""
  말 "  저장소 설정에서 main 이 잠겨 있을 수 있습니다"
  말 "  (Settings → Branches → 보호 규칙). 잠깐 풀고 다시 눌러 주세요."
  말 ""
  exit 1
}

# ── 7. 이 PC 에 남은 옛 덩어리도 치웁니다 ──────────────────
깃 reflog expire --expire=now --all | Out-Null
깃 gc --prune=now --quiet | Out-Null

$보는곳 = $원격 -replace '\.git$', ''
말 ""
말 "  다 됐습니다."
말 ""
말 "    저장소     $보는곳"
말 "    남은 기록  1 개"
말 ""
말 "  ★ 그래도 열쇠는 꼭 바꾸십시오."
말 "     올라가 있던 동안 누가 받아 갔는지는 알 수 없습니다."
말 "     지우는 것은 마무리이고, **바꾸는 것이 해결**입니다."
말 ""
exit 0
