# PaddleOCR 轻量服务（CPU 版）
# 构建时间较长（依赖体积大），镜像较大
# 依赖版本与 infra/ocr/setup_venv.ps1 的原生验证版一致（paddle 2.6 + numpy 1.x + protobuf 3.20）
FROM python:3.11-slim

WORKDIR /app

# 国内环境建议保留清华源加速
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple \
      numpy==1.26.4 protobuf==3.20.2 opencv-contrib-python-headless==4.9.0.80 \
      scipy==1.13.1 scikit-image==0.22.0 imgaug==0.4.0 shapely==2.0.4 \
      pyclipper==1.3.0.post5 lmdb==3.0.0 tqdm rapidfuzz pillow pyyaml \
      requests setuptools six httpx decorator astor opt-einsum==3.3.0 \
      fastapi uvicorn python-multipart \
 && pip install --no-cache-dir --no-deps -i https://pypi.tuna.tsinghua.edu.cn/simple \
      paddlepaddle==2.6.2 paddleocr==2.7.0.3

COPY app.py /app/app.py

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
