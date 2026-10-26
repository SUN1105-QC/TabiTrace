// 移动端布局回归：主要页面在 360 / 390 / 430 / 768 / 1440 下没有横向溢出、页面底部内容不被底部导航遮挡；
// 快速打卡在手机上是底部弹层（不超出屏幕，保存按钮可达）。需要测试账号（E2E_EMAIL / E2E_PASSWORD，至少有一段旅行）。
import { WEB, call, login, sleep, suite } from '../lib/common.mjs'
import { openBrowser } from '../lib/browser.mjs'

const t = suite('mobile-layout')
const SIZES = [[360, 800], [390, 844], [430, 932], [768, 1024], [1440, 900]]
// 移动端仿真下内容过宽会把布局视口一起撑宽（innerWidth 也跟着变大），所以溢出要和设定宽度 W 比较
const MEASURE = W => `(() => {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
  return new Promise(r => setTimeout(() => {
    const H = innerHeight
    const hidden = el => { for (let p = el; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.position === 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return true; if (p !== el && /(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) return true /* 在内部滚动区域里，可以滚动到 */ } return !!el.closest('details:not([open])') && !el.closest('summary') }
    const nav = [...document.querySelectorAll('.mobile-appbar')].filter(e => getComputedStyle(e).display !== 'none')[0]
    const navTop = nav ? nav.getBoundingClientRect().top : H
    const content = [...document.querySelectorAll('main a, main button, main p, main h1, main h2, main h3, main img, main li')].filter(el => { const b = el.getBoundingClientRect(); return b.width > 2 && b.height > 2 && !hidden(el) })
    const bottom = content.length ? Math.max(...content.map(el => el.getBoundingClientRect().bottom)) : 0
    r({ overflow: Math.max(document.documentElement.scrollWidth, innerWidth) - ${W}, covered: bottom > navTop + 2 ? Math.round(bottom - navTop) : 0 })
  }, 400))
})()`

const s = await login()
const trips = await call('GET', '/trips', { token: s.token })
const tripId = trips.data?.[0]?.id
if (!tripId) throw new Error('测试账号需要至少一段旅行')
const ROUTES = ['/', '/trips', '/trips/new', `/trips/${tripId}`, `/trips/${tripId}/map`, `/trips/${tripId}/gallery`, `/trips/${tripId}/video`, `/trips/${tripId}/summary`, `/trips/${tripId}/share`, `/trips/${tripId}/achievements`, '/memories', '/profile', '/pricing', '/explore', '/explore/tokyo']
const b = await openBrowser()
try {
  await b.session(s.refresh)
  for (const [w, h] of SIZES) {
    await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
    const bad = []
    for (const r of ROUTES) {
      await b.goto(WEB + r, 1800)
      const m = await b.js(MEASURE(w))
      if (m.overflow > 1) bad.push(`${r} 横向溢出 ${m.overflow}px`)
      if (m.covered) bad.push(`${r} 底部 ${m.covered}px 被遮挡`)
    }
    t.check(`${w}×${h}：${ROUTES.length} 个页面无横向溢出、底部内容不被遮挡`, bad.length === 0, bad.join('；'))
    if (w <= 430) {
      await b.goto(`${WEB}/trips/${tripId}`, 2000)
      await b.js(`document.querySelector('.mobile-appbar-fab')?.click(); true`)
      await b.waitFor(`!!document.querySelector('[role=dialog][aria-label=快速打卡] .qc-actions')`, 8000)
      await sleep(300)
      const q = await b.js(`(() => { const p = document.querySelector('.qc-panel').getBoundingClientRect(); const btn = [...document.querySelectorAll('.qc-actions button')][0].getBoundingClientRect(); return { fits: p.top >= 0 && p.bottom <= innerHeight + 1, btn: btn.bottom <= innerHeight + 1 && btn.top >= 0 } })()`)
      t.check(`${w}×${h}：快速打卡底部弹层不超出屏幕，保存按钮可见`, q.fits && q.btn, JSON.stringify(q))
    }
  }
  t.check('没有前端报错', b.errors.length === 0, b.errors.join(' | '))
} finally {
  await b.close()
  t.finish()
}
