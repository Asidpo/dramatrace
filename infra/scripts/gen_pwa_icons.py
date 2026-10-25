"""生成 PWA 图标（192/512 普通 + 512 maskable）。"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', 'apps', 'web', 'public'))

BG = (108, 92, 231)  # #6c5ce7
FONT_PATH = r'C:\Windows\Fonts\msyh.ttc'


def make(size: int, safe_zone: bool) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = size // 5
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)
    if safe_zone:
        glyph_size = int(size * 0.55)  # maskable 安全区
    else:
        glyph_size = int(size * 0.68)
    font = ImageFont.truetype(FONT_PATH, glyph_size)
    text = '剧'
    box = d.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), text, font=font, fill=(255, 255, 255, 255))
    return img


def main():
    make(192, False).save(os.path.join(OUT, 'icon-192.png'))
    make(512, False).save(os.path.join(OUT, 'icon-512.png'))
    make(512, True).save(os.path.join(OUT, 'icon-maskable-512.png'))
    print('icons written:', os.listdir(OUT))


if __name__ == '__main__':
    main()
