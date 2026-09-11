@echo off
rem ---------------------------------------------------------
rem  Tongdol Note - clean the GitHub repository (one time)
rem
rem  On 2026-09-11 the first upload accidentally included the
rem  _to_delete folder. Two archives inside it contained the
rem  .env file, and the repository is public.
rem
rem  This rewrites the repository history from the current
rem  state of this folder and overwrites GitHub with it, so
rem  those archives are gone from the branch.
rem
rem  It does NOT delete anything in this folder.
rem
rem  IMPORTANT: rotate the leaked keys anyway. Removing them
rem  from GitHub is the cleanup; changing them is the fix.
rem
rem  (Kept ASCII on purpose, and saved with CRLF line endings:
rem   cmd.exe reads .bat bytes in the machine code page and
rem   seeks by byte offset, so Korean text or LF-only endings
rem   make it resume mid-word and try to run the fragments.
rem   That is also why the PowerShell file is named
rem   gitclean.ps1.)
rem ---------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gitclean.ps1"
echo.
pause
