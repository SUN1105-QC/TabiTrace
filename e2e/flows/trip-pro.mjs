// Trip Pro 页面：三种真实状态与购买流程。
// - 未登录：Hero / 状态卡 / 价格卡都引导登录；成果标签可以切换（点击与方向键）
// - 免费旅行：状态卡显示 FREE 与真实用量；按钮写明为哪段旅行、多少钱；成果入口带 ?mode= 打开分享页对应成果
// - 升级（模拟支付环境）：状态卡与价格卡都变成已解锁，不再出现购买按钮；Hero 改为成果入口
// - 买断 · 终身 Pro：价格卡显示已买断，账号会员（上传自己的音乐）同步显示
// - /pricing#pr-lifetime 加载后滚动到买断卡；底部购买条只在状态卡与价格卡都不在屏幕上时出现
// 需要测试邮箱（注册）；真实支付环境（Stripe）下跳过购买步骤。
import { WEB, call, sleep, suite } from '../lib/common.mjs'
import { openBrowser } from '../lib/browser.mjs'
import { createDemoTrip, registerDemoUser } from '../tools/landing-demo.mjs'

const t = suite('trip-pro')
const text = sel => `document.querySelector(${JSON.stringify(sel)})?.innerText?.replace(/\\s+/g, ' ').trim() || ''`
const attr = (sel, a) => `document.querySelector(${JSON.stringify(sel)})?.getAttribute(${JSON.stringify(a)}) || ''`
const ready = b => b.waitFor(`!!document.querySelector('.pr-pricing') && !document.querySelector('.pr-trip.is-loading')`, 20000)

