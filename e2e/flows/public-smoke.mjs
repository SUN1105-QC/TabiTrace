// Read-only public release checks. No login, email, payment, upload, or user-data mutation.
import { API, WEB, suite } from '../lib/common.mjs'
import { openBrowser } from '../lib/browser.mjs'

const t = suite('public-smoke')
const pages = ['/', '/explore', '/explore/tokyo', '/explore/seoul', '/explore/hong-kong', '/explore/taipei', '/pricing', '/login', '/register', '/forgot-password', '/credits']
const retiredCopy = /我的成就|旅行成就|城市成就|解锁成就/
const retiredLink = /\/achievements(?:[/?#]|$)/
const request = url => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) })
let browser

try {
  t.section = 'HTTP'
  for (const route of ['/health', ...pages]) {
    const r = await request(WEB + route)
    const body = await r.text()
    t.check(route + ' 返回 200', r.status === 200, 'HTTP ' + r.status)
    if (route !== '/health') {
      t.check(route + ' 保留浏览器安全响应头', r.headers.get('x-content-type-options') === 'nosniff'
        && r.headers.get('x-frame-options') === 'DENY')
      t.check(route + ' 不包含已下线的成就文案', !retiredCopy.test(body))
    }
  }
  const old = await request(WEB + '/trips/1/achievements')
  t.check('旧成就链接永久跳转到对应旅行地图', old.status === 308
    && new URL(old.headers.get('location') || '/', WEB).pathname === '/trips/1/map', 'HTTP ' + old.status)
  for (const route of ['/trips/1', '/trips/1/summary']) {
    const r = await request(WEB + route + '?day=2026-10-31')
    const target = new URL(r.headers.get('location') || '/', WEB)
    t.check(route + ' 永久跳转到地图并保留参数', r.status === 308
      && target.pathname === '/trips/1/map' && target.searchParams.get('day') === '2026-10-31', 'HTTP ' + r.status)
  }
  const createTrip = await request(WEB + '/trips/new')
  t.check('创建旅行不被旧总览跳转规则拦截', createTrip.status === 200, 'HTTP ' + createTrip.status)
  await createTrip.arrayBuffer()
  for (const route of ['/users/me', '/users/me/usage', '/payments']) {
    const r = await request(API + route)
    t.check(route + ' 未登录返回 401', r.status === 401, 'HTTP ' + r.status)
    await r.arrayBuffer()
  }
  const planResponse = await request(API + '/plans/trip-pro')
  const plan = await planResponse.json()
  const limits = plan?.data?.videoUsageLimits
  t.check('公开方案包含有效的账号视频限额', planResponse.status === 200 && plan.success === true
    && typeof limits?.enforced === 'boolean'
    && Number.isSafeInteger(limits.dailyRenders) && limits.dailyRenders >= 0
    && Number.isSafeInteger(limits.dailyOutputSeconds) && limits.dailyOutputSeconds >= 0)
  t.check('公开方案明确是否可以付款', typeof plan?.data?.paymentsAvailable === 'boolean')
  t.check('公开方案说明是否全部功能免费开放', typeof plan?.data?.openAccess === 'boolean')

  browser = await openBrowser()
  for (const [width, height] of [[360, 800], [1440, 1000]]) {
    t.section = width + 'px'
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 })
    for (const route of pages) {
      const errorOffset = browser.errors.length
      await browser.goto(WEB + route, 900)
      const ready = await browser.waitFor(`!!document.querySelector('main h1') && document.readyState === 'complete'`, 10000)
      const view = await browser.js(`(() => {
        const text = document.body.innerText
        const heading = document.querySelector('main h1')?.innerText.trim() || ''
        const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))
        return { heading, text, links, width: Math.max(document.documentElement.scrollWidth, innerWidth), path: location.pathname }
      })()`)
      t.check(route + ' 正常显示页面标题', ready && view.heading.length > 0 && view.path === route, view.heading)
      t.check(route + ' 无横向溢出', view.width <= width + 1, String(view.width - width) + 'px')
      t.check(route + ' 无成就内容或入口', !retiredCopy.test(view.text) && !view.links.some(href => retiredLink.test(href || '')))
      t.check(route + ' 无前端运行时错误', browser.errors.length === errorOffset, browser.errors.slice(errorOffset).join(' | '))
    }
  }
  t.section = '只读边界'
  const writes = browser.requests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method))
  t.check('浏览器未提交业务写请求', writes.length === 0, writes.map(r => r.method + ' ' + new URL(r.url).pathname).join(', '))
} catch (error) {
  t.check('检查执行完成', false, error?.message || String(error))
} finally {
  if (browser) await browser.close()
  t.finish()
}
