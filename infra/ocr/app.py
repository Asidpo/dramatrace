"""DramaTrace 截图 OCR 服务：POST /ocr 上传图片 → 返回识别文本行。

兼容 PaddleOCR 2.x（传统 .ocr() 返回值）与 3.x（.predict() 返回值）两种结构。
识别结果由客户端进一步解析（剧名/集数/进度）并生成"建议记录"，最终人工审核。
"""

import io

from fastapi import FastAPI, File, UploadFile
from paddleocr import PaddleOCR
from pydantic import BaseModel

app = FastAPI(title="DramaTrace OCR", version="0.1.0")

_engine = None


def get_engine() -> PaddleOCR:
    global _engine
    if _engine is None:
        # show_log=False 避免刷日志；use_angle_cls=False 对视频截图够用且更快
        _engine = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)
    return _engine


def parse_result(result) -> list[dict]:
    """把 PaddleOCR 的返回结果统一成 [{text, conf}]"""
    lines: list[dict] = []
    if not result:
        return lines
    for page in result:
        if isinstance(page, dict):
            # PaddleOCR 3.x predict() 风格
            texts = page.get("rec_texts") or []
            scores = page.get("rec_scores") or []
            for t, s in zip(texts, scores):
                lines.append({"text": str(t), "conf": float(s)})
        elif page:
            # PaddleOCR 2.x 传统风格: [box, (text, conf)]
            for item in page:
                try:
                    txt, conf = item[1]
                    lines.append({"text": str(txt), "conf": float(conf)})
                except Exception:
                    continue
    return lines


class OcrResponse(BaseModel):
    text: str
    lines: list[dict]


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/ocr", response_model=OcrResponse)
async def ocr(file: UploadFile = File(...)):
    data = await file.read()
    img = io.BytesIO(data)
    engine = get_engine()
    try:
        result = engine.ocr(img, cls=False)
    except TypeError:
        # 3.x 移除 cls 参数时走 predict
        result = engine.predict(img)
    lines = parse_result(result)
    return OcrResponse(text="\n".join(l["text"] for l in lines), lines=lines)
