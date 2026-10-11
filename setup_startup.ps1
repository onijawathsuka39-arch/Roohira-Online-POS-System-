$startupPath = [Environment]::GetFolderPath('Startup')
$targetFile = Join-Path $startupPath "Roohira_POS_AutoStart.lnk"
$vbsPath = "C:\Users\User\Documents\File\Roohira Pos\POS Online\Start_Silent_Background.vbs"
$workDir = "C:\Users\User\Documents\File\Roohira Pos\POS Online"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($targetFile)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = $workDir
$shortcut.Description = "AutoStart Roohira POS Server and Ngrok Tunnel"
$shortcut.WindowStyle = 7
$shortcut.Save()

Write-Output "SUCCESS: AutoStart shortcut created at $targetFile"
