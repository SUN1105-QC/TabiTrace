// 重新截取公共首页的产品截图：frontend/public/images/landing/<name>.webp（1 倍）与 <name>@2x.webp（高清档，个别是 @3x）。
//
//   cd frontend && npm run images:landing                 全部重新截取
//   cd frontend && npm run images:landing -- share-grid   只截指定的几张
//
// 需要正在运行的 web + API + 测试邮箱（与 e2e 相同：E2E_WEB / E2E_API / E2E_MAILBOX_URL）。
// 流程：注册 tt-landing-*@example.test 测试账号 → 建演示旅行（landing-demo.mjs）→ 在 1440 宽、2 倍屏下截取各区域 → 删除演示旅行。
// 测试账号本身需要按 e2e/README.md 的 SQL 清理。地图截图里保留底图的版权署名（开发环境是 OpenStreetMap）。
import path from 'node:path'
import { createRequire } from 'node:module'
import { openBrowser } from '../lib/browser.mjs'
import { ROOT, WEB, call, sleep } from '../lib/common.mjs'
import { createDemoTrip, registerDemoUser } from './landing-demo.mjs'

const sharp = createRequire(path.join(ROOT, 'frontend/package.json'))('sharp')
const OUT = path.join(ROOT, 'frontend/public/images/landing')
const WIDTH = 1440, HEIGHT = 1000, SCALE = 2

const allDays = async b => {
  await b.js(`[...document.querySelectorAll('.tm-days button')].find(x => /全部/.test(x.innerText))?.click(); true`)
  await b.waitFor(`!!document.querySelector('.tm-timeline')`, 15000)
  await sleep(5000)   // 底图瓦片
}
const shareMode = mode => async b => {
  await b.js(`[...document.querySelectorAll('.ss-page button')].find(x => x.innerText.trim() === ${JSON.stringify(mode)})?.click(); true`)
  await sleep(2500)
}

// clip：要截的元素；或 { x: 取左右边界的元素, y: 取上边界的元素, height 或 heightOf: 取高度的元素 }；maxHeight：只截上面一段
const SHOTS = [
  // 「全部」时布局里还有时间轴，只截地图与右侧面板
  { name: 'map-workspace', url: t => `/trips/${t}/map`, prep: allDays, clip: { x: '.tm-layout', y: '.tm-layout', heightOf: '.tm-map-area' } },
  // 时间轴在平板（≤1024）上单列铺满，显示宽度比截图宽，高清档用 3 倍
  { name: 'timeline', url: t => `/trips/${t}/map`, prep: allDays, clip: '.tm-timeline', maxHeight: 780, scale: 3 },
  { name: 'gallery', url: t => `/trips/${t}/gallery`, clip: { x: '.gl-toolbar', y: '.gl-toolbar', height: 807 } },
  { name: 'video-studio', url: t => `/trips/${t}/video`, clip: { x: '.vs-hero', y: '.vs-hero', height: 953 } },
  { name: 'story-frame', url: t => `/trips/${t}/video`, clip: '.ts-phone' },
  { name: 'share-poster', url: t => `/trips/${t}/share`, prep: shareMode('城市海报'), clip: '.cp-poster' },
  { name: 'share-grid', url: t => `/trips/${t}/share`, prep: shareMode('九宫格'), clip: '.sg-card' },
  { name: 'share-long', url: t => `/trips/${t}/share`, prep: shareMode('每日长图'), clip: '.sl-card', maxHeight: 1364 }
]

const rectOf = (b, sel) => b.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height } })()`)

async function clipFor(b, shot) {
  if (typeof shot.clip === 'string') {
    const r = await rectOf(b, shot.clip)
    if (!r) throw new Error(`${shot.name}：找不到 ${shot.clip}`)
    return { ...r, height: Math.min(r.height, shot.maxHeight ?? Infinity) }
  }
  const [rx, ry] = [await rectOf(b, shot.clip.x), await rectOf(b, shot.clip.y)]
  const rh = shot.clip.heightOf ? await rectOf(b, shot.clip.heightOf) : null
  if (!rx || !ry || (shot.clip.heightOf && !rh)) throw new Error(`${shot.name}：找不到截图区域`)
  return { x: rx.x, width: rx.width, y: ry.y, height: rh ? rh.height : shot.clip.height }
}

/**
 * 截图区域超出窗口时先把窗口加高（不用 captureBeyondViewport：它会临时改变窗口大小、页面重新排版，
 * 分享成果预览会跟着移动，截到空白），再重新量一次位置；区域都在窗口内，懒加载图片也会加载。
 */
async function fitViewport(b, shot) {
  await b.js('scrollTo(0, 0); true')
  let clip = await clipFor(b, shot)
  const need = Math.ceil(clip.y + clip.height + 24)
  if (need > HEIGHT) {
    await b.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: need, deviceScaleFactor: shot.scale ?? SCALE, mobile: false })
    await sleep(1500)
    clip = await clipFor(b, shot)
  }
  await b.waitFor(`[...document.querySelectorAll('img')].every(i => { const r = i.getBoundingClientRect(); return r.top > ${clip.y + clip.height} || r.bottom < ${clip.y} || r.width < 2 || (i.complete && i.naturalWidth > 0) })`, 30000)
  await sleep(800)
  return clip
}

const only = process.argv.slice(2)

let user, tripId
const results = []
try {
  user = await registerDemoUser()
  tripId = await createDemoTrip(user.token)
  console.log(`演示旅行 ${tripId}（${user.email}）`)
  const b = await openBrowser({ width: WIDTH, height: HEIGHT })
  try {
    await b.session(user.refresh)
    for (const shot of SHOTS.filter(s => !only.length || only.includes(s.name))) {
      await b.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: shot.scale ?? SCALE, mobile: false })
      await b.goto(WEB + shot.url(tripId), 3500)
      // 截图里不要开发环境的浮层（数据源切换器、Next.js 指示器）
      await b.js(`(() => { const s = document.createElement('style'); s.textContent = 'nextjs-portal, [class^=devds] { display: none !important }'; document.head.append(s); return true })()`)
      if (shot.prep) await shot.prep(b)
      const clip = await fitViewport(b, shot)
      const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } })
      const png = Buffer.from(r.result.data, 'base64')
      const w = Math.round(clip.width), h = Math.round(clip.height)
      const full = await sharp(png).webp({ quality: 82, effort: 6 }).toFile(path.join(OUT, `${shot.name}@${shot.scale ?? SCALE}x.webp`))
      const one = await sharp(png).resize(w, h).webp({ quality: 84, effort: 6 }).toFile(path.join(OUT, `${shot.name}.webp`))
      results.push({ name: shot.name, width: w, height: h })
      console.log(`${shot.name.padEnd(14)} ${w}×${h}  1x ${Math.round(one.size / 1024)}KB  高清 ${full.width}×${full.height} ${Math.round(full.size / 1024)}KB`)
    }
  } finally { await b.close() }
  console.log('\n把下面的尺寸更新到 frontend/components/landing/landingDemo.ts 的 PRODUCT_SHOTS：')
  for (const r of results) console.log(`  ${r.name}: width: ${r.width}, height: ${r.height}`)
} catch (e) {
  console.error('截图失败：', e?.message || e)
  process.exitCode = 1
} finally {
  if (tripId) await call('DELETE', `/trips/${tripId}`, { token: user.token })
}
