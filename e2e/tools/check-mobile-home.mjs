// 隔离业务接口，覆盖移动工作台的布局、图片预览、错误与空状态。
import fs from 'node:fs'
import path from 'node:path'
import { openBrowser } from '../lib/browser.mjs'
import { layoutFixture } from '../fixtures/layout-ui.mjs'
const web = process.env.UX_TEST_WEB || 'http://127.0.0.1:3017'
const out = path.resolve('backend/.tabitrace/mobile-home-qa')
fs.mkdirSync(out, { recursive: true })
const b = await openBrowser(), results = []
let scriptId
const check = (name, ok) => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
async function load(width, extra = {}, scenario = '') {
  if (scriptId) await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId })
  const fixture = layoutFixture({ web, photoCount: 8, ...extra }).replace("if(method==='GET'&&", "if(p.startsWith('/api/v1/official-cities'))return Promise.resolve(new Response(JSON.stringify({success:true,data:[]})));if(method==='GET'&&")
  scriptId = (await b.send('Page.addScriptToEvaluateOnNewDocument', { source: fixture + `
    const originalFixture=window.fetch;window.fetch=async(input,init)=>{const p=new URL(typeof input==='string'?input:input.url,location.href).pathname;
    if(${JSON.stringify(scenario)}==='photos-error'&&p.endsWith('/photos'))return new Response(JSON.stringify({success:false,message:'照片服务暂不可用'}),{status:500});
    const response=await originalFixture(input,init);
    if(p==='/api/v1/users/me'&&${JSON.stringify(scenario)}==='no-name'){const e=await response.json();e.data.nickname='';return new Response(JSON.stringify(e));}
    return response;};` })).result.identifier
  await b.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 })
  await b.goto(web, 300)
  if (!await b.waitFor("!!document.querySelector('.hw-workspace')&&!document.querySelector('.skeleton')", 30000)) throw Error('首页未加载')
}
async function shot(name) {
  const metrics = await b.send('Page.getLayoutMetrics')
  const size = metrics.result.cssContentSize
  const s = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.width, height: Math.min(size.height, 6000), scale: 1 } })
  fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(s.result.data, 'base64'))
}
try {
  for (const width of [320, 360, 375, 390, 430, 768, 1440]) {
    await load(width, { longTitle: true })
    check(`${width} 无横向溢出`, await b.js('document.documentElement.scrollWidth<=innerWidth+1'))
    check(`${width} 首页最多4条活动和6张真实照片`, await b.js("document.querySelectorAll('.hw-activities li').length===4&&document.querySelectorAll('.hw-photo-grid button').length===6"))
    check(`${width} 无常驻会员卡且照片与分享入口保留`, await b.js("!document.querySelector('.notification-account')&&!!document.querySelector('.hw-photos a[href$=gallery]')&&!!document.querySelector('.hw-export-tip a[href$=share]')"))
    if (width < 768) {
      check(`${width} 快捷入口严格两列`, await b.js("getComputedStyle(document.querySelector('.hw-shortcuts')).gridTemplateColumns.split(' ').length===2"))
      check(`${width} 核心模块顺序正确`, await b.js("(()=>{const cs=['.hw-trip','.hw-shortcuts','.hw-next','.hw-activities','.hw-photos','.hw-export-tip'].map(s=>document.querySelector(s).getBoundingClientRect().top);return cs.every((n,i)=>!i||n>cs[i-1])})()"))
    }
    await shot(`home-${width}`)
  }
  await load(390)
  await shot('home-normal-390')
  await b.js("document.querySelector('.hw-photo-grid button').click()")
  check('照片点击打开原生模态预览', await b.waitFor("!!document.querySelector('dialog[open]')&&document.activeElement.getAttribute('aria-label')==='关闭照片预览'"))
  await b.js("document.querySelector('[aria-label=\"下一张照片\"]').click()")
  check('照片支持前后切换', await b.waitFor("document.querySelector('.hw-photo-dialog header').innerText.includes('2 / 6')"))
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', windowsVirtualKeyCode: 27 })
  check('Escape关闭并恢复缩略图焦点', await b.waitFor("!document.querySelector('dialog')&&document.activeElement.closest('.hw-photo-grid')!==null"))
  await b.js("document.querySelector('.hw-photo-grid img').dispatchEvent(new Event('error'))")
  check('坏图显示文字占位', await b.waitFor("document.querySelector('.hw-photo-fallback')?.innerText.includes('照片暂时无法显示')"))
  await b.js("document.querySelector('.hw-activities header a').click()")
  check('查看全部进入真实活动列表且不受首页4条限制', await b.waitFor("location.pathname==='/activities'&&document.querySelectorAll('.hw-activities li').length>4"))
  await load(360, {}, 'photos-error')
  check('照片接口失败提供提示和重试', await b.waitFor("document.querySelector('.hw-load-issues')?.innerText.includes('照片')&&document.querySelector('.hw-load-issues button')?.innerText.includes('重试')"))
  await load(360, {}, 'no-name')
  check('缺少昵称使用旅人', await b.js("document.querySelector('.hw-heading h1').innerText.includes('你好，旅人')"))
  await load(320, { empty: true })
  check('无旅程显示真实创建入口和空态', await b.js("!!document.querySelector('.hw-empty a[href=\"/trips/new\"]')&&!document.querySelector('.hw-photo-grid')"))
  check('没有浏览器运行异常', b.errors.length === 0)
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ results, errors: b.errors }, null, 2))
  await b.close()
}
process.exitCode = results.every(r => r.ok) ? 0 : 1
