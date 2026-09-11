# 한글 자동화 환경을 살펴봅니다. 아무것도 바꾸지 않고 보기만 합니다.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Output "== 1. 한글 설치 =="
foreach ($k in @("HKLM:\SOFTWARE\WOW6432Node\Classes\HWPFrame.HwpObject\CLSID",
                 "HKLM:\SOFTWARE\Classes\HWPFrame.HwpObject\CLSID")) {
  if (Test-Path $k) { Write-Output ("  " + $k + " -> " + (Get-ItemProperty $k)."(default)") }
}

Write-Output ""
Write-Output "== 2. 보안 모듈 DLL 이 PC 에 있는가 =="
$found = @()
foreach ($pf in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
  if (-not $pf) { continue }
  $hnc = Join-Path $pf "Hnc"
  if (Test-Path -LiteralPath $hnc) {
    $found += Get-ChildItem -LiteralPath $hnc -Recurse -Filter "FilePathChecker*.dll" `
                            -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
  }
}
if ($found.Count -gt 0) { $found | ForEach-Object { Write-Output ("  찾음: " + $_) } }
else { Write-Output "  없음 — 한글 설치 폴더에 FilePathChecker*.dll 이 없습니다." }

Write-Output ""
Write-Output "== 3. 자동화 모듈 레지스트리 =="
$key = "HKCU:\Software\HNC\HwpAutomation\Modules"
if (Test-Path $key) {
  (Get-Item $key).Property | ForEach-Object {
    Write-Output ("  " + $_ + " = " + (Get-ItemProperty $key).$_)
  }
} else { Write-Output "  키가 없습니다: $key" }

Write-Output ""
Write-Output "== 4. RegisterModule 이 정말 되는가 =="
try {
  $hwp = New-Object -ComObject HWPFrame.HwpObject
  $r = $hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
  Write-Output ("  RegisterModule 반환값: " + $r)
  Write-Output ("  한글 버전: " + $hwp.Version)
  try { $hwp.Quit() | Out-Null } catch { }
} catch {
  Write-Output ("  실패: " + $_.Exception.Message)
}
Write-Output ""
Write-Output "== 끝 =="
