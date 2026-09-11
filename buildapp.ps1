# 현장앱 짓기 — 올릴 폴더를 만듭니다.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try { & chcp.com 65001 | Out-Null } catch { }
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$bun = "bun"
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  $c = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
  if (Test-Path $c) { $bun = $c } else {
    Write-Host "  bun 을 못 찾았습니다." -ForegroundColor Red; Read-Host "`n  엔터"; exit 1 }
}

Write-Host ""
Write-Host "  통돌 Note — 현장앱 짓기" -ForegroundColor Cyan
Write-Host "  ================================================"

<#
  ── 준비물부터 봅니다 ────────────────────────────────────────
  현장앱에 **QR 읽는 눈**(jsQR)이 들어갑니다. 이것은 지을 때마다
  새로 묶는 것이라, 없으면 짓기가 통째로 실패합니다.
  「bun install 을 먼저 하세요」라고 적어 두는 것으로는 안 됩니다 —
  사람은 안 합니다. 없으면 **여기서 알아서** 받습니다.
#>
if (-not (Test-Path (Join-Path $here "node_modules\jsqr"))) {
  Write-Host ""
  Write-Host "  준비물이 하나 빠졌습니다 (QR 읽개). 받아 옵니다…" -ForegroundColor Yellow
  & $bun install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  준비물 받기에 실패했습니다." -ForegroundColor Red
    Read-Host "`n  엔터"; exit 1
  }
  Write-Host "  받았습니다." -ForegroundColor Green
}

& $bun "도구/현장앱짓기.ts"
if ($LASTEXITCODE -ne 0) { Read-Host "`n  엔터"; exit 1 }

<#
  브라우저에 띄워서 하는 시험은 **개발 쪽에서** 돕니다.
  Playwright 와 크롬을 합쳐 150MB 를 이 PC 에 얹을 이유가 없습니다.
  여기 있으면 돌리고, 없으면 건너뜁니다.
#>
$ok = $true
if (Test-Path (Join-Path $here "node_modules\playwright")) {
  Write-Host ""
  Write-Host "  브라우저에 띄워 확인합니다 (30초쯤)" -ForegroundColor White
  & $bun "도구/현장앱시험.ts"
  $ok = ($LASTEXITCODE -eq 0)
  if ($ok) {
    # 방문 찍기·확인사항·서명까지 — 가짜 카메라에 진짜 방문표 영상을 물립니다
    & $bun "도구/찍기시험.ts"
    $ok = ($LASTEXITCODE -eq 0)
  }
} else {
  Write-Host ""
  Write-Host "  브라우저 시험은 건너뜁니다 (이 PC 에는 Playwright 가 없습니다)." -ForegroundColor DarkGray
  Write-Host "  위의 여섯 가지는 방금 확인했습니다 — 올리셔도 됩니다." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  ================================================"
if ($ok) {
  $folder = Join-Path $here "현장앱\올릴것"
  Write-Host "  다 됐습니다." -ForegroundColor Green
  Write-Host ""
  Write-Host "  올릴 폴더를 열어 드립니다:"
  Write-Host "      $folder" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  다음에 하실 일" -ForegroundColor White
  Write-Host "    1. https://app.netlify.com 에서 tongdol-local 을 엽니다"
  Write-Host "    2. Deploys 로 갑니다"
  Write-Host "    3. 방금 열린 「올릴것」 폴더를 그 화면에 끌어다 놓습니다"
  Write-Host "    4. 1분쯤 뒤 https://app.tongdol.kr 을 폰에서 열어 봅니다"
  Write-Host ""
  Write-Host "    폰은 다시 등록 안 하셔도 됩니다 (주소가 그대로입니다)." -ForegroundColor DarkGray
  Start-Process explorer.exe $folder
} else {
  Write-Host "  시험에서 걸렸습니다 — 위 내용을 보내 주세요." -ForegroundColor Red
}
Read-Host "`n  엔터를 누르면 닫힙니다"
