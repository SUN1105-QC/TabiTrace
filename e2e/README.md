# 旅迹 E2E 测试

对真实运行的 web（Next.js）+ API（Spring Boot）+ MySQL 做端到端验证。只依赖 Node 20+ 和本机的 Chrome / Edge（通过 DevTools Protocol 驱动，不需要安装 Playwright）。

## 运行

```bash
cd frontend
npm run test:e2e                         # 默认套件：critical-path、auth-session、mobile-layout、images、trip-pro、storage
node ../e2e/run.mjs auth-session         # 只跑某个套件
node ../e2e/run.mjs public-smoke         # 仅公开只读检查，不需要测试账号
```

| 变量 | 说明 | 默认 |
|---|---|---|
| `E2E_WEB` | 网页地址 | `http://localhost:3000` |
| `E2E_API` | API 地址（含 `/api/v1`） | `http://localhost:8080/api/v1` |
| `E2E_EMAIL` / `E2E_PASSWORD` | 已有的**测试账号**（auth-session、mobile-layout、storage 使用；mobile-layout 需要该账号至少有一段旅行） | — |
| `E2E_TRIP_ID` | storage 使用的测试旅行（不填则新建并在结束时删除） | — |
| `E2E_MAILBOX_URL` | 测试邮箱（读取注册验证码） | `http://127.0.0.1:1080`（`backend/scripts/dev-mail-catcher.mjs`） |
| `E2E_BROWSER` | Chrome / Edge 可执行文件 | 自动查找 |
| `E2E_REPORT_DIR` | 把每个套件的结果写成 JSON | 不写 |

不要用真实用户账号；输出里不会打印密码、Cookie、令牌或验证码。

## 套件

| 套件 | 内容 |
|---|---|
| `public-smoke` | 无需登录的只读发布检查：公网页面、安全响应头、成就旧链接跳转、账号接口鉴权、公开限额，以及 360 / 1440 下的标题、溢出、成就残留与运行时错误；不发信、不提交表单、不修改用户数据 |
| `critical-path` | 注册（邮箱验证码）→ 登录 → 创建旅行（真实页面）→ 快速打卡（含照片）→ 照片墙上传 → 修改设置 → 退出，并验证服务端数据与会话吊销 |
| `auth-session` | 访问令牌只在内存、refresh 只在 HttpOnly Cookie；刷新页面、多标签页并发刷新、令牌过期重试、会话吊销、没有无限刷新、未登录拦截、跨标签页退出、CSRF |
| `mobile-layout` | 14 个主要页面在 360 / 390 / 430 / 768 / 1440 下无横向溢出、底部内容不被底部导航遮挡；快速打卡底部弹层不超出屏幕 |
| `trip-pro` | Trip Pro 页面：未登录 / 免费旅行 / 模拟支付升级 / 买断终身 Pro 四种状态下的按钮与文案、成果标签（点击与方向键）、成果入口带 `?mode=` 打开分享页、`#pr-lifetime` 锚点、底部购买条出现时机。真实支付环境下跳过付款步骤（需要测试邮箱） |
| `images` | 图片清晰度与下载量：头像小图（导航栏用小图、更换后旧文件删除）、照片墙三档 srcset 且普通屏不下载原图、首页被 CSS 隐藏的 Hero 不下载、推荐探索各屏幕像素够用且小卡不下载大档、公共首页产品截图 1 倍 / 高清档选择。自带注册与演示旅行（需要测试邮箱） |
| `storage` | 对象存储（R2 或本地存储）：预签名、真实 JPG / PNG 上传与访问、元数据、20MB 上限（正好 / 超出 / 接近上限的真实上传）、删除后 404。对接真实 R2 时 API 以 `STORAGE_MODE=r2` 和测试桶启动，另外校验签名有效期与签入的 Content-Length |
| `email` | Resend 请求契约与失败处理：脚本启动模拟 Resend（127.0.0.1:1090），API 需以 `MAIL_PROVIDER=resend RESEND_BASE_URL=http://127.0.0.1:1090 RESEND_API_KEY=<任意测试值> APP_PUBLIC_URL=<正式域名>` 启动。`E2E_EMAIL_MODE=live E2E_INBOX=<真实邮箱>` 时改为真实发信，收件结果人工确认 |

## 测试图片与工具

