# PatentForge launcher
param()

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Create backend .env if missing
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
    'DATABASE_URL="file:./prisma/dev.db"' | Out-File -FilePath $envFile -Encoding utf8
}

# Kill stale processes on ports 3000, 3001, 8080
foreach ($port in @(3000, 3001, 8080)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# Start backend (build first so source changes are always picked up)
$backendDir = Join-Path $root "backend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build && npm run start" -WorkingDirectory $backendDir -WindowStyle Hidden

# Start feasibility service (build first)
$feasibilityDir = Join-Path $root "services\feasibility"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build && npm run start" -WorkingDirectory $feasibilityDir -WindowStyle Hidden

# Start frontend dev server
$frontendDir = Join-Path $root "frontend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $frontendDir -WindowStyle Hidden

# Wait for services, then open browser
Start-Sleep -Seconds 8
Start-Process "http://localhost:8080"
