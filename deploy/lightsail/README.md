# TabiTrace · SUNOWS / Lightsail

当前目标为 `https://tabi.sunows.com`，服务器 `175.41.217.207`。本方案补充 Lightsail 独立 Compose 部署；原 Railway 配置保留供参考。

## 组成与目录

| 服务 | 作用 | 主机监听 |
|---|---|---|
| web | Next.js standalone / Node 22 | 仅 127.0.0.1:13000 |
| api | Java 21 / Spring Boot | 仅 127.0.0.1:18080 |
| worker | Java 21 / FFmpeg / CJK 字体 | 无公开端口 |
| mysql | MySQL 8.4 | 不映射主机端口 |
| 主机 Nginx | HTTPS 与路由 | 80 / 443，配置完成后启用 |

代码位于 `/srv/sunows/apps/tabi/repository`，服务配置位于 `/srv/sunows/apps/tabi/shared/.env`，数据库位于 `/srv/sunows/data/mysql/tabi`。`.env` 为服务器独有文件，权限 0600，不加入 Git。MySQL、API、Worker 使用相同应用数据库账号；数据库与 JWT 密钥由 prepare.sh 随机生成。日志轮转为每容器 3×10 MB。

## 首次发布前必须完成

1. DNS 新增 `tabi.sunows.com` 的 A 记录，指向 `175.41.217.207`。若添加 AAAA，必须确认 IPv6 的 80/443 可达。证书验证期间可先使用 DNS only。
2. 在 Lightsail 网络设置确认 TCP 80、443 允许访问。本方案不自动改动云防火墙。
3. Cloudflare R2：创建媒体桶，创建仅允许所需桶的读写 S3 API 凭证，配置公开 HTTPS 自定义域名（例如用户自行选择 `media.sunows.com`）。设置桶 CORS 允许 `https://tabi.sunows.com` 的 GET、HEAD、PUT，允许 `Content-Type`，暴露 ETag。填写 R2_ENDPOINT、R2_ACCESS_KEY、R2_SECRET_KEY、R2_BUCKET、R2_PUBLIC_BASE_URL。媒体桶当前设计为可公开访问；不要把不应公开的文件放入其中。音乐原曲建议单独私有桶，填 R2_MUSIC_BUCKET。
4. 邮件：配置 Resend 或 SMTP。使用 Resend 时，在控制台添加并验证自有发件域名，按控制台实际记录配置 SPF/DKIM，然后填写 RESEND_API_KEY 和 MAIL_FROM_ADDRESS；不要修改既有邮箱 MX。若用 SMTP，填写 MAIL_PROVIDER=smtp 及 MAIL_*。
5. Stripe 可以暂不配置，应用将显示支付暂未开放；不得切成模拟支付。现有价格与法律页面仍需产品负责人确认，见管理文档。

R2 与邮件凭证不要发送到聊天或 GitHub。可将这些值保存到本地受限 `.env` 文件，再向执行助手提供本地路径；也可直接在服务器编辑 shared/.env。R2 账户开通与邮件域名验证需要用户完成。

官方说明：[R2 入门](https://developers.cloudflare.com/r2/get-started/)、[R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)、[Resend 域名验证](https://resend.com/docs/dashboard/domains/introduction)。

## 配置、构建和启动

在服务器以 ubuntu 执行：

```bash
cd /srv/sunows/apps/tabi/repository
bash deploy/lightsail/prepare.sh
# 使用编辑器填写 shared/.env 中的 R2 / 邮件配置；不要更换已初始化数据库的密码
python3 deploy/lightsail/check-env.py /srv/sunows/apps/tabi/shared/.env
bash deploy/lightsail/deploy.sh
```

检查失败会停止发布并只列变量名，不会用 Mock 或开发密钥启动生产 API。`deploy.sh` 构建三个镜像，启动并等待健康检查；MySQL 的 V1–V19 迁移由 API 执行。数据库更新后回滚旧代码不等于回滚数据库；升级前需备份，禁止使用 `down -v`。

只构建镜像可以在外部服务尚未准备时执行，不启动应用：

```bash
sudo docker compose --env-file /srv/sunows/apps/tabi/shared/.env -f compose.production.yml config --quiet
sudo docker compose --env-file /srv/sunows/apps/tabi/shared/.env -f compose.production.yml build
```

前端构建参数包含域名、内网 API 地址和地图配置，不包含 R2/邮件/JWT 私钥。地图默认采用 [OpenFreeMap 官方 Liberty 样式](https://openfreemap.org/quick_start/)，保留样式内的署名；不支持 WebGL 的基础地图仍需单独配置栅格服务。照片、视频及背景音乐需要 R2。曲库的音频不在 Git 中，发布说明见原部署设计的背景音乐章节；没有上传的音频不能标记为可试听或可生成带音乐的视频。

## Nginx 与 HTTPS

2026-10-27 已发布到 https://tabi.sunows.com，四个生产容器已启动，SMTP 认证、R2、公开 HTTPS、浏览器与证书续期演练通过。实际启用的是 nginx-tls.conf，证书续期钩子为 /etc/letsencrypt/renewal-hooks/deploy/tabi-nginx-reload.sh（内容见 renew-nginx.sh）。业务镜像标签 b7a2e45；后续提交主要是部署模板与验收文档。

证书已存在时，使用 nginx-tls.conf；首次创建且证书尚未申请时才使用下面的 HTTP 模板与 Certbot 流程。已发布实例维护时不要将 HTTPS 站点替换回 HTTP 模板。Lightsail 的 IPv4 防火墙须允许 TCP 443；API、数据库端口不需要向公网开放。

只有应用健康、域名已解析到本服务器后执行：

```bash
sudo install -m 0644 deploy/lightsail/nginx.conf /etc/nginx/sites-available/tabi.sunows.com
sudo ln -s /etc/nginx/sites-available/tabi.sunows.com /etc/nginx/sites-enabled/tabi.sunows.com
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d tabi.sunows.com --redirect
curl --fail https://tabi.sunows.com/health
```

不要删除其他站点。已有同名文件时先比对内容；不要强制覆盖。生产登录 Cookie 必须使用 HTTPS，因此只有 HTTP 200 不能算完整上线。

## 验收与运维

除 web /health 和 API /actuator/health 外，发布验收必须包括真实邮箱验证码注册、登录、刷新会话、创建旅行、照片上传与访问、打卡、视频渲染、退出。未配置的服务如实列为未完成。

现有 CI 已迁到仓库根目录 `.github/workflows/ci.yml`，检查 Java 21 后端与 Node 22 前端。GitHub 推送不自动触发服务器发布，避免缺少外部配置时启动失败。更新源码前检查 Git 状态并记录提交；部署时保留数据库，不执行卷清理。
