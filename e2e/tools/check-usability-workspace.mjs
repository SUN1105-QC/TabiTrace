// Browser-only accounts and trips. No real user data or business writes.
import fs from 'node:fs'
import path from 'node:path'
import {openBrowser} from '../lib/browser.mjs'
import {layoutFixture} from '../fixtures/layout-ui.mjs'
const web=(process.env.UX_TEST_WEB||'http://127.0.0.1:3017').replace(/\/$/,'')
const out=path.resolve(process.env.UX_TEST_OUTPUT||'backend/.tabitrace/usability-preview-qa')
fs.mkdirSync(out,{recursive:true})
const b=await openBrowser(),results=[]
let fixtureId
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const check=(name,ok,details)=>{results.push({name,ok:Boolean(ok),details});console.log(`${ok?'PASS':'FAIL'} ${name}${ok?'':' '+JSON.stringify(details)}`)}
async function shot(name){const r=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.result.data,'base64'))}
async function load(route,width=390,extra={}){
 if(fixtureId)await b.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixtureId})
 fixtureId=(await b.send('Page.addScriptToEvaluateOnNewDocument',{source:layoutFixture({web,photoCount:8,...extra})})).result.identifier
 await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768})
 await b.goto(web+route,500)
 if(!await b.waitFor("!document.querySelector('[aria-busy=true],.skeleton,.ss-skeleton')&&!!document.querySelector('.workspace-spacer')",30000))throw new Error('Page not ready: '+route)
 await sleep(200)
}
async function click(selector){
 await b.js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`)
 const point=await b.js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
 for(const type of ['mousePressed','mouseReleased'])await b.send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1})
 await sleep(150)
}
const visible=s=>`(()=>{const e=document.querySelector(${JSON.stringify(s)});return !!e&&e.getBoundingClientRect().height>0&&e.getBoundingClientRect().width>0})()`
try{
 for(const width of [320,390,768,1024,1440,1920]){
  for(const route of ['/','/trips/new','/trips/900001/map','/trips/900001/gallery','/trips/900001/share?mode=nine']){
   await load(route,width,{longTitle:true})
   const m=await b.js("({width:innerWidth,root:document.documentElement.scrollWidth,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText),unknown:window.__auditUnknown})")
   check(`${width}px ${route} fits`,m.root<=width+1&&!m.alerts.length&&!m.unknown.length,m)
  }
 }
 await load('/',390)
 const home=await b.js("({top:document.querySelector('.hw-trip').getBoundingClientRect().top,actions:[...document.querySelectorAll('.hw-shortcuts a')].map(e=>e.getAttribute('href')),text:document.querySelector('.hw-trip').innerText})")
 check('Current trip appears in first mobile screen',home.top<260,home)
 check('All home actions identify current trip',home.actions.length===4&&home.actions.every(h=>h.startsWith('/trips/900001/')),home.actions)
 await shot('home-390')
 await b.fill('#hw-trip','900002')
 check('Home selector changes context and protects archived trip',await b.waitFor("document.querySelector('.hw-trip').innerText.includes('已归档')&&[...document.querySelectorAll('.hw-shortcuts a')].every(a=>a.getAttribute('href').startsWith('/trips/900002/'))&&!document.querySelector('.hw-trip button')",10000))
 await load('/',1440);await shot('home-1440')
 await b.fill('#hw-trip','900002')
 await b.waitFor("document.querySelector('.hw-trip').innerText.includes('已归档')",10000)
 await click('.quick-checkin')
 check('Header check-in follows switched archived trip and explains read-only state',await b.waitFor("document.querySelector('.qk-empty')?.innerText.includes('京都春日漫游')&&document.querySelector('.qk-empty')?.innerText.includes('已归档')",5000))
 await click('[aria-label="关闭快速打卡"]')
 const nav=await b.js("[...document.querySelectorAll('.workspace-nav')[0].querySelectorAll('a')].map(a=>a.getAttribute('href'))")
 check('Global navigation has four destinations',JSON.stringify(nav)===JSON.stringify(['/','/trips','/explore','/memories']),nav)
 await load('/trips/900001/map',390)
 check('Mobile itinerary is primary, without second fixed action row',await b.js(`${visible('.tm-panel-area')}&&!(${visible('.tm-map-area')})&&!document.querySelector('.tm-mobile-actions')&&${visible('.tm-add-desktop')}`))
 await shot('map-list-390')
 await click('.tm-view-switch button:nth-child(2)')
 check('Map switch shows map',await b.js(`${visible('.tm-map-area')}&&!(${visible('.tm-panel-area')})`))
 await click('.tm-view-switch button:nth-child(3)')
 check('Records switch shows timeline',await b.js(`${visible('.tm-timeline')}&&!(${visible('.tm-map-area')})`))
 await shot('map-records-390')
 await b.fill('.trip-context select','900002')
 check('Trip switch preserves current page and archived state',await b.waitFor("location.pathname==='/trips/900002/map'&&document.body.innerText.includes('已归档，只能查看')",10000))
 await load('/trips/900001/map',1440)
 await b.js("window.__confirmText='';window.confirm=text=>{window.__confirmText=text;return false}")
 await b.js("document.querySelector('.tm-timeline .tm-link').click()")
 check('Cancelling undo does not send deletion',await b.js("window.__confirmText.includes('不能恢复')&&!window.__auditIntercepted.some(r=>r.method==='DELETE')"))
 await load('/trips/900001/gallery',390)
 check('Photo filters start with two choices and collapsed advanced controls',await b.js("document.querySelectorAll('.gl-filters button').length===2&&!document.querySelector('.gl-filter-details').open"))
 check('Adding photos is in page header',await b.js(visible('.gl-add-desktop')))
 await click('.gl-filter-details summary')
 check('Advanced photo filters can be opened',await b.js(visible('[aria-label="关联状态筛选"]')))
 await shot('gallery-390')
 await load('/trips/new',390)
 const form=await b.js("({y:document.getElementById('cj-destination').getBoundingClientRect().top,inputs:[...document.querySelectorAll('.cj-form input')].map(e=>e.id),preview:document.querySelector('.cj-mobile-preview').open})")
 check('Destination comes first and mobile preview is collapsed',form.y<400&&form.inputs[0]==='cj-destination'&&!form.preview,form)
 await shot('create-390')
 for(const width of [390,1440]){
  await load('/trips/900001/share?mode=nine',width)
  const grid=await b.js("({count:document.querySelector('.ss-count').innerText,photos:document.querySelectorAll('.sg-tile img').length,empty:document.querySelectorAll('.sg-tile.is-empty').length,editorTop:document.querySelector('.ss-side').getBoundingClientRect().top,previewTop:document.querySelector('.ss-stage').getBoundingClientRect().top})")
  check(`${width}px actual nine-grid fill count and blank slot`,/8.*9/.test(grid.count)&&grid.photos===8&&grid.empty===1,grid)
  check(`${width}px material placement follows device`,width<1280?grid.editorTop<grid.previewTop:Math.abs(grid.editorTop-grid.previewTop)<2,grid)
  await shot('share-'+width)
  for(const slot of [0,4,8]){
   await b.js(`document.querySelectorAll('.ss-slot>button:first-child')[${slot}].click()`)
   await b.js("[...document.querySelectorAll('.ss-materials .ss-item')].at(-1).querySelector('button.ss-item-action,button:last-child').click()")
   check(`${width}px replacing slot ${slot+1} retains eight distinct photos`,await b.js("document.querySelectorAll('.sg-tile img').length===8&&new Set([...document.querySelectorAll('.sg-tile img')].map(i=>i.src)).size===8"))
  }
  await click('.ss-purpose button:nth-child(1)')
  await b.clickText('/导出打卡记录/','button')
  check(`${width}px record export opens from share workspace`,await b.waitFor("!!document.querySelector('dialog[open]')",5000))
  check(`${width}px record export includes map option`,await b.js("document.querySelector('[aria-label=\"包含旅行地图\"]').checked"))
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  check(`${width}px export closes with Escape`,await b.waitFor("!document.querySelector('dialog[open]')",2000))
  await click('.ss-purpose button:nth-child(3)')
  check(`${width}px link rules are shown before creation`,await b.waitFor("document.querySelector('.ss-link-rules')?.innerText.includes('新链接的当前规则')",5000))
 }
 await load('/',390,{empty:true})
 check('First trip empty state offers creation',await b.js("!!document.querySelector('.hw-empty a[href=\"/trips/new\"]')"))
 check('No frontend runtime errors',b.errors.length===0,b.errors)
 const writes=b.requests.filter(r=>new URL(r.url).pathname.startsWith('/api/v1/')&&r.method!=='GET')
 check('No real business writes',writes.length===0,writes)
}catch(e){check('Runner completed',false,String(e));await shot('runner-error').catch(()=>{})}
finally{await b.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));const failed=results.filter(r=>!r.ok);console.log(`Usability regression: ${results.length-failed.length}/${results.length} passed`);process.exitCode=failed.length?1:0}
