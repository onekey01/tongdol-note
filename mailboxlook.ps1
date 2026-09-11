# 우편함 들여다보기 — 폰에 안 뜰 때 어디가 막혔는지 봅니다.
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

<#
  날짜를 하나 받을 수 있습니다. 그냥 엔터면 오늘.
  어제 것이 어떻게 올라갔는지 볼 때 씁니다.
#>
$날 = Read-Host "  날짜 (YYYY-MM-DD, 그냥 엔터면 오늘)"
if ($날) { & $bun "도구/우편함살펴보기.ts" $날 } else { & $bun "도구/우편함살펴보기.ts" }

Read-Host "`n  엔터를 누르면 닫힙니다"