- `fixtures/`：上传用的真实 JPG（与前端公开图片分开，清理 `frontend/public/images` 里的旧图不影响测试）。
- `tools/landing-demo.mjs`：演示旅行「东京三日散步」（3 天、9 个计划地点、7 次打卡、8 张照片），照片来自 `frontend/public/images/explore/hd/2560`，按网页上传流程生成原图 / 中图 / 缩略图。`images` 套件和下面的截图工具都用它。
- `tools/capture-landing.mjs`：重新截取公共首页的产品截图（1440 宽、2 倍屏；输出 `frontend/public/images/landing/<name>.webp` 与高清档），用法 `cd frontend && npm run images:landing [-- 名称…]`。截完把输出的尺寸更新到 `components/landing/landingDemo.ts`。

## 测试适配

- 验证码邮件：本地 / CI 使用 SMTP 收件器（`dev-mail-catcher.mjs`）或模拟 Resend；生产的 `MailService` 不做任何替换。
- 自动化测试不在浏览器表单里输入密码：注册、登录走真实 API，浏览器只通过 HttpOnly refresh Cookie 建立会话。

## 清理

`critical-path`、`images`、`trip-pro` 和截图工具结束时删除它们创建的旅行（连同照片对象）。注册的账号是 `tt-e2e-*@example.test`（`images` 为 `tt-e2e-img-*`，`trip-pro` 为 `tt-e2e-pro-*`）和 `tt-landing-*@example.test`；账号注销有 7 天冷静期，本地开发库可以直接执行：

```sql
DELETE FROM email_verifications WHERE email LIKE 'tt-e2e-%@example.test' OR email LIKE 'tt-landing-%@example.test';
DELETE FROM users WHERE email LIKE 'tt-e2e-%@example.test' OR email LIKE 'tt-landing-%@example.test';   -- 旅行、打卡、照片记录随外键级联删除
```

头像文件在本地存储的 `users/<id>/avatar/` 下，删除账号记录后可以一并删掉对应目录。

推荐探索 V2 只读验收：在本地前后端启动后运行 node e2e/tools/check-explore-directory.mjs。覆盖六种屏宽、真实目录筛选、错误/权限/弱网/空目录、120 城市与封面回退；测试数据只注入浏览器，不写入业务库。截图与日志位于 backend/.tabitrace/。

设置标签导航回归：node e2e/tools/check-settings-navigation.mjs；PROFILE_TEST_WEB 可指定线上地址。通过浏览器内虚拟账户验证36项点击/草稿/刷新/返回行为，不操作真实用户数据。

打卡记录导出回归：`node e2e/tools/check-checkin-export.mjs`；`CHECKIN_EXPORT_WEB` 可指定测试前端（默认 `http://127.0.0.1:3000`），`CHECKIN_EXPORT_OUTPUT` 可指定结果目录。只需启动前端，账户及 API 响应均注入测试浏览器，不读取或写入真实用户数据。每种地图模式覆盖 37 项：四种文件格式、地图页与记录顺序、日期与坐标回退、可取消地图、无坐标状态、45 条完整记录、长笔记跨页、照片失败提示、归档及空旅行、桌面和手机对话框。默认禁用 WebGL 检查明确的示意图回退；设置 `CHECKIN_EXPORT_WEBGL=1` 使用软件 WebGL 检查真实底图导出（前端需配置可访问的地图服务）。样例、截图和报告默认保存到 `backend/.tabitrace/checkin-export-qa/`，PDF 样例使用 Poppler 渲染后检查地图署名、分页与中文。

布局与样式回归：`node e2e/tools/check-layout-regressions.mjs`；`LAYOUT_TEST_WEB` 指定测试前端（默认 `http://127.0.0.1:3015`），`LAYOUT_TEST_OUTPUT` 指定报告目录（默认 `backend/.tabitrace/layout-regression`）。只需启动前端，并保证公开方案/目录 GET 接口可用；本地可配置 `NEXT_PUBLIC_API_BASE_URL=/api/v1` 和 `API_INTERNAL_URL` 使用已有 API。登录标记、账户、旅行、打卡和照片响应仅注入浏览器，不操作真实账号。覆盖 125 项：六种屏宽的普通/200 字符旅行标题、Free 旅行的长标题升级按钮、实际点击平板导航和遮罩、横屏搜索行布局及末项可达性、窄屏 1/4/5/7 张照片换行和计数、空数据及前端运行错误。输出包含截图与 `report.json`。
