// 会话回归：访问令牌只在内存，refresh token 只在 HttpOnly Cookie。
// 刷新页面 / 新标签页（含两个同时打开）/ 访问令牌过期 / 会话被吊销 / 未登录访问私有页 / 退出（跨标签页）/ CSRF / 没有无限刷新
// 需要测试账号：E2E_EMAIL / E2E_PASSWORD
import { API, WEB, call, login, sleep, suite } from '../lib/common.mjs'
import { openBrowser } from '../lib/browser.mjs'

const t = suite('auth-session')
const b = await openBrowser()
const refreshes = (tab, from) => tab.requests.filter(r => r.method === 'POST' && r.url.includes('/api/v1/auth/refresh') && r.t >= from).length
const loggedIn = tab => tab.js(`!!document.querySelector('.user-chip') && !location.pathname.startsWith('/login')`)

try {
  t.section = 'CSRF'
  const s0 = await login()
  const evil = await fetch(API + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Cookie: `tt_refresh=${s0.refresh}` }, body: '{}' })
  t.check('跨站来源调用 /auth/refresh → 403，且不清除 Cookie', evil.status === 403 && !(evil.headers.getSetCookie?.() ?? []).length, evil.status)
  const evil2 = await fetch(API + '/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site', Cookie: `tt_refresh=${s0.refresh}` }, body: '{}' })
  t.check('Sec-Fetch-Site: cross-site 调用 /auth/logout → 403（其他网站不能把用户登出）', evil2.status === 403, evil2.status)

  t.section = '内存令牌'
  const s = await login()
  await b.session(s.refresh)
  await b.js(`localStorage.setItem('tabitrace-access-token', 'legacy.jwt.value'); localStorage.setItem('tabitrace-notifications-read-at', '123'); true`)
  let mark = Date.now()
  await b.goto(WEB + '/trips', 3000)
  t.check('打开私有页面：用 Cookie 静默换取访问令牌，保持登录', await loggedIn(b))
  t.check('首次加载只刷新 1 次', refreshes(b, mark) === 1, refreshes(b, mark))
  const stored = await b.js(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))) + JSON.stringify(Object.fromEntries(Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)])))`)
  t.check('旧版 localStorage 访问令牌已删除，无关偏好保留', !stored.includes('legacy.jwt.value') && stored.includes('tabitrace-notifications-read-at'))
  t.check('localStorage / sessionStorage 里没有任何 JWT', !/eyJ[\w-]+\.[\w-]+\.[\w-]+/.test(stored))
  t.check('document.cookie 读不到 refresh token', !(await b.js('document.cookie')).includes('tt_refresh'))
  mark = Date.now()
  await b.send('Page.reload'); await sleep(3000)
  t.check('刷新页面后仍然登录，只换 1 次令牌', await loggedIn(b) && refreshes(b, mark) === 1, refreshes(b, mark))

  t.section = '多标签页'
  const t2 = await b.newTab(), t3 = await b.newTab()
  await Promise.all([t2.send('Page.navigate', { url: WEB + '/trips' }), t3.send('Page.navigate', { url: WEB + '/profile' })])
  await sleep(5000)
  t.check('两个标签页同时打开（并发刷新）都保持登录', (await loggedIn(t2)) && (await loggedIn(t3)))
  await b.send('Page.reload'); await sleep(3000)
  t.check('并发刷新后原标签页仍然登录（Cookie 没被错误清除）', await loggedIn(b))

  t.section = '令牌过期'
  let intercepted = 0
  await b.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/users/me*', requestStage: 'Request' }] })
  b.hooks.push(m => {
    if (m.method !== 'Fetch.requestPaused') return
    if (intercepted === 0 && m.params.request.method === 'GET') {
      intercepted++
      void b.send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 401, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: WEB }, { name: 'Access-Control-Allow-Credentials', value: 'true' }], body: Buffer.from('{"success":false,"code":"UNAUTHORIZED"}').toString('base64') })
    } else void b.send('Fetch.continueRequest', { requestId: m.params.requestId })
  })
  mark = Date.now()
  await b.goto(WEB + '/profile', 3500)
  t.check('访问令牌过期（401）→ 刷新并重试成功，页面正常', intercepted === 1 && await loggedIn(b) && refreshes(b, mark) <= 2, `intercepted=${intercepted} refresh=${refreshes(b, mark)}`)
  await b.send('Fetch.disable')

  t.section = '会话失效'
  // 在另一台“设备”上吊销这次会话：用同一个 refresh Cookie 调用退出
  const current = (await b.send('Network.getCookies', { urls: [API + '/auth/refresh'] })).result.cookies.find(c => c.name === 'tt_refresh')?.value
  await fetch(API + '/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `tt_refresh=${current}` }, body: '{}' })
  mark = Date.now()
  await b.send('Page.reload'); await sleep(4500)
  t.check('会话失效：回到 /login?next=…', /^\/login\?next=/.test(await b.js('location.pathname + location.search')), await b.js('location.href'))
  const tries = refreshes(b, mark)
  await sleep(4000)
  t.check(`没有无限刷新（${tries} 次尝试后停止）`, tries <= 3 && refreshes(b, mark) === tries, `${tries} → ${refreshes(b, mark)}`)

  t.section = '未登录'
  t.check('未登录调用受保护 API → 401', (await call('GET', '/users/me')).status === 401)
  await b.goto(WEB + '/trips/1', 2500)
  t.check('未登录访问私有页面 → 登录页', (await b.js('location.pathname')) === '/login')

  t.section = '退出'
  const s2 = await login()
  await b.session(s2.refresh)
  await b.goto(WEB + '/trips', 3000)
  await t2.goto(WEB + '/trips', 3000)
  t.check('重新登录后两个标签页都登录', (await loggedIn(b)) && (await loggedIn(t2)))
  await b.js(`document.querySelector('.user-chip').click(); true`); await sleep(300)
  await b.js(`[...document.querySelectorAll('[role=menuitem]')].find(x => x.tagName === 'BUTTON').click(); true`)
  t.check('点击退出 → 登录页', await b.waitFor(`location.pathname === '/login'`, 8000))
  t.check('退出后没有 refresh Cookie', !(await b.send('Network.getCookies', { urls: [API + '/auth/refresh'] })).result.cookies.some(c => c.name === 'tt_refresh' && c.value))
  await t2.js(`document.querySelector('a[href="/profile"]')?.click(); true`)
  t.check('其他标签页下一次操作即回到登录页', await t2.waitFor(`location.pathname === '/login'`, 8000))
  t.check('没有前端报错', b.tabs.every(x => x.errors.length === 0), b.tabs.flatMap(x => x.errors).join(' | '))
} finally {
  await b.close()
  t.finish()
}
