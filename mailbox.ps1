# 기관 세우기 + 우편함 왕복 시험
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

Write-Host ""
Write-Host "  통돌 Note — 우편함 왕복 시험" -ForegroundColor Cyan
Write-Host "  ================================================"

# bun 찾기
$bun = "bun"
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  $c = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
  if (Test-Path $c) { $bun = $c } else {
    Write-Host "  bun 을 못 찾았습니다." -ForegroundColor Red
    Read-Host "`n  엔터"; exit 1
  }
}

# .env 에 기관이 들어 있나
$env문 = Get-Content (Join-Path $here ".env") -Encoding UTF8 -ErrorAction SilentlyContinue
$기관있나 = ($env문 | Where-Object { $_ -match '^TONGDOL_ORG_KEY=.+' }).Count -gt 0

if (-not $기관있나) {
  Write-Host ""
  Write-Host "  아직 기관이 없습니다. 먼저 하나 세웁니다." -ForegroundColor Yellow
  $이름 = Read-Host "  기관 이름 (그냥 엔터면 '시험기관')"
  if (-not $이름) { $이름 = "시험기관" }
  Write-Host ""
  & $bun "도구/기관만들기.ts" $이름
  if ($LASTEXITCODE -ne 0) {
    Write-Host "`n  기관 세우기 실패." -ForegroundColor Red
    Read-Host "`n  엔터"; exit 1
  }
} else {
  Write-Host "`n  기관이 이미 .env 에 있습니다 — 그대로 씁니다." -ForegroundColor Gray
}

Write-Host ""
& $bun "도구/왕복시험.ts"
$ok = ($LASTEXITCODE -eq 0)

Write-Host ""
Write-Host "  ================================================"
if ($ok) { Write-Host "  왕복 통과 — 우편함으로 자료가 오갑니다." -ForegroundColor Green }
else     { Write-Host "  실패 — 이 화면을 보내 주세요." -ForegroundColor Red }
Read-Host "`n  엔터를 누르면 닫힙니다"
