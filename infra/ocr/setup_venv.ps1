# 剧迹 DramaTrace 原生 OCR 环境一键安装（Windows，已验证 python 3.12.14）
# 用法: pwsh -File infra/ocr/setup_venv.ps1
# 注意: 需要 Python 3.12（3.13/3.14 无 paddlepaddle 2.6.2 对应 wheel，系统 python 版本不对请先装 3.12）
$ErrorActionPreference = 'Stop'
$ocrDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv   = Join-Path $ocrDir '.venv'
$py     = Join-Path $venv 'Scripts\python.exe'
$mirror = 'https://pypi.tuna.tsinghua.edu.cn/simple'

if (-not (Test-Path $py)) {
    python -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw '创建 venv 失败，请确认系统已安装 Python 3.12' }
}

# 依赖版本是实际调通验证过的组合：numpy 1.x 全家桶 + protobuf 3.20 匹配 paddle 2.6
# 全部 --no-cache-dir（pip 缓存在本机偶发卡死）+ 清华源
& $py -m pip install --no-cache-dir -i $mirror `
    numpy==1.26.4 protobuf==3.20.2 opencv-contrib-python==4.9.0.80 `
    scipy==1.13.1 scikit-image==0.22.0 imgaug==0.4.0 shapely==2.0.4 `
    pyclipper==1.3.0.post5 lmdb==3.0.0 tqdm rapidfuzz pillow pyyaml `
    requests setuptools six httpx decorator astor opt-einsum==3.3.0 `
    fastapi uvicorn python-multipart

# paddle 全家桶单独 --no-deps 装（避免 pip 解析器按最新版重装 numpy/protobuf 把环境打乱）
& $py -m pip install --no-cache-dir --no-deps -i $mirror `
    paddlepaddle==2.6.2 paddleocr==2.7.0.3

Write-Host ''
Write-Host 'OCR 环境安装完成。'
Write-Host '首次启动服务时会自动联网下载识别模型（约 15MB）到 infra\ocr\home\.paddleocr'
Write-Host '启动服务: pwsh -File infra/ocr/start_ocr.ps1'
