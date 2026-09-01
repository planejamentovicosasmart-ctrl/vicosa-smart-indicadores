$ErrorActionPreference = "Stop"
Write-Host "" 
Write-Host "=== Central de Indicadores - Viçosa SMART ===" -ForegroundColor Cyan
Write-Host "Configuração local para Windows" -ForegroundColor DarkGray
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js não encontrado. Instale o Node.js 22 ou superior e execute este arquivo novamente." -ForegroundColor Red
  exit 1
}

$databaseUrl = Read-Host "Cole a DATABASE_URL do Neon (PostgreSQL)"
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  Write-Host "A DATABASE_URL é obrigatória." -ForegroundColor Red
  exit 1
}

$openaiKey = Read-Host "Cole a OPENAI_API_KEY para ativar o agente (Enter para configurar depois)"
$basicPassword = Read-Host "Senha opcional para proteger o sistema quando publicar (Enter para deixar vazio)"

$envContent = @"
DATABASE_URL="$databaseUrl"
OPENAI_API_KEY="$openaiKey"
OPENAI_MODEL="gpt-5.6-sol"
TAVILY_API_KEY=""
AGENT_MAX_INDICATORS="8"
BASIC_AUTH_USER="vicosasmart"
BASIC_AUTH_PASSWORD="$basicPassword"
PORT="3000"
NODE_ENV="development"
"@
$envContent | Set-Content -Path "$PSScriptRoot\server\.env" -Encoding UTF8

Write-Host "" 
Write-Host "Instalando dependências..." -ForegroundColor Cyan
Set-Location $PSScriptRoot
npm run install:all

Write-Host "Preparando banco..." -ForegroundColor Cyan
npm run db:push
npm run seed

Write-Host "Gerando aplicação..." -ForegroundColor Cyan
npm run build

Write-Host "" 
Write-Host "Configuração concluída." -ForegroundColor Green
Write-Host "Para iniciar depois, dê dois cliques em INICIAR_WINDOWS.bat" -ForegroundColor Green
Write-Host ""
Write-Host "Iniciando agora em http://localhost:3000" -ForegroundColor Cyan
npm start
