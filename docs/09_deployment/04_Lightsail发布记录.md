# 2026-10-26 · Lightsail 发布记录

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
