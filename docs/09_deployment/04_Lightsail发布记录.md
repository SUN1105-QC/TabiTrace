# 2026-10-26 · Lightsail 发布记录

## 2026-11-13 · 九宫格手机页、成品图导出、iOS 输入框放大修复上线（只更新 Web）

当前 Web 为 `fix-20261113-31cfd17a`（提交 `31cfd17`，CI 第 18 次运行通过）；API / Worker 仍运行 `speed-20261111-83c006db` 的镜像（已打同名新标签），指针已同步。

- 修复：九宫格 / 手帐素材列表在手机与平板宽度下溢出盖住预览；成品图导出前照片缩到所需像素再内嵌，WebKit 先预绘一次，长图在 iOS 上按画布面积上限降倍率；打卡记录导出兼容 iOS 16 以前；只在 iOS 上禁止输入框聚焦自动放大。
- 由 `git archive` 打包（SHA256 `c716213d…6c167849`，服务器校验一致），`deploy-fix-build.sh` 只构建 Web（`sha256:cb0403f6…`），`deploy-fix-switch.sh` 备份 `.env` 与镜像清单后只替换 Web，失败自动回退。没有迁移，数据库与 API / Worker 未重启。
- Web restart 为 0，公开页只读回归 133 / 133；已确认正式站页面带有 iOS viewport 脚本与新的素材列表样式。真机 Safari 导出效果待用户确认。
- 回退目标为 `home-20261112-9cc8ef50`。详见[验收报告](../08_testing/11_首页改版与导出修复验收_2026-11-13.md)。

## 2026-11-12 · 登录后首页改版上线（只更新 Web）

当前 Web 为 `home-20261112-9cc8ef50`（提交 `9cc8ef5`，CI 第 16 次运行通过）；API / Worker 继续运行 `speed-20261111-83c006db` 的镜像，已打上同名新标签，指针已同步。

- 只改前端首页：旅行横幅（状态、国家城市、天数/打卡/照片、城市线描插画）、带说明的快捷入口、日期卡「下一站」、图标式最近活动。没有迁移，数据库与 API / Worker 容器未重启。
- 由 `git archive` 打包（SHA256 `cbea9001…d4321305`，服务器校验一致）；`deploy-home-build.sh` 只构建 Web 镜像（`sha256:45fb07ad…`），`deploy-home-switch.sh` 先备份 `.env` 和镜像清单，再只替换 Web，失败自动回退。
- Web restart 为 0，公开页只读回归 133 / 133。登录后的首页需要用户在正式站自行查看；本地用测试数据核对过 1440 / 1024 / 390 宽度。
- 回退目标为 `speed-20261111-83c006db`。

## 2026-11-11 · 视频生成提速上线

当前 Web / API / Worker 均为 `speed-20261111-83c006db`（提交 `83c006d`，CI 第 14 次运行通过），指针已同步。

- 只有 Worker 逻辑变化：并行准备与绘制，分段导出。成片与旧版逐字节一致：发布前在新 Worker 镜像的 FFmpeg 8.0.1 上，用临时容器（限 1.5 CPU、无网络、合成测试图）对 6 组转场 × 风格逐帧比对，0 差异。
- 发布前排查到：旧 Worker 已被内核 OOM 杀掉 2 次（xfade 长链导出峰值 1.25～1.58GB，加上 JVM 超过容器 2GB）。新导出峰值降到 0.67～0.98GB，绘制阶段不再同时持有全部原图。
- 备份 `shared/backups/20261111T135031Z-before-speed-20261111-83c006db.sql.gz`（39881 字节，校验通过），确认没有进行中的视频任务后才切换；无迁移。三容器 restart 为 0，Worker 启动自检通过，公开页 133 / 133。
- 回退目标为 `open-access-20261111-c32b709b`。详见[验收报告](../08_testing/10_视频生成提速验收_2026-11-11.md)。

## 2026-11-11 · 全部付费功能免费开放上线

当前 Web / API / Worker 均为 `open-access-20261111-c32b709b`（提交 `c32b709`，CI 第 12 次运行通过），指针已同步。

- 发布前备份 `shared/backups/20261111T044006Z-before-open-access-20261111-c32b709b.sql.gz`（38560 字节，校验通过），确认没有进行中的视频任务。没有迁移，仍为 V24。
- `PLANS_OPEN_ACCESS` 取 Compose 默认值 true，服务器 `.env` 没有改。API 启动日志为 `upgraded 1 FREE trips to PRO`；用户 1、旅行 1，切换前后一致。
- 三容器 restart 均为 0，切换后 30 分钟内 API、Worker 没有错误日志；MySQL 没有重启。公网只读回归 292 / 292（公开页 133、目录 108、新城市 51）。
- 第一次构建的 `open-access-20261111-737b6f58` 因 CI 失败没有切换上线，源码目录与镜像只作记录保留。回退目标为 `cities-20261110-233bcae8`：旧版不认识开关，旅行保持 PRO，会员恢复按记录判断。
- 详见[验收报告](../08_testing/09_全部功能免费开放验收_2026-11-11.md)；服务器日志 `releases/open-access-20261111-c32b709b.log`、`-switch.log`。

