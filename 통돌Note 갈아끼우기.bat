@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ---------------------------------------------------------
rem  Tongdol Note - version swap helper
rem
rem  You do NOT normally run this by hand. The program starts
rem  it for you when you press the update button, then closes
rem  itself so the files can be replaced.
rem
rem  Run it by hand only if the program told you to, or if an
rem  update was interrupted. It is safe to run twice: with
rem  nothing prepared it just says so and stops.
rem
rem  What it does, in order:
rem    1. wait for the program to close
rem    2. move the old .exe into data\update\old\
rem    3. copy the prepared files over this folder
rem    4. start the program again
rem
rem  It never touches data\tongdol.db - your records stay put.
rem
rem  (Kept ASCII on purpose: cmd.exe reads .bat bytes in the
rem   machine code page, so Korean here can break parsing.
rem   That is also why every path below is ASCII. The friendly
rem   Korean folder name is created by the program afterwards.)
rem ---------------------------------------------------------

set "STAGE=%CD%\data\update"
set "PAYLOAD=%STAGE%\payload"
set "OLDDIR=%STAGE%\old"

chcp 437 >nul 2>&1
echo.
echo   Tongdol Note - replacing with the new version
echo   ---------------------------------------------

if not exist "%STAGE%\ready.txt" goto :nothing
if not exist "%PAYLOAD%" goto :nothing

rem -- 1. wait for the running program to close (max 60s) ----
rem    The program writes its own process id before it exits.
rem    If the file is missing we just wait a few seconds.
if not exist "%STAGE%\pid.txt" (
  echo   Waiting a moment...
  ping -n 4 127.0.0.1 >nul
  goto :swap
)
set /p PID=<"%STAGE%\pid.txt"
echo   Waiting for the program to close...
set /a tries=0
:wait
tasklist /fi "PID eq %PID%" 2>nul | find "%PID%" >nul
if errorlevel 1 goto :swap
set /a tries+=1
if %tries% GEQ 60 goto :stillrunning
ping -n 2 127.0.0.1 >nul
goto :wait

:swap
rem -- 2. old exe out of the way -----------------------------
if not exist "%OLDDIR%" mkdir "%OLDDIR%"
set "MOVED="
for %%F in ("%CD%\*.exe") do (
  move /y "%%~fF" "%OLDDIR%\" >nul 2>&1
  if not errorlevel 1 set "MOVED=1"
)
if not defined MOVED goto :cannotmove

rem -- 3. new files into place -------------------------------
rem    robocopy return codes 0-7 mean success; 8+ is a failure.
echo   Replacing files...
robocopy "%PAYLOAD%" "%CD%" /E /IS /IT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if %ERRORLEVEL% GEQ 8 goto :rollback

rem -- 4. did an exe actually land? --------------------------
set "GOT="
for %%F in ("%CD%\*.exe") do set "GOT=%%~fF"
if not defined GOT goto :rollback

rem -- 5. tidy up and start ----------------------------------
del /q "%STAGE%\ready.txt" >nul 2>&1
del /q "%STAGE%\pid.txt" >nul 2>&1
rmdir /s /q "%PAYLOAD%" >nul 2>&1
echo   Done. Starting the new version...
ping -n 2 127.0.0.1 >nul
start "" "%GOT%"
exit /b 0

rem ---------------------------------------------------------
:rollback
rem  Something went wrong halfway. Put the old exe back so the
rem  agency is never left without a working program.
echo.
echo   Could not replace the files. Putting the old version back.
for %%F in ("%OLDDIR%\*.exe") do move /y "%%~fF" "%CD%\" >nul 2>&1
set "BACK="
for %%F in ("%CD%\*.exe") do set "BACK=%%~fF"
if defined BACK (
  echo   The old version is back in place. Starting it.
  start "" "%BACK%"
) else (
  echo   The old version could not be restored automatically.
  echo   It is here:  %OLDDIR%
  echo   Copy the .exe from that folder back into:
  echo     %CD%
)
echo.
pause
exit /b 1

:stillrunning
echo.
echo   The program is still running after 60 seconds.
echo   Close it and run this file again.
echo.
pause
exit /b 1

:cannotmove
echo.
echo   Could not move the current program file.
echo   It is usually still running, or a virus scanner is
echo   holding it. Close the program, wait a moment, and run
echo   this file again.
echo.
pause
exit /b 1

:nothing
echo.
echo   Nothing is prepared to install.
echo   Start the program normally - it will tell you when a
echo   new version is ready.
echo.
pause
exit /b 0
