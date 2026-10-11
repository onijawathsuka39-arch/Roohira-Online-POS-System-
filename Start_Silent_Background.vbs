Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\User\Documents\File\Roohira Pos\POS Online"

' Check if node server.js is already running, if not start it silently
WshShell.Run "cmd /c powershell -Command ""if (-not (Get-Process -Name node -ErrorAction SilentlyContinue)) { Start-Process node -ArgumentList 'server.js' -WindowStyle Hidden }""", 0, False

' Wait 2 seconds
WScript.Sleep 2000

' Check if ngrok is already running, if not start it silently
WshShell.Run "cmd /c powershell -Command ""if (-not (Get-Process -Name ngrok -ErrorAction SilentlyContinue)) { Start-Process .\ngrok.exe -ArgumentList 'http --domain=distant-oxygen-vice.ngrok-free.dev 3005' -WindowStyle Hidden }""", 0, False
