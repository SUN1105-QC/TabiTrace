// Read-only browser regression for the five layout issues from the 2026-11-05 audit.
// API fixtures stay in the browser; public catalog/plan GETs use the configured API.
import fs from 'node:fs'
import path from 'node:path'
import {openBrowser} from '../lib/browser.mjs'
import {layoutFixture} from '../fixtures/layout-ui.mjs'

const web=(process.env.LAYOUT_TEST_WEB||'http://127.0.0.1:3015').replace(/\/$/,'')
const output=path.resolve(process.env.LAYOUT_TEST_OUTPUT||'backend/.tabitrace/layout-regression')
fs.mkdirSync(output,{recursive:true})
const browser=await openBrowser()
const results=[]
let fixtureId
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
function check(name,ok,details){results.push({name,ok:Boolean(ok),details});console.log(`${ok?'PASS':'FAIL'} ${name}${ok?'':' '+JSON.stringify(details)}`)}
async function shot(name){const r=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(r.result.data,'base64'))}
async function load(route,width,height=1000,fixture={}){
  if(fixtureId)await browser.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixtureId})
  const source=layoutFixture({web,...fixture});new Function(source)
  fixtureId=(await browser.send('Page.addScriptToEvaluateOnNewDocument',{source})).result.identifier
  await browser.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768||height<450})
  await browser.goto(web+route,350)
  const ready=route==='/'?'.hw-workspace':route==='/trips'?'.dashboard-grid':route==='/memories'?'.mm-page h1':route.startsWith('/pricing')?'.pr-trip-info h2,.pr-trip.is-empty':route.includes('/share')?'.ss-head h1':'.tm-tl-photos'
  if(!await browser.waitFor(`!!document.querySelector(${JSON.stringify(ready)})&&!document.querySelector('[aria-busy=true]')`,20000))throw new Error('Page not ready: '+route)
  await browser.js("document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))")
}
async function actualClick(selector){
  await browser.js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`)
  const at=await browser.js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  for(const type of ['mousePressed','mouseReleased'])await browser.send('Input.dispatchMouseEvent',{type,...at,button:'left',clickCount:1})
  await pause(150)
}
const widthMetric=`({root:document.documentElement.scrollWidth,innerWidth,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText),unknown:window.__auditUnknown})`
try{
  // Avoid reliance on a third-party map tile server for layout-only checks.
  await browser.send('Fetch.enable',{patterns:[{urlPattern:'*tile.openstreetmap.org/*'}]})
  browser.hooks.push(e=>{if(e.method==='Fetch.requestPaused')void browser.send('Fetch.fulfillRequest',{requestId:e.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9kAAAAASUVORK5CYII='})})

  for(const width of [360,390,768,1024,1440,1920]){
    for(const longTitle of [false,true]){
      for(const route of ['/','/trips','/memories','/pricing?tripId=900001','/trips/900001/share?mode=nine']){
        await load(route,width,width<768?844:1000,{longTitle})
        const metrics=await browser.js(widthMetric)
        await browser.js("scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");await pause(80)
        const bottom=await browser.js(widthMetric)
        const ok=Math.max(metrics.root,metrics.innerWidth,bottom.root,bottom.innerWidth)<=width+1&&metrics.alerts.length===0&&metrics.unknown.length===0
        const label=`${width}px ${longTitle?'long title':'normal'} ${route}`
        check(label,ok,{top:metrics,bottom})
        if(!ok)await shot('failure-'+results.length)
        if(width===390&&longTitle&&route.includes('/share')){await browser.js("scrollTo({top:0,behavior:'instant'})");await shot('share-long-title-390')}
        if(width===1440&&longTitle&&route==='/memories'){await browser.js("scrollTo({top:0,behavior:'instant'})");await shot('memories-long-title-1440')}
        if(width===390&&longTitle&&route.startsWith('/pricing')){await browser.js("document.querySelector('.pr-trip').scrollIntoView({block:'start',behavior:'instant'})");await shot('pricing-long-title-390')}
      }
    }
  }

  for(const width of [360,390,768,1440]){
    await load('/pricing?tripId=900001',width,1000,{longTitle:true,planType:'FREE',enablePayments:true})
    const cta=await browser.js(`(()=>{const b=document.querySelector('.pr-plan.is-pro button.pr-cta');return{enabled:!!b&&!b.disabled,text:b?.innerText,root:document.documentElement.scrollWidth}})()`)
    check(`${width}px named upgrade button fits long title`,cta.enabled&&cta.text.includes('TravelMemory')&&cta.root<=width+1,cta)
    await browser.js("scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})");await pause(80)
    const m=await browser.js(widthMetric)
    check(`${width}px FREE price page remains bounded after scrolling`,m.root<=width+1&&m.innerWidth<=width+1,m)
  }

  for(const width of [768,860,1023]){
    await load('/trips',width)
    await actualClick('.topbar-menu')
    const hit=await browser.js(`(()=>{const link=document.querySelector('.sidebar-create'),r=link.getBoundingClientRect();return link.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`)
    check(`${width}px sidebar receives clicks`,hit)
    if(width===768)await shot('sidebar-768')
    await actualClick('.sidebar-create')
    check(`${width}px sidebar navigates`,await browser.waitFor("location.pathname==='/trips/new'&&!document.querySelector('.workspace-sidebar.is-open')",10000))
    await actualClick('.topbar-menu');await actualClick('.sidebar-close')
    check(`${width}px sidebar close button`,await browser.js("!document.querySelector('.workspace-sidebar.is-open')"))
    await actualClick('.topbar-menu');await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',x:width-10,y:300,button:'left',clickCount:1});await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:width-10,y:300,button:'left',clickCount:1});await pause(100)
    check(`${width}px outside scrim dismisses drawer`,await browser.js("!document.querySelector('.workspace-sidebar.is-open')"))
  }

  for(const [width,height] of [[360,640],[844,390],[667,375],[1440,700]]){
    for(const longTitle of [false,true]){
      await load('/trips',width,height,{longTitle})
      await browser.clickText('/搜索地点/','button')
      if(!await browser.waitFor("document.querySelectorAll('.command-result').length>5",5000))throw new Error('Search results not ready')
      const rows=await browser.js(`(()=>{const list=document.querySelector('.command-results'),r=list.getBoundingClientRect(),rows=[...list.querySelectorAll('.command-result')].map(e=>e.getBoundingClientRect());return {count:rows.length,fit:rows.every(e=>Math.abs(e.left-r.left-8)<2&&Math.abs(e.width-(list.clientWidth-16))<2),stacked:rows.every((e,i)=>!i||e.top>=rows[i-1].bottom-1)}})()`)
      check(`${width}×${height} search rows ${longTitle?'long':'normal'}`,rows.count>5&&rows.fit&&rows.stacked,rows)
      await browser.js("document.querySelector('.command-results').scrollTop=1e6")
      const bounds=await browser.js(`(()=>{const p=document.querySelector('.command-panel').getBoundingClientRect(),input=document.querySelector('.command-input').getBoundingClientRect(),last=[...document.querySelectorAll('.command-result')].at(-1).getBoundingClientRect();return {panelTop:p.top,panelBottom:p.bottom,lastTop:last.top,lastBottom:last.bottom,inputHeight:input.height,height:innerHeight,width:document.documentElement.scrollWidth}})()`)
      check(`${width}×${height} final search result reachable ${longTitle?'long':'normal'}`,bounds.panelTop>=0&&bounds.panelBottom<=height&&bounds.lastTop>=0&&bounds.lastBottom<=height&&bounds.inputHeight>=50&&bounds.width<=width+1,bounds)
      if(width===844&&!longTitle)await shot('search-landscape-last-result')
      if(width===1440&&!longTitle){await browser.js("document.querySelector('.command-results').scrollTop=0");await shot('search-rows-desktop')}
      await actualClick('.command-input button')
      check(`${width}×${height} search closes`,await browser.js("!document.querySelector('.command-panel')"))
    }
  }

  for(const width of [360,375,390]){
    for(const photosPerCheckin of [1,4,5,7]){
      await load('/trips/900001/map',width,800,{photoCount:photosPerCheckin*3})
      await actualClick('.tm-view-switch button:nth-child(3)')
      await browser.js("document.querySelector('.tm-tl-photos').scrollIntoView({block:'center',behavior:'instant'})")
      const metrics=await browser.js(`(()=>{const strips=[...document.querySelectorAll('.tm-tl-photos')];return {root:document.documentElement.scrollWidth,innerWidth,tiles:[...document.querySelectorAll('.tm-tl-photos img,.tm-tl-photos span')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),contained:strips.every(e=>e.scrollWidth<=e.clientWidth+1),counter:strips[0].querySelector('span')?.innerText}})()`)
      check(`${width}px map ${photosPerCheckin} photos per record`,metrics.root<=width+1&&metrics.innerWidth<=width+1&&metrics.contained&&metrics.tiles.every(e=>e.width===72&&e.height===72)&&(photosPerCheckin<=4||metrics.counter==='+'+(photosPerCheckin-4)),metrics)
      if(width===360&&photosPerCheckin===5)await shot('map-five-photos-360')
    }
  }
  for(const width of [360,1440]){
    for(const route of ['/','/trips','/memories','/pricing']){
      await load(route,width,1000,{empty:true})
      const m=await browser.js(widthMetric)
      check(`${width}px empty ${route}`,m.root<=width+1&&!m.alerts.length&&!m.unknown.length,m)
    }
  }
  check('No frontend runtime errors',browser.errors.length===0,browser.errors)
}catch(error){check('Regression runner completed',false,String(error));await shot('runner-error').catch(()=>{})}
finally{
  await browser.close()
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(results,null,2))
  const failures=results.filter(r=>!r.ok)
  console.log(`Layout regression: ${results.length-failures.length}/${results.length} passed`)
  process.exitCode=failures.length?1:0
}
