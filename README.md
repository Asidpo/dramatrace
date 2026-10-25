# 剧迹 DramaTrace

跨设备追剧记录软件：记录你在追的每一部剧（看到第几季第几集第几分钟、在哪个设备看的），数据自托管同步，手机与网页随时续看。

- 后端：[PocketBase](https://pocketbase.io)（单二进制自托管，SQLite 存储，实时同步）
- 客户端：Web（PWA，适配电视浏览器）+ Android（Capacitor）
- 自动记录：截图 OCR 生成建议记录，人工审核确认（插件框架预留 Jellyfin/Plex/Emby webhook）
- 剧集信息：TMDB 搜索补全（内置国内镜像，可配置自备 API Key）
- 数据安全：手动编辑的进度受保护，自动记录冲突需人工审核，所有变更留审计流水
- 许可证：MIT

## 仓库结构

```
dramatrace/
├── apps/
│   └── web/                  # React + Vite + TS 前端（Capacitor 打包 Android）
├── infra/
│   ├── docker-compose.yml        # 一键部署：PocketBase + 前端静态托管
│   ├── docker-compose.ocr.yml    # 可选：自托管 PaddleOCR 服务
│   ├── pocketbase/               # 数据目录 + 迁移 + 服务端规则钩子
│   ├── ocr/                      # PaddleOCR 轻量服务（FastAPI）
│   └── scripts/                  # 后端冒烟测试等脚本
├── docs/                     # 需求说明、设计方案
├── LICENSE                   # MIT
└── README.md
```

## 快速开始（本地开发，无需 Docker）

1. 启动后端（PocketBase）：

```powershell
cd infra\pocketbase
$env:PB_ADMIN_EMAIL='admin@dramatrace.local'; $env:PB_ADMIN_PASSWORD='changeme123'
.\pocketbase.exe serve --http=127.0.0.1:8090 --dir=pb_data
```

2. 启动前端（Vite dev，自带 /api 代理）：

```powershell
cd apps\web
pnpm install
pnpm dev   # http://localhost:5173
```

3. 浏览器打开 http://localhost:5173，用上面的管理员账号登录。

后端自检：`pwsh infra\scripts\api_smoke.ps1`（11 项冒烟测试）。
OCR 服务逻辑自检（stub 引擎，无需安装 PaddleOCR）：`python infra\scripts\ocr_service_test.py`（4 项）。
Compose 文件校验：`python infra\scripts\check_compose.py infra\docker-compose.yml infra\docker-compose.ocr.yml`。

CI：`.github/workflows/ci.yml` 在每次 push/PR 时自动跑前端构建、OCR 逻辑测试与后端冒烟测试。

## 生产部署（Docker Compose，一键）

```bash
cd infra
export PB_ADMIN_EMAIL=你的邮箱 PB_ADMIN_PASSWORD=你的密码
docker compose up -d            # 网页 http://<服务器IP>:8080
docker compose -f docker-compose.ocr.yml up -d   # 可选：OCR 服务（约 5GB 镜像）
```

网页 Nginx 已将 `/api` 反代到 PocketBase，手机/电视浏览器直接访问 8080 端口即可。
首次使用在「设置」页把服务器地址填成 `http://<服务器IP>:8080`。

## Android 打包（需 Android Studio / JDK 17 + Android SDK）

```bash
cd apps/web
pnpm build                      # 重新构建前端产物
pnpm cap:sync                   # 同步到 android/
pnpm android:open               # 用 Android Studio 打开并构建 APK
```

在手机端登录前，先在「设置」页填写服务器的局域网/公网完整地址。

## 自动记录（截图 OCR）

1. 部署 OCR 服务（见上文 docker-compose.ocr.yml），在「设置」页填 OCR 地址（默认 `http://<服务器IP>:8091`）。
2. 追剧时截取含播放器进度条的画面 → 「追剧」页上传截图 → OCR 解析出剧名/集数/时间 → 生成待审核建议。
3. 在「待审核」页确认 / 合并 / 忽略；与手动记录冲突时以手动为准，直接覆盖会被服务端拒绝。

插件框架：`pending_records` 集合即标准建议入口，未来可接入 Jellyfin/Plex/Emby webhook、通知栏解析、Trakt/CSV 导入。

## 数据模型

- `shows` — 剧集（标题、TMDB 编号、季/集总数、海报）
- `progress` — 观看进度（唯一约束：剧 + 季 + 集；含第几分钟、设备、是否看完、备注、来源、手动标记）
- `pending_records` — 自动记录建议（待审核：pending / confirmed / merged / ignored）
- `history_log` — 进度变更审计流水（服务端钩子自动写入）

服务端规则（`infra/pocketbase/pb_hooks/main.pb.js`）：

- `manually_edited` 一旦为 true 不可被清除；
- 自动记录确认前校验目标进度未被手动编辑，否则拒绝并要求人工合并；
- 每次进度创建/更新自动写 `history_log`。

## 发布到 GitHub

```bash
git init && git add -A && git commit -m "init: 剧迹 DramaTrace"
git remote add origin https://github.com/<你的用户名>/dramatrace.git
git branch -M main && git push -u origin main
```

仓库已按 MIT 开源准备就绪（LICENSE、README、.gitignore 齐备）。

## 文档

- docs/需求说明.txt — 原始需求全文
- docs/设计方案.md — 方案与开发计划（已确认定稿）
