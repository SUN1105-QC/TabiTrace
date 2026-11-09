// Explore V2 read-only browser acceptance. Fixtures exist only inside the test browser.
// Run: node e2e/tools/check-explore-directory.mjs
import fs from 'node:fs'
import path from 'node:path'
import { openBrowser } from '../lib/browser.mjs'
const WEB=process.env.WEB_URL || 'http://localhost:3000'
const API=process.env.API_URL || 'http://localhost:8080/api/v1'
const output=path.resolve('backend/.tabitrace')
fs.mkdirSync(output,{recursive:true})
const envelope=await (await fetch(API+'/official-cities/directory')).json()
if(!envelope.success)throw Error('Public directory unavailable')
const actual=envelope.data
// 预期值来自公开目录接口：开放城市（东京、首尔、香港、台北）链接到各自城市页，其余城市卡片不可点击。
const allCodes=actual.countries.flatMap(c=>c.cities.map(x=>x.code)).join()
const openHrefs=Object.fromEntries(actual.countries.flatMap(c=>c.cities.filter(x=>x.status==='OPEN').map(x=>[x.code,x.href])))
const browser=await openBrowser({width:1440,height:1100,mobile:false})
let passed=0,failed=0,fixtureId
const check=(label,ok)=>{console.log(`${ok?'PASS':'FAIL'} ${label}`);ok?passed++:failed++}
const ready=()=>browser.waitFor("!!document.querySelector('[data-city=\"TOKYO\"]')",30000)
const codes="[...document.querySelectorAll('[data-city]')].map(x=>x.dataset.city).join()"
const selectionVisible="(()=>{const nav=document.querySelector('[aria-label=国家筛选]');const selected=nav?.querySelector('[aria-pressed=true]');if(!selected)return false;const a=nav.getBoundingClientRect(),b=selected.getBoundingClientRect();return b.left>=a.left-1&&b.right<=a.right+1})()"
async function screenshot(name){
 await browser.js(`(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,100))}scrollTo(0,0);await new Promise(r=>setTimeout(r,400));return true})()`)
 const size=(await browser.send('Page.getLayoutMetrics')).result.cssContentSize
 const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:size.width,height:size.height,scale:1}})
 fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(shot.result.data,'base64'))
}
async function fixture(mode,data=actual){
 if(fixtureId)await browser.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixtureId})
 const source=`(()=>{const original=window.fetch.bind(window);let attempt=0;window.fetch=(input,init)=>{const url=typeof input==='string'?input:input.url;if(new URL(url,location.href).pathname==='/api/v1/official-cities/directory'){attempt++;const mode=${JSON.stringify(mode)};const data=${JSON.stringify(data)};const status=mode==='forbidden'?403:mode==='retry'&&!window.__exploreRecovered?500:200;const result=new Response(JSON.stringify({success:status===200,data:status===200?data:null,message:'Test response'}),{status,headers:{'Content-Type':'application/json'}});return new Promise(resolve=>setTimeout(()=>resolve(result),mode==='slow'?5000:100))}return original(input,init)}})()`
 const result=await browser.send('Page.addScriptToEvaluateOnNewDocument',{source})
 fixtureId=result.result.identifier
}
try{
 for(const width of [1440,1024,768,390,375,320]){
  await browser.send('Emulation.setDeviceMetricsOverride',{width,height:width<768?844:1100,deviceScaleFactor:1,mobile:width<768})
  await browser.goto(WEB+'/explore',300)
  check(width+'px actual directory loaded',await ready())
  check(width+'px real counts match API',await browser.js(`document.querySelector('[data-directory-stats]').innerText.includes(${JSON.stringify(actual.stats.cityCount+' 座城市')})`))
  check(width+'px no horizontal page overflow',await browser.js('document.documentElement.scrollWidth<=innerWidth+1'))
  check(width+'px pending cards have no links',await browser.js(`[...document.querySelectorAll('[data-city]')].filter(x=>!${JSON.stringify(openHrefs)}[x.dataset.city]).every(x=>x.tagName==='ARTICLE'&&!x.querySelector('a'))`))
  check(width+'px open cities use their own routes',await browser.js(`Object.entries(${JSON.stringify(openHrefs)}).every(([code,href])=>document.querySelector('[data-city='+code+']')?.getAttribute('href')===href)`))
  const expectedColumns=width<640?1:width<1024?2:3
  check(width+'px responsive column count',await browser.js(`getComputedStyle(document.querySelector('[data-country=JP]>[class*=cityGrid]')).gridTemplateColumns.split(' ').length===${expectedColumns}`))
  await browser.js("document.querySelector('[data-country-filter=KR]').click()")
  check(width+'px country filter',await browser.waitFor(codes+"==='SEOUL'",5000))
  check(width+'px selected country remains visible',await browser.waitFor(selectionVisible,5000))
  await browser.js("document.querySelector('[data-country-filter=JP]').click()")
  await browser.js("document.querySelector('input[type=checkbox]').click()")
  check(width+'px open-only keeps open cities',await browser.waitFor(codes+"==='TOKYO'",5000))
  await browser.fill('#explore-city-search','Kyoto')
  check(width+'px open-only empty recovery',await browser.waitFor("document.body.innerText.includes('没有找到符合条件的城市')",5000))
  await browser.clickText('/^包含筹备与计划中的城市$/')
  check(width+'px include pending recovery',await browser.waitFor(codes+"==='KYOTO'",5000))
  await browser.clickText('/^重置筛选$/')
  await browser.js("document.querySelector('#explore-city-search').focus()")
  await browser.fill('#explore-city-search','ＴＯＫＹＯ')
  check(width+'px fullwidth keyword search',await browser.waitFor(codes+"==='TOKYO'",5000))
  check(width+'px search keeps focus',await browser.js("document.activeElement?.id==='explore-city-search'"))
  await browser.fill('#explore-city-search','x'.repeat(120))
  check(width+'px long query stays within viewport',await browser.waitFor("document.body.innerText.includes('没有找到符合条件的城市')&&document.documentElement.scrollWidth<=innerWidth+1",5000))
  await browser.clickText('/^清除全部筛选$/')
  check(width+'px reset restores entire directory',await browser.waitFor(codes+`===${JSON.stringify(allCodes)}`,5000))
  if([1440,390,320].includes(width))await screenshot('explore-v2-'+width)
 }
 await browser.goto(WEB+'/explore?country=JP&q=Kyoto&source=check#country-japan',300)
 check('refresh restores country and search',await browser.waitFor(codes+"==='KYOTO'&&document.querySelector('#explore-city-search').value==='Kyoto'",10000))
 await browser.clickText('/^重置筛选$/')
 check('reset preserves unrelated parameters',await browser.js("location.search==='?source=check'"))
 await browser.goto(WEB+'/explore#country-korea',300)
 check('legacy country anchor restores filter',await browser.waitFor(codes+"==='SEOUL'",10000))
 check('deep-linked country is visible in horizontal selector',await browser.waitFor(selectionVisible,5000))
 await fixture('retry')
 await browser.goto(WEB+'/explore',300)
 check('failure shows retry and hides statistics',await browser.waitFor("!!document.querySelector('[role=alert]')&&!document.querySelector('[data-directory-stats]')",10000))
 await browser.js('window.__exploreRecovered=true;true')
 await browser.clickText('/^重新加载$/')
 check('retry reloads real-shaped data',await ready())
 await fixture('forbidden')
 await browser.goto(WEB+'/explore',300)
 check('permission failure explained without content',await browser.waitFor("document.body.innerText.includes('当前没有权限查看城市目录')&&!document.querySelector('[data-city]')",10000))
 await fixture('slow')
 await browser.goto(WEB+'/explore',0)
 check('slow network shows skeleton without invented counts',await browser.js("!!document.querySelector('[aria-label=\"正在加载真实城市统计\"]')&&!document.querySelector('[data-directory-stats]')"))
 check('slow request eventually resolves',await ready())
 await fixture('empty',{countries:[],stats:{countryCount:0,cityCount:0,openCountryCount:0,openCityCount:0,placeCount:0,routeCount:0}})
 await browser.goto(WEB+'/explore',300)
 check('empty directory has honest status',await browser.waitFor("document.body.innerText.includes('国家主题与城市指南发布后')&&!document.querySelector('[data-city]')",10000))
 const france={code:'FR',slug:'france',name:'法国',englishName:'FRANCE',theme:'测试主题',description:'仅浏览器测试数据，不保存到数据库。',cities:[]}
 await fixture('empty-country',{countries:[france],stats:{countryCount:1,cityCount:0,openCountryCount:0,openCityCount:0,placeCount:0,routeCount:0}})
 await browser.goto(WEB+'/explore?country=FR',300)
 check('new country and empty collection need no frontend registry',await browser.waitFor("!!document.querySelector('[data-country=FR]')&&document.querySelector('[data-country-filter=FR]').getAttribute('aria-pressed')==='true'&&!document.querySelector('[data-city]')",10000))
 france.cities=Array.from({length:120},(_,i)=>({code:'PARIS'+i,name:i===0?'很长的城市名称'.repeat(15):'测试城市'+i,englishName:'CITY'+i,region:'法国',description:'测试摘要'.repeat(100),tags:['测试主题'],status:'PLANNED',href:null,cover:null}))
 await fixture('large',{countries:[france],stats:{countryCount:1,cityCount:120,openCountryCount:0,openCityCount:0,placeCount:0,routeCount:0}})
 await browser.goto(WEB+'/explore',300)
 check('120 cities initially render only three cards',await browser.waitFor("document.querySelectorAll('[data-city]').length===3",10000))
 check('long city content does not overflow mobile',await browser.js('document.documentElement.scrollWidth<=innerWidth+1'))
 await browser.clickText('/^查看更多法国城市/')
 check('load more renders six additional cards',await browser.waitFor("document.querySelectorAll('[data-city]').length===9",5000))
 if(fixtureId){await browser.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixtureId});fixtureId=null}
 await browser.send('Network.setBlockedURLs',{urls:['*01-sensoji-kaminarimon.webp','*/assets/explore/city_tokyo.webp']})
 await browser.goto(WEB+'/explore',300)
 check('failed real and illustration covers reach neutral placeholder',await browser.waitFor("!!document.querySelector('[data-city=TOKYO] [data-visual-source=placeholder]')",10000))
 check('hero fallback is explicitly an illustration',await browser.js("!!document.querySelector('header [data-visual-source=illustration]')"))
 await browser.send('Network.setBlockedURLs',{urls:[]})
 check('no runtime exceptions',browser.errors.length===0)
 if(browser.errors.length)console.log(JSON.stringify(browser.errors))
 check('no business write requests',browser.requests.filter(r=>new URL(r.url).pathname.startsWith('/api/v1/')).every(r=>['GET','HEAD','OPTIONS'].includes(r.method)))
}finally{await browser.close()}
console.log(`${passed} PASS, ${failed} FAIL`)
process.exitCode=failed?1:0
