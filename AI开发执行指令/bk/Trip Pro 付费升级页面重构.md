你现在作为当前「旅迹 / TabiTrace」项目的高级产品工程师、全栈工程师和 UI/UX 工程师。

请基于当前已有的 Trip Pro 页面进行完整重构。

不要创建新项目。
不要替换当前技术栈。
不要重新实现现有 Auth / Trip / Pro / Payment 体系。
不要虚构支付成功、订阅、购买记录或 AI 额度。

先检查当前代码、Trip Pro 数据结构和真实商业逻辑，然后直接实施。

==================================================
一、目标
==================================================

当前 Trip Pro 页面存在：

1. FREE / PRO 两张价格卡过于传统。
2. 用户无法快速理解 Pro 的实际价值。
3. “按单次旅行生效”不够醒目。
4. 容易误解 ¥128 是订阅价格。
5. 已经是 Pro 的旅行仍然看到购买型页面。
6. Feature List 缺少成果预览。
7. 页面缺少真正购买决策信息。
8. 页面底部存在内部产品说明式文案。
9. 没有 FAQ。
10. 没有 Free → Pro 使用场景说明。

请将页面重构成：

Trip Pro Upgrade Center

核心表达：

基础旅行记录永久免费。

当用户希望：

记录更多
生成高清旅行成果
使用高级模板
制作完整 Travel Story

时，可以为当前旅行一次性解锁 Trip Pro。

重点明确：

一次购买
当前旅行生效
非订阅
不会自动续费

但以上文案必须与真实商业逻辑一致。

==================================================
二、开发前检查
==================================================

搜索：

TripPro
Pro
Plan
Subscription
Purchase
Payment
Checkout
Entitlement
Trip
isPro
plan
upgrade

确认：

Pro 是：

per-trip
per-user
subscription
lifetime

具体以当前代码为准。

确认：

price
currency
payment provider
purchase status
trip pro state
feature limits

禁止根据设计稿擅自改变商业模式。

==================================================
三、价格显示
==================================================

统一使用：

¥0
¥128

不要出现：

Yo
Y128

必须使用正确人民币格式。

推荐建立：

formatCurrency()

不要页面硬编码错误符号。

价格必须来自当前配置 / backend / product configuration。

如果真实价格不是 ¥128：

以真实数据为准。

==================================================
四、Hero
==================================================

设计：

TRIP PRO

让值得留下的旅程，
拥有完整的表达。

副标题：

基础记录永久免费。
当你需要更多记录空间、高清成果或完整 Travel Story 时，再为这趟旅行升级。

如果当前商业模式确实是：

一次购买
per trip
no auto renewal

显示三个 Trust Labels：

一次购买
当前旅行永久生效
不会自动续费

如果不是：

不要显示虚假承诺。

==================================================
五、Current Trip Status
==================================================

Hero 下展示当前旅行。

读取真实：

trip.title
trip.destination
trip.plan / isPro

FREE：

显示：

当前方案 FREE

真实使用情况，例如：

checkins current / limit
photos current / limit

以及：

升级后可以获得什么。

PRO：

页面必须切换为已解锁状态。

不要继续显示购买 CTA。

显示：

当前旅行已解锁 Trip Pro

以及已解锁功能入口：

分享成果
Travel Story
高清导出
旅行统计

==================================================
六、Pro Value
==================================================

创建 4 个 Value Sections：

完整记录
精致分享
Travel Story
深度回顾

具体 Feature 必须基于现有真实能力。

不要显示不存在的功能。

==================================================
七、Outcome Preview
==================================================

如果项目已有：

Share Result
Grid Poster
Long Image
Travel Story

读取真实预览资源或项目静态产品截图。

展示：

旅行海报
九宫格
每日长图
Travel Story

不要使用随机假用户内容。

可以使用项目已有 demo / placeholder。

==================================================
八、Pricing
==================================================

FREE：

弱化显示。

Trip Pro：

作为主 Price Card。

显示：

价格
生效范围
是否续费
核心权益

FREE / PRO Limits 必须来自统一 config。

不要在 UI 多处硬编码：

10 photos
10 check-ins

建议创建：

PLAN_FEATURES

