# ─────────────────────────────────────────────────────────────
#  한글 문서(.hwp)를 .hwpx 로 바꿉니다 — 한글 프로그램을 시켜서.
# ─────────────────────────────────────────────────────────────
#
#  왜 필요한가
#  ───────────
#  편람은 .hwp(2진) 인데 우리 서식 엔진은 .hwpx(XML) 만 읽습니다.
#  서식은 **우리가 다시 그리면 안 됩니다.** 그래서 한글에게 시켜
#  원본 그대로 껍데기만 바꿉니다. 그 안에서 서식9 만 오려 씁니다.
#
#  쓰는 법
#  ───────
#    powershell -ExecutionPolicy Bypass -File 한글hwpx변환.ps1 -Source a.hwp -Target a.hwpx
#
#  ── 이 파일을 고치실 때 ──────────────────────────────────────
#  **변수 이름과 매개변수는 영문으로만 씁니다.** 한글로 쓰면
#  윈도우 PowerShell 5.1 이 이 파일을 CP949 로 잘못 읽어 통째로 깨집니다.
#  그리고 이 파일은 **UTF-8 BOM** 으로 저장해야 위 안내문이 안 깨집니다.
# ─────────────────────────────────────────────────────────────

param(
  [string]$Source = "",
  [string]$Target = ""
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
try { [System.Environment]::CurrentDirectory = (Get-Location).Path } catch { }

if ($Source -eq "" -or $Target -eq "") { throw "-Source 와 -Target 을 주세요" }

function Find-CheckerDll {
  $names = @("FilePathCheckerModuleExample.dll")
  $dirs  = @($PSScriptRoot, (Get-Location).Path,
             (Join-Path $PSScriptRoot "도구"),
             (Join-Path (Get-Location).Path "도구"))
  foreach ($d in $dirs) {
    if (-not $d) { continue }
    foreach ($n in $names) {
      $p = Join-Path $d $n
      if (Test-Path -LiteralPath $p) { return (Resolve-Path -LiteralPath $p).Path }
    }
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
  $said = $false
  try { $said = [bool]$hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModuleExample") } catch { }
  return ($said -or [bool]$dll)
}

$src = [System.IO.Path]::GetFullPath($Source)
$dst = [System.IO.Path]::GetFullPath($Target)
if (-not (Test-Path -LiteralPath $src)) { throw "원본이 없습니다: $src" }

$dir = Split-Path -Parent $dst
if ($dir -and -not (Test-Path -LiteralPath $dir)) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }

$hwp = New-Object -ComObject HWPFrame.HwpObject
try {
  Register-Security $hwp | Out-Null
  # 확장자를 안 주고 열면 한글이 알아서 가려 읽습니다. .hwp 도 이 길로 열립니다.
  if (-not $hwp.Open($src, "", "forceopen:true")) { throw "한글이 파일을 열지 못했습니다" }
  if (-not $hwp.SaveAs($dst, "HWPX", "")) { throw "hwpx 로 저장하지 못했습니다" }
  if (-not (Test-Path -LiteralPath $dst)) { throw "hwpx 가 만들어지지 않았습니다" }
  $size = (Get-Item -LiteralPath $dst).Length
  Write-Output "OK`t$dst`t$size bytes"
} finally {
  try { $hwp.Clear(1) | Out-Null } catch { }
  try { $hwp.Quit() } catch { }
  try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($hwp) | Out-Null } catch { }
}
