"""OCR 服务本地测试：用 stub 引擎验证 /ocr 解析逻辑（无需安装 PaddleOCR 5GB 依赖）。

用法：python infra/scripts/ocr_service_test.py
"""
import io
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, '..', 'ocr')))

# 用占位模块代替真实的 paddleocr（5GB 依赖），引擎实例由各用例注入
_paddle_stub = types.ModuleType('paddleocr')
_paddle_stub.PaddleOCR = type('PaddleOCR', (), {})  # 不会被实例化
sys.modules['paddleocr'] = _paddle_stub

import app as ocr_app
from fastapi.testclient import TestClient

# 用 PIL 生成真实可解码的小 PNG（app.py 会用 cv2/PIL 解码上传字节）
from PIL import Image

_buf = io.BytesIO()
Image.new('RGB', (8, 8), (0, 0, 0)).save(_buf, format='PNG')
PNG = _buf.getvalue()
client = TestClient(ocr_app.app)
passed = 0


def run_case(name, engine, expected_text, expected_lines):
    global passed
    ocr_app._engine = engine  # get_engine() 直接复用
    r = client.post('/ocr', files={'file': ('shot.png', PNG, 'image/png')})
    assert r.status_code == 200, f'{name}: HTTP {r.status_code} {r.text}'
    data = r.json()
    assert data['text'] == expected_text, f'{name}: text={data["text"]!r}'
    assert len(data['lines']) == expected_lines, f'{name}: lines={data["lines"]}'
    print(f'PASS  {name}')
    passed += 1


class Stub2x:
    """PaddleOCR 2.x 传统返回值风格：[[box, (text, conf)], ...]"""

    def ocr(self, img, cls=False):
        # 真实 2.x 返回 [页列表]，每页为 [[box, (text, conf)], ...]
        return [
            [
                [[[0, 0], [10, 0], [10, 10], [0, 10]], ('天行九歌 第12集', 0.99)],
                [[[0, 12], [10, 12], [10, 22], [0, 22]], ('00:23:45', 0.98)],
            ]
        ]

    def predict(self, img):  # pragma: no cover
        raise AssertionError('2.x 引擎不应走 predict')


class Stub3x:
    """PaddleOCR 3.x 风格：ocr() 带 cls 参数抛 TypeError → 回退 predict()"""

    def ocr(self, img, cls=False):
        raise TypeError("ocr() got an unexpected keyword argument 'cls'")

    def predict(self, img):
        return [{'rec_texts': ['凡人修仙传 第34集', '12:34'], 'rec_scores': [0.97, 0.96]}]


def main():
    r = client.get('/health')
    assert r.status_code == 200 and r.json()['ok'] is True
    print('PASS  /health')
    global passed
    passed += 1

    run_case('2.x 风格 ocr()', Stub2x(), '天行九歌 第12集\n00:23:45', 2)
    run_case('3.x 风格 predict() 回退', Stub3x(), '凡人修仙传 第34集\n12:34', 2)

    # parse_result 边界：空结果
    assert ocr_app.parse_result(None) == []
    assert ocr_app.parse_result([{}]) == []
    print('PASS  parse_result 空输入边界')
    passed += 1

    print(f'OCR service: {passed}/4 PASS')


if __name__ == '__main__':
    main()
