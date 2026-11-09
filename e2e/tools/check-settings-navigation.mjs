import {openBrowser} from '../lib/browser.mjs';
const web=process.env.PROFILE_TEST_WEB||'http://localhost:3000';const b=await openBrowser();let failed=0;const check=(n,v)=>{console.log((v?'PASS ':'FAIL ')+n);if(!v)failed++};
try{await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('tabitrace-session','1');localStorage.setItem('tabitrace.dev.dataSource','local');const original=fetch.bind(window);window.fetch=(input,init)=>{const p=new URL(typeof input==='string'?input:input.url,location.href).pathname;if(!p.startsWith('/api/v1/'))return original(input,init);let data=[];if(p.endsWith('/auth/refresh'))data={accessToken:'browser-only-fixture'};else if(p==='/api/v1/users/me')data={id:900000,email:'fixture@example.invalid',nickname:'UI Fixture',locale:'zh-CN',timezone:'Asia/Tokyo',distanceUnit:'KM',emailNotifications:false};else if(p.endsWith('/overview'))data={trips:0,places:0,photos:0,proTrips:0,activeFreeTrips:0,freeTripLimit:1,tripProAmount:400,lifetimeAmount:400,tripProCurrency:'CNY',lifetimePro:false,plans:[]};return Promise.resolve(new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}}))}`});

async function click(selector){await b.js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',inline:'center',behavior:'instant'})`);await new Promise(r=>setTimeout(r,400));const r=await b.js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',clickCount:1});await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x,y:r.y,button:'left',clickCount:1})}
const selected=k=>`document.querySelector('#st-tab-${k}')?.getAttribute('aria-selected')==='true'&&document.querySelector('#st-panel')?.getAttribute('aria-labelledby')==='st-tab-${k}'&&new URLSearchParams(location.search).get('tab')==='${k}'`;
await b.goto(web+'/profile?tab=security&source=qa',300);await b.waitFor(selected('security'),30000);
if(process.env.SETTINGS_TEST_BASELINE){await click('#st-tab-preferences');check('实际点击旅行偏好后内容、选中态与URL同步',await b.waitFor(selected('preferences'),2000));}
else {
for(const width of [1440,390]){
await b.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
const panels=new Set();for(const key of ['profile','preferences','privacy','notifications','security','pro','profile']){await click('#st-tab-'+key);check(width+' '+key+' 实际点击同步栏目与地址',await b.waitFor(selected(key),5000));panels.add(await b.js("document.querySelector('#st-panel').innerText"));}
check(width+' 六个栏目内容均不同',panels.size===6);
check(width+' 保留其他参数',await b.js("new URLSearchParams(location.search).get('source')==='qa'"));
await click('.st-summary-links button:nth-child(2)');check(width+' 左侧管理Pro入口',await b.waitFor(selected('pro'),5000));
await click('.st-summary-links button:nth-child(1)');check(width+' 左侧资料入口',await b.waitFor(selected('profile'),5000));
await b.fill('#st-nickname','Unsaved Test');await click('#st-tab-security');check(width+' 未保存修改阻止切换',await b.waitFor("!!document.querySelector('[role=dialog]')&&!!document.querySelector('#st-nickname')",5000));
await b.clickText('/^取消$/','[role=dialog] button');check(width+' 取消切换保留草稿',await b.js("document.querySelector('#st-nickname').value==='Unsaved Test'"));
await click('#st-tab-security');await b.clickText('/放弃更改/','[role=dialog] button');check(width+' 放弃后正确切换',await b.waitFor(selected('security'),5000));
await b.goto(web+'/profile?tab=privacy',300);check(width+' 刷新恢复栏目',await b.waitFor(selected('privacy'),15000));
await b.goto(web+'/profile?tab=profile&source=qa',300);await b.waitFor(selected('profile'),15000);await b.js("history.pushState(null,'','/profile?tab=security&source=qa')");check(width+' 历史导航切换栏目',await b.waitFor(selected('security'),5000));await b.js('history.back()');check(width+' 返回恢复资料栏目',await b.waitFor(selected('profile'),5000));
}
check('无运行时异常',b.errors.length===0);check('无实际业务写请求',b.requests.filter(r=>r.url.includes('/api/v1/')).every(r=>['GET','HEAD','OPTIONS'].includes(r.method)));
}
}finally{await b.close()}process.exitCode=failed?1:0;console.log('FAILURES '+failed);
