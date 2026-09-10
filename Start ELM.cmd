@echo off
setlocal
powershell.exe -NoProfile -STA -File "%~dp0clients\vscode\start-elm.ps1"
if errorlevel 1 (
  echo ELM setup could not start. See clients\vscode\EASY-START.md for help.
  pause
)
