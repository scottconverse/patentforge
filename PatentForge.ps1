# PatentForge launcher — starts all 5 services and opens the browser
param()

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "PatentForge starting..." -ForegroundColor Cyan

# Create backend .env if missing
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
    'DATABASE_URL="file:./prisma/dev.db"' | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "  Created backend/.env with SQLite default"
}

# Check for node_modules and run npm ci if missing
$npmDirs = @(
    @{ Name = "Backend";     Path = Join-Path $root "backend" },
    @{ Name = "Feasibility"; Path = Join-Path $root "services\feasibility" },
    @{ Name = "Frontend";    Path = Join-Path $root "frontend" }
)

foreach ($dir in $npmDirs) {
    $nm = Join-Path $dir.Path "node_modules"
    if (-not (Test-Path $nm)) {
        Write-Host "  $($dir.Name): node_modules missing, running npm ci..." -ForegroundColor Yellow
        $npmResult = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm ci" -WorkingDirectory $dir.Path -NoNewWindow -Wait -PassThru
        if ($npmResult.ExitCode -ne 0) {
            Write-Host "  $($dir.Name): npm ci failed (exit code $($npmResult.ExitCode))" -ForegroundColor Red
        } else {
            Write-Host "  $($dir.Name): npm ci complete" -ForegroundColor Green
        }
    }
}

# Check Python dependencies
$pyCheck = $null
try {
    $pyCheck = & py -c "import uvicorn" 2>&1
} catch {}
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Python: uvicorn not found. Run: pip install uvicorn fastapi anthropic" -ForegroundColor Yellow
}

# Kill stale processes on all service ports
foreach ($port in @(3000, 3001, 3002, 3004, 8080)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# Start backend (NestJS — build first so source changes are always picked up)
Write-Host "  Starting Backend (port 3000)..."
$backendDir = Join-Path $root "backend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build && npm run start" -WorkingDirectory $backendDir -WindowStyle Hidden

# Start feasibility service (Node.js — build first)
Write-Host "  Starting Feasibility service (port 3001)..."
$feasibilityDir = Join-Path $root "services\feasibility"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build && npm run start" -WorkingDirectory $feasibilityDir -WindowStyle Hidden

# Start claim-drafter service (Python/FastAPI)
Write-Host "  Starting Claim Drafter (port 3002)..."
$claimDrafterDir = Join-Path $root "services\claim-drafter"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c set INTERNAL_SERVICE_SECRET=patentforge-internal && py -m uvicorn src.server:app --host 0.0.0.0 --port 3002" -WorkingDirectory $claimDrafterDir -WindowStyle Hidden

# Start compliance-checker service (Python/FastAPI)
Write-Host "  Starting Compliance Checker (port 3004)..."
$complianceDir = Join-Path $root "services\compliance-checker"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c set INTERNAL_SERVICE_SECRET=patentforge-internal && py -m uvicorn src.server:app --host 0.0.0.0 --port 3004" -WorkingDirectory $complianceDir -WindowStyle Hidden

# Start frontend dev server (Vite)
Write-Host "  Starting Frontend (port 8080)..."
$frontendDir = Join-Path $root "frontend"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $frontendDir -WindowStyle Hidden

# Wait for services to start
Write-Host "`nWaiting for services to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 12

# Verify each port is bound
$services = @(
    @{ Name = "Backend";            Port = 3000 },
    @{ Name = "Feasibility";        Port = 3001 },
    @{ Name = "Claim Drafter";      Port = 3002 },
    @{ Name = "Compliance Checker"; Port = 3004 },
    @{ Name = "Frontend";           Port = 8080 }
)

$backendOk = $false
$frontendOk = $false

Write-Host ""
foreach ($svc in $services) {
    $conn = Get-NetTCPConnection -LocalPort $svc.Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "  $($svc.Name) ($($svc.Port)): OK" -ForegroundColor Green
        if ($svc.Port -eq 3000) { $backendOk = $true }
        if ($svc.Port -eq 8080) { $frontendOk = $true }
    } else {
        Write-Host "  $($svc.Name) ($($svc.Port)): FAILED" -ForegroundColor Red
    }
}

Write-Host ""
if ($backendOk -and $frontendOk) {
    Write-Host "PatentForge is running at http://localhost:8080" -ForegroundColor Green
    Start-Process "http://localhost:8080"
} else {
    Write-Host "Backend or Frontend failed to start. Check the logs and try again." -ForegroundColor Red
    if (-not $backendOk) { Write-Host "  Hint: try 'cd backend && npm run build && npm run start' to see backend errors" -ForegroundColor Yellow }
    if (-not $frontendOk) { Write-Host "  Hint: try 'cd frontend && npm run dev' to see frontend errors" -ForegroundColor Yellow }
}
