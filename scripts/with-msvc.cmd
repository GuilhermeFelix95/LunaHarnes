@echo off
rem Executa um comando com o ambiente do MSVC carregado, em qualquer terminal.
rem Uso: scripts\with-msvc.cmd cargo test --manifest-path src-tauri\Cargo.toml
setlocal

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" (
  echo vswhere nao encontrado. Instale o Visual Studio Build Tools com a carga "Desenvolvimento para desktop com C++".
  exit /b 1
)

rem Parenteses no caminho do Program Files (x86) quebram o for /f: a saida vai para um arquivo.
set "VSINFO=%TEMP%\lunaharness-vsdir.txt"
"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath > "%VSINFO%"
set "VSDIR="
set /p VSDIR=<"%VSINFO%"
del "%VSINFO%" >nul 2>&1
if not defined VSDIR (
  echo Build Tools com C++ nao encontrado. Instale a carga "Desenvolvimento para desktop com C++".
  exit /b 1
)

call "%VSDIR%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 (
  echo Falha ao carregar o ambiente do MSVC em "%VSDIR%".
  exit /b 1
)

rem O linker do MSVC precisa vir antes do link.exe do Git no PATH.
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

%*
