@echo off
rem ---------------------------------------------------------
rem  Tongdol Note - put the source on GitHub
rem
rem  Double-click this after you finish a round of changes.
rem  It shows what changed, asks for a one-line note, and
rem  uploads the source to the GitHub repository.
rem
rem  This is NOT how the agency gets a new version. The agency
rem  gets a Release (version.json + .sig + the zip), which you
rem  still attach by hand on the GitHub Release page. This file
rem  only preserves the source so the work is not living on a
rem  single desktop PC.
rem
rem  The first run also sets the repository up: it installs
rem  nothing, but it will tell you where to get git if git is
rem  missing, and it refuses to upload anything that looks like
rem  a key file (.env, .pem, ...).
rem
rem  (Kept ASCII on purpose, and saved with CRLF line endings:
rem   cmd.exe reads .bat bytes in the machine code page and
rem   seeks by byte offset, so Korean text or LF-only endings
rem   make it resume mid-word and try to run the fragments.
rem   That is also why the PowerShell file is named gitpush.ps1.)
rem ---------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gitpush.ps1"
echo.
pause
