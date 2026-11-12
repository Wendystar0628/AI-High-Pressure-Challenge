# 开发用：只结束命令行中含 nestos-dev 数据目录的本会话 Electron 进程（按 PID），重建映像并启动
param([string]$Data = "$env:TEMP\nestos-dev\data1", [int]$W = 1600, [int]$H = 940)
$procs = Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like '*nestos-dev*' -and $_.CommandLine -notlike '*--type=*' }
foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 800
Set-Location (Split-Path $PSScriptRoot -Parent)
node -e "import('./tools/build-image.mjs').then(m=>m.buildImages(process.cwd()))"
if ($LASTEXITCODE -ne 0) { exit 1 }
$log = "$env:TEMP\nestos-dev\electron.log"
$p = Start-Process -FilePath ".\node_modules\electron\dist\electron.exe" -ArgumentList @('.', '--data-dir', $Data, '--width', $W, '--height', $H, '--remote-debugging-port=19106') -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 500; try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:19106/json | Out-Null; break } catch {} }
Start-Sleep -Seconds 2
"started pid $($p.Id)"
