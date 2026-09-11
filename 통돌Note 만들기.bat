@echo off
rem ---------------------------------------------------------
rem  Chaengkim Note - build & package
rem
rem  Double-click this file to produce the folder and the zip
rem  you hand to the agency. Everything else is automatic;
rem  the only question it asks is the version number.
rem
rem  (Kept ASCII on purpose: cmd.exe reads .bat bytes in the
rem   machine code page, so Korean here can break parsing.
rem   That is also why the PowerShell file is named build.ps1.)
rem ---------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
if errorlevel 1 pause
