param(
    [string]$TargetDir = "$env:LOCALAPPDATA\Programs\diriddle-admin"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$SourceDir = "$ProjectRoot\apps\admin\dist-electron\win-unpacked"

if (-not (Test-Path "$SourceDir\diriddle-admin.exe")) {
    Write-Host "[!] diriddle-admin.exe not found. Building package first..." -ForegroundColor Yellow
    Push-Location "$ProjectRoot\apps\admin"
    npx electron-builder --win --dir
    Pop-Location
}

if (-not (Test-Path "$SourceDir\diriddle-admin.exe")) {
    Write-Error "Failed to locate diriddle-admin.exe in $SourceDir"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Installing diriddle Admin Command Center for Windows    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Create target installation directory
Write-Host "[1/3] Copying application binaries to $TargetDir..." -ForegroundColor Gray
if (Test-Path $TargetDir) {
    Remove-Item -Path $TargetDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
Copy-Item -Path "$SourceDir\*" -Destination $TargetDir -Recurse -Force

# 2. Create Desktop Shortcut
Write-Host "[2/3] Creating Desktop shortcut..." -ForegroundColor Gray
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$DesktopShortcut = $WshShell.CreateShortcut("$DesktopPath\diriddle Admin.lnk")
$DesktopShortcut.TargetPath = "$TargetDir\diriddle-admin.exe"
$DesktopShortcut.WorkingDirectory = $TargetDir
$DesktopShortcut.Description = "diriddle Admin Command Center"
$DesktopShortcut.Save()

# 3. Create Start Menu Shortcut
Write-Host "[3/3] Creating Start Menu shortcut..." -ForegroundColor Gray
$StartMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$StartShortcut = $WshShell.CreateShortcut("$StartMenuPath\diriddle Admin.lnk")
$StartShortcut.TargetPath = "$TargetDir\diriddle-admin.exe"
$StartShortcut.WorkingDirectory = $TargetDir
$StartShortcut.Description = "diriddle Admin Command Center"
$StartShortcut.Save()

Write-Host "`n[SUCCESS] diriddle Admin Command Center installed successfully!" -ForegroundColor Green
Write-Host "• Application: $TargetDir\diriddle-admin.exe" -ForegroundColor White
Write-Host "• Desktop Shortcut: $DesktopPath\diriddle Admin.lnk" -ForegroundColor White
Write-Host "• Start Menu: Available in Windows Start Menu as 'diriddle Admin'" -ForegroundColor White
