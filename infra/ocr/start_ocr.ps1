# 启动剧迹 OCR 服务（监听 http://0.0.0.0:8000，手机可通过局域网 IP 访问，如 http://192.168.x.x:8000）
$ocrDir = Split-Path -Parent $MyInvocation.MyCommand.Path
# 把 HOME 重定向到本地目录：paddle 默认把模型缓存写到 C:\Users\<你>\.cache 与 ~/.paddleocr，
# 部分机器上该目录存在权限问题，统一收到项目内更稳
$env:USERPROFILE      = Join-Path $ocrDir 'home'
$env:HOME             = $env:USERPROFILE
$env:PYTHONIOENCODING = 'utf-8'
Set-Location $ocrDir
& (Join-Path $ocrDir '.venv\Scripts\python.exe') -m uvicorn app:app --host 0.0.0.0 --port 8000
