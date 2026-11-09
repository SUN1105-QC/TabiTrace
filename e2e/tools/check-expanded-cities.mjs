// Public city APIs use the isolated local database. All account/writing flows stay in browser memory.
import fs from 'node:fs'
import path from 'node:path'
import {openBrowser} from '../lib/browser.mjs'
const web=process.env.EXPANSION_WEB||'http://127.0.0.1:3019',api=process.env.EXPANSION_API||'http://127.0.0.1:18081/api/v1'
const out=path.resolve(process.env.EXPANSION_OUTPUT||'backend/.tabitrace/explore-expansion-browser-qa')
fs.mkdirSync(out,{recursive:true})
const results=[],check=(name,ok,details)=>{results.push({name,ok:Boolean(ok),details});console.log(`${ok?'PASS':'FAIL'} ${name}${ok?'':' '+JSON.stringify(details)}`)}
const json=async route=>{const r=await fetch(api+route,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(route+' HTTP '+r.status);return(await r.json()).data}
const cities=[{code:'SEOUL',slug:'seoul',name:'首尔'},{code:'HONGKONG',slug:'hong-kong',name:'香港'},{code:'TAIPEI',slug:'taipei',name:'台北'}]
const directory=await json('/official-cities/directory')
check('Directory exposes 3 themes, 6 cities, 4 open guides and 120 places',directory.stats.countryCount===3&&directory.stats.cityCount===6&&directory.stats.openCityCount===4&&directory.stats.placeCount===120&&directory.stats.routeCount===24,directory.stats)
for(const city of cities){
 city.places=await json(`/official-cities/${city.code}/places`);city.routes=await json(`/official-cities/${city.code}/routes`)
 check(city.name+' API has 30 locations and 6 complete local routes',city.places.length===30&&city.routes.length===6&&city.routes.every(r=>r.placeIds.length>1&&r.placeIds.every(id=>city.places.some(p=>p.id===id))))
 // 目的地搜索属于登录后接口；目的地与城市指南的关联由 MySqlSchemaMigrationIntegrationTest 在数据库层断言。
 const destination=await fetch(api+'/destinations/search?q='+encodeURIComponent(city.name),{signal:AbortSignal.timeout(15000)})
 check(city.name+' destination search stays behind login',destination.status===401,destination.status)
}
const b=await openBrowser(),pause=ms=>new Promise(r=>setTimeout(r,ms));let fixture
async function shot(name){await b.js("scrollTo({top:0,behavior:'instant'})");const s=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.result.data,'base64'))}
async function load(route,width=1440,signedIn=true){
 if(fixture)await b.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture})
 const trips=cities.map((c,i)=>({id:9100+i,title:c.name+'城市散步',city:c.name,destinationName:c.name,startDate:'2026-11-10',endDate:'2026-11-12',status:'ONGOING',planType:'PRO',peopleCount:1}))
 const source=`(()=>{
  localStorage.${signedIn?'setItem(\'tabitrace-session\',\'1\')':'removeItem(\'tabitrace-session\')'};localStorage.setItem('tabitrace.dev.dataSource','local');localStorage.setItem('tabitrace-live-trip-id','900001');
  const trips=${JSON.stringify(trips)},all=${JSON.stringify(cities.flatMap(c=>c.places))};const original=fetch.bind(window);const joined=new Map(),favorites=new Set();window.__cityWrites=[];
  window.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input.url,location.href),p=u.pathname,m=init?.method||input?.method||'GET';
   if(!p.startsWith('/api/v1/'))return original(input,init);
   if(m==='GET'&&['/official-cities','/destinations','/places/search','/plans'].some(s=>p.startsWith('/api/v1'+s)))return original(input,init);
   let data=[];if(p.endsWith('/auth/refresh'))data={accessToken:'browser-only-city-fixture'};
   else if(p.endsWith('/users/me'))data={id:999,email:'fixture@example.invalid',nickname:'城市验收',locale:'zh-CN',timezone:'Asia/Tokyo',emailNotifications:false};
   else if(p==='/api/v1/trips')data=trips;
   else if(/[/]trips[/][0-9]+[/]official-places[/][0-9]+$/.test(p)){const parts=p.split('/'),id=Number(parts[4]),pid=Number(parts[6]);if(!joined.has(id))joined.set(id,new Set());joined.get(id).add(pid);data=all.find(x=>x.id===pid);window.__cityWrites.push({path:p,tripId:id,placeId:pid})}
   else if(/[/]trips[/][0-9]+[/]places$/.test(p)){const id=Number(p.split('/')[4]);data=all.filter(x=>joined.get(id)?.has(x.id))}
   else if(p.endsWith('/favorite-places'))data=[...favorites];
   else if(/[/]places[/][0-9]+[/]favorite$/.test(p)){const id=Number(p.split('/')[4]);m==='DELETE'?favorites.delete(id):favorites.add(id);window.__cityWrites.push({path:p,favorite:id});data=null}
   return Promise.resolve(new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}}));
  };
  Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__cityShare=text}},configurable:true});
 })();`
 fixture=(await b.send('Page.addScriptToEvaluateOnNewDocument',{source})).result.identifier
 await b.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768})
 await b.goto(web+route,500)
 if(!await b.waitFor("document.querySelector('.xp-hero-stats')?.innerText.includes('30')&&!document.querySelector('.xp-grid .skeleton')",20000))throw Error('City not ready '+route)
}
async function click(selector){await b.js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);const p=await b.js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await b.send('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});await pause(180)}
try{
 for(const city of cities){
  for(const width of [320,390,768,1024,1440,1920]){
   await load('/explore/'+city.slug,width)
   const m=await b.js("({root:document.documentElement.scrollWidth,width:innerWidth,title:document.querySelector('h1').innerText,stats:document.querySelector('.xp-hero-stats').innerText,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText)})")
   check(`${city.name} ${width}px correct identity, counts and layout`,m.root<=width+1&&m.width<=width+1&&m.title.includes(city.name)&&m.stats.includes('30')&&m.stats.includes('6')&&!m.alerts.length,m)
   if(width===390||width===1440)await shot(city.slug+'-'+width)
  }
  await load('/explore/'+city.slug,1440)
  await b.js("document.querySelector('.xp-more button').click();document.querySelector('.xp-more button')?.click()")
  await b.waitFor("document.querySelectorAll('.xp-grid .xp-card').length===30",3000)
  check(city.name+' all 30 cards can be displayed',await b.js("document.querySelectorAll('.xp-grid .xp-card').length===30"))
  await b.fill('.xp-search input',city.places[0].name)
  check(city.name+' search filters the actual city content',await b.waitFor("document.querySelectorAll('.xp-grid .xp-card').length===1",3000))
  await b.fill('.xp-search input','');await pause(400)
  await click('.xp-inspire')
  check(city.name+' route drawer resolves all stops',await b.waitFor("document.querySelectorAll('.ex-stops li').length>1",3000))
  await click('.ex-drawer-close')
  await b.js(`document.querySelector('[aria-label=${JSON.stringify('把 '+city.places[0].name+' 加入旅行')} ]')?.click()`)
  check(city.name+' add uses its matching trip, not a different city',await b.waitFor(`window.__cityWrites.some(w=>w.tripId===${9100+cities.indexOf(city)}&&w.placeId===${city.places[0].id})`,3000))
  await b.js(`document.querySelector('[aria-label=${JSON.stringify('收藏 '+city.places[0].name)} ]')?.click()`)
  check(city.name+' favorites retain the selected location ID',await b.waitFor(`window.__cityWrites.some(w=>w.favorite===${city.places[0].id})`,3000))
  await load(`/explore/${city.slug}#place-${city.places[0].id}`,390)
  check(city.name+' deep link opens the intended place and credit',await b.waitFor(`document.querySelector('#xp-detail-title')?.innerText.includes(${JSON.stringify(city.places[0].name)})&&!!document.querySelector('.xp-detail .img-credit')`,3000))
  await b.js(`document.querySelector('[aria-label=${JSON.stringify('分享 '+city.places[0].name)} ]')?.click()`)
  check(city.name+' copied share link keeps its city',await b.waitFor(`window.__cityShare===${JSON.stringify(web+'/explore/'+city.slug+'#place-'+city.places[0].id)}`,3000))
  await load('/explore/'+city.slug,390,false)
  await b.js("document.querySelector('.xp-add').click()")
  check(city.name+' login returns to the same guide',await b.waitFor(`!!document.querySelector('a[href=${JSON.stringify('/login?next='+encodeURIComponent('/explore/'+city.slug))}]')`,3000))
 }
 check('No frontend runtime errors',b.errors.length===0,b.errors)
 check('No actual account writes reached local API',b.requests.filter(r=>new URL(r.url).pathname.startsWith('/api/v1/')).every(r=>r.method==='GET'),b.requests.filter(r=>new URL(r.url).pathname.startsWith('/api/v1/')&&r.method!=='GET'))
}catch(e){check('Browser runner completed',false,String(e));await shot('runner-error').catch(()=>{})}
finally{await b.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));const failures=results.filter(r=>!r.ok);console.log(`Expanded cities: ${results.length-failures.length}/${results.length} passed`);process.exitCode=failures.length?1:0}
