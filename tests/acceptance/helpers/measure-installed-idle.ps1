# Read-only installed resource observer. Disconnect UI automation and profilers first.
# Keep the app visible. Starts/stops no processes and submits no terminal input.
param(
  [Parameter(Mandatory = $true)][int]$RootProcessId,
  [int[]]$CodexProcessIds = @(),
  [Parameter(Mandatory = $true)][string]$RuntimeCommit,
  [ValidateRange(12,180)][int]$WindowCount = 12,
  [ValidateRange(1,5)][int]$SampleIntervalSeconds = 5,
  [string]$FixtureExecutablePath,
  [switch]$PackagedCandidate,
  [Parameter(Mandatory = $true)][string]$ReportPath
)
$ErrorActionPreference = 'Stop'
if ($FixtureExecutablePath) {
  $FixtureExecutablePath = (Resolve-Path -LiteralPath $FixtureExecutablePath).ProviderPath
}
if ($CodexProcessIds.Count -notin 0,4 -or @($CodexProcessIds | Sort-Object -Unique).Count -ne $CodexProcessIds.Count) {
  throw 'Supply either zero provider IDs for no-session idle or exactly four distinct Codex IDs'
}
$expectedExe = if($PackagedCandidate){[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../apps/desktop/release/ThreadHelm-win32-x64/ThreadHelm.exe'))}else{Join-Path $env:LOCALAPPDATA 'Programs\@threadhelmdesktop\ThreadHelm.exe'}
$rootProcess = Get-Process -Id $RootProcessId
if ($rootProcess.Path -ne $expectedExe) { throw 'Unexpected installed app identity' }
$rootStarted = $rootProcess.StartTime
$expectedStarts = @{}
foreach ($testProcessId in $CodexProcessIds) {
  $testProcess = Get-Process -Id $testProcessId
  if ($testProcess.ProcessName -ne 'codex') { throw 'A selected provider is not Codex' }
  if ($FixtureExecutablePath -and $testProcess.Path -ne $FixtureExecutablePath) { throw 'Unexpected fixture executable' }
  $expectedStarts[$testProcessId] = $testProcess.StartTime
}
function Get-InstalledSnapshot {
  if ((Get-Process -Id $RootProcessId).StartTime -ne $rootStarted) { throw 'Installed root identity changed' }
  $rows = @(Get-CimInstance Win32_Process)
  $family = [System.Collections.Generic.HashSet[int]]::new()
  [void]$family.Add($RootProcessId)
  do {
    $added = $false
    foreach ($row in $rows) {
      if ($family.Contains([int]$row.ParentProcessId) -and $family.Add([int]$row.ProcessId)) { $added = $true }
    }
  } while ($added)
  foreach ($testProcessId in $CodexProcessIds) {
    if (-not $family.Contains($testProcessId)) { throw 'Test provider is no longer a descendant of the installed app' }
    if ((Get-Process -Id $testProcessId).StartTime -ne $expectedStarts[$testProcessId]) { throw 'Test provider PID was reused' }
  }
  $owned = @($rows | Where-Object { $family.Contains([int]$_.ProcessId) })
  $providers = @($owned | Where-Object { $_.Name -eq 'codex.exe' })
  if ($providers.Count -ne $CodexProcessIds.Count) { throw 'Unexpected provider count' }
  $hosts = @($owned | Where-Object { $_.CommandLine -like '*--utility-sub-type=node.mojom.NodeService*' })
  if ($hosts.Count -ne $CodexProcessIds.Count) { throw 'Unexpected session-host count' }
  if (@($owned | Where-Object { $_.CommandLine -like '*--type=renderer*' }).Count -eq 0) { throw 'No live renderer' }
  $parts = @($owned | ForEach-Object {
    [pscustomobject]@{
      ProcessId = [int]$_.ProcessId
      ParentProcessId = [int]$_.ParentProcessId
      Name = $_.Name
      Created = $_.CreationDate.ToString('o')
      CpuMs = ([double]$_.KernelModeTime + [double]$_.UserModeTime) / 10000
      WorkingSetMiB = [double]$_.WorkingSetSize / 1MB
      PrivateCommitMiB = [double]$_.PrivatePageCount / 1MB
    }
  })
  [pscustomobject]@{
    RecordedAt = [DateTimeOffset]::Now.ToString('o')
    CpuMs = ($parts | Measure-Object CpuMs -Sum).Sum
    WorkingSetMiB = ($parts | Measure-Object WorkingSetMiB -Sum).Sum
    PrivateCommitMiB = ($parts | Measure-Object PrivateCommitMiB -Sum).Sum
    Identity = (($parts | Sort-Object ProcessId | ForEach-Object { "$($_.ProcessId):$($_.Created)" }) -join ',')
    Processes = $parts
  }
}
$samples = @()
$before = Get-InstalledSnapshot
$initial = $before
$startedAt = [DateTimeOffset]::Now.ToString('o')
for ($index = 0; $index -lt $WindowCount; $index++) {
  $clock = [Diagnostics.Stopwatch]::StartNew()
  Start-Sleep -Seconds $SampleIntervalSeconds
  $after = Get-InstalledSnapshot
  $clock.Stop()
  if ($before.Identity -ne $after.Identity) { throw 'Process family changed during observation; no acceptance verdict recorded' }
  $samples += [pscustomobject]@{
    CpuPercentOneCore = 100 * ($after.CpuMs - $before.CpuMs) / $clock.Elapsed.TotalMilliseconds
    WindowMs = $clock.Elapsed.TotalMilliseconds
    Snapshot = $after
  }
  $before = $after
  if (($index + 1) % 12 -eq 0 -or $index + 1 -eq $WindowCount) {
    Write-Output "Completed idle measurement window $($index + 1)/$WindowCount"
  }
}
$sorted = @($samples.CpuPercentOneCore | Sort-Object)
$middle = [int][Math]::Floor($sorted.Count / 2)
$median = if ($sorted.Count % 2 -eq 0) { ($sorted[$middle - 1] + $sorted[$middle]) / 2 } else { $sorted[$middle] }
$peak = (@($initial.WorkingSetMiB) + @($samples | ForEach-Object { $_.Snapshot.WorkingSetMiB }) | Measure-Object -Maximum).Maximum
$report = [pscustomobject]@{
  CandidateKind = $(if($PackagedCandidate){'packaged-x64'}else{'installed-x64'})
  StartedAt = $startedAt
  CompletedAt = [DateTimeOffset]::Now.ToString('o')
  RuntimeCommit = $RuntimeCommit
  WindowCount = $WindowCount
  SampleIntervalSeconds = $SampleIntervalSeconds
  FixtureSimulation = [bool]$FixtureExecutablePath
  FixtureExecutableSha256 = $(if ($FixtureExecutablePath) { (Get-FileHash -LiteralPath $FixtureExecutablePath -Algorithm SHA256).Hash } else { $null })
  DurationSeconds = ($samples | Measure-Object WindowMs -Sum).Sum / 1000
  AsarSha256 = (Get-FileHash -LiteralPath (Join-Path (Split-Path $expectedExe) 'resources/app.asar') -Algorithm SHA256).Hash
  PrivateCommitNote = 'CIM PrivatePageCount is private committed memory, not unique resident RAM; supplementary only.'
  ExecutableSha256 = (Get-FileHash -LiteralPath $expectedExe -Algorithm SHA256).Hash
  InspectionClient = 'Operator must disconnect UI automation and profilers before running this observer; no accessibility setting is changed.'
  RootProcessId = $RootProcessId
  CodexProcessIds = $CodexProcessIds
  Scope = 'Exact candidate app and all recursively discovered descendants, including providers and helpers. CandidateKind distinguishes installed from packaged evidence. No working-set trimming or process exclusions. This script starts or stops no process and submits no input.'
  MedianCpuPercentOneCore = $median
  PeakWorkingSetMiB = $peak
  CpuObservationAtLeast60Seconds = (($samples | Measure-Object WindowMs -Sum).Sum -ge 60000)
  CpuBudgetPassed = $(if (($samples | Measure-Object WindowMs -Sum).Sum -ge 60000) { $median -le 1 } else { $null })
  MemoryBudgetMiB = $(if ($CodexProcessIds.Count -eq 0) { 250 } else { 700 })
  MemoryBudgetPassed = $peak -le $(if ($CodexProcessIds.Count -eq 0) { 250 } else { 700 })
  Initial = $initial
  Samples = $samples
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath
$report | Select-Object MedianCpuPercentOneCore,PeakWorkingSetMiB,CpuBudgetPassed,MemoryBudgetPassed | ConvertTo-Json
