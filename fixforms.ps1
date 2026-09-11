# ─────────────────────────────────────────────────────────────
#  서식을 **한글에게 다시 저장시킵니다** — 그리고 열리는지 알려 줍니다.
# ─────────────────────────────────────────────────────────────
#
#  왜 이것이 필요한가 (2026-09-01)
#  ───────────────────────────────
#  편람에서 서식을 오려 낼 때 우리는 zip 안의 XML 을 손으로 고쳤습니다.
#  그런데 hwpx 는 꾸러미 곳곳에 「이 문서는 이러이러하다」를 적어 둡니다 —
#  구역이 몇인지(secCnt), 부품이 무엇인지(container.rdf·content.hpf),
#  커서가 어디 있었는지(settings.xml)… 하나라도 어긋나면 한글은
#  **「알 수 없는 오류입니다」** 한 줄만 내놓고 아무것도 안 알려 줍니다.
#
#  세 군데를 찾아 고쳤는데도 안 열렸습니다. 넷째가 어디인지 찾기보다
#  **한글에게 시키는 편이 옳습니다.** 한글이 저장한 파일은 한글이 엽니다.
#
#  하는 일
#  ───────
#    1. 서식 폴더의 hwpx 를 하나씩 한글로 엽니다 (forceopen)
#    2. 열렸으면 **한글에게 다시 저장시킵니다** — 꾸러미가 한글 것이 됩니다
#    3. 원본은 「서식\오리기전」에 옮겨 두고, 새것으로 갈아 끼웁니다
#    4. **어느 것이 열리고 어느 것이 안 열리는지 표로 알려 줍니다**
#
#  -DiagnoseOnly 를 주면 **열리는지만 보고** 아무것도 안 고칩니다.
#
#  ── 이 파일을 고치실 때 ──────────────────────────────────────
#  변수 이름과 매개변수는 **영문으로만** 씁니다. 한글로 쓰면 윈도우
#  PowerShell 5.1 이 CP949 로 잘못 읽어 통째로 깨집니다.
#  저장은 **UTF-8 BOM** 으로 해야 위 안내문이 안 깨집니다.
# ─────────────────────────────────────────────────────────────

param(
  [string]$Folder = "",
  [switch]$DiagnoseOnly
)

$ErrorActionPreference = "Continue"
try { & chcp.com 65001 | Out-Null } catch { }
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$root = $PSScriptRoot
if ($Folder -eq "") { $Folder = Join-Path $root "서식" }
if (-not (Test-Path -LiteralPath $Folder)) { Write-Output "서식 폴더가 없습니다: $Folder"; exit 1 }

function Find-CheckerDll {
  $dirs = @($root, (Join-Path $root "도구"), (Get-Location).Path)
  foreach ($d in $dirs) {
    if (-not $d) { continue }
    $p = Join-Path $d "FilePathCheckerModuleExample.dll"
    if (Test-Path -LiteralPath $p) { return (Resolve-Path -LiteralPath $p).Path }
  }
  return $null
}

function Register-Security($hwp) {
  $dll = Find-CheckerDll
  if ($dll) {
    try { Unblock-File -LiteralPath $dll -ErrorAction SilentlyContinue } catch { }
    foreach ($key in @("HKCU:\Software\HNC\HwpAutomation\Modules",
                       "HKCU:\Software\HNC\HwpCtrl\Modules")) {
      try {
        if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
        New-ItemProperty -Path $key -Name "FilePathCheckerModuleExample" -Value $dll `
                         -PropertyType String -Force | Out-Null
      } catch { }
    }
  }
  try { $hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModuleExample") | Out-Null } catch { }
}

$files = Get-ChildItem -LiteralPath $Folder -Filter *.hwpx | Sort-Object Name
Write-Output ""
Write-Output "  $Folder"
Write-Output "  서식 $($files.Count)장"
Write-Output ""

$keep = Join-Path $Folder "오리기전"
if (-not $DiagnoseOnly -and -not (Test-Path -LiteralPath $keep)) {
  New-Item -ItemType Directory -Force -Path $keep | Out-Null
}

$hwp = New-Object -ComObject HWPFrame.HwpObject
Register-Security $hwp

$opened = 0; $failed = 0; $fixed = 0
$badNames = @()

foreach ($f in $files) {
  $src = $f.FullName
  $ok = $false
  $err = ""
  try { $ok = [bool]$hwp.Open($src, "HWPX", "forceopen:true") }
  catch { $ok = $false; $err = $_.Exception.Message }

  if (-not $ok) {
    $failed++
    $badNames += $f.Name
    Write-Output ("  X  못 엶   " + $f.Name + $(if ($err) { "   ($err)" } else { "" }))
    try { $hwp.Clear(1) | Out-Null } catch { }
    continue
  }

  $opened++
  if ($DiagnoseOnly) {
    Write-Output ("  O  열림    " + $f.Name)
    try { $hwp.Clear(1) | Out-Null } catch { }
    continue
  }

  $tmp = Join-Path $env:TEMP ("hwpxfix_" + [guid]::NewGuid().ToString("N") + ".hwpx")
  $saved = $false
  try { $saved = [bool]$hwp.SaveAs($tmp, "HWPX", "") } catch { $saved = $false }
  try { $hwp.Clear(1) | Out-Null } catch { }

  if ($saved -and (Test-Path -LiteralPath $tmp)) {
    Copy-Item -LiteralPath $src -Destination (Join-Path $keep $f.Name) -Force
    Move-Item -LiteralPath $tmp -Destination $src -Force
    $fixed++
    Write-Output ("  O  다시 저장  " + $f.Name + "   (" + (Get-Item -LiteralPath $src).Length + " bytes)")
  } else {
    Write-Output ("  !  열렸으나 저장 실패  " + $f.Name)
  }
}

try { $hwp.Quit() } catch { }
try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($hwp) | Out-Null } catch { }

Write-Output ""
Write-Output "  ────────────────────────────────────────"
Write-Output ("  한글이 연 것 " + $opened + "장 · 못 연 것 " + $failed + "장")
if (-not $DiagnoseOnly) { Write-Output ("  한글이 다시 저장한 것 " + $fixed + "장  (원본은 서식\오리기전\ 에 두었습니다)") }
if ($failed -gt 0) {
  Write-Output ""
  Write-Output "  못 연 서식:"
  foreach ($n in $badNames) { Write-Output ("    - " + $n) }
  Write-Output ""
  Write-Output "  이 목록을 그대로 알려 주세요. 원인을 좁히는 데 쓰겠습니다."
}
Write-Output ""