或复用现有 entitlement config。

==================================================
九、CTA
==================================================

FREE 用户主 CTA：

为「{trip.title}」解锁 Trip Pro

不要使用含糊：

立即升级

购买时必须清楚用户买的是哪趟旅行。

如果 Payment 已存在：

复用现有 checkout。

如果 Payment 尚未实现：

不要模拟付款成功。

保持已有 MVP 升级行为，并在最终报告说明。

==================================================
十、Already Pro State
==================================================

当前 Trip 已是 Pro：

隐藏：

purchase button
pricing purchase CTA
sticky purchase bar

显示：

Trip Pro 已解锁

主 CTA：

制作旅行成果

次 CTA：

打开 Travel Story

或根据现有路由选择真实入口。

==================================================
十一、Why Per Trip
==================================================

如果真实商业模式是 Per Trip：

增加说明：

不需要长期订阅。

新旅行仍然可以免费开始。

只有选择升级的旅行收费。

不要显示内部产品语气：

“更符合当前 MVP 商业设计”。

所有文案必须面向最终用户。

==================================================
十二、Feature Comparison
==================================================

增加简洁 comparison table。

数据从统一 plan configuration 读取。

Desktop table。

Mobile 改 stacked comparison。

==================================================
十三、FAQ
==================================================

使用项目现有 Accordion。

FAQ 内容根据真实商业规则：

是否订阅
是否自动续费
是否每次旅行分别购买
Pro 是否过期
历史旅行是否可以升级

如果某项规则尚未确定：

不要写确定性答案。

==================================================
十四、Sticky Upgrade Bar
==================================================

FREE：

Desktop / Mobile 可显示。

内容：

trip name
Trip Pro
price
CTA

PRO：

不要显示购买 CTA。

可以换成：

Trip Pro 已解锁
制作旅行成果

==================================================
十五、支付状态
==================================================

必须处理：

idle
checkout loading
success
cancelled
failed
already purchased

防止重复支付。

CTA loading 时禁用。

支付成功后：

刷新 Trip Entitlement。

不要：

window.location.reload()

优先 Query invalidation / Store update。

==================================================
十六、响应式
==================================================

Desktop：

Hero
Value
Preview
Pricing
Comparison
FAQ

Mobile：

价格与 CTA 前置。

成果 Preview 横向滑动。

Comparison 使用分组 Cards。

Sticky CTA 处理：

safe-area-inset-bottom。

==================================================
十七、视觉要求
==================================================

继续使用当前 TabiTrace Design System。

不要做：

黑金 VIP
手游充值中心
皇冠堆叠
大量渐变
发光
科技蓝 SaaS Pricing

目标：

Premium Travel Tool

而不是：

VIP Membership Center。

==================================================
十八、测试
==================================================

至少测试：

FREE trip

PRO trip

没有 current trip

达到 Free limit

未达到 Free limit

payment loading

payment failed

payment success

duplicate purchase attempt

Desktop

Tablet

Mobile

==================================================
十九、验收
==================================================

[ ] ¥ 符号正确

[ ] 价格来自真实配置

[ ] 当前旅行显示正确

[ ] FREE / PRO 状态正确

[ ] 已 Pro 不再出现购买型 CTA

[ ] Per-trip 规则表达清楚

[ ] 非订阅规则与真实业务一致

[ ] Pro Value 清楚

[ ] 成果 Preview 正常

[ ] 功能对比真实

[ ] FAQ 正常

[ ] Payment 状态正常

[ ] 防重复购买

[ ] Sticky CTA 正常

[ ] Mobile 正常

[ ] 没有虚构功能

[ ] 没有虚构支付状态

[ ] TypeScript 无关键错误

[ ] Console 无关键错误

==================================================
最终目标
==================================================

用户打开这个页面以后，必须在很短时间内明白四件事：

Free 能做到什么。

Trip Pro 多得到什么。

需要支付多少钱。

这笔钱具体解锁哪一趟旅行。

最终页面要减少“价格表”的感觉，
增加“为什么值得为这段旅行升级”的感觉。

现在先检查当前 Trip Pro / Payment / Entitlement 实现，然后直接完成重构和测试。