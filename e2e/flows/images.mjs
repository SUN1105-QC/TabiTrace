// 图片清晰度与下载量回归（对应《TabiTrace 全站图片高清化报告》）：
// - 头像：设置页上传后同时生成 160px 小图，导航栏用小图；更换头像后旧的原图与小图都被删除
// - 照片墙：每张照片有缩略图 / 中图 / 原图三档 srcset，1440 普通屏上不下载原图
// - 首页：桌面版和手机版 Hero 同时渲染、CSS 隐藏其中一个，被隐藏的那张不下载
// - 推荐探索：官方景点图按显示宽度选档，像素够用，小卡不下载 1920 / 2560 档
// - 公共首页：产品截图 1 倍屏用 1 倍图、2 倍屏用高清档
// 账号走真实注册流程（测试邮箱，见 e2e/README.md），演示旅行由 e2e/tools/landing-demo.mjs 生成（8 张真实照片）。
import { API, WEB, call, fixturePath, sleep, suite } from '../lib/common.mjs'
import { openBrowser } from '../lib/browser.mjs'
import { createDemoTrip, registerDemoUser } from '../tools/landing-demo.mjs'

const t = suite('images')

/** 页面里可见的官方景点图：档位、显示尺寸、按 cover 铺满需要的像素 */
const HD_IMAGES = `[...document.querySelectorAll('img')].map(i => {
  const m = /\\/images\\/explore\\/hd\\/(\\d+)\\//.exec(i.currentSrc || '')
  const r = i.getBoundingClientRect()
  if (!m || r.width < 8 || r.height < 8) return null
  const aspect = i.naturalWidth / Math.max(1, i.naturalHeight)
  const cover = getComputedStyle(i).objectFit === 'cover'
  return { alt: i.alt, tier: +m[1], w: Math.round(r.width), need: Math.round((cover ? Math.max(r.width, r.height * aspect) : r.width) * devicePixelRatio) }
}).filter(Boolean)`

