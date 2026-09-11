# 오늘 시험하느라 만든 것들을 치웁니다.
# **지우지 않고 한 곳에 모읍니다.** 확인하고 사장님이 지우시면 됩니다.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$root = "C:\Users\Bak Byeongseob\Desktop\care-saas\chaengkim-note"
$bin  = Join-Path $root "_치울것"
if (-not (Test-Path -LiteralPath $bin)) { New-Item -ItemType Directory -Path $bin | Out-Null }

function Move-One($path) {
  if (-not (Test-Path -LiteralPath $path)) { return }
  $name = Split-Path -Leaf $path
  $dest = Join-Path $bin $name
  $n = 1
  while (Test-Path -LiteralPath $dest) { $dest = Join-Path $bin ($n.ToString() + "_" + $name); $n++ }
  Move-Item -LiteralPath $path -Destination $dest -Force
  Write-Output ("  옮김: " + $name)
}

Write-Output "-- 오늘 시험하며 만든 것 --"
foreach ($n in @("변환목록.txt", "변환목록2.txt", "변환목록3.txt",
                 "변환결과.txt", "변환결과2.txt", "점검결과.txt",
                 "opentest.txt", "reg_guide.jpg")) {
  Move-One (Join-Path $root $n)
}
Move-One (Join-Path $root "도구\opentest.ps1")
Move-One (Join-Path $root "서식시험\변형시험")

Write-Output "-- 전에 버리기로 한 것 --"
Move-One (Join-Path $root "server\recordbook-pdf.ts")

Write-Output "-- 낡은 시험 PDF (7번째 칸이 빠진 것들) --"
$pdfdir = Join-Path $root "서식시험\PDF_시험출력"
foreach ($n in @("시험1_김순자.pdf", "시험2_여섯서비스_1.pdf", "시험3_여섯서비스_2.pdf",
                 "기록지_바로잡음_6종_2장.pdf", "기록지_바로잡음_김순자.pdf",
                 "기록지_서비스6종_한장.pdf", "2026-08_기록지_김순자.pdf")) {
  Move-One (Join-Path $pdfdir $n)
}

Write-Output "-- 바탕화면 --"
Move-One "C:\Users\Bak Byeongseob\Desktop\한글변환시험.bat"

Write-Output ""
Write-Output "-- 남긴 것 (지우면 안 됩니다) --"
$dll = Join-Path $root "도구\FilePathCheckerModuleExample.dll"
Write-Output ("  도구\FilePathCheckerModuleExample.dll  있음=" + (Test-Path -LiteralPath $dll))
Write-Output "  → 한글 경고창을 없애는 보안 모듈입니다. 프로그램과 함께 배포해야 합니다."

Write-Output ""
Write-Output ("모은 곳: " + $bin)
Get-ChildItem -LiteralPath $bin | ForEach-Object { Write-Output ("  · " + $_.Name) }
Write-Output "== 끝 =="
