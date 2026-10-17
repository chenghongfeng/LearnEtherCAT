# EtherCAT 可视化学习站 —— 一键启动本地服务器
# 用法：右键“使用 PowerShell 运行”，或在终端执行 .\start.ps1
$ErrorActionPreference = 'Stop'
$port = 4173
$node = $null

# 1) 优先用 PATH 里的 node
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) { $node = $cmd.Source }

# 2) 退回 DSH 内置 node
if (-not $node) {
    $candidate = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\app.asar.unpacked\dsh\runtimes\node\bin\node.exe'
    if (Test-Path $candidate) { $node = $candidate }
}

if (-not $node) {
    Write-Host "未找到 Node.js。可以直接双击 index.html（离线也能用），或用任意静态服务器打开本目录。" -ForegroundColor Yellow
    exit 1
}

Write-Host "EtherCAT 可视化学习站" -ForegroundColor Cyan
Write-Host "启动本地服务器： http://127.0.0.1:$port/index.html" -ForegroundColor Green
Write-Host "按 Ctrl+C 停止。" -ForegroundColor DarkGray

Start-Process "http://127.0.0.1:$port/index.html" | Out-Null
& $node (Join-Path $PSScriptRoot '.tools\serve.mjs') $port
