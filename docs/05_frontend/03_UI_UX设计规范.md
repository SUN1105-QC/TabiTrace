# UI / UX 设计规范

视觉基线是「Warm Workspace」：暖白 / 米杏背景、橙棕主色、墨色标题、柔和卡片与轻阴影、旅行实景照片。规范从现有代码整理（`tailwind.config.ts`、`app/globals.css`），**新界面沿用，不另起一套**。

## 1. 颜色

⚠ 主题色目前有**两份定义，数值不一致**（技术债）：Tailwind 的 `warm` 是 `#E97A33`，CSS 变量 `--warm` 是 `#C56A3A`。新代码优先用 Tailwind 类，改主色前先统一两处。

| 用途 | Tailwind | CSS 变量 |
|---|---|---|
| 页面背景 | `canvas #FBF7F1` | `--canvas #FBF7F1` |
| 卡片 / 纸面 | `paper #FFFCF8` | `--paper #FFFCF8` |
| 正文与标题 | `ink #26221E` | `--ink #26221E` |
| 次要文字 | — | `--muted #7D746C` |
| 主色（按钮、强调） | `warm` / `vermilion #E97A33` | `--warm #C56A3A`、`--warm-dark #9F4F29` |
| 浅主色 | `orangeSoft #F5E4D2` | — |
| 沙色 / 分隔线 | `sand #E9DCCB` | `--sand #E9DCCB`、`--line #E8DED4` |
| 金色、灰绿 | `gold #C99A58`、`sage #6F8B78` | `--gold`、`--sage` |
| 雾白 | `mist #F4EFE8` | — |

## 2. 字体

- 正文：`Inter, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui`（`font-sans`）
- 标题：`Georgia, Noto Serif SC, Songti SC`（`font-serif`），大标题常配一行英文小标签（大写、字距宽、主色）

## 3. 阴影与圆角

- 阴影：`shadow-soft`（大卡片）、`shadow-card`（普通卡片）
- 常用主题类：`warm-card`（卡片）、`warm-button`（主按钮）、`st-btn`（设置页按钮）、`modal-backdrop` / `modal-panel`（对话框）

## 4. 布局与响应式

| 项目 | 规则 |
|---|---|
| 桌面外壳 | 固定侧栏 `--sidebar`：>1600 宽 248px、1366–1600 宽 216px、≤1365 宽 200px（`globals.css` 里另有一条 ≤1100 设 210px 的规则，因为写在前面被覆盖，实际不生效）+ 顶栏 `--topbar 78px` + 主工作区 |
| 页面宽度 | 统一用 `PageContainer`：`wide`（最大 2100px，超宽屏 2300px）、`medium`（1700px）、`narrow`（1200px），在工作区内居中 |
| 手机 | 单栏 + 底部导航；内容底部留出导航高度；弹层从底部出现且不超出屏幕 |
| 验证尺寸 | 360 / 390 / 430 / 768 / 1440 由 E2E 自动检查（无横向溢出、底部不被遮挡）；1366–3440 桌面宽度在 10-10 做过一次人工测量 |

## 5. 图片

- 卡片统一 `object-fit: cover`；竖拍或主体偏上的照片单独指定焦点。
- 只有首屏主图用 `fetchpriority="high"`，其余懒加载；加载失败统一换成占位图。
- 没有可信照片的官方地点用**文字封面**，不借用相似图片；没有封面的旅行用暖色渐变 + 目的地首字（`TripCoverImage`）。
- 官方景点图要署名时用 `ImageCredit`（地点详情、专题详情、`/credits`）。

## 6. 交互与反馈

| 场景 | 规则 |
|---|---|
| 确认 | 用 `ConfirmDialog`，Esc 或点遮罩等于取消，打开时聚焦第一个按钮 |
| Pro 限制 | 用行内提示（`VideoProGate`）说明限制并给出升级入口，不弹窗打断 |
| 会员功能 | 用 `MembershipGate`：未开通显示锁定卡片（不隐藏入口）；已到期只读提示 |
| 加载 | 首页等用骨架屏（`HomeSkeleton`）；请求超时 20 秒给出明确提示 |
| 空状态 | 给出下一步操作（如「新旅行」） |
| 错误 | 显示后端返回的中文 `message`；网络错误、超时、登录失效有统一文案 |
| 拿不到的自动信息 | 显示「暂未获取」，不填猜测值 |
