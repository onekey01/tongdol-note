@echo off
rem ---------------------------------------------------------
rem  Form 8 test - ask Hangul to open three sample files.
rem
rem  Double-click. Hangul flashes open and closed once per
rem  file; that is normal. Nothing is changed on disk.
rem  Send the printed table back, then open A, B and C to
rem  check the line weights and the page break.
rem
rem  ASCII only on purpose: cmd.exe reads .bat bytes in the
rem  machine code page, so Korean here breaks parsing.
rem ---------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0form8test.ps1"
pause
