param([Parameter(Mandatory = $true)][string]$InstallRoot, [switch]$IncludeTree, [string]$HelperRoot)
$ErrorActionPreference = 'Stop'
$prefix = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\') + '\'
$registrations = @()
foreach ($registryRoot in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall', 'HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')) {
    if (Test-Path -LiteralPath $registryRoot) {
        foreach ($key in Get-ChildItem -LiteralPath $registryRoot) {
            $value = Get-ItemProperty -LiteralPath $key.PSPath
            if ($key.PSChildName -eq 'ThreadHelm' -or $value.DisplayName -eq 'ThreadHelm') {
                $registrations += @{ key = $key.Name; version = $value.DisplayVersion; uninstall = $value.UninstallString }
            }
        }
    }
}
$shortcuts = @()
foreach ($folder in @([Environment]::GetFolderPath('DesktopDirectory'), [Environment]::GetFolderPath('CommonDesktopDirectory'), [Environment]::GetFolderPath('Programs'))) {
    if ($folder -and (Test-Path -LiteralPath $folder)) {
        $shortcuts += @(Get-ChildItem -LiteralPath $folder -Filter '*ThreadHelm*.lnk' -File -Recurse | Select-Object -ExpandProperty FullName)
    }
}
$helperPrefix = if ($HelperRoot) { [IO.Path]::GetFullPath($HelperRoot).TrimEnd('\') + '\' } else { $null }
$helperProcesses = @()
$processIds = @()
foreach ($process in Get-CimInstance Win32_Process) {
    if (-not $process.ExecutablePath) { continue }
    $inInstall = $process.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
    $inHelper = $helperPrefix -and $process.ExecutablePath.StartsWith($helperPrefix, [StringComparison]::OrdinalIgnoreCase)
    if ($inInstall -or $inHelper) { $processIds += [int]$process.ProcessId }
    if ($inHelper) {
        $digest = $null
        try { $digest = (Get-FileHash -LiteralPath $process.ExecutablePath -Algorithm SHA256).Hash.ToLowerInvariant() } catch { }
        $helperProcesses += @{ processId = [int]$process.ProcessId; parentProcessId = [int]$process.ParentProcessId; createdAt = $process.CreationDate; sha256 = $digest }
    }
}
$credentialFiles = @()
# Electron's package name may be normalized differently by its platform runtime.
foreach ($name in @('ThreadHelm', '@threadhelm/desktop', 'threadhelm')) {
    $candidate = Join-Path ([Environment]::GetFolderPath('ApplicationData')) $name
    $sessionRoot = Join-Path $candidate 'coordination-sessions'
    if (Test-Path -LiteralPath $sessionRoot) {
        $credentialFiles += @(Get-ChildItem -LiteralPath $sessionRoot -Recurse -File | Select-Object -ExpandProperty FullName)
    }
}
$rootEntries = @()
$remainingEntries = @()
$remainingEntriesTruncated = $false
if (Test-Path -LiteralPath $InstallRoot) {
    $rootEntries = @(Get-ChildItem -LiteralPath $InstallRoot -Force | Select-Object -ExpandProperty Name)
    if ($IncludeTree) {
        $pending = [Collections.Generic.Queue[string]]::new()
        $pending.Enqueue([IO.Path]::GetFullPath($InstallRoot))
        while ($pending.Count -gt 0 -and -not $remainingEntriesTruncated) {
            $directory = $pending.Dequeue()
            foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
                if ($remainingEntries.Count -ge 256) { $remainingEntriesTruncated = $true; break }
                if (-not $entry.FullName.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'OBSERVATION_PATH_OUTSIDE_INSTALL' }
                $reparse = ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
                $kind = if ($reparse) { 'reparsePoint' } elseif ($entry.PSIsContainer) { 'directory' } else { 'file' }
                $remainingEntries += @{ relativePath = $entry.FullName.Substring($prefix.Length); type = $kind; bytes = $(if ($entry.PSIsContainer) { $null } else { $entry.Length }) }
                if ($entry.PSIsContainer -and -not $reparse) { $pending.Enqueue($entry.FullName) }
            }
        }
    }
}
@{
    rootEntries = $rootEntries
    remainingEntries = $remainingEntries
    remainingEntriesTruncated = $remainingEntriesTruncated
    registrations = @($registrations | ForEach-Object { $_.key })
    registrationDetails = $registrations
    shortcuts = @($shortcuts | Sort-Object -Unique)
    processIds = $processIds
    helperProcesses = $helperProcesses
    credentialFiles = @($credentialFiles | Sort-Object -Unique)
    windows = @{ caption = (Get-CimInstance Win32_OperatingSystem).Caption; build = [Environment]::OSVersion.Version.ToString() }
} | ConvertTo-Json -Depth 6 -Compress
