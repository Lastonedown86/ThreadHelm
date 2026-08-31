param([Parameter(Mandatory = $true)][string]$InstallRoot)
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
$processIds = @(Get-CimInstance Win32_Process | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
} | ForEach-Object { [int]$_.ProcessId })
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
if (Test-Path -LiteralPath $InstallRoot) {
    $rootEntries = @(Get-ChildItem -LiteralPath $InstallRoot -Force | Select-Object -ExpandProperty Name)
}
@{
    rootEntries = $rootEntries
    registrations = @($registrations | ForEach-Object { $_.key })
    registrationDetails = $registrations
    shortcuts = @($shortcuts | Sort-Object -Unique)
    processIds = $processIds
    credentialFiles = @($credentialFiles | Sort-Object -Unique)
    windows = @{ caption = (Get-CimInstance Win32_OperatingSystem).Caption; build = [Environment]::OSVersion.Version.ToString() }
} | ConvertTo-Json -Depth 6 -Compress
