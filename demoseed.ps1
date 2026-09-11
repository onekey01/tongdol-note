# 시범자료 넣기 — 화면을 눌러 볼 수 있게 자료를 채웁니다.
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
Write-Host "  통돌 Note — 시범자료 넣기" -ForegroundColor Cyan
Write-Host "  ================================================"

& $bun "도구/시범자료.ts"
if ($LASTEXITCODE -ne 0) { Read-Host "`n  엔터"; exit 1 }

Write-Host ""
Write-Host "  통돌 Note 를 켜고 화면을 하나씩 눌러 보세요."
Write-Host "  종사자 비밀번호는 모두  care1234  입니다."
Write-Host "  "
Write-Host "  지울 때는 「시범자료 지우기.bat」 을 누르시면 됩니다."
Read-Host "`n  엔터"
