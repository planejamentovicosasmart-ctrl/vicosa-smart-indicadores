@echo off
cd /d "%~dp0"
echo.
echo ================================================
echo   Central de Indicadores - Vicosa SMART
echo ================================================
echo.
if not exist "server\.env" (
  echo Sistema ainda nao configurado.
  echo Clique com o botao direito em CONFIGURAR_WINDOWS.ps1 e escolha Executar com PowerShell.
  pause
  exit /b 1
)
npm start
pause
