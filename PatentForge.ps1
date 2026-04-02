# PatentForge launcher — starts all 5 services and opens the browser
param()

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Create backend .env if missing
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
    'DATABASE_URL="file:./prisma/dev.db"' | Out-File -FilePath $envFile -Encoding utf8
}

# Kill stale processes on all service ports
foreach ($port in @(3000, 3001, 3002, 3004, 8080)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# Start backend (NestJS — build first so source changes are always picked up)
$backendDir = Join-Path $root "backend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build && npm run start" -WorkingDirectory $backendDir -WindowStyle Hidden

# Start feasibility service (Node.js — build first)
$feasibilityDir = Join-Path $root "services\feasibility"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build && npm run start" -WorkingDirectory $feasibilityDir -WindowStyle Hidden

# Start claim-drafter service (Python/FastAPI)
$claimDrafterDir = Join-Path $root "services\claim-drafter"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c set INTERNAL_SERVICE_SECRET=patentforge-internal && py -m uvicorn src.server:app --host 0.0.0.0 --port 3002" -WorkingDirectory $claimDrafterDir -WindowStyle Hidden

# Start compliance-checker service (Python/FastAPI)
$complianceDir = Join-Path $root "services\compliance-checker"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c set INTERNAL_SERVICE_SECRET=patentforge-internal && py -m uvicorn src.server:app --host 0.0.0.0 --port 3004" -WorkingDirectory $complianceDir -WindowStyle Hidden

# Start frontend dev server (Vite)
$frontendDir = Join-Path $root "frontend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $frontendDir -WindowStyle Hidden

# Wait for services, then open browser
Start-Sleep -Seconds 10
Start-Process "http://localhost:8080"