## 2026-11-10 · 首尔、香港、台北推荐探索上线（首次从 Git 提交发布）

正式地址 https://tabi.sunows.com 。当前 Web / API / Worker 均为 `cities-20261110-233bcae8`，MySQL 保持原实例，指针 `shared/current-release.txt` 已同步。

- **来源**：GitHub `main` 的提交 `233bcae8b76a133d36d4c3f02a11ed13d849f7a6`（CI 第 10 次运行通过），用 `git archive` 打包。包大小约 164MB，SHA256 `adc1680a94858c36bb9f633e2e397d12d4f982795d917ec4cd50ea85b4265ae3`，服务器校验一致。发布目录内的 `RELEASE_MANIFEST.json` 记录了提交、基线和迁移。
- **基线核对（P0-2 关闭）**：发布前对服务器 `releases/usability-20261108-v3` 逐文件取哈希，与提交比对。服务器上只有发布清单不在提交中。去掉换行符差异后共 47 个文件内容不同，全部是提交侧更新：新城市、主屏幕独立窗口、改成中文的代码注释，以及构建时会重新生成的 `next-env.d.ts`。没有线上改动被覆盖。
- **构建**：`deploy-cities-build.sh` 只解包和构建三个镜像，不动运行中的服务。镜像 ID：Web `sha256:51ddffc8…`，API `sha256:2a8ee6de…`，Worker `sha256:9fd49076…`。
- **数据库**：迁移前备份 `shared/backups/20261110T115419Z-before-cities-20261110-233bcae8.sql.gz`（27524 字节，0600，gzip 校验通过），同前缀的 `.env` 和 `.images.txt` 记录原配置与旧镜像。确认没有进行中的视频任务后切换。API 启动执行 V24，Flyway 当前版本 24；用户 1、旅行 1，迁移前后一致。
- **切换中的一次自动回退**：第一次切换已经成功（V24 执行完，API 与 Web 健康），但脚本末尾的统计查询把 `explore_city_entries` 不存在的 `status` 列写进了 SQL，触发脚本的失败回退，三容器回到 `usability-20261108-v3` / `security-20261107-2859ac69`。旧 API 在 V24 已执行的库上正常启动，验证了回退路径可用。修正查询后重新切换成功，前后约 1 分钟，期间站点一直可访问；但目录接口已显示三座新城市开放，旧 Web 还没有对应页面。第二次切换前多了一份备份 `20261110T115542Z-…`，那份已经是 V24 之后的数据。第一次的日志保留为 `releases/cities-20261110-233bcae8-switch-attempt1.log`。
- **结果**：目录为 3 个国家 / 6 座城市 / 4 座开放 / 120 个地点 / 24 条路线，中国主题内香港在台北前。四个城市各 30 个官方地点；大阪、京都仍为准备中。
- **运行状态**：四容器健康，Web / API / Worker 的 restart 均为 0，切换后 20 分钟内 API、Worker 日志没有 ERROR 或异常。MySQL 没有重启。Nginx、TLS、共享秘密配置都没有改。
- **公网只读验收 291 / 291**：
  - 公开页面 132（含三座新城市页）、探索目录 108、新城市浏览器 51（6 种屏宽、搜索、路线、加入旅行、收藏、深链接与署名、分享、登录回跳）。
  - 账户与写操作只在测试浏览器内模拟，真实请求全部是 GET；没有注册、发信或付款。
  - `/manifest.webmanifest` 为 200，主屏幕独立窗口随本次上线，真机效果还没验证。
- **回退**：`usability-20261108-v3`（Web）、`security-20261107-2859ac69`（API / Worker）的源码与镜像都保留。数据库若需回到 V23 之前，用 `20261110T115419Z` 那份备份；只回退应用不需要动数据库。

服务器日志 `releases/cities-20261110-233bcae8.log`（构建）、`-switch.log`（切换）；本地公网验收日志 `backend/.tabitrace/cities-production-*.log`。部署私钥只用于本次 SSH，没有复制进项目，也没有进入 Git。

## 2026-11-08 · 旅行工作台改版发布完成

正式地址 https://tabi.sunows.com 。当前Web和源码版本 `usability-20261108-v3`，指针 `shared/current-release.txt` 已同步。以服务器实际运行的 `security-20261107-2859ac69` 为基线，仅发布19个前端路径（含一份单元测试），保留此前安全和导出功能。

