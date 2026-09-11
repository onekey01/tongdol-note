# 시범자료 지우기 — 표가 달린 것만 지웁니다.
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
Write-Host "  통돌 Note — 시범자료 지우기" -ForegroundColor Cyan
Write-Host "  ================================================"

& $bun "도구/시범자료.ts" "지우기"
if ($LASTEXITCODE -ne 0) { Read-Host "`n  엔터"; exit 1 }

Write-Host ""
Write-Host "  시범으로 넣은 것만 지웠습니다."
Write-Host "  손으로 넣으신 자료는 그대로 있습니다."
Read-Host "`n  엔터"
