# PaddleOCR 轻量服务（CPU 版）
# 构建时间较长（依赖体积大），镜像约 5GB
FROM python:3.11-slim

WORKDIR /app

# 国内环境建议保留清华源加速
RUN pip install --no-cache-dir paddlepaddle==3.1.1 -i https://pypi.tuna.tsinghua.edu.cn/simple \
 && pip install --no-cache-dir paddleocr fastapi uvicorn python-multipart pillow numpy opencv-python-headless -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY app.py /app/app.py

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
