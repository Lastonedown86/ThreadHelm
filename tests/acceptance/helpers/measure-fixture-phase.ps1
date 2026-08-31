# Read-only T173 phase capture. Run only after disconnecting UI inspection.
param(
  [Parameter(Mandatory=$true)][string]$RunRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^(baseline|cycle-[1-5]-(active|stopped)|final)$')][string]$Phase,
  [Parameter(Mandatory=$true)][string]$NodeExecutable,
  [Parameter(Mandatory=$true)][string]$RuntimeCommit,
  [ValidateRange(12,180)][int]$WindowCount=12
)
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$RunRoot=[IO.Path]::GetFullPath($RunRoot)
if((Split-Path $RunRoot) -ne (Join-Path $repoRoot 'tmp/us8') -or (Split-Path $RunRoot -Leaf) -notmatch '^t173-fixtures-[a-f0-9]+$'){throw 'Unexpected fixture root'}
$identity=Get-Content -Raw -LiteralPath (Join-Path $RunRoot 'identity.json') | ConvertFrom-Json
$launch=Get-Content -Raw -LiteralPath (Join-Path $RunRoot 'launch.json') | ConvertFrom-Json
$rootProcess=Get-Process -Id $launch.ProcessId
if($rootProcess.StartTime -ne [datetime]$launch.StartedAt -or $rootProcess.Path -ne $identity.Executable){throw 'Coordinator identity changed'}
if((Get-FileHash -LiteralPath $identity.Executable).Hash -ne $identity.ExecutableSha256 -or (Get-FileHash -LiteralPath (Join-Path (Split-Path $identity.Executable) 'resources/app.asar')).Hash -ne $identity.AsarSha256){throw 'Candidate bytes changed'}
& $NodeExecutable (Join-Path $PSScriptRoot 'capture-fixture-state.mjs') $RunRoot $Phase
if($LASTEXITCODE -ne 0){throw 'Lifecycle collection failed'}
$lifecycle=Get-Content -Raw -LiteralPath (Join-Path $RunRoot "$Phase-lifecycle.json") | ConvertFrom-Json
$active=@($lifecycle.sessions | Where-Object { $_.lifecycle_state -in @('starting','running','interrupting','stopping') })
$expected=if($Phase.EndsWith('-active')){4}else{0}
if($active.Count -ne $expected -or @($active | Where-Object lifecycle_state -ne 'running').Count){throw 'Unexpected live session state'}
if($Phase -match '^cycle-([1-5])-stopped$'){
  $cycle=$Matches[1]
  $previous=Get-Content -Raw -LiteralPath (Join-Path $RunRoot "cycle-$cycle-active-resource.json") | ConvertFrom-Json
  $baseline=Get-Content -Raw -LiteralPath (Join-Path $RunRoot 'baseline-resource.json') | ConvertFrom-Json
  $sessionProcesses=@($previous.Initial.Processes | Where-Object { $_.ProcessId -notin $baseline.Initial.Processes.ProcessId })
  $remaining=@(foreach($owned in $sessionProcesses){
    $live=Get-CimInstance Win32_Process -Filter "ProcessId=$($owned.ProcessId)"
    if($live -and $live.CreationDate -eq [datetime]$owned.Created){$owned}
  })
  if($sessionProcesses.Count -ne 12 -or $remaining.Count){throw 'Session process cleanup incomplete'}
  $ended=@($lifecycle.sessions | Where-Object { $_.id -in (Get-Content -Raw -LiteralPath (Join-Path $RunRoot "cycle-$cycle-active-lifecycle.json") | ConvertFrom-Json).sessions.Where({$_.lifecycle_state -eq 'running'}).id })
  if($ended.Count -ne 4 -or @($ended | Where-Object { $_.lifecycle_state -ne 'stopped' -or $_.stop_kind -ne 'clean' -or $_.exit_code -ne 0 }).Count){throw 'Session clean-stop evidence incomplete'}
  [ordered]@{Phase=$Phase;OwnedProcessCount=$sessionProcesses.Count;RemainingProcessCount=$remaining.Count;Processes=$sessionProcesses;Sessions=$ended} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $RunRoot "cycle-$cycle-cleanup.json")
}
$observer=@{
  RootProcessId=$launch.ProcessId;RuntimeCommit=$RuntimeCommit;WindowCount=$WindowCount
  ReportPath=(Join-Path $RunRoot "$Phase-resource.json");FixtureExecutablePath=$identity.FixtureExecutable
  CodexProcessIds=@($active | ForEach-Object {[int]$_.root_pid})
  PackagedCandidate=($identity.CandidateKind -eq 'packaged-x64')
}
& (Join-Path $PSScriptRoot 'measure-installed-idle.ps1') @observer
if($expected -eq 0 -and $Phase -ne 'baseline'){
  $measured=Get-Content -Raw -LiteralPath $observer.ReportPath | ConvertFrom-Json
  $baseline=Get-Content -Raw -LiteralPath (Join-Path $RunRoot 'baseline-resource.json') | ConvertFrom-Json
  if($measured.Initial.Identity -ne $baseline.Initial.Identity){throw 'No-session family differs from baseline; investigate before accepting'}
}
