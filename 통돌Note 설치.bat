@echo off
rem ---------------------------------------------------------
rem  Tongdol Note - installer (double-click this)
rem
rem  It copies the program to C:\TongdolNote (a Korean folder
rem  name is chosen inside the PowerShell file), makes a
rem  desktop shortcut, removes the "downloaded from the
rem  internet" mark so Windows stops warning, and starts it.
rem
rem  Your data folder is never touched when re-installing.
rem
rem  (Kept ASCII on purpose: cmd.exe reads .bat bytes in the
rem   machine code page, so Korean here can break parsing.
rem   That is also why the PowerShell file is named install.ps1.)
rem ---------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 pause
