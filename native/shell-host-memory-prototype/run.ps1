param(
  [ValidateSet('blank','workspace','hosts')][string]$Mode = 'blank',
  [ValidateRange(1,3)][int]$Runs = 3,
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$prototypeRoot = $PSScriptRoot
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $prototypeRoot '../..'))
if (-not $SkipBuild) {
  & node (Join-Path $prototypeRoot 'build-ui.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'Prototype UI build failed' }
  & cargo build --release --manifest-path (Join-Path $prototypeRoot 'Cargo.toml')
  if ($LASTEXITCODE -ne 0) { throw 'Prototype build failed' }
}
$executable = Join-Path $prototypeRoot 'target/release/threadhelm-memory-prototype.exe'
$resultRoot = Join-Path $repositoryRoot ('tmp/shell-host-memory/' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $Mode)
[void](New-Item -ItemType Directory -Path $resultRoot)

function Snapshot([int]$RootProcessId, [string]$DataDirectory) {
  $rows = @(Get-CimInstance Win32_Process)
  $family = [Collections.Generic.HashSet[int]]::new()
  [void]$family.Add($RootProcessId)
  # WebView2 can share/reparent browser processes. A unique user-data directory
  # identifies this prototype's entire browser group, never other applications.
  foreach ($row in $rows) {
    if ($row.Name -eq 'msedgewebview2.exe' -and $row.CommandLine -and $row.CommandLine.Contains($DataDirectory)) {
      [void]$family.Add([int]$row.ProcessId)
    }
  }
  do {
    $added = $false
    foreach ($row in $rows) {
      if ($family.Contains([int]$row.ParentProcessId) -and $family.Add([int]$row.ProcessId)) { $added = $true }
    }
  } while ($added)
  $owned = @($rows | Where-Object { $family.Contains([int]$_.ProcessId) })
  $parts = @($owned | ForEach-Object {
    $role = if ($_.ProcessId -eq $RootProcessId) { 'coordinator' }
      elseif ($_.Name -eq 'msedgewebview2.exe') {
        if ($_.CommandLine -match '--type=([^\s]+)') { 'webview-' + $Matches[1] } else { 'webview-browser' }
      } elseif ($_.CommandLine -like '*--host*') { 'native-host' }
      else { 'fixture-or-helper' }
    [pscustomobject]@{
      ProcessId=[int]$_.ProcessId; ParentProcessId=[int]$_.ParentProcessId; Name=$_.Name; Role=$role
      Created=$_.CreationDate.ToString('o')
      CpuMs=([double]$_.KernelModeTime+[double]$_.UserModeTime)/10000
      WorkingSetMiB=[double]$_.WorkingSetSize/1MB
    }
  })
  [pscustomobject]@{
    RecordedAt=[DateTimeOffset]::Now.ToString('o')
    Identity=(($parts | Sort-Object ProcessId | ForEach-Object { "$($_.ProcessId):$($_.Created)" }) -join ',')
    CpuMs=($parts | Measure-Object CpuMs -Sum).Sum
    WorkingSetMiB=($parts | Measure-Object WorkingSetMiB -Sum).Sum
    Processes=$parts
  }
}

for ($runIndex=1; $runIndex -le $Runs; $runIndex++) {
  $runDirectory=Join-Path $resultRoot ('run-' + $runIndex + '-' + [guid]::NewGuid().ToString('N'))
  [void](New-Item -ItemType Directory -Path $runDirectory)
  $startInfo=[Diagnostics.ProcessStartInfo]::new($executable)
  $startInfo.UseShellExecute=$false
  $startInfo.CreateNoWindow=$true
  $startInfo.RedirectStandardInput=$true
  $startInfo.RedirectStandardError=$true
  $startInfo.RedirectStandardOutput=$true
  $startInfo.WorkingDirectory=$runDirectory
  $startInfo.ArgumentList.Add($runDirectory)
  $startInfo.ArgumentList.Add($Mode)
  # The app needs Windows runtime paths, not inherited provider credentials.
  $startInfo.Environment.Clear()
  foreach ($key in @('SystemRoot','WINDIR','PATH','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE')) {
    $value=[Environment]::GetEnvironmentVariable($key)
    if ($value) { $startInfo.Environment[$key]=$value }
  }
  $process=[Diagnostics.Process]::Start($startInfo)
  $stderr=$process.StandardError.ReadToEndAsync()
  $stdout=$process.StandardOutput.ReadToEndAsync()
  try {
    $readyFile=Join-Path $runDirectory 'ready.json'
    $deadline=[DateTime]::UtcNow.AddSeconds(45)
    while (-not (Test-Path -LiteralPath $readyFile)) {
      if ($process.HasExited -or [DateTime]::UtcNow -gt $deadline) { throw 'Renderer readiness failed' }
      Start-Sleep -Milliseconds 250
    }
    $ready=Get-Content -Raw -LiteralPath $readyFile | ConvertFrom-Json
    if (-not $ready.rendered -or $ready.pid -ne $process.Id -or $ready.mode -ne $Mode) { throw 'Wrong readiness identity' }
    if (-not $ready.visible -or $ready.minimized) { throw 'Prototype must be visible and not minimized' }
    Write-Output "Run $runIndex/${Runs}: renderer ready; settling for 15 seconds."
    Start-Sleep -Seconds 15
    $initial=Snapshot $process.Id (Join-Path $runDirectory 'webview-data')
    if (@($initial.Processes | Where-Object Role -eq 'webview-renderer').Count -eq 0) { throw 'Missing renderer process' }
    $expectedHosts=if ($Mode -eq 'hosts') { 4 } else { 0 }
    if (@($initial.Processes | Where-Object Role -eq 'native-host').Count -ne $expectedHosts) { throw 'Wrong host count' }
    $before=$initial
    $samples=@()
    for ($sampleIndex=0; $sampleIndex -lt 12; $sampleIndex++) {
      $clock=[Diagnostics.Stopwatch]::StartNew()
      Start-Sleep -Seconds 5
      if ($process.HasExited) { throw 'Prototype exited during observation' }
      $after=Snapshot $process.Id (Join-Path $runDirectory 'webview-data')
      $clock.Stop()
      if ($after.Identity -ne $initial.Identity) { throw 'Process family changed; reject observation' }
      $samples += [pscustomobject]@{CpuPercentOneCore=100*($after.CpuMs-$before.CpuMs)/$clock.Elapsed.TotalMilliseconds; WindowMs=$clock.Elapsed.TotalMilliseconds; Snapshot=$after}
      $before=$after
      Write-Output "Run $runIndex/${Runs}: window $($sampleIndex+1)/12"
    }
    $sorted=@($samples.CpuPercentOneCore | Sort-Object)
    $median=($sorted[5]+$sorted[6])/2
    $peak=(@($initial.WorkingSetMiB)+@($samples.Snapshot.WorkingSetMiB) | Measure-Object -Maximum).Maximum
    $process.StandardInput.WriteLine('STOP')
    $process.StandardInput.Flush()
    if (-not $process.WaitForExit(15000)) { throw 'Prototype did not stop' }
    if ($process.ExitCode -ne 0) { throw 'Prototype exited with failure' }
    $cleanupDeadline=[DateTime]::UtcNow.AddSeconds(15)
    do {
      $remaining=Snapshot $process.Id (Join-Path $runDirectory 'webview-data')
      if ($remaining.Processes.Count -eq 0) { break }
      Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $cleanupDeadline)
    if ($remaining.Processes.Count -ne 0) { throw 'Prototype processes remain after normal close' }
    $report=[pscustomobject]@{
      Mode=$Mode; Run=$runIndex; Readiness=$ready
      ExecutableSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $executable).Hash
      RuntimeVersion=(Get-Item 'C:/Program Files (x86)/Microsoft/EdgeWebView/Application/*/msedgewebview2.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).VersionInfo.FileVersion
      MedianCpuPercentOneCore=$median; PeakWorkingSetMiB=$peak
      CpuBudgetPassed=$median -le 1; MemoryBudgetMiB=$(if($Mode -eq 'hosts'){700}else{250})
      MemoryBudgetPassed=$peak -le $(if($Mode -eq 'hosts'){700}else{250})
      CleanExit=$true; RemainingProcesses=0; Initial=$initial; Samples=$samples
      ProductionAcceptance=$false
      Scope='All descendants plus private WebView2 process group; visible local window; no inspector, working-set trimming, custom graphics/security switches, or provider processes. Budget comparison only; dormant hosts do not establish four-session acceptance.'
    }
    $report | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $runDirectory 'measurement.json')
    $report | Select-Object Mode,Run,PeakWorkingSetMiB,MedianCpuPercentOneCore,CleanExit | ConvertTo-Json -Compress | Write-Output
  } finally {
    if (-not $process.HasExited) {
      $process.StandardInput.WriteLine('STOP')
      $process.StandardInput.Flush()
      if (-not $process.WaitForExit(15000)) { $process.Kill($true); $process.WaitForExit() }
    }
    $stderr.GetAwaiter().GetResult() | Set-Content -LiteralPath (Join-Path $runDirectory 'stderr.txt')
    $stdout.GetAwaiter().GetResult() | Set-Content -LiteralPath (Join-Path $runDirectory 'stdout.txt')
    $process.Dispose()
  }
}
Write-Output "Reports: $resultRoot"
