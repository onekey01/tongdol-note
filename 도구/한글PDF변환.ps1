# ─────────────────────────────────────────────────────────────
#  한글 문서(.hwpx)를 PDF 로 바꿉니다 — 한글 프로그램을 시켜서.
# ─────────────────────────────────────────────────────────────
#
#  왜 이렇게 하나
#  ──────────────
#  지자체에 내는 서류는 **서식이 완전히 같아야 하고 확장자만 달라야** 합니다.
#  PDF 를 우리가 다시 그리면 글꼴·선 굵기·여백이 전부 우리가 정한 값이 되어
#  아무리 비슷해도 같은 서식이 아닙니다. 그래서 **한글에게 시킵니다.**
#
#  ── 「PDF 로 저장」을 쓰지 않는 이유 ─────────────────────────
#  한글 2022 의 「PDF 로 저장」은 **한 줄에 칸이 7개 이상이면 마지막 칸을
#  통째로 빠뜨립니다.** 기록지 서식의 「직접 서비스 제공일」 칸이 그래서
#  사라졌습니다. 우리가 만든 파일만 그런 것이 아니라 **아무것도 안 채운
#  원본 서식, 한컴이 배포한 작성예시도 똑같이** 사라집니다. 한글의 화면과
#  미리보기는 멀쩡하니 내보내기 쪽 문제입니다.
#
#  그래서 **「인쇄」 길로 갑니다.** 윈도우에 기본으로 있는
#  「Microsoft Print to PDF」 로 인쇄하면 화면에 보이는 그대로 나옵니다.
#  종이에 인쇄하는 것과 같은 길이라, 사람이 하던 일을 그대로 대신합니다.
#
#  쓰는 법
#  ───────
#    powershell -ExecutionPolicy Bypass -File 한글PDF변환.ps1 -Source a.hwpx -Target a.pdf
#    powershell -ExecutionPolicy Bypass -File 한글PDF변환.ps1 -ListFile 목록.txt
#
#  목록 파일은 한 줄에 하나씩 「보낼파일.hwpx<탭>나올파일.pdf」 로 적습니다.
#  -UseSaveAs 를 주면 옛 방식(PDF 로 저장)으로 돌아갑니다. 칸이 빠지니 권하지 않습니다.
#
#  ── 이 파일을 고치실 때 ──────────────────────────────────────
#  **변수 이름과 매개변수는 영문으로만 씁니다.** 한글로 쓰면
#  윈도우 PowerShell 5.1 이 이 파일을 CP949 로 잘못 읽어 통째로 깨집니다.
#  그리고 이 파일은 **UTF-8 BOM** 으로 저장해야 위 안내문이 안 깨집니다.
# ─────────────────────────────────────────────────────────────

param(
  [string]$Source   = "",
  [string]$Target   = "",
  [string]$ListFile = "",
  [string]$Printer  = "Microsoft Print to PDF",
  [switch]$UseSaveAs
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

# PowerShell 의 현재 폴더와 .NET 의 현재 폴더는 서로 다릅니다.
# 이것을 맞춰 두지 않으면 목록 파일의 상대경로가 엉뚱한 곳을 가리킵니다.
try { [System.Environment]::CurrentDirectory = (Get-Location).Path } catch { }

function Get-Jobs {
  if ($ListFile -ne "") {
    if (-not (Test-Path -LiteralPath $ListFile)) { throw "목록 파일이 없습니다: $ListFile" }
    Get-Content -LiteralPath $ListFile -Encoding UTF8 | ForEach-Object {
      $line = $_.Trim()
      if ($line -eq "") { return }
      $parts = $line -split "`t"
      if ($parts.Count -lt 2) { throw "목록 줄이 이상합니다(탭으로 나눠야 합니다): $line" }
      [pscustomobject]@{ Src = $parts[0]; Dst = $parts[1] }
    }
  } elseif ($Source -ne "" -and $Target -ne "") {
    [pscustomobject]@{ Src = $Source; Dst = $Target }
  } else {
    throw "-ListFile 또는 (-Source -Target) 을 주세요."
  }
}

# ── 보안 모듈 ────────────────────────────────────────────────
# 이것이 등록돼 있지 않으면 한글이 「다른 프로그램이 파일에 접근하려 합니다」를
# 파일마다 묻습니다. 쓰는 분에게는 겁나는 경고창이고, 40명이면 몇십 번 눌러야 합니다.
# 한컴이 주는 보안 모듈(FilePathCheckerModuleExample.dll)을 이 스크립트 옆에
# 두면 조용해집니다.
function Find-CheckerDll {
  $names = @("FilePathCheckerModuleExample.dll", "FilePathChecker.dll")
  $roots = @($PSScriptRoot)
  foreach ($pf in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
    if (-not $pf) { continue }
    $hnc = Join-Path $pf "Hnc"
    if (Test-Path -LiteralPath $hnc) {
      Get-ChildItem -LiteralPath $hnc -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $roots += (Join-Path $_.FullName "HOffice120\Bin")
        $roots += $_.FullName
      }
    }
  }
  foreach ($r in $roots) {
    if (-not $r -or -not (Test-Path -LiteralPath $r)) { continue }
    foreach ($n in $names) {
      $hit = Join-Path $r $n
      if (Test-Path -LiteralPath $hit) { return $hit }
    }
  }
  return $null
}

