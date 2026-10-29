# TabiTrace Frontend

旅迹 TabiTrace 前端：Next.js 16.3.3（App Router）、React 19.2、TypeScript 5.7（strict）、Tailwind CSS 3.4、MapLibre GL 6 / Leaflet、html-to-image。

> ⚠ 这一版 Next.js 有不兼容改动，写代码前先读 [AGENTS.md](AGENTS.md)。

设计文档在仓库根目录的 `docs/`：
- 前端架构、目录、状态管理、API Client：[docs/05_frontend/01_前端架构设计.md](../docs/05_frontend/01_前端架构设计.md)
- 路由与页面：[docs/05_frontend/02_前端路由与页面.md](../docs/05_frontend/02_前端路由与页面.md)
- UI 规范与核心组件：[UI_UX 设计规范](../docs/05_frontend/03_UI_UX设计规范.md)、[组件设计](../docs/05_frontend/04_组件设计.md)
- 开发规范：[docs/10_development/01_开发规范.md](../docs/10_development/01_开发规范.md)

## 命令

```bash
npm install
npm run dev                  # http://localhost:3000（默认直连 http://localhost:8080/api/v1）
npm run typecheck
npm run lint
npm run test                 # Vitest 单元测试
APP_URL=https://tabitrace.example npm run build    # 生产构建必须提供 https 的 APP_URL
npm run check                # typecheck + lint + test + build（生产构建默认 Webpack）
npm run build:turbo          # 显式使用 Turbopack 排查，不用于当前默认发布路径
npm run test:e2e             # 端到端测试（需要整套服务在运行，见 ../e2e/README.md）
npm run images:optimize      # 生成官方景点图四档 WebP
npm run images:audit         # 全站图片审计（输出 docs/image-audit.json）
npm run images:landing       # 重新截取公共首页产品截图
```

- 环境变量见 [.env.local.example](.env.local.example)；`NEXT_PUBLIC_*` 会进入浏览器代码，只能放公开值。
- 生产构建默认使用 Webpack，规避当前本机 Turbopack 的 CSS 子进程异常；开发模式仍为 Next.js 默认开发服务器。按此版本 CLI 文档，开发产物在 `.next/dev`，生产产物在 `.next`。
