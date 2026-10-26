// 关键路径：注册（邮箱验证码）→ 登录 → 创建旅行 → 快速打卡 → 上传照片 → 修改设置 → 退出
//
// - 注册 / 验证码 / 登录：走真实 API；验证码从测试邮箱读取（本地为 backend/scripts/dev-mail-catcher.mjs，
//   E2E_MAILBOX_URL 指定），生产的邮件适配器不做任何替换。自动化测试不在浏览器表单里输入密码。
// - 其余步骤：无界面浏览器操作真实页面（E2E_WEB），会话只通过 HttpOnly refresh Cookie 建立。
// 结束时删除测试旅行；测试账号（*@example.test）需要清理时见 e2e/README.md。
import { API, WEB, call, fixturePath, sleep, suite } from '../lib/common.mjs'
import { openBrowser } from '../lib/browser.mjs'

const t = suite('critical-path')
const MAILBOX = (process.env.E2E_MAILBOX_URL || 'http://127.0.0.1:1080').replace(/\/$/, '')
const stamp = Date.now().toString(36)
const email = `tt-e2e-${stamp}@example.test`
const password = `E2e-${stamp}-${Math.random().toString(36).slice(2, 8)}`
const today = new Date()
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const start = iso(today), end = iso(new Date(today.getTime() + 2 * 86400000))
let b, tripId, token

