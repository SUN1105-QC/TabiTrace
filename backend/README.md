# TabiTrace Backend

旅迹 TabiTrace 后端：Java 21、Spring Boot 4.1.1、Maven 多模块、MyBatis、Flyway、MySQL 8。

设计文档在仓库根目录的 `docs/`：
- 架构与分层：[docs/06_backend/01_后端架构设计.md](../docs/06_backend/01_后端架构设计.md)
- API 清单：[docs/06_backend/02_API接口设计.md](../docs/06_backend/02_API接口设计.md)
- 错误码：[docs/06_backend/03_异常与错误码设计.md](../docs/06_backend/03_异常与错误码设计.md)
- 存储、视频 Worker 与定时任务：[文件存储设计](../docs/06_backend/04_文件存储设计.md)、[任务与视频渲染机制](../docs/06_backend/05_任务与视频渲染机制.md)
- 认证、邮箱验证码与登录保护：[docs/07_security/01_认证设计.md](../docs/07_security/01_认证设计.md)
- 数据库：[docs/04_data/01_数据库设计.md](../docs/04_data/01_数据库设计.md)（最终事实是 `api/src/main/resources/db/migration/`）

## 模块

```text
backend/
├── api/             Spring Boot REST API（/api/v1，端口 8080；启动时执行 Flyway 迁移）
├── video-worker/    视频渲染 Worker（无 HTTP 端口，轮询 QUEUED 任务，调用 FFmpeg）
├── scripts/         本地数据库初始化、开发邮件接收器、空库迁移验证、曲库同步（music/）
├── deploy/          旧的 nginx / systemd 示例（Lightsail 方案，当前不使用）
├── docker-compose.yml   本地 MySQL 8.4（可选）
└── pom.xml
```

## 本地运行

```bash
mysql -u root -p -e "source scripts/mysql-init-local.sql"          # 首次：建库和应用账号
mvn -pl api spring-boot:run                                         # API → http://localhost:8080/api/v1
node scripts/dev-mail-catcher.mjs                                   # 邮件接收器（注册验证码）
STORAGE_MODE=local mvn -pl video-worker spring-boot:run             # 视频 Worker（需要 FFmpeg）
mvn -B test                                                         # 测试（api + video-worker）
```

- 跑真实 Worker 时，API 必须关闭模拟渲染器（`VIDEO_MOCK_RENDERER=false`），否则模拟渲染器会先抢走任务、写入不能播放的占位地址。根目录的启动脚本会自动处理。
- 配置全部走环境变量，见 [.env.example](.env.example) 与 [环境与配置说明](../docs/09_deployment/01_环境与配置说明.md)。`prod` profile 缺少必要变量或使用开发默认值时拒绝启动。
- 完整的从零上手步骤见 [新手上手指南](../docs/09_deployment/03_新手上手指南.md)，部署见 [部署设计](../docs/09_deployment/02_部署设计.md)。
