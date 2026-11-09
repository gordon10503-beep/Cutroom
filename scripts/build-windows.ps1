$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$encoder = (Get-Command ffmpeg.exe).Source
$probe = (Get-Command ffprobe.exe).Source
python -m PyInstaller --noconfirm --windowed --onedir --noupx --icon assets/cutroom.ico --name Cutroom --add-data "index.html;." --add-data "app.js;." --add-data "style.css;." --add-data "assets;assets" --add-binary "$encoder;bin" --add-binary "$probe;bin" desktop.py
if ($LASTEXITCODE -ne 0) { throw 'Windows build failed' }

