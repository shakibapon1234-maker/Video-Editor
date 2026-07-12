param()
$Host.UI.RawUI.WindowTitle = "Studio Flow - Video Editor"

Write-Host ""
Write-Host " ========================================" -ForegroundColor Cyan
Write-Host "   Studio Flow - Video Editor for Facebook" -ForegroundColor Cyan
Write-Host " ========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Starting server on http://localhost:4000 ..." -ForegroundColor Green
Write-Host " [!] Do NOT close this window while editing!" -ForegroundColor Yellow
Write-Host ""

# Set working directory to script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Kill any existing server on port 4000
$existing = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
if ($existing) {
    $existing | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500
}

# Start Node.js Express & WebSocket server
$serverJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    if (-not (Test-Path "node_modules")) {
        npm install
    }
    node server.js
} -ArgumentList $scriptDir

# Wait for server to start
Start-Sleep -Seconds 3

# Open browser
Write-Host " Opening browser at http://localhost:4000" -ForegroundColor Green
Start-Process "http://localhost:4000"

Write-Host ""
Write-Host " Server is running! Press ENTER to stop the server and exit." -ForegroundColor White
Read-Host

# Stop server job
Write-Host " Stopping server..." -ForegroundColor Yellow
Stop-Job $serverJob -ErrorAction SilentlyContinue
Remove-Job $serverJob -ErrorAction SilentlyContinue

# Kill remaining processes on port 4000
$remaining = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
if ($remaining) {
    $remaining | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Write-Host " Server stopped. Goodbye!" -ForegroundColor Cyan
Start-Sleep -Seconds 1