- 包SHA256：`cf6e30620d5e83dd9d51d757a05858aed4ee9e63ab8c61e8e42713ba818c8e51`；服务器检查前后文件哈希，Compose内容不变。未提交或推送Git。
- 当前旅行导航与切换、任务首页、手机地图视图、照片筛选、创建表单、九宫格计数和导出用途分组已上线；快捷打卡同步当前旅行，归档入口明确只读。详见[验收](../08_testing/07_旅行工作台改版验收_2026-11-08.md)。
- Linux生产构建和类型检查通过，前端99项单元测试通过，改动文件静态检查0 errors / 19现有warnings。独立预览先通过65项操作和125项布局检查后才切换Web。
- 公网 **464 / 464**：操作65、布局125、公开99、记录导出37、设置36、探索102。没有前端运行异常。登录及业务数据只注入浏览器，无真实业务写请求；四种格式实际下载成功，地图联合导出仍可用。
- Web健康、restart=0；API、Worker仍为 `security-20261107-2859ac69`，两者及MySQL的容器ID、镜像和启动时间均保持发布前值。共享配置、数据库、Nginx、TLS均未修改。
- Web容器ID `1db27d471eb4176e8bdc40dc9843091f31929ae3edcd2456709a1cba26bdd1bf`；镜像ID `sha256:5c3b474129d5d4dc990451c0090b32207b2bb31edc5e665342b8960c019738da`。旧安全版本源码和镜像保留，可以只回退Web。
- v1/v2为未上线构建迭代；最终独立预览、SSH隧道、临时私钥副本已清理。原私钥未修改。未验证真实注册、上传、打卡、扣款或视频渲染链路。

服务器构建日志 `releases/usability-20261108-v3.log`、切换日志同名 `-switch.log`，本地日志 `backend/.tabitrace/usability-production-*.log`；浏览器结果、截图和导出样例 `usability-production-qa/`。

## 2026-11-07 · 最新功能与安全修复整体发布完成

正式地址 https://tabi.sunows.com 。当前版本 security-20261107-2859ac69，Web/API/Worker 均使用同名镜像；MySQL 保持原实例。当前指针 shared/current-release.txt 已同步，源码位于 releases/security-20261107-2859ac69。原始快照 SHA256：2859ac699fabc59e88a88374230a45e180f764213144afa9770d24e538fdd7d9，771 个文件，服务器校验通过；RELEASE_MANIFEST.json 已保存。未提交或推送 Git。

- 整体包含当前已实现的导出、地图联合导出、布局、探索目录、设置页修复和安全更新。运行时已实际加载确认 Next.js 16.4.5、sharp 0.35.5。最新锁文件生产依赖扫描为 0；开发/测试依赖的14项通告仍在待办，不能称全依赖零风险。
- 首次 Linux npm ci 发现 @emnapi/core、@emnapi/runtime 1.11.3 缺项，构建中止且旧服务保持运行。已在独立 Linux Node22 容器生成修正锁文件并验证干净安装；原有包版本未改变，仅补齐依赖与元数据。修正锁文件同步本地后重新创建新快照，Linux 三镜像构建全部成功。首次失败的暂存目录 security-20261107-577911e0 保留作记录，未运行其中镜像。
- 数据库备份：shared/backups/20261107T001124Z-before-security-20261107-2859ac69.sql.gz，27193 字节、0600、gzip校验通过；同前缀 .env 与 .images.txt 记录原共享配置及实际旧镜像。旧 Web=layout-20261106-v1，API/Worker=explore-20261031-689fd547，旧目录和镜像均保留。
- 三镜像构建通过、Nginx覆盖转发头和API回环绑定检查通过、无活跃排队/渲染任务后才切换。持久化唯一非秘密配置 TRUST_PROXY_HEADERS=true，其余秘密配置保持。API/Web仅回环暴露，Nginx/TLS/防火墙未改。
- 修复音乐 PATCH 跨域预检：实际 API 预检200且Allow-Methods包含PATCH；恶意来源仍403。客户端IP畸形代理链回退也已发布。
- 运行时确认 COST_ENFORCE=true、账号每日20次/6000秒、全站同时3个任务。数据库验证23个迁移，当前V23且无需新增迁移；未清理业务数据或媒体对象。
- API/Web/MySQL健康，Worker启动成功，四容器restart=0。Worker保留了旧本地曲库目录不存在的兼容告警；用户上传音乐在R2模式使用独立下载分支，不据此断言上传音乐不可用。未执行真实用户视频渲染。
- 公网回归399/399通过：公开页面99、设置36、布局125、探索102、记录导出37；故障、账户与旅行数据只注入测试浏览器，无真实业务写请求。后台基线API247+Worker19、前端99、生产构建均已通过。
- 未启用Stripe、未真实扣款/退款、未发信或修改真实用户资料。条款页面、开发工具链风险、定时备份恢复和私有音乐桶策略等审计待办仍需后续处理。

服务器日志 releases/security-20261107-2859ac69.log；本地验收日志 backend/.tabitrace/security-production-*.log，JSON/截图/导出样例位于 backend/.tabitrace/security-release-qa/。回退应使用保存的三个实际旧镜像及旧配置，不覆盖迁移后业务数据，不执行 down -v。

