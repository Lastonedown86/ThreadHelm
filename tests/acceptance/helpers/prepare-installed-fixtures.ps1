# Creates and launches a private acceptance profile; never changes the owner profile or install.
param([switch]$PrepareOnly, [string]$PreparedRoot, [switch]$PackagedCandidate)
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$runRoot=if($PreparedRoot){[IO.Path]::GetFullPath($PreparedRoot)}else{Join-Path $repoRoot ('tmp/us8/t173-fixtures-' + [guid]::NewGuid().ToString('N'))}
if(-not $runRoot.StartsWith((Join-Path $repoRoot 'tmp/us8/t173-fixtures-'),[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture root outside acceptance scratch area'}
$fixtureBin=Join-Path $runRoot 't173-fixture-bin'
$installedExe=if($PackagedCandidate){Join-Path $repoRoot 'apps/desktop/release/ThreadHelm-win32-x64/ThreadHelm.exe'}else{Join-Path $env:LOCALAPPDATA 'Programs/@threadhelmdesktop/ThreadHelm.exe'}
if(-not $PreparedRoot){
foreach($relative in @('t173-fixture-bin','user-data','profile','profile/Desktop','local','roaming','temp','fixture-workspace-1','fixture-workspace-2','fixture-workspace-3','fixture-workspace-4')) {
  [void](New-Item -ItemType Directory -Path (Join-Path $runRoot $relative))
}
& rustc --edition 2021 -O (Join-Path $PSScriptRoot 'inert-terminal-fixture.rs') -o (Join-Path $fixtureBin 'codex.exe')
if($LASTEXITCODE -ne 0){throw 'Fixture compilation failed'}
$identity=[ordered]@{
  RunRoot=$runRoot; Executable=$installedExe; FixtureExecutable=(Join-Path $fixtureBin 'codex.exe')
  CandidateKind=$(if($PackagedCandidate){'packaged-x64'}else{'installed-x64'})
  ExecutableSha256=(Get-FileHash -LiteralPath $installedExe).Hash
  AsarSha256=(Get-FileHash -LiteralPath (Join-Path (Split-Path $installedExe) 'resources/app.asar')).Hash
  FixtureSha256=(Get-FileHash -LiteralPath (Join-Path $fixtureBin 'codex.exe')).Hash
  ProductionAcceptance=$false; LiveProvider=$false; OwnerDataAccessIntended=$false
}
$identity | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runRoot 'identity.json')
$runRoot | Set-Content -LiteralPath (Join-Path $repoRoot 'tmp/us8/t173-fixture-root.txt')
}else{
  if(Test-Path -LiteralPath (Join-Path $runRoot 'launch.json')){throw 'Prepared profile already launched'}
  $identity=Get-Content -Raw -LiteralPath (Join-Path $runRoot 'identity.json') | ConvertFrom-Json
  if($installedExe -ne $identity.Executable){throw 'Prepared candidate path changed'}
  if((Get-FileHash -LiteralPath $installedExe).Hash -ne $identity.ExecutableSha256 -or
     (Get-FileHash -LiteralPath (Join-Path (Split-Path $installedExe) 'resources/app.asar')).Hash -ne $identity.AsarSha256 -or
     (Get-FileHash -LiteralPath (Join-Path $fixtureBin 'codex.exe')).Hash -ne $identity.FixtureSha256){throw 'Prepared candidate identity changed'}
}
if($PrepareOnly){Write-Output $runRoot;return}
$info=[Diagnostics.ProcessStartInfo]::new($installedExe)
$info.UseShellExecute=$false
$info.CreateNoWindow=$true
$info.WorkingDirectory=Join-Path $runRoot 'user-data'
$info.ArgumentList.Add('--user-data-dir=' + (Join-Path $runRoot 'user-data'))
$info.Environment.Clear()
foreach($key in @('SystemRoot','WINDIR','COMSPEC')) {
  $value=[Environment]::GetEnvironmentVariable($key)
  if($value){$info.Environment[$key]=$value}
}
$info.Environment['PATH']=$fixtureBin + ';' + (Join-Path $env:SystemRoot 'System32')
$info.Environment['USERPROFILE']=Join-Path $runRoot 'profile'
$info.Environment['LOCALAPPDATA']=Join-Path $runRoot 'local'
$info.Environment['APPDATA']=Join-Path $runRoot 'roaming'
$info.Environment['TEMP']=Join-Path $runRoot 'temp'
$info.Environment['TMP']=Join-Path $runRoot 'temp'
$process=[Diagnostics.Process]::Start($info)
[ordered]@{ProcessId=$process.Id;StartedAt=$process.StartTime.ToString('o');RunRoot=$runRoot} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runRoot 'launch.json')
Write-Output "Isolated fixture profile PID=$($process.Id) root=$runRoot"
$process.Dispose()
