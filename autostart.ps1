# ─────────────────────────────────────────────────────────────
#  통돌 Note — 「PC 를 켜면 저절로 켜지게」
#
#  통돌 Note 설정 화면이 이 파일을 부릅니다. 손으로 실행하실 일은
#  없습니다. 하는 일은 하나 —
#
#      윈도우 시작프로그램 폴더에
#      「통돌 Note.lnk」 바로가기를 넣거나 뺍니다.
#
#  ── 왜 바로가기(.lnk)인가 ──────────────────────────────────
#  레지스트리를 만지지 않습니다. 시작프로그램 폴더는 사람이 열어서
#  **눈으로 보고 손으로 지울 수 있는** 자리입니다. 나중에 다른 사람이
#  「이게 왜 켜지지」 할 때 찾아낼 수 있어야 합니다.
#
#  ── 왜 경로를 안 받나 ──────────────────────────────────────
#  기관 폴더 이름에 한글이 섞이면 명령줄로 넘기는 사이에 깨집니다.
#  그래서 이 파일이 **자기가 있는 자리**를 스스로 봅니다.
#
#  ── 이 파일을 고치실 때 ────────────────────────────────────
#  변수 이름은 영문으로만. 저장은 UTF-8 BOM 으로.
# ─────────────────────────────────────────────────────────────
param(
  [switch]$On,
  [switch]$Off
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$root    = $PSScriptRoot
$target  = Join-Path $root "통돌Note 시작.bat"
$startup = [Environment]::GetFolderPath("Startup")
$link    = Join-Path $startup "통돌 Note.lnk"

if ($Off) {
  if (Test-Path -LiteralPath $link) { Remove-Item -LiteralPath $link -Force }
  Write-Output "off"
  exit 0
}

if (-not $On) {
  Write-Error "쓰는 법: autostart.ps1 -On  또는  -Off"
  exit 1
}

if (-not (Test-Path -LiteralPath $target)) {
  Write-Error "「통돌Note 시작.bat」을 못 찾았습니다."
  exit 1
}

# 바로가기를 만듭니다. 이미 있으면 덮어씁니다.
$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($link)
$sc.TargetPath       = $target
$sc.WorkingDirectory = $root
$sc.Description      = "통돌 Note - 사무실 PC 프로그램"
$sc.WindowStyle      = 7          # 작게 시작합니다 (검은 창이 튀어나오지 않게)
$sc.Save()

Write-Output "on"
exit 0