## 2026-11-06 · 页面布局与样式修复上线

- 正式地址：https://tabi.sunows.com 。Web 及源码目录已更新为 `layout-20261106-v1`，服务器 `shared/current-release.txt` 已同步。
- 以现网 `map-export-20261105-v1` 为基线，逐文件核对后只发布 6 个布局相关前端文件与 2 个只读回归文件。修复平板遮罩盖住菜单、搜索结果样式失效、横屏弹窗裁切、长标题撑宽页面和时间轴多照片溢出；极长卡片标题限制行数并保留完整标题提示。
- 文件前后 SHA256 见 `RELEASE_MANIFEST.json`。发布包 SHA256：`02affbf83f34ae422e3c510dd62529a4a2b1b0b89ba3200ea0de30681da0cc74`。服务器校验包与文件哈希后完成 Linux Webpack 生产构建、TypeScript 检查，只切换 Web。
- Web 健康、重启计数 0。API、Worker、MySQL 的容器 ID、镜像 ID、启动时间均与发布前一致，未执行数据库迁移，也未改变共享配置。上一版 `map-export-20261105-v1` 源码与镜像保留可回退。
- 正式域名验收 **224/224 通过**：布局回归 125 项、公开页面检查 99 项。覆盖六种屏宽、普通/200 字符标题、Free 长标题升级按钮、平板导航实际坐标点击、横屏搜索末项、多照片换行与计数、空数据、公开页面安全响应头、旧链接跳转及匿名接口 401。无前端运行错误；业务数据仅在测试浏览器注入，未注册、发信、上传或执行真实购买。
- [布局修复验收](../08_testing/06_页面布局修复验收_2026-11-06.md) 含截图与测量。公网日志：`backend/.tabitrace/layout-production.log`、`layout-public-smoke.log`；完整截图和报告：`layout-production-qa/`、`layout-public-smoke-qa/`；服务器构建日志：`releases/layout-20261106-v1.log`，本机副本为 `backend/.tabitrace/layout-production-build.log`。

## 2026-11-05 · 旅行地图与打卡记录联合导出上线

- 正式地址：https://tabi.sunows.com 。当前 Web 版本及源码目录为 `map-export-20261105-v1`，`shared/current-release.txt` 已同步；入口为旅行「地图与打卡 → 导出打卡记录 → 包含旅行地图」。
- 基于生产 `checkin-export-20261104-v1`，发布 11 个相关文件。地图页仅增加关联地点参数；地图渲染、位置逻辑及回归脚本已固化，其他工作区改动没有带入。文件前后 SHA256 记录于 `RELEASE_MANIFEST.json`；发布包 SHA256 为 `7caca9f8fe23ecbe244e3ec471cb014f2abe29439e1624a5b57bcd730b988ca0`。
- PDF / PNG / JPG 默认先导出地图页，再导出编号对应的打卡记录；地图按所选日期筛选，保留底图署名及来源链接。可取消包含地图，CSV 仍为文字表格。无坐标记录保留文字，底图或 WebGL 不可用时明确生成位置示意图。
- 服务器 Linux Webpack 生产构建、TypeScript 和健康检查通过。仅切换 Web，API、Worker、MySQL 未重启，无数据库迁移；四个容器重启计数均为 0。旧 `checkin-export-20261104-v1` 源码与镜像保留，可回退。
- 正式域名浏览器验收：真实 WebGL 底图与无 WebGL 示意回退两种模式各 37 项，共 74 项通过、0 失败；覆盖地图页和记录顺序、按日范围、关联地点坐标回退、取消地图、四种文件下载、45 条完整记录、无坐标、失败照片和桌面/手机界面。无运行异常，无真实账户读写或业务 API 请求。
- 公网生成的 A4 PDF 分别为 2 页、5 页，全部 7 页已用 Poppler 渲染，PNG SHA256 与此前逐页视觉审核的最终本地样例完全一致。地图、署名链接、中文、续页及页码均保留。`/health`、首页、探索、登录为 200；匿名个人信息接口为 401。
- 回归脚本：`e2e/tools/check-checkin-export.mjs`；公网日志及报告：`backend/.tabitrace/map-export-production-webgl.log`、`map-export-production-fallback.log` 和同名 `-qa/` 目录；服务器构建日志：`releases/map-export-20261105-v1.log`。未执行真实账户注册、上传或视频链路。

## 2026-11-04 · 打卡记录多格式导出上线