let user, tripId, b
try {
  const plan = (await call('GET', '/plans/trip-pro')).data
  const price = `¥${plan.price.amount / 100}`

  t.section = '未登录'
  b = await openBrowser({ width: 1440, height: 900 })
  await b.goto(`${WEB}/pricing`, 2500)
  await ready(b)
  t.check('Hero 主按钮引导登录，次按钮跳到功能对比', /\/login/.test(await b.js(attr('.pr-hero-actions a', 'href'))) && (await b.js(attr('.pr-hero-actions a:nth-child(2)', 'href'))) === '#pr-compare')
  t.check('状态卡与 Trip Pro 价格卡都引导登录', /登录/.test(await b.js(text('#pr-status'))) && /登录后升级/.test(await b.js(text('.pr-plan.is-pro .pr-plan-cta'))))
  t.check('价格区三张卡与「为什么按旅行购买」三点', (await b.js(`document.querySelectorAll('.pr-plan').length`)) === 3 && (await b.js(`document.querySelectorAll('.pr-why li').length`)) === 3)
  t.check(`Trip Pro 价格来自方案配置（${price} / 每段旅行 · 一次性）`, (await b.js(text('.pr-plan.is-pro .pr-plan-price'))) === `${price} / 每段旅行 · 一次性`, await b.js(text('.pr-plan.is-pro .pr-plan-price')))
  await b.js(`document.querySelector('#pr-tab-nine').click(); true`)
  t.check('点击「九宫格」切换成果预览', (await b.js(text('.pr-outcome-copy h3'))) === '九宫格' && /share-grid/.test(await b.js(attr('.pr-outcome-stage img', 'src'))))
  await b.js(`document.querySelector('#pr-tab-nine').focus(); document.querySelector('.pr-tabs').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); true`)
  await sleep(200)
  t.check('方向键移到下一个标签（每日长图）并获得焦点', (await b.js(`document.activeElement?.id`)) === 'pr-tab-long' && (await b.js(text('.pr-outcome-copy h3'))) === '每日长图')
  t.check('FAQ 不超过 6 个问题', (await b.js(`document.querySelectorAll('.pr-faq details').length`)) <= 6)
  await b.close(); b = null

  t.section = '免费旅行'
  user = await registerDemoUser('tt-e2e-pro')
  tripId = await createDemoTrip(user.token, { pro: false, title: '秋天的东京漫步' })
  b = await openBrowser({ width: 1440, height: 900 })
  await b.session(user.refresh)
  await b.goto(`${WEB}/pricing?trip=${tripId}`, 2500)
  await ready(b)
  const status = await b.js(text('#pr-status'))
  t.check('状态卡：旅行名称、FREE、真实用量（7 / 10 打卡、8 / 10 照片）', /秋天的东京漫步/.test(status) && /FREE/.test(status) && /7 \/ 10/.test(status) && /8 \/ 10/.test(status), status.slice(0, 160))
  t.check(`状态卡按钮「升级 Trip Pro · ${price}」`, (await b.js(text('#pr-status .pr-cta'))) === `升级 Trip Pro · ${price}`)
  t.check('价格卡按钮写明为哪段旅行升级', (await b.js(text('.pr-plan.is-pro .pr-cta'))) === `为「秋天的东京漫步」升级 · ${price}`)
  t.check('Hero「升级这趟旅行」跳到状态卡', (await b.js(attr('.pr-hero-actions a', 'href'))) === '#pr-status')
  t.check('对比区说明当前旅行是 Free', /当前是 Free/.test(await b.js(text('.pr-compare-hint'))))
  t.check('成果入口打开这段旅行的海报', (await b.js(attr('.pr-outcome-cta a', 'href'))) === `/trips/${tripId}/share?mode=poster`)
  await b.js(`document.querySelector('#pr-tab-nine').click(); true`)
  const nineHref = await b.js(attr('.pr-outcome-cta a', 'href'))
  t.check('切到九宫格后入口带 ?mode=nine', nineHref === `/trips/${tripId}/share?mode=nine`, nineHref)

  // 底部购买条：滚到权益区（状态卡已滚出、价格卡还在下方很远）出现；滚到价格区消失
  await b.js(`document.querySelector('.pr-benefits').scrollIntoView({ block: 'start' }); true`)
  await sleep(600)
  const stickyShown = await b.js(`!!document.querySelector('.pr-sticky')`)
  await b.js(`document.querySelector('.pr-pricing').scrollIntoView({ block: 'center' }); true`)
  await sleep(600)
  t.check('底部购买条：状态卡与价格卡都不在屏幕上时才出现', stickyShown && !(await b.js(`!!document.querySelector('.pr-sticky')`)))

  await b.goto(`${WEB}${nineHref}`, 3000)
  await b.waitFor(`!!document.querySelector('.ss-seg [aria-selected=true]')`, 20000)
  await sleep(1500)
  t.check('分享页按 ?mode=nine 打开九宫格', (await b.js(text('.ss-seg [aria-selected=true]'))) === '九宫格', await b.js(text('.ss-seg [aria-selected=true]')))

  t.section = '升级（模拟支付）'
  if (plan.realPayments) {
    t.skip('模拟支付升级与买断', '真实支付环境（Stripe）下不在自动化测试里付款')
  } else {
    await b.goto(`${WEB}/pricing?trip=${tripId}`, 2500)
    await ready(b)
    await b.js(`document.querySelector('#pr-status .pr-cta').click(); true`)
    await b.waitFor(`/已解锁 Trip Pro/.test(document.querySelector('#pr-status')?.innerText || '')`, 20000)
    const after = await b.js(text('#pr-status'))
    t.check('状态卡变为已解锁，提示支付成功，给出成果入口', /已解锁 Trip Pro/.test(after) && /支付成功/.test(after) && /查看分享成果/.test(after) && /制作 Travel Story/.test(after), after.slice(0, 200))
    t.check('页面上不再有为这段旅行购买的按钮', (await b.js(`[...document.querySelectorAll('.pr-cta')].filter(x => /升级/.test(x.innerText)).length`)) === 0)
    t.check('价格卡显示「秋天的东京漫步」已解锁 Trip Pro', /「秋天的东京漫步」已解锁 Trip Pro/.test(await b.js(text('.pr-plan.is-pro .pr-unlocked'))))
    t.check('Hero 主按钮改为查看分享成果', /查看分享成果/.test(await b.js(text('.pr-hero-actions a'))))
    t.check('服务端旅行方案已是 PRO', (await call('GET', `/trips/${tripId}`, { token: user.token })).data?.planType === 'PRO')

    t.section = '买断 · 终身 Pro'
    t.check('买断前：权益卡说明上传自己的音乐属于会员权益', /买断 · 终身 Pro 的账号会员权益/.test(await b.js(text('.pr-benefits'))))
    await b.js(`document.querySelector('.pr-plan.is-lifetime .pr-cta').click(); true`)
    await b.waitFor(`/已买断终身 Pro/.test(document.querySelector('.pr-plan.is-lifetime')?.innerText || '')`, 20000)
    await sleep(1500)
    t.check('买断后：价格卡显示已买断，状态卡说明所有旅行已解锁', /已买断终身 Pro：账号下所有旅行都已解锁/.test(await b.js(text('.pr-plan.is-lifetime'))) && /买断终身 Pro/.test(await b.js(text('#pr-status'))))
    t.check('买断后：权益卡显示已开通上传自己的音乐', /已开通上传自己的音乐/.test(await b.js(text('.pr-benefits'))))
  }

  t.section = '锚点'
  await b.goto(`${WEB}/pricing#pr-lifetime`, 3000)
  await ready(b)
  await sleep(800)
  const top = await b.js(`Math.round(document.querySelector('#pr-lifetime').getBoundingClientRect().top)`)
  t.check('/pricing#pr-lifetime 加载后滚动到买断卡，停在吸顶导航下方', top >= 78 && top < 300, `top=${top}`)
  t.check('全程没有前端报错', b.errors.length === 0, b.errors.join(' | '))
} catch (e) {
  t.check('运行', false, e?.message || e)
} finally {
  if (tripId && user) {
    const del = await call('DELETE', `/trips/${tripId}`, { token: user.token })
    t.check('清理：删除测试旅行', del.success, `${del.status} ${del.code}`)
  }
  await b?.close()
  if (user) console.log(`测试账号：${user.email}（*@example.test，清理方式见 e2e/README.md）`)
  t.finish()
}
