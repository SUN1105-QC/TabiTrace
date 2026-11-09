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

## 打卡记录导出

旅行的「地图与打卡」页提供「导出打卡记录」，支持整趟旅行或按日导出 PDF、PNG、JPG、CSV，可选择是否包含旅行地图和打卡照片。导出读取完整时间轴，保留同一地点的多次打卡，不受界面 30 条分页限制；已归档旅行仍可导出。

PDF 使用按需加载的 jsPDF，将浏览器绘制的中文页面封装为 A4 多页文档；PNG / JPG 按相同版式分别导出各页。长笔记和照片可跨页，失败照片有占位及提示。CSV 使用 UTF-8 BOM，保留地点、日期时间、区域、笔记、天气、温度及照片数量，并处理公式前缀。文件由浏览器生成，不增加后端接口或数据库迁移。

核心逻辑位于 `utils/checkin-export.ts`、`utils/export-checkins.ts`，入口组件为 `components/checkin/CheckinExportButton.tsx`。回归用法见 [E2E 说明](../e2e/README.md)。

PDF / PNG / JPG 默认在记录前加入旅行地图页，随所选日期筛选位置，地图编号与后续记录对应。优先使用打卡坐标，缺失时回退关联地点；无坐标记录仍保留文字。同一天相邻打卡以虚线表示顺序，不推测道路路线，不跨天或跨缺失坐标连线。地图复用当前配置的底图服务，通过独立 MapLibre 实例导出并保留署名与链接；无 WebGL、底图失败或超时时明确回退为坐标示意图，结束后释放资源。全部记录均无坐标时禁用地图选项；CSV 不包含地图。位置与投影逻辑见 `utils/checkin-map.ts`，绘图见 `utils/export-checkin-map.ts`。