- 正式地址：https://tabi.sunows.com 。当前 Web 版本和源码目录为 `checkin-export-20261104-v1`，`shared/current-release.txt` 已同步；入口为旅行「地图与打卡 → 导出打卡记录」。
- 以生产 `grid-20261104-v1` 为基线，只更新 11 个导出相关文件。地图页仅加入导出入口，未带入工作区其他改动；文件前后 SHA256 记录于 `RELEASE_MANIFEST.json`。发布包 SHA256：`febcad27c54d4b8d03ff4cc36e952dcbfed21e4d8050b66339d261bd2f9bd3f1`。
- 支持整趟或按日导出 PDF、PNG、JPG、CSV；可选择照片，长笔记与多张照片可跨页。完整读取时间轴，不受页面 30 条限制；归档旅行可导出，空记录禁用，失败照片保留占位并提示。
- 服务器 Linux 依赖安装、Webpack 生产构建及 TypeScript 检查通过。仅重建并切换 Web，API、Worker、MySQL 未重启，无迁移；旧 `grid-20261104-v1` 源码和镜像保留可回退。四个容器重启计数均为 0。
- 公网浏览器验收 27 项通过、0 失败，包括四种文件真实下载、日期筛选、45 条完整记录、长笔记多页 PDF、照片失败提示、桌面及手机对话框、焦点与 Esc、空记录和归档旅行。测试数据只注入浏览器，无真实账户读写或业务 API 请求。
- 线上生成的单日 PDF 为 1 页、长笔记 PDF 为 4 页，均为 A4，已使用 Poppler 渲染全部页面并检查中文、照片、续页标题与页码。`/health`、首页、探索、登录均 200；匿名个人信息接口仍 401。
- 验收脚本：`e2e/tools/check-checkin-export.mjs`；公网日志：`backend/.tabitrace/checkin-export-production.log`；报告、导出样例和截图：`backend/.tabitrace/checkin-export-qa/`；服务器构建日志：`releases/checkin-export-20261104-v1.log`。未执行真实账户上传和注册链路。

## 2026-11-04 · 九宫格照片布局上线

- 正式地址：https://tabi.sunows.com 。Web 已发布 `grid-20261104-v1`，源码位于 `/srv/sunows/apps/tabi/releases/grid-20261104-v1`，`shared/current-release.txt` 已同步。
- 基于线上 `profile-20261031-v2`，仅替换七个九宫格相关文件；全局样式仅应用本次九宫格差异，没有带入工作区其他改动。文件前后 SHA256 记录于 `RELEASE_MANIFEST.json`；补丁包 SHA256 为 `b8ae3513caaf9050f2b725a4362b2c425c86fb097a21b699fe86e1ff191de1c7`。
- 第 1、5、9 格改为照片位，标准九宫格支持九张照片。照片不足九张时保留空位，不重复照片，上传后自动补齐；预览与导出共用布局。
- 服务器 Linux 生产构建及 TypeScript 检查通过，前端切换后健康检查正常。仅更新 Web 容器；API、Worker、MySQL 未重启，无数据库迁移。旧源码及镜像保留，可切回 `profile-20261031-v2`。
- 公网浏览器验收 18 项通过、0 失败：八张照片保留一个空位、九张自动补齐、素材栏九格、第 1 / 5 / 9 格真实鼠标替换、整张 PNG 和九张独立正方形 PNG 导出、1440 / 390 屏宽布局、无运行异常。测试数据仅注入浏览器，没有读取真实账户或向业务 API 发出写请求。
- 浏览器验收脚本：`backend/.tabitrace/check-grid-production.mjs`；桌面及手机截图：`backend/.tabitrace/grid-production-1440.png`、`grid-production-390.png`；服务器构建日志：`releases/grid-20261104-v1.log`。未执行真实账户上传流程。

## 2026-10-31 · 设置栏目真实点击修复（v2）

Web 已发布 profile-20261031-v2，源码 releases/profile-20261031-v2；后端与数据库未重启、无迁移。

问题已在修复前用真实鼠标点击复现：标签改了地址但未切换选中态和内容。上一轮菜单回归漏测标签按钮。根因：向 replaceState 传入 window.history.state 含 Next.js 内部 __NA 标记，使框架跳过 useSearchParams 通知。改用当前安装版本官方文档的 replaceState(null, ...)；Next 自动复制内部历史状态，同时同步栏目。继续保留其他参数、草稿与未保存确认。

持久化回归脚本 e2e/tools/check-settings-navigation.mjs：桌面1440与手机390各17项，加无运行异常/无真实业务写请求，共36项，本地及公网最终均通过。覆盖六标签真实坐标点击、六组不同内容、左侧快捷入口、未保存取消/放弃、刷新及历史返回。手机点击等待滚动动画结束，避免坐标竞争；未删除或放宽断言。账户与响应数据仅在浏览器注入，不使用真实用户资料、不触发密码修改等写操作。

TypeScript 与服务器 Linux 生产构建通过；目标 ESLint 0错误、1个既有加载effect警告。生产Web健康，重启0。公网日志 backend/.tabitrace/settings-tabs-production.log；服务器日志 releases/profile-20261031-v2.log。

## 2026-10-31 · 账户菜单重复入口热修复

发布 profile-20261031-v1，仅更新 Web；API、Worker、数据库保持原运行版本，不执行迁移。源码位于 releases/profile-20261031-v1，以 explore-20261031-689fd547 为基线，差异及 SHA256 记录于 RELEASE_MANIFEST.json。