async function mailCode(to) {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILBOX}/api/messages?to=${encodeURIComponent(to)}`)).json().catch(() => [])
    const hit = (Array.isArray(list) ? list : []).find(m => JSON.stringify(m.to ?? '').includes(to)) ?? list[0]
    const code = /\b(\d{6})\b/.exec(hit?.text || '')?.[1]
    if (code) return code
    await sleep(300)
  }
  return null
}

try {
  t.section = '注册 / 登录'
  const sent = await call('POST', '/auth/email-verification/send', { body: { email, purpose: 'register' } })
  t.check('发送注册验证码', sent.status === 200, `${sent.status} ${sent.code}`)
  const code = await mailCode(email)
  t.check('测试邮箱收到 6 位验证码', /^\d{6}$/.test(code || ''))
  const verified = await call('POST', '/auth/email-verification/verify', { body: { email, code, purpose: 'register' } })
  t.check('验证码校验通过', verified.success, `${verified.status} ${verified.code}`)
  const reg = await call('POST', '/auth/register', { body: { nickname: 'E2E 旅人', email, password, emailVerificationToken: verified.data?.emailVerificationToken } })
  t.check('注册成功', reg.success && reg.data.accessToken && !reg.data.refreshToken, `${reg.status} ${reg.code}`)
  const loginRes = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const refresh = ((loginRes.headers.getSetCookie?.() ?? []).find(c => c.startsWith('tt_refresh=')) || '').split(';')[0].split('=')[1]
  token = (await loginRes.json()).data?.accessToken
  t.check('登录成功，refresh token 只在 HttpOnly Cookie', loginRes.ok && token && refresh)

  b = await openBrowser()
  await b.session(refresh)

  t.section = '创建旅行'
  await b.goto(WEB + '/trips/new', 1500)
  await b.fill('#cj-title', `E2E 东京 ${stamp}`)
  await b.js(`document.querySelector('#cj-destination').focus(); true`)
  await b.fill('#cj-destination', '东京')
  t.check('目的地搜索出现候选', await b.waitFor(`document.querySelectorAll('[role=option]').length > 0`, 10000))
  await b.js(`(() => { const o = [...document.querySelectorAll('[role=option]')].find(x => /东京/.test(x.innerText)) || document.querySelector('[role=option]'); o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); o.click(); return true })()`)
  await b.fill('#cj-start', start)
  await b.fill('#cj-end', end)
  await b.js(`document.querySelector('.cj-cta').click(); true`)
  t.check('创建成功并进入旅行详情', await b.waitFor(`/^\\/trips\\/\\d+$/.test(location.pathname)`, 20000), await b.js('location.pathname + " " + document.body.innerText.slice(0, 120)'))
  tripId = Number(await b.js(`location.pathname.split('/')[2]`))

  t.section = '快速打卡'
  await b.js(`(document.querySelector('.quick-checkin, .mobile-appbar-fab') || [...document.querySelectorAll('button')].find(x => /快速打卡/.test(x.innerText))).click(); true`)
  // 拍照优先：面板里默认只有拍照 / 相册入口与选填的心情；地点等在「修改记录信息」里手动修改
  t.check('打开快速打卡', await b.waitFor(`!!document.querySelector('[role=dialog][aria-label=快速打卡] .qk-shoot')`, 10000))
  await b.setFiles('[aria-label=快速打卡] input[type=file]:not([capture])', [fixturePath('asakusa.jpg')])
  t.check('选择照片后显示预览', await b.waitFor(`!!document.querySelector('[aria-label=快速打卡] .qk-photo img')`, 8000))
  await b.fill('[aria-label=快速打卡] textarea', 'E2E 打卡记录')
  await b.js(`document.querySelector('[aria-label=快速打卡] .qk-edit').open = true; true`)
  await b.waitFor(`!!document.querySelector('[aria-label=快速打卡] input[placeholder^="例如：浅草寺"]')`, 5000)
  await b.fill('[aria-label=快速打卡] input[placeholder^="例如：浅草寺"]', '浅草寺')
  await b.fill('[aria-label=快速打卡] input[placeholder="例如：浅草"]', '浅草')
  await b.clickText('/保存这一刻/', '[aria-label=快速打卡] button')
  t.check('保存后显示「这一刻已保存」', await b.waitFor(`/这一刻已保存/.test(document.querySelector('[aria-label=快速打卡] .qk-done')?.innerText || '')`, 30000), await b.js(`document.querySelector('[aria-label=快速打卡] .qk-error')?.innerText || ''`))
  await b.clickText('/^完成$/', '[aria-label=快速打卡] button')
  t.check('点「完成」关闭面板', await b.waitFor(`!document.querySelector('[role=dialog][aria-label=快速打卡]')`, 10000))
  const checkins = await call('GET', `/trips/${tripId}/checkins`, { token })
  t.check('打卡已写入（地点、备注）', checkins.data?.length === 1 && /浅草寺/.test(checkins.data[0].placeName) && checkins.data[0].note === 'E2E 打卡记录', JSON.stringify(checkins.data?.[0] ?? null).slice(0, 200))
  const withPhoto = await call('GET', `/trips/${tripId}/photos/page?limit=10`, { token })
  t.check('打卡附带的照片已上传（含缩略图）', withPhoto.data?.items?.length === 1 && withPhoto.data.items[0].checkinId === checkins.data?.[0]?.id && !!withPhoto.data.items[0].thumbUrl, JSON.stringify(withPhoto.data?.items?.[0] ?? null).slice(0, 200))

  t.section = '上传照片'
  await b.goto(`${WEB}/trips/${tripId}/gallery?view=grid&filter=ALL&sort=NEWEST`, 2000)
  await b.js(`document.querySelector('.gl-add-desktop').click(); true`)
  await b.waitFor(`!!document.querySelector('input[type=file]')`)
  await b.setFiles('input[type=file]', [fixturePath('shibuya.jpg')])
  await sleep(600)
  await b.clickText('/^上传/', '[role=dialog] button')
  t.check('上传完成（1 / 1 已完成）', await b.waitFor(`(document.querySelector('.gl-upload-summary')?.innerText || '').startsWith('1 / 1 已完成')`, 30000), await b.js(`document.querySelector('.gl-upload-summary')?.innerText`))
  await b.js(`([...document.querySelectorAll('[role=dialog] button')].find(x => /完成|关闭/.test(x.innerText + (x.getAttribute('aria-label') || ''))))?.click(); true`)
  t.check('照片墙显示 2 张（缩略图）', await b.waitFor(`document.querySelectorAll('.gl-grid img').length === 2 && [...document.querySelectorAll('.gl-grid img')].every(i => /thumb/.test(decodeURIComponent(i.src)))`, 10000), await b.js(`document.querySelectorAll('.gl-grid img').length`))

  t.section = '设置'
  await b.goto(WEB + '/profile', 2000)
  t.check('设置页加载', await b.waitFor(`!!document.querySelector('#st-nickname')`))
  await b.fill('#st-nickname', `E2E ${stamp.slice(-4)}`)
  t.check('出现未保存提示', await b.waitFor(`!!document.querySelector('.st-unsaved')`))
  await b.js(`document.querySelector('.st-unsaved .is-primary').click(); true`)
  await b.waitFor(`!document.querySelector('.st-unsaved')`, 10000)
  const me = await call('GET', '/users/me', { token })
  t.check('昵称已保存到服务端', me.data?.nickname === `E2E ${stamp.slice(-4)}`, me.data?.nickname)

  t.section = '退出'
  await b.goto(WEB + '/trips', 1500)
  await b.js(`document.querySelector('.user-chip').click(); true`)
  await sleep(300)
  await b.js(`[...document.querySelectorAll('[role=menuitem]')].find(x => x.tagName === 'BUTTON').click(); true`)
  t.check('退出后回到登录页', await b.waitFor(`location.pathname === '/login'`, 10000))
  const cookies = (await b.send('Network.getCookies', { urls: [API + '/auth/refresh'] })).result.cookies
  t.check('浏览器里不再有 refresh Cookie', !cookies.some(c => c.name === 'tt_refresh' && c.value))
  const again = await fetch(API + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `tt_refresh=${refresh}` }, body: '{}' })
  t.check('旧的 refresh token 已在服务端失效', again.status === 401, again.status)
  t.check('全程没有前端报错', b.errors.length === 0, b.errors.join(' | '))
} finally {
  if (tripId && token) {
    const re = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(r => r.json()).catch(() => null)
    const del = await call('DELETE', `/trips/${tripId}`, { token: re?.data?.accessToken || token })
    t.check('清理：删除测试旅行（含照片对象）', del.success, `${del.status} ${del.code}`)
  }
  await b?.close()
  console.log(`测试账号：${email}（*@example.test，清理方式见 e2e/README.md）`)
  t.finish()
}