let user, tripId, b
try {
  t.section = '准备'
  user = await registerDemoUser('tt-e2e-img')
  tripId = await createDemoTrip(user.token)
  t.check('注册测试账号并建好演示旅行（8 张照片）', Boolean(tripId))
  b = await openBrowser({ width: 1440, height: 900 })
  await b.session(user.refresh)
  await b.send('Network.setCacheDisabled', { cacheDisabled: true })

  t.section = '头像'
  await b.goto(`${WEB}/profile`, 2500)
  const uploadAvatar = async file => {
    await b.waitFor(`!!document.querySelector('.st-avatar-uploader input[type=file]')`, 10000)
    await b.setFiles('.st-avatar-uploader input[type=file]', [fixturePath(file)])
    for (let i = 0; i < 40; i++) {
      const me = (await call('GET', '/users/me', { token: user.token })).data
      if (me?.avatarUrl && me.avatarUrl !== uploadAvatar.last) { uploadAvatar.last = me.avatarUrl; return me }
      await sleep(400)
    }
    return null
  }
  const first = await uploadAvatar('asakusa.jpg')
  t.check('上传头像后同时保存了小图', Boolean(first?.avatarUrl && first?.avatarSmallUrl && first.avatarSmallUrl !== first.avatarUrl), JSON.stringify(first ?? null).slice(0, 200))
  const px = async url => b.js(`new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r([0, 0]); i.src = ${JSON.stringify(url)} })`)
  const [sw, sh] = first?.avatarSmallUrl ? await px(first.avatarSmallUrl) : [0, 0]
  t.check('小图是 160×160（原图不足 160 时按原图大小）', sw === sh && sw > 0 && sw <= 160, `${sw}×${sh}`)
  await b.goto(`${WEB}/trips`, 2500)
  const chip = await b.js(`document.querySelector('.user-chip .user-avatar')?.currentSrc || ''`)
  t.check('桌面导航栏头像用小图', Boolean(first?.avatarSmallUrl) && chip === first.avatarSmallUrl, chip)
  await b.goto(`${WEB}/profile`, 2500)
  const second = await uploadAvatar('shibuya.jpg')
  const gone = first ? await Promise.all([first.avatarUrl, first.avatarSmallUrl].map(u => fetch(u).then(r => r.status))) : []
  t.check('更换头像后，旧的原图与小图都已删除', Boolean(second?.avatarSmallUrl) && gone.length === 2 && gone.every(s => s === 404), gone.join(','))

  t.section = '照片墙'
  await b.goto(`${WEB}/trips/${tripId}/gallery`, 3000)
  await b.js(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 150)) } scrollTo(0, 0); return true })()`)
  await sleep(1500)
  const cards = await b.js(`[...document.querySelectorAll('.gl-card img')].map(i => ({ set: (i.getAttribute('srcset') || '').split(',').length, src: decodeURIComponent(i.currentSrc || '') }))`)
  t.check('8 张照片都有缩略图 / 中图 / 原图三档 srcset', cards.length === 8 && cards.every(c => c.set === 3), JSON.stringify(cards.map(c => c.set)))
  t.check('1440 普通屏的照片墙只用缩略图或中图，不下载原图', cards.length > 0 && cards.every(c => /-(thumb|medium)\./.test(c.src)), cards.map(c => c.src.split('/').pop()).join(', '))

  t.section = '首页 Hero'
  const heroes = async () => b.js(`[['.home-hero', document.querySelector('.home-hero img')], ['.m-hero', document.querySelector('.m-hero img')]].map(([k, i]) => k + '=' + (i ? (i.currentSrc.startsWith('data:') ? '占位' : i.currentSrc.replace(location.origin, '')) : '无'))`)
  await b.goto(`${WEB}/`, 3000)
  const desk = await heroes()
  t.check('桌面：显示桌面 Hero，隐藏的手机 Hero 不下载', /\.home-hero=\/images\/explore\/hd\//.test(desk[0]) && desk[1] === '.m-hero=占位', desk.join(' | '))
  await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true })
  await b.goto(`${WEB}/`, 3000)
  const phone = await heroes()
  t.check('手机：显示手机 Hero，隐藏的桌面 Hero 不下载', phone[0] === '.home-hero=占位' && /\.m-hero=\/images\/explore\/hd\//.test(phone[1]), phone.join(' | '))

  t.section = '推荐探索'
  for (const [w, h, dpr] of [[1440, 900, 1], [1440, 900, 2], [390, 844, 3]]) {
    await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: w < 768 })
    await b.goto(`${WEB}/explore/tokyo`, 3000)
    await b.waitFor(`document.querySelectorAll('#xp-recommend .xp-card:not(.is-skeleton)').length > 0`, 20000)
    await b.js(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise(r => setTimeout(r, 150)) } scrollTo(0, 0); return true })()`)
    await sleep(2000)
    const imgs = await b.js(HD_IMAGES)
    const blurry = imgs.filter(i => i.tier < 2560 && i.tier < i.need * 0.9)
    const oversize = imgs.filter(i => i.tier >= 1920 && i.need < 1100)
    t.check(`${w}×${h}@${dpr}x：${imgs.length} 张景点图像素够用，小卡不下载 1920 / 2560 档`, imgs.length > 0 && !blurry.length && !oversize.length,
      [...blurry.map(i => `${i.alt} ${i.tier}<${i.need}`), ...oversize.map(i => `${i.alt} ${i.tier} 过大`)].join('，'))
  }

  t.section = '公共首页'
  const anon = await openBrowser({ width: 1440, height: 900 })
  try {
    for (const dpr of [1, 2]) {
      await anon.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: dpr, mobile: false })
      await anon.goto(`${WEB}/`, 3000)
      await anon.js(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 200)) } return true })()`)
      await sleep(1500)
      // 选中的那一档像素够用（≥ 显示宽度 × 倍率 × 0.9）；1 倍图已经够用时不下载高清档
      const shots = await anon.js(`[...document.querySelectorAll('.ld-preview-shot img')].map(i => {
        const cands = i.getAttribute('srcset').split(',').map(s => s.trim().split(/\\s+/)).map(([u, w]) => ({ u, w: parseInt(w) }))
        const cur = cands.find(c => i.currentSrc.endsWith(c.u)), need = Math.round(i.getBoundingClientRect().width * devicePixelRatio)
        return { name: i.currentSrc.split('/').pop(), px: cur?.w ?? 0, need, oneX: cands[0].w }
      })`)
      const bad = shots.filter(s => s.px < s.need * 0.9 || (s.px > s.oneX && s.oneX >= s.need))
      t.check(`${dpr} 倍屏：4 张产品截图像素够用，1 倍图够用时不下载高清档`, shots.length === 4 && !bad.length, shots.map(s => `${s.name} ${s.px}/${s.need}`).join(', '))
    }
  } finally { await anon.close() }
  t.check('全程没有前端报错', b.errors.length === 0, b.errors.join(' | '))
} catch (e) {
  t.check('运行', false, e?.message || e)
} finally {
  if (tripId) {
    const del = await call('DELETE', `/trips/${tripId}`, { token: user.token })
    t.check('清理：删除演示旅行（含照片对象）', del.success, `${del.status} ${del.code}`)
  }
  await b?.close()
  if (user) console.log(`测试账号：${user.email}（*@example.test，清理方式见 e2e/README.md）`)
  t.finish()
}
