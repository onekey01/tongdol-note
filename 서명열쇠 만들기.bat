@echo off
rem ---------------------------------------------------------
rem  Tongdol Note - create the update signing key (once)
rem
rem  Double-click this file ONE TIME, before you publish your
rem  first update. It creates a key pair:
rem
rem    - the private half goes to your user folder, OUTSIDE
rem      this project, so it can never end up inside the zip
rem    - the public half is written into the program itself
rem
rem  Running it again does nothing: it refuses to overwrite an
rem  existing key, because changing the key would strand every
rem  copy already out in the field.
rem
rem  (Kept ASCII on purpose, and saved with CRLF line endings:
rem   cmd.exe reads .bat bytes in the machine code page and
rem   seeks by byte offset, so Korean text or LF-only endings
rem   make it resume mid-word and try to run the fragments.
rem   That is also why the PowerShell file is named signkey.ps1.)
rem ---------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0signkey.ps1"
echo.
pause
