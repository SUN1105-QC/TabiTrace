// 全页面审查（2026-11-13）：测试数据只在浏览器里注入（不写真实业务）；手机 / Pad 竖屏 / Pad 横屏 / 电脑四种尺寸，
// 逐屏截图（不放大视口，避免 vh 失真）+ 自动指标：横向溢出、文字截断、触屏点击区域（含伪元素扩大）、过小文字、坏图、脚本错误、未知接口。
// 用法：AUDIT_WEB=http://localhost:3000 node e2e/tools/audit-all-pages.mjs；可选 SIZES=375x812,1440x900、ONLY=页面名正则、SCREENS=每页最多几屏、TAG=输出子目录。
// 输出到 backend/.tabitrace/page-audit/<TAG>/（每屏 JPG 与 report.json，已被 Git 忽略）。开发环境的数据源切换按钮、sr-only 文字会出现在指标里，属于误报。
import fs from 'node:fs'
import path from 'node:path'
import {openBrowser} from '../lib/browser.mjs'
import {layoutFixture} from '../fixtures/layout-ui.mjs'
const out = path.resolve(process.env.AUDIT_OUTPUT || 'backend/.tabitrace/page-audit', process.env.TAG || 'base')
fs.mkdirSync(out, {recursive: true})
const web = (process.env.AUDIT_WEB || 'http://localhost:3000').replace(/\/$/, '')
const sizes = (process.env.SIZES || '375x812,768x1024,1024x768,1440x900').split(',').map(s => s.split('x').map(Number))
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null
const maxScreens = Number(process.env.SCREENS || 6)
const pages = [
  ['pub-home', '/', false], ['login', '/login', false], ['register', '/register', false], ['forgot', '/forgot-password', false],
  ['pub-explore', '/explore', false], ['pub-tokyo', '/explore/tokyo', false], ['pub-seoul', '/explore/seoul', false],
  ['pub-hk', '/explore/hong-kong', false], ['pub-taipei', '/explore/taipei', false], ['pub-pricing', '/pricing', false],
  ['credits', '/credits', false], ['public-share', '/s/fixture', false],
  ['home', '/', true], ['trips', '/trips', true], ['trip-new', '/trips/new', true], ['map', '/trips/900001/map', true],
  ['gallery', '/trips/900001/gallery', true], ['gallery-filter', '/trips/900001/gallery', true, "(()=>{const d=document.querySelector('.gl-filter-details');if(d)d.open=true;return !!d})()"], ['share-nine', '/trips/900001/share', true], ['share-scrap', '/trips/900001/share?mode=nine', true, "(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('旅行手帐'));e&&e.click();return !!e})()"],
  ['share-long', '/trips/900001/share?mode=long', true], ['share-poster', '/trips/900001/share?mode=poster', true],
  ['share-records', '/trips/900001/share', true, "(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('保存旅行记录'));e&&e.click();return !!e})()"], ['share-link', '/trips/900001/share', true, "(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('发送访问链接'));e&&e.click();return !!e})()"],
  ['video', '/trips/900001/video', true], ['memories', '/memories', true], ['profile', '/profile', true],
  ['pricing', '/pricing', true], ['explore', '/explore', true], ['tokyo', '/explore/tokyo', true]
].filter(([name]) => !only || only.test(name))

const fixture = session => {
  let src = layoutFixture({web, photoCount: 12, session})
  // 公开分享页：用同一份测试旅行
  src = src.replace('else window.__auditUnknown.push({p,method});', "else if(p.startsWith('/api/v1/share/'))data={trip,summary,timeline,featuredPhotos:photos,ownerNickname:'布局验收'};else window.__auditUnknown.push({p,method});")
  src = src.replace("['plans','official-cities','destinations','video-templates']", "['plans','official-cities','destinations']").replace('else window.__auditUnknown.push({p,method});', "else if(p==='/api/v1/video-templates')data=[{code:'CITY_WALK',name:'城市漫步',englishName:'City Walk',description:'节奏轻快的城市散步',suitableFor:'城市旅行',pace:'MEDIUM',transition:'fade',transitionSeconds:.5,plan:'FREE'},{code:'SLOW_LIFE',name:'慢生活',englishName:'Slow Life',description:'舒缓的风景与生活片段',suitableFor:'度假',pace:'SLOW',transition:'dissolve',transitionSeconds:.8,plan:'PRO'},{code:'NIGHT_CITY',name:'城市夜色',englishName:'Night City',description:'夜景与灯光',suitableFor:'夜游',pace:'FAST',transition:'slideleft',transitionSeconds:.4,plan:'PRO'}];else window.__auditUnknown.push({p,method});")
  src = src.replace("else if(p.endsWith('/video-projects')", "else if(p==='/api/v1/user/music')data={membership:{status:'ACTIVE',source:'OPEN_ACCESS',startedAt:null,expiresAt:null,inGracePeriod:false,features:[]},canUpload:true,canUse:true,limits:{maxFileBytes:20971520,maxTracks:20,maxTotalBytes:209715200,minDurationSeconds:10,maxDurationSeconds:600,formats:['MP3','M4A'],extensions:['mp3','m4a'],mimeTypes:['audio/mpeg','audio/mp4']},usage:{tracks:0,bytes:0},items:[]};else if(p.endsWith('/video-projects')")
  if (!src.includes("p.startsWith('/api/v1/share/')") || !src.includes('CITY_WALK') || !src.includes('maxTracks')) throw new Error('fixture patch failed')
  return src
}

