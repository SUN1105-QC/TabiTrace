// 所有业务请求使用浏览器夹具，验证菜单外观与真实首页切换链路。
import fs from 'node:fs'
import path from 'node:path'
import { openBrowser } from '../lib/browser.mjs'
import { layoutFixture } from '../fixtures/layout-ui.mjs'
const web = process.env.UX_TEST_WEB || 'http://127.0.0.1:3000'
const out = path.resolve('backend/.tabitrace/home-switcher-qa')
fs.mkdirSync(out, { recursive: true })
const b = await openBrowser(), results = []
const check = (name, ok) => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
let fixtureId
async function load(width, longTitle = false) {
  if (fixtureId) await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixtureId })
  const fixture = layoutFixture({ web, longTitle }).replace("if(method==='GET'&&", "if(p.startsWith('/api/v1/official-cities'))return Promise.resolve(new Response(JSON.stringify({success:true,data:[]})));if(method==='GET'&&")
  fixtureId = (await b.send('Page.addScriptToEvaluateOnNewDocument', { source: fixture })).result.identifier
  await b.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 })
  await b.goto(web, 400)
  if (!await b.waitFor("!!document.querySelector('.hw-trip-trigger')", 30000)) throw Error('首页未加载')
}
async function key(key, code) {
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, ...(key === 'Enter' ? { text: '\r' } : {}) })
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code })
}
try {
  for (const width of [1024, 1440, 1920]) {
    await load(width, true)
    await b.js("document.querySelector('.hw-trip-trigger').click()")
    check(`${width} 菜单适中字号且无视口溢出`, await b.js("(()=>{const e=document.querySelector('.hw-trip-menu'),r=e.getBoundingClientRect();return getComputedStyle(e.querySelector('button')).fontSize==='14px'&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth})()"))
    check(`${width} 长标题可完整换行且当前项有标记`, await b.js("document.querySelector('[role=menuitemradio][aria-checked=true]').innerText.length>100&&getComputedStyle(document.querySelector('.hw-trip-menu button span')).overflowWrap==='anywhere'"))
    const shot = await b.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(out, `menu-${width}.png`), Buffer.from(shot.result.data, 'base64'))
    await key('Escape', 27)
    check(`${width} Escape 关闭并恢复标题焦点`, await b.waitFor("!document.querySelector('.hw-trip-menu')&&document.activeElement.classList.contains('hw-trip-trigger')"))
  }
  await load(1440)
  await b.js("document.querySelector('.hw-trip-trigger').click()")
  const normal = await b.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(out, 'menu-normal-1440.png'), Buffer.from(normal.result.data, 'base64'))
  await key('Escape', 27)
  await b.js("document.querySelector('.hw-trip-trigger').focus()")
  await key('ArrowDown', 40)
  check('键盘可打开菜单并定位当前旅行', await b.waitFor("document.activeElement.getAttribute('aria-checked')==='true'"))
  await key('End', 35)
  check('End 将焦点移至最后一段旅行', await b.js("document.activeElement.getAttribute('role')==='menuitemradio'&&document.activeElement.innerText.includes('京都')"))
  await key('Enter', 13)
  check('键盘选择更新旅行和四个快捷入口并保护归档状态', await b.waitFor("document.querySelector('.hw-trip')?.innerText.includes('已归档')&&[...document.querySelectorAll('.hw-shortcuts a')].every(a=>a.getAttribute('href').startsWith('/trips/900002/'))&&!document.querySelector('.hw-trip-actions button')", 15000))
  await b.js("document.querySelector('.hw-trip-trigger').click()")
  await b.waitFor("!!document.querySelector('.hw-trip-menu')")
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 300, y: 180, button: 'left', clickCount: 1 })
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 300, y: 180, button: 'left', clickCount: 1 })
  check('点击外部关闭菜单', await b.waitFor("!document.querySelector('.hw-trip-menu')"))
  for (const width of [360, 768]) {
    await load(width)
    if (width < 768) {
      check('手机保留系统旅行选择器', await b.js("document.querySelector('#hw-trip').getBoundingClientRect().width>0&&document.querySelector('.hw-trip-trigger').getBoundingClientRect().width===0"))
      await b.fill('#hw-trip', '900002')
      check('手机切换仍更新旅行上下文', await b.waitFor("document.querySelector('.hw-trip')?.innerText.includes('已归档')"))
    } else {
      await b.js("document.querySelector('.hw-trip-trigger').click()")
      check('平板宽度菜单显示正常', await b.js("document.querySelector('.hw-trip-menu').getBoundingClientRect().right<=innerWidth"))
    }
  }
  check('无浏览器运行错误', b.errors.length === 0)
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ results, errors: b.errors }, null, 2))
  await b.close()
}
process.exitCode = results.every(r => r.ok) ? 0 : 1
