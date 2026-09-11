@echo off
rem ---------------------------------------------------------
rem  Form repair - let Hangul open and re-save each form.
rem
rem  Double-click this file. Hangul flashes open and closed
rem  once per form; that is normal. Do not touch it meanwhile.
rem  It prints which forms open and which do not.
rem
rem  ASCII only on purpose: cmd.exe reads .bat bytes in the
rem  machine code page, so Korean here breaks parsing.
rem  That is why the PowerShell file is named fixforms.ps1.
rem ---------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fixforms.ps1"
pause