原两个菜单均指向 /profile，现改为「个人资料」→ /profile?tab=profile、「账户与安全」→ /profile?tab=security。设置栏目直接从 Next.js 查询参数读取，同页跳转及刷新均同步，保留未保存修改确认。菜单复用现有三语言设置标签，没有新增虚假的个人主页模块。

本地与公网各 8 项浏览器断言全部通过，使用浏览器内虚拟账户，无实际业务写请求。类型检查、Linux 生产构建通过；目标文件 ESLint 0 错误、2 个既有 effect 警告。Web 健康检查通过，旧镜像保留。日志 backend/.tabitrace/profile-navigation-production.log；服务器构建日志 releases/profile-20261031-v1.log。

## 2026-10-31 · 推荐探索 V2 与页面精简已上线

- 正式地址：https://tabi.sunows.com/explore 。发布标签 explore-20261031-689fd547，Web / API / Worker 均使用该标签；MySQL 保持既有容器和数据目录。
- 从已验证的本地工作区创建源码快照（762 个文件），排除环境文件、私钥、依赖、运行数据。SHA256：689fd54759111b2fd57766b619b4061e87fe81e83ca58f601526a7544e01c0b5，服务器校验通过。未提交或推送 Git。
- 源码与生产构建位于 /srv/sunows/apps/tabi/releases/explore-20261031-689fd547；旧 repository 保持原状，旧 f32c4aad053e 镜像保留供回退。当前版本指针 shared/current-release.txt。后续操作须使用当前发布目录及 RELEASE_TAG，不能直接从旧 repository 重建覆盖。
- 三个镜像先全部构建成功，再备份生产数据库。快照：/srv/sunows/apps/tabi/shared/backups/20261031T092542Z-before-explore-20261031-689fd547.sql.gz，gzip 校验通过；未清理任何卷、媒体或既有用户数据。
- API 启动完成 V23 兼容目录迁移。只新增国家主题、目录条目与城市预告；东京仍为唯一开放城市。公开统计为 3 个国家主题 / 5 座城市 / 1 座开放 / 30 个地点 / 6 条路线。
- 一并发布自带音乐入口和选择逻辑移除（保留自行上传与无音乐）、旅行总览/总结下线、相关入口与导航调整。历史媒体未删除。
- /trips/1、/trips/1/summary、/trips/1/achievements 均返回 308 → /trips/1/map；探索及东京页、公开目录、health 均为 200；匿名个人信息和付款接口仍为 401。
- 四个容器运行，API / Web / MySQL 健康，全部重启计数 0，Worker 运行并通过 Compose 启动检查。Nginx、TLS、防火墙和共享秘密配置未更改。
- 公网浏览器 102 项通过、0 失败：六种屏宽、筛选与深链接、错误/权限/弱网/空数据/大目录/坏图；无运行时异常，无业务写请求。异常与大目录只在浏览器内注入。
- 公开方案仍为 paymentsAvailable=false；Stripe 配置未改变。账号每日 20 次 / 6000 秒硬限制继续启用，全站同时 3 个任务的配置沿用。没有执行真实扣款、发信、账号创建或登录后的上传/渲染链路。
- 生产日志：/srv/sunows/apps/tabi/releases/explore-20261031-689fd547.log；本地公网验收日志 backend/.tabitrace/production-explore-browser.log。

## 2026-10-30 · 成就下线与费用功能合并发布完成

正式地址：https://tabi.sunows.com 。业务提交 f32c4aad053ed5e10b637bade3ef5bf1bd8e88f7，三个业务镜像标签均为 f32c4aad053e，发布前线上源码为 0a0d9d3、业务镜像为 b7a2e45。