function Register-Security($hwp) {
  # 한컴 안내(보안모듈 zip 안 「레지스트리.JPG」)대로 등록합니다:
  #   HKEY_CURRENT_USER\Software\HNC\HwpAutomation\Modules 에
  #   **값 이름**을 모듈 이름으로, **값**을 DLL 의 전체 경로로 적고,
  #   RegisterModule 의 두 번째 인자에 **같은 값 이름**을 줍니다.
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
  # 주의: 한글 2022 는 **제대로 얹혔는데도 False 를 돌려주는 일이 있습니다**
  #       (한컴 개발자 포럼에 보고된 문제). 그래서 반환값만으로 판단하지 않고
  #       DLL 이 자리에 있는지도 함께 봅니다.
  $said = $false
  try { $said = [bool]$hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModuleExample") } catch { }
  return ($said -or [bool]$dll)
}

function Wait-ForFile($path, $seconds) {
  # 인쇄는 스풀러를 거쳐 나중에 끝납니다. 파일이 생기고 **크기가 멎을 때까지** 기다립니다.
  $limit = (Get-Date).AddSeconds($seconds)
  $last  = -1
  $still = 0
  while ((Get-Date) -lt $limit) {
    if (Test-Path -LiteralPath $path) {
      $now = (Get-Item -LiteralPath $path).Length
      if ($now -gt 0 -and $now -eq $last) {
        $still = $still + 1
        if ($still -ge 3) { return $true }
      } else {
        $still = 0
      }
      $last = $now
    }
    Start-Sleep -Milliseconds 300
  }
  return (Test-Path -LiteralPath $path)
}

# 쓰는 법이 틀렸을 때 시커먼 오류 더미 대신 한 줄로 알려 줍니다.
try {
  $jobs = @(Get-Jobs)
} catch {
  Write-Output "ERROR`t$($_.Exception.Message)"
  Write-Output "쓰는 법:"
  Write-Output "  powershell -ExecutionPolicy Bypass -File 한글PDF변환.ps1 -Source a.hwpx -Target a.pdf"
  Write-Output "  powershell -ExecutionPolicy Bypass -File 한글PDF변환.ps1 -ListFile 목록.txt"
  exit 3
}
if ($jobs.Count -eq 0) { Write-Output "할 일이 없습니다."; exit 0 }

# 인쇄로 갈 수 있는지 미리 봅니다.
$canPrint = $false
if (-not $UseSaveAs) {
  try {
    $p = Get-Printer -Name $Printer -ErrorAction SilentlyContinue
    if ($p) { $canPrint = $true }
  } catch { }
  if (-not $canPrint) {
    Write-Output "NOTE`t프린터 「$Printer」 를 찾지 못해 옛 방식(PDF 로 저장)으로 갑니다."
    Write-Output "     이 방식은 한 줄에 칸이 7개 이상인 표의 마지막 칸을 빠뜨립니다."
  }
}

try {
  $hwp = New-Object -ComObject HWPFrame.HwpObject
} catch {
  Write-Output "ERROR`t한글을 부르지 못했습니다: $($_.Exception.Message)"
  Write-Output "이 PC 에 한글(HWP)이 깔려 있어야 합니다."
  exit 2
}

if (-not (Register-Security $hwp)) {
  Write-Output "NOTE`t보안 모듈이 없어 한글이 확인 창을 띄웁니다(파일마다 두 번쯤)."
  Write-Output "     한컴 보안 모듈(FilePathCheckerModuleExample.dll)을 이 스크립트 옆(도구 폴더)에"
  Write-Output "     넣어 두면 다음부터 조용히 지나갑니다."
}

try { $hwp.XHwpWindows.Item(0).Visible = $false } catch { }

$done = 0
$failed = 0

foreach ($job in $jobs) {
  $src = [System.IO.Path]::GetFullPath($job.Src)
  $dst = [System.IO.Path]::GetFullPath($job.Dst)
  try {
    if (-not (Test-Path -LiteralPath $src)) { throw "원본이 없습니다" }
    $dir = Split-Path -Parent $dst
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }

    if (-not $hwp.Open($src, "HWPX", "forceopen:true")) { throw "한글이 파일을 열지 못했습니다" }

    if ($canPrint) {
      $set = $hwp.HParameterSet.HPrint
      $hwp.HAction.GetDefault("Print", $set.HSet) | Out-Null
      $set.PrinterName = $Printer
      $set.PrintToFile = 1
      $set.FileName    = $dst
      $hwp.HAction.Execute("Print", $set.HSet) | Out-Null
      if (-not (Wait-ForFile $dst 60)) { throw "인쇄한 PDF 가 만들어지지 않았습니다" }
    } else {
      if (-not $hwp.SaveAs($dst, "PDF", "")) { throw "PDF 로 저장하지 못했습니다" }
      if (-not (Test-Path -LiteralPath $dst)) { throw "PDF 가 만들어지지 않았습니다" }
    }

    $hwp.Clear(1) | Out-Null
    $done += 1
    Write-Output "OK`t$dst"
  } catch {
    $failed += 1
    try { $hwp.Clear(1) | Out-Null } catch { }
    Write-Output "FAIL`t$($job.Src)`t$($_.Exception.Message)"
  }
}

try { $hwp.Quit() | Out-Null } catch { }
try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($hwp) | Out-Null } catch { }

Write-Output "DONE`t$done`t$failed"
if ($failed -gt 0) { exit 1 }
exit 0
