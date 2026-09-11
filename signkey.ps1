<#
  통돌 Note — 업데이트 서명 열쇠 만들기 (평생 한 번)

  「서명열쇠 만들기.bat」이 이 파일을 부릅니다.

  ── 왜 .bat 이 직접 bun 을 안 부르나 ────────────────────────

  .bat 은 **한 글자도 한글이면 안 됩니다.** cmd.exe 는 .bat 의 바이트를
  기계 코드 페이지로 읽기 때문에, 한글이 섞이면 어느 날 파싱이 깨집니다.
  실제로 2026-09-11 에 깨졌습니다 — 「서명열쇠 만들기.bat」이 한글 경로를
  직접 적고 있었고, 줄끝도 LF 였습니다. cmd 가 줄을 엉뚱한 자리에서
  잘라 읽어 이런 것들을 명령으로 실행하려 했습니다 —

      'ote'은(는) 내부 또는 외부 명령... 이 아닙니다.
      'e-click'은(는) ...
      'project'은(는) ...

  그래서 다른 .bat 들과 같은 모양으로 맞춥니다 —
  **.bat 은 ASCII 로만 적고, 한글이 필요한 일은 .ps1 이 합니다.**
  (PowerShell 은 UTF-8 BOM 만 붙어 있으면 한글을 아무 문제 없이 읽습니다.)
#>
$ErrorActionPreference = "Stop"
chcp 65001 > $null 2>&1
$뿌리 = Split-Path -Parent $MyInvocation.MyCommand.Path
$할것 = Join-Path $뿌리 "도구\서명열쇠만들기.ts"

if (-not (Test-Path -LiteralPath $할것)) {
  Write-Output ""
  Write-Output "  도구\서명열쇠만들기.ts 를 찾지 못했습니다."
  Write-Output "  이 파일이 프로그램 폴더 안에 있는지 확인해 주세요 —"
  Write-Output "    $할것"
  Write-Output ""
  exit 1
}

& bun $할것
exit $LASTEXITCODE