const METRICS = `(() => {
  const W = innerWidth, H = innerHeight, touch = W < 1100
  const vis = e => { if (e.closest('details:not([open])') && !e.closest('summary')) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 }
  const hit = e => { const r = e.getBoundingClientRect(); let w = r.width, h = r.height; for (const p of ['::after', '::before']) { const c = getComputedStyle(e, p); if (c.content !== 'none' && c.position === 'absolute') { w = Math.max(w, r.width - parseFloat(c.left || 0) - parseFloat(c.right || 0)); h = Math.max(h, r.height - parseFloat(c.top || 0) - parseFloat(c.bottom || 0)) } } return [w, h] }
  const label = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') + ' "' + (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 30) + '"')
  const scrollerAncestor = e => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return p } return null }
  const all = [...document.querySelectorAll('body *')]
  const overflow = all.filter(e => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return (r.right > W + 2 || r.left < -2) && !scrollerAncestor(e) && getComputedStyle(e).position !== 'fixed' }).slice(0, 8).map(e => label(e) + ' L' + Math.round(e.getBoundingClientRect().left) + ' R' + Math.round(e.getBoundingClientRect().right))
  const clipped = all.filter(e => { if (!vis(e) || !e.childNodes.length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return false; const cs = getComputedStyle(e); if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none' || e.closest('[aria-hidden=true],svg')) return false; return (/(hidden|clip)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2) || (/(hidden|clip)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) }).slice(0, 8).map(label)
  const targets = touch ? [...document.querySelectorAll('a[href],button,select,input:not([type=hidden]),[role=button],summary')].filter(e => { if (!vis(e) || e.closest('[aria-hidden=true],.share-scale-inner,.sg-card,.sb-canvas,.cp-poster,.sl-page')) return false; const [w, h] = hit(e); return (w < 32 || h < 32) && !(e.tagName === 'A' && getComputedStyle(e).display === 'inline') && !/devds|leaflet-control-attribution/.test(e.className) }).slice(0, 10).map(e => label(e) + ' ' + hit(e).map(Math.round).join('x')) : []
  const tiny = W < 768 ? all.filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11 && !e.closest('[aria-hidden=true],.share-scale-inner,.sg-card,.sb-canvas,.cp-poster,svg')).slice(0, 8).map(e => label(e) + ' ' + getComputedStyle(e).fontSize) : []
  const broken = [...document.images].filter(i => i.complete && !i.naturalWidth && i.getAttribute('src') && vis(i)).map(i => i.getAttribute('src').slice(0, 80)).slice(0, 5)
  const fixedTall = all.filter(e => { const cs = getComputedStyle(e); if (!/(fixed|sticky)/.test(cs.position) || !vis(e)) return false; const r = e.getBoundingClientRect(); return r.height > H * 0.28 && r.width > W * 0.5 }).slice(0, 4).map(e => label(e) + ' h' + Math.round(e.getBoundingClientRect().height))
  return { W, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, title: document.title.slice(0, 40), h1: (document.querySelector('h1')?.innerText || '').slice(0, 40), overflow, clipped, targets, tiny, broken, fixedTall, unknown: (window.__auditUnknown || []).map(x => x.method + ' ' + x.p).slice(0, 6), alerts: [...document.querySelectorAll('[role=alert]')].map(e => e.innerText.slice(0, 60)).filter(Boolean) }
})()`

const report = []
for (const [w, h] of sizes) {
  const b = await openBrowser({mobile: w < 768})
  await b.send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: w < 1100})
  await b.send('Emulation.setTouchEmulationEnabled', {enabled: w < 1100, maxTouchPoints: w < 1100 ? 5 : 0})
  let fixtureId
  for (const [name, route, session, action] of pages) {
    if (fixtureId) await b.send('Page.removeScriptToEvaluateOnNewDocument', {identifier: fixtureId})
    fixtureId = (await b.send('Page.addScriptToEvaluateOnNewDocument', {source: fixture(session)})).result.identifier
    b.errors.length = 0
    try {
      await b.goto(web + route, 600)
      await b.waitFor("!document.querySelector('[aria-busy=true],.skeleton,.ss-skeleton,.animate-pulse')", 20000)
      await new Promise(r => setTimeout(r, 1800))
      if (action) { if (!await b.js(action)) console.log('action not found', name); await new Promise(r => setTimeout(r, 1200)) }
      const m = await b.js(METRICS)
      m.errors = [...b.errors].slice(0, 5)
      m.url = await b.js('location.pathname + location.search')
      const screens = Math.min(maxScreens, Math.ceil(m.docH / h))
      for (let i = 0; i < screens; i++) {
        await b.js(`scrollTo(0, ${i * Math.round(h * 0.9)}); true`)
        await new Promise(r => setTimeout(r, 450))
        const shot = await b.send('Page.captureScreenshot', {format: 'jpeg', quality: 70})
        fs.writeFileSync(path.join(out, `${name}-${w}-${i}.jpg`), Buffer.from(shot.result.data, 'base64'))
      }
      m.screens = screens
      report.push({name, size: `${w}x${h}`, ...m})
      const issues = ['overflow', 'clipped', 'targets', 'tiny', 'broken', 'fixedTall', 'unknown', 'alerts', 'errors'].filter(k => m[k]?.length).map(k => `${k}:${m[k].length}`).join(' ')
      console.log(`${w} ${name} docW=${m.docW} h=${m.docH} ${issues}`)
    } catch (e) {
      report.push({name, size: `${w}x${h}`, failed: e.message})
      console.log(`${w} ${name} FAILED ${e.message.slice(0, 120)}`)
    }
  }
  await b.close?.()
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1))
process.exit(0)
