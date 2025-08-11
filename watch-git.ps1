# watch-git.ps1 — авто add/commit/push при изменениях
param(
  [string]$RepoPath = (Get-Location).Path,
  [int]$DebounceMs = 5000
)

Set-Location $RepoPath

# Папки/маски, которые не надо слушать
$excludeDirs = @('\.git', 'node_modules', '\.next', '\.turbo', 'dist', 'build', 'coverage', '\.vercel')
$filter = '*'

$fsw = New-Object System.IO.FileSystemWatcher
$fsw.Path = $RepoPath
$fsw.Filter = $filter
$fsw.IncludeSubdirectories = $true
$fsw.EnableRaisingEvents = $true

$lastEvent = Get-Date

$action = {
  $path = $Event.SourceEventArgs.FullPath
  $dir  = Split-Path $path -Parent

  foreach ($ex in $excludeDirs) {
    if ($dir -match [Regex]::Escape($ex)) { return }
  }

  $now = Get-Date
  if (($now - $script:lastEvent).TotalMilliseconds -lt $DebounceMs) { return }
  $script:lastEvent = $now

  try {
    git add -A | Out-Null
    # Если нет staged изменений, не коммитим
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
      $msg = "auto: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
      git commit -m $msg | Out-Null
      git push | Out-Null
      Write-Host "Pushed: $msg"
    }
  } catch {
    Write-Warning $_.Exception.Message
  }
}

Register-ObjectEvent $fsw Changed -Action $action | Out-Null
Register-ObjectEvent $fsw Created -Action $action | Out-Null
Register-ObjectEvent $fsw Deleted -Action $action | Out-Null
Register-ObjectEvent $fsw Renamed -Action $action | Out-Null

Write-Host "Watching $RepoPath. Press Ctrl+C to stop."
while ($true) { Start-Sleep -Seconds 1 }
