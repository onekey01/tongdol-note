# ─────────────────────────────────────────────────────────────
#  통돌 Note 실행 — 눈으로 보면서 시연할 때 씁니다.
#
#  하는 일
#    1. 자료함을 한 부 복사해 둡니다 (하루 한 번)
#    2. 준비물이 없으면 받아 옵니다 (bun install)
#    3. 화면을 새로 짓습니다 (고친 것이 있을 때만)
#    4. 프로그램을 켜고 브라우저를 열어 줍니다
#
#  끄실 때는 이 검은 창에서 Ctrl+C 를 누르거나 창을 닫으시면 됩니다.
#
#  ── 이 파일을 고치실 때 ──────────────────────────────────
#  변수 이름은 **영문으로만** 씁니다. 한글로 쓰면 윈도우 PowerShell 5.1 이
#  이 파일을 CP949 로 잘못 읽어 통째로 깨집니다.
#  저장은 **UTF-8 BOM** 으로 해야 아래 한글 안내문이 안 깨집니다.
# ─────────────────────────────────────────────────────────────

# 검은 창의 글자가 깨지지 않게 합니다.
# 창의 코드페이지(65001)와 내보내는 글자(UTF-8)를 **둘 다** 맞춰야 합니다.
# 하나만 맞추면 이쪽이 멀쩡할 때 저쪽이 깨집니다.
try { & chcp.com 65001 | Out-Null } catch { }
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location -LiteralPath $root
try { [System.Environment]::CurrentDirectory = $root } catch { }

Write-Output ""
Write-Output "  통돌 Note"
Write-Output "  ─────────────────────────────────────────"
Write-Output "  폴더  $root"
Write-Output ""

# ── 1. bun 이 있는가 ─────────────────────────────────────────
$bun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bun) {
  Write-Output "  [멈춤] bun 을 찾지 못했습니다."
  Write-Output ""
  Write-Output "  PowerShell 을 열고 아래 한 줄을 붙여 넣어 설치하신 뒤,"
  Write-Output "  창을 닫았다 새로 열고 이 파일을 다시 실행해 주세요."
  Write-Output ""
  Write-Output "      powershell -c ""irm bun.sh/install.ps1 | iex"""
  Write-Output ""
  Read-Host "  엔터를 누르면 닫힙니다"
  exit 1
}
Write-Output ("  bun   " + (& bun --version))

# ── 2. 자료함 복사해 두기 ────────────────────────────────────
# 자료 구조가 바뀌는 날이 있습니다. 되돌릴 일은 거의 없지만,
# 되돌릴 수 없는 것과 되돌릴 수 있는 것은 마음가짐이 다릅니다.
$dbPath = Join-Path $root "data\tongdol.db"
if (Test-Path -LiteralPath $dbPath) {
  $bakDir = Join-Path $root "data\보관"
  if (-not (Test-Path -LiteralPath $bakDir)) { New-Item -ItemType Directory -Path $bakDir | Out-Null }
  $stamp = Get-Date -Format "yyyyMMdd"
  $bak = Join-Path $bakDir ("tongdol-" + $stamp + ".db")
  if (-not (Test-Path -LiteralPath $bak)) {
    Copy-Item -LiteralPath $dbPath -Destination $bak -Force
    Write-Output ("  복사  data\보관\tongdol-" + $stamp + ".db")
  }
  # 최근 다섯 부만 남깁니다. 쌓이기만 하면 그것대로 짐입니다.
  Get-ChildItem -LiteralPath $bakDir -Filter "tongdol-*.db" |
    Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
}

# ── 3. 준비물 ────────────────────────────────────────────────
if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules"))) {
  Write-Output "  준비물을 받아 옵니다 (처음 한 번, 1~2분)…"
  & bun install
  if ($LASTEXITCODE -ne 0) { Read-Host "  준비물 받기에 실패했습니다. 엔터"; exit 1 }
}

# ── 4. 화면 짓기 ─────────────────────────────────────────────
# 화면 파일을 고친 뒤 안 지으면 **옛 화면이 그대로 뜹니다.**
# 「분명히 고쳤는데 안 바뀐다」의 십중팔구가 이것입니다.
$dist = Join-Path $root "dist-web"
$indexHtml = Join-Path $dist "index.html"
$needBuild = -not (Test-Path -LiteralPath $indexHtml)
if (-not $needBuild) {
  $built = (Get-Item -LiteralPath $indexHtml).LastWriteTime
  $newest = Get-ChildItem -LiteralPath (Join-Path $root "web") -Recurse -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($newest -and $newest.LastWriteTime -gt $built) { $needBuild = $true }
}
if ($needBuild) {
  Write-Output "  화면을 새로 짓습니다…"
  & bunx vite build
  if ($LASTEXITCODE -ne 0) { Read-Host "  화면 짓기에 실패했습니다. 엔터"; exit 1 }
} else {
  Write-Output "  화면  이미 최신입니다"
}

# ── 5. 브라우저는 프로그램이 엽니다 ─────────────────────────
# 예전에는 여기서도 열었습니다. 그래서 **창이 두 개** 떴습니다.
#
# 여는 일은 프로그램에게 맡깁니다. 이유가 두 가지입니다.
#   1) 프로그램은 자기가 실제로 잡은 번호를 압니다. 여기서 5757 부터
#      찔러 보면, 옛 프로그램이 5757 에 남아 있고 새것이 5758 로 갔을 때
#      엉뚱한 쪽을 엽니다.
#   2) 나중에 하나짜리 실행파일로 묶으면 이 파일이 없습니다.
#      그때도 브라우저는 열려야 합니다.
#
# (열지 말라고 하려면 TONGDOL_NO_OPEN=1 을 넣고 켜면 됩니다.)

Write-Output ""
Write-Output "  프로그램을 켭니다. 브라우저가 저절로 열립니다."
Write-Output "  끄실 때는 이 창에서 Ctrl+C 를 누르거나 창을 닫으세요."
Write-Output "  ─────────────────────────────────────────"
Write-Output ""

& bun server/index.ts
