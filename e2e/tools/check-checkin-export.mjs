// Read-only UI fixtures. Does not sign in to or write to an actual user account.
import fs from 'node:fs'
import path from 'node:path'
import { openBrowser } from '../lib/browser.mjs'

const web = process.env.CHECKIN_EXPORT_WEB || 'http://127.0.0.1:3000'
const output = path.resolve(process.env.CHECKIN_EXPORT_OUTPUT || 'backend/.tabitrace/checkin-export-qa')
fs.mkdirSync(output, { recursive: true })
const webgl = process.env.CHECKIN_EXPORT_WEBGL === '1'
const browser = await openBrowser({ width: 1440, height: 1100, softwareWebGL: webgl })
let passed = 0, failed = 0
const check = (name, value) => { console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); value ? passed++ : failed++ }
const trip = { id: 900001, title: '东京自驾游 · 打卡记录', city: '东京', destinationName: '东京', startDate: '2026-10-30', endDate: '2026-10-31', peopleCount: 1, planType: 'FREE', status: 'ARCHIVED', visibility: 'PRIVATE' }
const photos = ['asakusa', 'tokyo-tower', 'tokyo-station', 'ginza'].map((name, i) => ({ id: i + 1, imageUrl: `${web}/images/explore/${name}.jpg`, featured: false }))
const timeline = [
  { date: '2026-10-30', items: [
    { checkin: { id: 1, tripId: trip.id, placeName: '浅草寺与仲见世商店街', area: '东京 · 浅草', checkinType: 'MANUAL', checkinTime: '2026-10-30T09:30:00+09:00', weatherText: '晴', temperatureC: 21, note: '清晨抵达浅草寺，沿着仲见世商店街散步。\n记下这段旅行的第一次到达。' }, photos: photos.slice(0, 3) },
    { checkin: { id: 2, tripId: trip.id, placeName: '东京站', area: '丸之内', checkinType: 'MANUAL', checkinTime: '2026-10-30T14:20:00+09:00', note: '红砖车站前的午后，和朋友一起拍下合照。' }, photos: photos.slice(3) }
  ] },
  { date: '2026-10-31', items: [{ checkin: { id: 3, tripId: trip.id, placeName: '东京塔', area: '港区', checkinType: 'MANUAL', checkinTime: '2026-10-31T18:30:00+09:00', note: Array.from({ length: 100 }, (_, i) => `旅途笔记 ${i + 1}：把走过的街道与看过的风景，收进这段回忆。`).join('\n') }, photos: [] }] }
]
Object.assign(timeline[0].items[0].checkin,{latitude:35.71476,longitude:139.79665})
Object.assign(timeline[0].items[1].checkin,{placeId:101})
Object.assign(timeline[1].items[0].checkin,{latitude:35.65858,longitude:139.74543})
const places=[{id:101,name:'东京站',latitude:35.68124,longitude:139.767125,sourceType:'MANUAL'}]
const source = `(() => {
  localStorage.setItem('tabitrace-session','1');localStorage.setItem('tabitrace.dev.dataSource','local');
  const trip=${JSON.stringify(trip)},timeline=${JSON.stringify(timeline)},places=${JSON.stringify(places)};
  const original=fetch.bind(window);
  window.fetch=(input,init)=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href),p=url.pathname;
    if(!p.startsWith('/api/v1/')) {
      if(url.pathname==='/fixture-failed-photo') return Promise.resolve(new Response('',{status:404}));
      return original(input,init);
    }
    let data=[];
    const mode=sessionStorage.getItem('checkin-export-mode')||'normal';
    if(p.endsWith('/auth/refresh'))data={accessToken:'browser-only-fixture'};
    else if(p==='/api/v1/users/me')data={id:900001,email:'fixture@example.invalid',nickname:'验收',locale:'zh-CN',timezone:'Asia/Tokyo',emailNotifications:false};
    else if(p==='/api/v1/trips')data=[trip];
    else if(p==='/api/v1/trips/900001')data=trip;
    else if(p.endsWith('/places'))data=places;
    else if(p.endsWith('/timeline')) {
      data=mode==='empty'?[]:structuredClone(timeline);
      if(mode==='bulk')data=[{date:'2026-10-30',items:Array.from({length:45},(_,i)=>({checkin:{...timeline[0].items[0].checkin,id:i+1,placeName:'批量记录'+(i+1),note:'完整导出'},photos:[]}))}];
      if(mode==='broken')data=[{date:'2026-10-30',items:[{...timeline[0].items[0],photos:[{id:999,imageUrl:location.origin+'/fixture-failed-photo',featured:false}]}]}];
      if(mode==='nocoords')for(const day of data)for(const item of day.items){delete item.checkin.latitude;delete item.checkin.longitude;delete item.checkin.placeId;}
    }
    else if(p.endsWith('/summary'))data={tripId:trip.id,title:trip.title,days:2,places:3,photos:4,dailyRecords:[],readiness:{featuredPhotos:4,recordedDays:2,shareReady:true,videoReady:true}};
    return Promise.resolve(new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}}));
  };
  if(!${webgl}){const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:getContext.call(this,type,...args)}};
  window.__exportDownloads=[];
  const click=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    if(!this.download)return click.call(this);
    const name=this.download;
    original(this.href).then(r=>r.blob()).then(blob=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve({name,type:blob.type,size:blob.size,data:reader.result});reader.readAsDataURL(blob)})).then(file=>window.__exportDownloads.push(file));
  };
})();`
async function click(selector) {
  await browser.js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`)
  await new Promise(r => setTimeout(r, 200))
  const pos = await browser.js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...pos, button: 'left', clickCount: 1 })
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...pos, button: 'left', clickCount: 1 })
}
async function ready() { return browser.waitFor("[...document.querySelectorAll('.tm-head button')].some(b=>b.innerText.includes('导出打卡记录'))",60000) }
async function open() {
  await browser.clickText('/导出打卡记录/','.tm-head button')
  if (!await browser.waitFor('!!document.querySelector("dialog[open]")',10000)) throw Error('Export dialog did not open')
}
let lastDownloadIndices=[]
async function save(index, name) {
  const file = await browser.js(`window.__exportDownloads[${lastDownloadIndices[index]}]`)
  fs.writeFileSync(path.join(output, name), Buffer.from(file.data.split(',')[1], 'base64'))
  return file
}
async function start() {
  const before=await browser.js('window.__exportDownloads.length')
  await browser.clickText('/开始导出/','dialog button')
  const ok=await browser.waitFor(`window.__exportDownloads.length>${before}&&!document.querySelector('dialog button[disabled]')`,60000)
  const after=await browser.js('window.__exportDownloads.length')
  lastDownloadIndices=Array.from({length:after-before},(_,i)=>before+i)
  return ok
}
try {
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source })
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*tile.openstreetmap.org/*' }] })
  browser.hooks.push(event => { if(event.method==='Fetch.requestPaused')void browser.send('Fetch.fulfillRequest',{requestId:event.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9kAAAAASUVORK5CYII='}) })
  await browser.goto(web + '/trips/900001/map', 500)
  check('Export is available for an archived trip', await ready())
  await open()
  check('Four formats and correct complete record count', await browser.js("document.querySelectorAll('dialog input[type=radio]').length===4&&document.querySelector('dialog').innerText.includes('3 条打卡记录')"))
  check('Native dialog traps focus', await browser.js("document.querySelector('dialog').contains(document.activeElement)"))
  check('Travel map is selected by default and uses all three checkins',await browser.js("document.querySelector('dialog input[aria-label=包含旅行地图]').checked&&document.querySelector('dialog').innerText.includes('标记 3 次打卡')"))
  await browser.fill('dialog select','2026-10-30')
  check('Date selection filters to two records',await browser.waitFor("document.querySelector('dialog').innerText.includes('2 条打卡记录')",5000))
  check('Map follows selected day including place-coordinate fallback',await browser.js("document.querySelector('dialog').innerText.includes('标记 2 次打卡')"))
  check('PDF downloaded successfully', await start())
  const pdf = await save(0,'checkin-day.pdf')
  check('PDF has correct type and header',pdf.type==='application/pdf'&&Buffer.from(pdf.data.split(',')[1],'base64').subarray(0,5).toString()==='%PDF-')
  check('PDF contains a map page followed by records',(Buffer.from(pdf.data.split(',')[1],'base64').toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length===2)
  check('Map resources cleaned after export',await browser.js("!document.querySelector('[data-checkin-export-map]')"))
  check(webgl?'Configured geographic basemap exported':'Unavailable basemap clearly reported as schematic',await browser.js(`document.querySelector('dialog').innerText.includes('位置示意图')===${!webgl}`))
  await click('dialog input[value=png]')
  check('PNG downloaded', await start())
  check('PNG exports map and record pages in order',lastDownloadIndices.length===2)
  const png = await save(0,'checkin-day.png')
  await save(1,'checkin-day-records.png')
  check('PNG correct MIME type',png.type==='image/png')
  await click('dialog input[value=jpeg]')
  check('JPG downloaded', await start())
  check('JPG includes map and records',lastDownloadIndices.length===2)
  const jpg = await save(0,'checkin-day.jpg')
  check('JPG correct MIME type',jpg.type==='image/jpeg')
  await click('dialog input[value=png]');await click('dialog input[aria-label=包含旅行地图]')
  check('Map may be excluded',await start()&&lastDownloadIndices.length===1)
  await save(0,'checkin-without-map.png')
  await click('dialog input[aria-label=包含旅行地图]')
  await click('dialog input[value=csv]')
  check('CSV hides include-photo checkbox',await browser.js("!document.querySelector('dialog input[type=checkbox]')"))
  await browser.fill('dialog select','ALL')
  check('CSV downloaded',await start())
  const csv = await save(0,'checkin-all.csv')
  const csvText=Buffer.from(csv.data.split(',')[1],'base64').toString('utf8')
  check('CSV contains both dates, photos count, and final long-note line',csvText.includes('2026-10-30')&&csvText.includes('2026-10-31')&&csvText.includes('旅途笔记 100'))
  await click('dialog input[value=pdf]')
  await click('dialog input[aria-label=包含打卡照片]')
  check('Long-note multipage PDF downloaded without photos',await start())
  await save(0,'checkin-long.pdf')
  await click('dialog button[aria-label="关闭导出窗口"]')
  check('Close restores dialog state',await browser.waitFor("!document.querySelector('dialog')",5000))
  for(const width of [1440,390]) {
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768})
    await open()
    check(width+'px dialog fits viewport',await browser.js("(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"))
    const shot=await browser.send('Page.captureScreenshot',{format:'png'})
    fs.writeFileSync(path.join(output,`dialog-${width}.png`),Buffer.from(shot.result.data,'base64'))
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
    await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
    check(width+'px Escape closes dialog',await browser.waitFor("!document.querySelector('dialog')",5000))
  }
  await browser.js("sessionStorage.setItem('checkin-export-mode','bulk')")
  await browser.goto(web+'/trips/900001/map',300);await ready();await open()
  check('Export count includes all 45 records',await browser.js("document.querySelector('dialog').innerText.includes('45 条打卡记录')"))
  await click('dialog input[value=csv]');check('Bulk CSV downloaded',await start())
  const bulk=await save(0,'checkin-45.csv')
  check('Last record beyond page limit included',Buffer.from(bulk.data.split(',')[1],'base64').toString('utf8').includes('批量记录45'))
  await click('dialog button[aria-label="关闭导出窗口"]')
  await browser.js("sessionStorage.setItem('checkin-export-mode','broken')")
  await browser.goto(web+'/trips/900001/map',300);await ready();await open()
  await click('dialog input[value=png]');check('Failed photo still exports the record',await start())
  check('Failed photo is reported explicitly',await browser.js("document.querySelector('dialog').innerText.includes('1 张照片加载失败')"))
  await click('dialog button[aria-label="关闭导出窗口"]')
  await browser.js("sessionStorage.setItem('checkin-export-mode','nocoords')")
  await browser.goto(web+'/trips/900001/map',300);await ready();await open()
  check('No coordinates disables map with an explicit explanation',await browser.js("document.querySelector('dialog input[aria-label=包含旅行地图]').disabled&&!document.querySelector('dialog input[aria-label=包含旅行地图]').checked&&document.querySelector('dialog').innerText.includes('暂无可定位')"))
  await click('dialog input[value=csv]')
  check('Records remain exportable without coordinates',await start())
  await click('dialog button[aria-label="关闭导出窗口"]')
  await browser.js("sessionStorage.setItem('checkin-export-mode','empty')")
  await browser.goto(web+'/trips/900001/map',300);await ready()
  check('Export disabled when there are no checkins',await browser.js("[...document.querySelectorAll('.tm-head button')].find(b=>b.innerText.includes('导出打卡记录')).disabled"))
  check('No runtime exceptions',browser.errors.filter(e=>!e.startsWith('console.error:')).length===0)
  check('No business API requests reached the server',browser.requests.every(r=>!new URL(r.url).pathname.startsWith('/api/v1/')))
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed,failed,errors:browser.errors},null,2))
  console.log(JSON.stringify({passed,failed},null,2))
} finally { await browser.close() }
process.exitCode=failed?1:0
