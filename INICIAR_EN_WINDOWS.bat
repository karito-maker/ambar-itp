@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo ===========================================
echo       TECPLUS - SISTEMA ACADEMICO
 echo ===========================================
echo.
if not exist "node_modules\@angular" (
  echo Instalando dependencias del proyecto...
  call npm install
  if errorlevel 1 (
    echo Error al instalar dependencias. Revisa Node.js y npm.
    pause
    exit /b 1
  )
)
echo Iniciando TECPLUS en http://localhost:8100
call npm run dev
pause
