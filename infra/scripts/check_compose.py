"""compose 文件 YAML 校验（本地无 Docker 时的轻量检查）。"""
import sys

import yaml

for path in sys.argv[1:]:
    with open(path, encoding='utf-8') as f:
        doc = yaml.safe_load(f)
    assert isinstance(doc, dict) and 'services' in doc, path
    print(f'OK {path}: services={list(doc["services"])}')
