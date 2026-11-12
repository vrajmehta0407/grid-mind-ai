$ErrorActionPreference = "Stop"

Write-Host "Starting GridMind AI FastAPI backend on http://127.0.0.1:8000 ..."
$api = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "app.main:app", "--app-dir", "services/api", "--port", "8000" -PassThru

Write-Host "Starting GridMind AI Next.js frontend on http://127.0.0.1:3000 ..."
$web = Start-Process -FilePath "pnpm" -ArgumentList "--dir", "apps/web", "dev" -PassThru

try {
  Write-Host "GridMind AI is running! Press Ctrl+C to stop both services."
  Wait-Process -Id $api.Id, $web.Id
} finally {
  if (!$api.HasExited) { Stop-Process -Id $api.Id -Force }
  if (!$web.HasExited) { Stop-Process -Id $web.Id -Force }
}

