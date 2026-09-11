@echo off
rem ---------------------------------------------------------
rem  Chaengkim Note - launcher
rem
rem  Double-click this file to start.
rem  The program opens the browser itself; do NOT open it here.
rem  Opening it here too is what made two windows pop up.
rem
rem  (Kept ASCII on purpose: cmd.exe reads .bat bytes in the
rem   machine code page, so Korean here can break parsing.)
rem ---------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
if errorlevel 1 pause
