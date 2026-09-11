# 준비물 받기 + 타입 검사 + 화면 짓기 — 고친 뒤 한 번 돌립니다.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try { & chcp.com 65001 | Out-Null } catch { }
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

Write-Host ""
Write-Host "  통돌 Note — 준비물 받고 검사하기" -ForegroundColor Cyan
Write-Host "  ================================================"

$bun = "bun"
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  $c = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
  if (Test-Path $c) { $bun = $c } else {
    Write-Host "  bun 을 못 찾았습니다." -ForegroundColor Red
    Read-Host "`n  엔터"; exit 1
  }
}

Write-Host ""
Write-Host "  1. 준비물 받기 (qrcode 가 새로 듭니다)" -ForegroundColor White
& $bun install
if ($LASTEXITCODE -ne 0) { Read-Host "`n  실패. 엔터"; exit 1 }

Write-Host ""
Write-Host "  2. 타입 검사" -ForegroundColor White
& $bun x tsc --noEmit -p tsconfig.json
if ($LASTEXITCODE -ne 0) {
  Write-Host "`n  타입 검사에서 걸렸습니다 — 위 내용을 보내 주세요." -ForegroundColor Red
  Read-Host "`n  엔터"; exit 1
}
Write-Host "  통과  걸린 것 없음" -ForegroundColor Green

Write-Host ""
Write-Host "  3. 자물쇠 시험" -ForegroundColor White
& $bun "우편함시험.ts"
if ($LASTEXITCODE -ne 0) { Read-Host "`n  실패. 엔터"; exit 1 }

Write-Host ""
Write-Host "  4. 화면 짓기" -ForegroundColor White
& $bun x vite build
if ($LASTEXITCODE -ne 0) {
  Write-Host "`n  화면 짓기에서 걸렸습니다." -ForegroundColor Red
  Read-Host "`n  엔터"; exit 1
}

Write-Host ""
Write-Host "  ================================================"
Write-Host "  다 됐습니다. 이제 run.ps1 로 켜시면 됩니다." -ForegroundColor Green
Read-Host "`n  엔터를 누르면 닫힙니다"
