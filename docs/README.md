# 旅迹 TabiTrace · 项目设计文档索引

这里不讲业务，只告诉人类开发者和 AI：**去哪里找什么信息**。
所有文档以实际代码为准；文档与代码冲突时按 `99_management/03_已知问题与技术债.md` 的「文档与代码偏差」处理，无法判断的标记 `❓ 待确认`。

## AI / 开发者开始任务前

1. 阅读本文件
2. 阅读 [00_overview/00_项目总说明.md](00_overview/00_项目总说明.md)
3. 阅读 [99_management/01_项目长期记忆.md](99_management/01_项目长期记忆.md)（当前阶段、P0、下一步）
4. 阅读 [99_management/02_未完成事项.md](99_management/02_未完成事项.md)
5. 按下面「按任务读取」只读相关目录；提出替代方案前先读 [99_management/04_设计决策记录.md](99_management/04_设计决策记录.md) 里相关的 ADR

不要每次重新扫描整个项目。只有结构大改、文档明显过期、代码与文档严重冲突或用户要求时才重新做大范围分析。

## 目录

| 目录 | 回答的问题 | 文档 |
|---|---|---|
| `00_overview/` | 项目是什么 | [项目总说明](00_overview/00_项目总说明.md) · [系统总体设计](00_overview/01_系统总体设计.md) · [技术选型说明](00_overview/02_技术选型说明.md) |
| `01_requirements/` | 应该做什么 | [需求规格说明](01_requirements/01_需求规格说明.md) · [MVP 验收标准](01_requirements/02_验收标准.md) |
| `02_business/` | 业务怎么运行 | [业务流程](02_business/01_业务流程设计.md) · [功能模块](02_business/02_功能模块设计.md) · [用例与业务规则](02_business/03_用例与业务规则.md) · [状态与生命周期](02_business/04_状态与生命周期设计.md) · [收费与退款运营决策草案](02_business/05_收费与退款运营决策.md) |
| `03_architecture/` | 系统由什么组成 | [系统架构](03_architecture/01_系统架构设计.md) · [模块依赖](03_architecture/02_模块依赖设计.md) · [部署架构](03_architecture/03_部署架构设计.md) |
| `04_data/` | 数据是什么 | [数据库设计](04_data/01_数据库设计.md) · [数据字典](04_data/02_数据字典.md) · [枚举与常量](04_data/03_枚举与常量定义.md) |
| `05_frontend/` | 前端怎么组织 | [前端架构](05_frontend/01_前端架构设计.md) · [路由与页面](05_frontend/02_前端路由与页面.md) · [UI/UX 规范](05_frontend/03_UI_UX设计规范.md) · [组件设计](05_frontend/04_组件设计.md) |
| `06_backend/` | 后端怎么组织 | [后端架构](06_backend/01_后端架构设计.md) · [API 接口](06_backend/02_API接口设计.md) · [异常与错误码](06_backend/03_异常与错误码设计.md) · [文件存储](06_backend/04_文件存储设计.md) · [任务与视频渲染](06_backend/05_任务与视频渲染机制.md) |
| `07_security/` | 你是谁、能做什么、怎么防护 | [认证](07_security/01_认证设计.md) · [权限](07_security/02_权限设计.md) · [安全、日志与审计](07_security/03_安全设计.md) |
| `08_testing/` | 怎么验证 | [测试计划](08_testing/01_测试计划.md) · [支付验收与上线检查](08_testing/02_支付验收与上线检查.md) |
| `09_deployment/` | 怎么运行和部署 | [环境与配置](09_deployment/01_环境与配置说明.md) · [Lightsail 指南](../deploy/lightsail/README.md) · [Lightsail 实测发布记录](09_deployment/04_Lightsail发布记录.md) · [历史 Railway 方案](09_deployment/02_部署设计.md) · [新手上手指南](09_deployment/03_新手上手指南.md) · [成本保护与监控](09_deployment/05_成本保护与监控.md) |
| `10_development/` | 怎么开发 | [开发规范](10_development/01_开发规范.md) · [Git 规范](10_development/02_Git版本管理规范.md) · [开发执行计划](10_development/03_开发执行计划.md) |
| `99_management/` | 现在到哪了、为什么这样 | [项目长期记忆](99_management/01_项目长期记忆.md) · [未完成事项](99_management/02_未完成事项.md) · [已知问题与技术债](99_management/03_已知问题与技术债.md) · [设计决策记录 ADR](99_management/04_设计决策记录.md) · [变更记录](99_management/05_变更记录.md) |

模板里有、但本项目**没有建立**的文档（以及原因）：
- 缓存设计：项目没有服务端缓存层（没有 Redis，也没有 `@Cacheable`），只有前端少量内存缓存，写在前端架构里。
- 字段映射表：各层命名规则统一（数据库 snake_case ↔ 其余各层 camelCase，由 MyBatis 自动映射），少数例外写在数据字典里。
- 独立的页面说明、测试用例、CI/CD、监控、备份、日志审计、里程碑文档：内容不多，分别并入路由与页面、测试计划、部署设计、安全设计、开发执行计划。

## 按任务读取

| 任务 | 读取 |
|---|---|
| 数据库 | `04_data/`、`06_backend/01_后端架构设计.md`、`07_security/02_权限设计.md`、`99_management/` |
| API | `02_business/`、`04_data/`、`06_backend/`、`07_security/`、`99_management/` |
| 前端 | `02_business/`、`05_frontend/`、`06_backend/02_API接口设计.md`、`06_backend/03_异常与错误码设计.md`、`07_security/01_认证设计.md`、`99_management/` |
| 权限 / 套餐限制 | `02_business/03_用例与业务规则.md`、`06_backend/`、`07_security/`、`99_management/` |
| 视频 / 音乐 | `02_business/`、`06_backend/04_文件存储设计.md`、`06_backend/05_任务与视频渲染机制.md`、`99_management/` |
| 测试 | `01_requirements/`、`02_business/`、`08_testing/`、`99_management/` |
| 部署 | `03_architecture/`、`09_deployment/`、`99_management/` |

## 文档以外的知识来源

| 位置 | 内容 | 是否维护 |
|---|---|---|
| 代码与 `backend/api/src/main/resources/db/migration/` | 实际实现与数据库结构（最终事实） | — |
| `README.md`、`backend/README.md`、`frontend/README.md` | 子项目入口与启动命令，详细设计指回本目录 | 维护 |
| `e2e/README.md` | E2E 套件的运行方式与清理方法（被测试脚本引用） | 维护 |
| `frontend/AGENTS.md` | Next.js 16 的 AI 注意事项（由 `next dev` 自动写入） | 不手改 |
| `AI开发执行指令/` | 历次给 AI 的开发指令原文 | 历史资料，不维护、不作为事实来源 |
| `docs/image-audit.json` | `npm run images:audit` 生成的图片审计数据（运行后才出现） | 生成文件，不手改 |

## 文档维护规则

- **一个主题，一个主要事实来源**。其他文档只链接，不复制。
- 每次开发结束，按 [10_development/01_开发规范.md](10_development/01_开发规范.md) 末尾的「文档同步检查」只更新真正受影响的文档。
- 长期记忆是当前状态的高密度索引，不是日志；历史写进变更记录。
