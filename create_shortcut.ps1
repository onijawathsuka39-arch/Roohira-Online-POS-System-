$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Ruhira POS.lnk')
$Shortcut.TargetPath = 'C:\Users\User\Documents\File\Roohira Pos\POS Online\Start_Ruhira_POS.bat'
$Shortcut.IconLocation = 'C:\Windows\System32\shell32.dll, 13'
$Shortcut.Description = 'Start Ruhira POS Server'
$Shortcut.Save()
Write-Host "Shortcut created on Desktop!"
