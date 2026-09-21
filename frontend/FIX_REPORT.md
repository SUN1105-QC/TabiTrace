# TabiTrace Frontend v5 修正报告

## 已确认并修复

1. Travel Story 照片选择在后台轮询时可能被恢复为默认值。
2. 东京官方探索刷新后丢失“已加入当前旅行”状态。
3. 首页旅行日历写死固定月份与固定高亮日期。
4. 自动选择当前旅行时可能选中已归档旅行。
5. 顶部搜索框不可操作。
6. Access / Refresh Token 同时失效后缺少统一重新登录流程。
7. 未登录访问旅行工作区缺少前端保护。
8. 创建旅行日期使用固定 Demo 数据，且缺少日期顺序校验。
9. MapLibre 初次加载时存在路线 source 尚未建立的竞态。
10. 手动直接打卡（无 Place）虽有坐标，但地图不显示点。
11. 手动经纬度非法值缺少前端提示。
12. 图片上传缺少类型与大小预检。
13. Pricing 无 recent trip id 时无法恢复用户已有旅行。
14. 登录后不能返回原本想访问的受保护页面。

## 回归结果

- API Client 业务链路：15 / 15 通过。
- TS / TSX parse diagnostics：0。
- 内部 import 缺失：0。

## 本地建议执行

```bash
npm install
npm run typecheck
npm run build
npm run dev
```