- 移除全部产品成就入口、相关统计/总结/回忆/分享图/通知/视频展示、API 与解锁计算，开发模式同步移除。旧成就地址由 Next 路由层 308 跳到对应旅行；历史成就表与兼容字段保留，不清空历史数据。
- 同步发布支付订单、退款/争议同步与对账、账号用量与限额、V22 成片清理。受限服务器环境仅补充已确认的 COST_ENFORCE=true、每日 20 次 / 6000 秒、全站同时 3 个任务，其他秘密配置保留。
- 数据库迁移前快照：`/srv/sunows/apps/tabi/shared/backups/20261029T223026Z-before-f32c4aad053e.sql.gz`，24260 字节，0600，gzip 校验通过；环境配置也在该受限目录备份。Flyway V20、V21、V22 均成功，现有账号数量保持 1，验收时视频清理队列为空。
- API / Web / MySQL 健康检查通过，Worker 运行，四个容器重启计数均为 0；数据库与业务目录卷未清理，Nginx、TLS 与防火墙未更改。
- 公网 HTTPS：首页、探索、价格、登录、health 均 200；`/trips/1/achievements` 为 308 → `/trips/1`；未登录访问账号、用量、支付记录接口均 401。
- 公共方案接口与 API 容器运行时均确认限额已启用：20 / 6000 / 全站同时 3，Free 与 Pro 共用账号每日额度。原有每账号同时最多 2 个任务继续执行。
- 本地 API 215 项（含 MySQL 专项 16 项）、Worker 19 项、前端 67 项全部通过，生产构建完成，Lint 0 errors / 109 warnings。[GitHub Linux CI](https://github.com/SUN1105-QC/TabiTrace/actions/runs/40965625471) 前后端均通过。
- Stripe Secret / Webhook 尚未配置，方案接口明确 paymentsAvailable=false；没有启用生产 mock，没有执行扣款、退款或发送邮件。未创建测试账号或修改现有旅行、照片；真实登录后的完整业务链路仍由用户验收，旧版孤儿成片仍需存储清单核对。

本次用户明确授权使用的 Lightsail 私钥只用于 SSH，没有进入 Git；临时受限副本在验收后清理。下面为历史部署记录。

## 2026-10-27 · 已正式发布

网站地址：https://tabi.sunows.com 。公网 HTTP 自动 301 跳转 HTTPS，首页、登录、注册、找回密码、价格、署名与东京探索页面均返回 200；公网 /health 返回 ok。未登录 API 返回 401，跨站会话请求被拒绝，refresh Cookie 的 Secure、HttpOnly、SameSite=Strict 属性通过检查。

- 用户提供的 SMTP 文件带编辑器行号与制表符，已在导入时规范化；APP_AUTH_EMAIL_CODE_FROM 映射 MAIL_FROM_ADDRESS，MAIL_SMTP_STARTTLS_ENABLE 映射 MAIL_SMTP_STARTTLS，MAIL_PROVIDER 设为 smtp。原文件未改，凭证仅保存在服务器受限 .env，未提交 Git。
- Gmail SMTP 587 / STARTTLS 验证：TLSv1.3、认证返回 235、发件地址被接受。只执行连接 / 登录 / 发件信封检查后重置，没有发送邮件。
- 四个容器已运行，web / API / MySQL 健康检查通过；Worker 无专用 Docker 健康检查，以运行状态和存储工具链验证。使用已构建的 b7a2e45 镜像，启动前确认 frontend、backend 与 Compose 相对该版本无差异。
- 主机 Nginx 已启用项目 TLS 模板与 ACME 验证目录；证书续期计时器正常，certbot dry-run 成功，续期后 Nginx 校验 / 重载钩子已安装。
- 最初公网 443 超时，主机监听与 INPUT 策略正常。用户按指引在 Lightsail 添加 HTTPS 入站规则后，公网 HTTPS 和浏览器验证通过。SSH、主机防火墙、数据库公开端口未更改。
- 桌面 1440 与手机 390 宽度浏览器通过：首页、登录 / 注册表单、无横向溢出、未登录访问旅行页跳转登录、无运行时错误。实际公网访问完成验证；早期私有 SSH 通道已撤销。
- 在现有 API 容器内使用其实际依赖与现有环境变量验证 Java S3 SDK：预签名 PUT 200、读取内容一致、私有音乐对象访问成功，临时对象已清除。未向其他镜像传递服务器 .env。

边界：验收未发送真实邮件、未创建测试账号，也未跑注册后旅行 / 照片 / 视频全链路；SMTP 已认证不等于邮件收件箱送达已验证。Stripe 未配置，支付不可用。真实业务验收可由用户在正式页面完成，用户数据不会被自动清理。下方为历史准备记录，已解决的阻塞以上述发布结果为准。

## 2026-10-27 · R2 与背景音乐已完成配置

- R2_BUCKET=tabi-media，R2_MUSIC_BUCKET=tabi-music-private，R2_PUBLIC_BASE_URL=https://media.sunows.com。凭证仅保存在服务器受限 .env 中。
- 两个桶上传、读取、删除验证通过，验证对象已清除；媒体匿名 HTTPS 读取与 https://tabi.sunows.com 的 GET / HEAD / PUT 跨域预检通过。未调整音乐桶的公开设置。
- 按生产数据库中 enabled=1、status=APPROVED 的清单发布 19 首背景音乐：19 个原曲进入音乐桶，19 个试听进入媒体桶，共 38 个对象、170238721 字节。原曲 SHA256 与数据库和本地分析记录一致，远端大小与 MD5 校验通过，试听匿名读取和 CORS 校验通过；没有覆盖内容不一致的已有对象。
- Java HttpClient 从服务器容器读取媒体返回 200，下载 721022 字节。最初 Python-urllib 客户端被 Cloudflare 返回 403，使用明确的验证客户端标识及实际 Java 客户端均成功；没有关闭 Cloudflare 安全设置。
- 2026-10-27 21:33 JST 复查：Nginx 配置有效，MySQL 健康，服务器域名解析正确；生产启动检查仅剩 MAIL_FROM_ADDRESS 与 RESEND_API_KEY 缺失。用户尚未开通邮件服务，已提供 Resend 开通步骤。网站仍未正式上线。

以下保留 2026-10-26 初始发布记录，R2 / 音乐未配置的旧状态以上述更新为准。

状态：源码整理、GitHub 上传、服务器部署准备与构建验证已完成；**完整网站尚未正式上线**。缺少 R2 与真实邮件配置，不能把 DNS 或证书成功记为应用上线。

## 项目分析与整理

- 单仓库：Next.js 16.3.3 / React 19 前端，Java 21 / Spring Boot 4.1.1 API、MySQL、独立 FFmpeg 视频 Worker；已有数据库迁移 V1–V19。
- 原仓库 main 停在 c6adb8d，本机大量业务改动尚未提交。保留现有业务、文档分类及 Git 历史，将当前源码固化为 9ef60bf，再以 b7a2e45 修复 Linux 依赖锁。
- 新增 compose.production.yml、frontend/Dockerfile、deploy/lightsail/ 与根目录 CI；扩展忽略规则，排除 .env、私钥、缓存、运行数据与本机 Claude 配置。原本机 launch.json 保留在本机。
- 原本机目录 F:/Workspace/Claude/02_TabiTrace 已同步到已发布版本；原始未提交工作完整备份于本机 stash `00c5fc98fa77f259181d1d043fa6b45e7a3f704d`，另保留首份备份 `bd8c9333f44fa136f95396690bd8e40ff39668fd`。不要直接 pop 到当前版本，以免与已提交的相同改动冲突。

## 已实测

| 项目 | 结果 |
|---|---|
| 本地后端测试 | API 165 + Worker 7，全通过 |
| 本地前端测试 | 55，全通过；typecheck / build 通过；lint 0 错误、108 个既有警告 |
| GitHub Linux CI | b7a2e45 的 backend / frontend 均成功，运行 40336286330 |
| 服务器源码 | /srv/sunows/apps/tabi/repository |
| 前端镜像 | tabitrace-web:b7a2e45，约 508 MB |
| API 镜像 | tabitrace-api:b7a2e45，约 556 MB |
| Worker 镜像 | tabitrace-worker:b7a2e45，约 1.28 GB |
| 数据库 | MySQL 8.4.13，健康；仅 Docker 内网，无主机公开端口 |
| 空库迁移 | V1–V19 全成功；24 张业务表；用户/旅行/打卡/照片均 0 |
| 产品目录 | 1 个官方城市、30 个地点、3 个视频模板 |
| 前端容器 | 回环地址 /health 返回 ok、首页 200、正式 canonical 域名正确；验证容器已移除 |
| Worker 运行时 | Java 21.0.12.1、FFmpeg 8.0.1、Noto Sans CJK 字体可用；真实视频渲染仍待联调 |
| DNS | tabi.sunows.com 已解析到 175.41.217.207 |
| TLS 证书 | Let's Encrypt 已签发，2027-01-24 到期；项目 HTTPS 站点尚未启用 |
| 生产校验 | 正确阻止缺少 R2 / 邮件配置的发布；没有切换到 Mock 生产运行 |

本次空库验证采用一次性的 local profile 迁移进程，只为执行 Flyway 并退出，没有运行公网 API；prod 的 R2、邮件、随机密钥与 Secure Cookie 校验均保留。未复跑原 verify-empty-db.mjs 的本地历史库结构对比，也未执行真实注册、上传、视频和支付流程，不能宣称全功能验收完成。

## 配置与后续发布

服务器 `/srv/sunows/apps/tabi/shared/.env` 权限 0600，父目录 0700，已生成随机数据库与 JWT 密钥，未输出到日志或 Git。MySQL 数据保存在 `/srv/sunows/data/mysql/tabi`。

仍需填写：R2_ENDPOINT、R2_ACCESS_KEY、R2_SECRET_KEY、R2_BUCKET、R2_PUBLIC_BASE_URL、MAIL_FROM_ADDRESS、RESEND_API_KEY（或改配 SMTP）。支付未启用；背景音乐音频尚未上传到对象存储。

准备配置的步骤见 [Lightsail 指南](../../deploy/lightsail/README.md)。完成后执行环境检查与部署脚本，再安装项目 Nginx 配置、启用证书并验证 HTTPS 注册、登录、刷新会话、创建旅行、照片上传、打卡和真实视频生成。

## 遇到的问题

- Linux npm ci 首次失败：锁文件漏掉 @emnapi/core、@emnapi/runtime；已在 Node 22 Linux 容器修复，服务器镜像与 CI 均复验通过。
- 原本机 stash 带排除路径时退出异常，但已保存备份；恢复索引状态后无路径排除的完整 stash 成功，原工作保留两份备份，目录已快进同步。
- 远程脚本从标准输入执行时，Docker Compose exec 会读取后续脚本输入，导致验证提前结束；已修复脚本传输为 bash -c，并完整补验。
