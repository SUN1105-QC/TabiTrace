// 后台复查：数据全部注入浏览器；不创建账号、发邮件或触发真实资源清理。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { openBrowser } from '../lib/browser.mjs'

const web=process.env.ADMIN_TEST_WEB||'http://localhost:3000'
const output=path.resolve(process.env.ADMIN_TEST_OUTPUT||'backend/.tabitrace/admin-review/browser')
fs.mkdirSync(output,{recursive:true})
const base=fs.readFileSync('e2e/tools/check-admin-users.mjs','utf8').split('const fixture = String.raw`')[1]?.split('`;')[0]
const moduleSource=fs.readFileSync('e2e/tools/check-admin-modules.mjs','utf8').split('const fixture = base + String.raw`')[1]
const extra=moduleSource?.split('new vm.Script(fixture)')[0].trimEnd().slice(0,-1)
if(!base||!extra)throw new Error('Missing isolated fixtures')
const fixture=base+extra+String.raw`
{
const previous=window.fetch;
window.__reviewAborts=0;window.__reviewLongReads=0;
const delay=(ms,signal)=>new Promise((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);window.__reviewAborts++;reject(new DOMException('Aborted','AbortError'));};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
});
window.fetch=async(input,init={})=>{
 const u=new URL(typeof input==='string'?input:input.url,location.href),method=init.method||'GET';
 if(u.pathname==='/api/v1/admin/trips'&&window.__reviewDelayTrips){window.__reviewTripPending=true;await delay(1600,init.signal);window.__reviewTripPending=false;}
 if(u.pathname==='/api/v1/admin/settings/defaults'&&method==='GET'&&window.__reviewFailDefaultsRead){window.__reviewFailDefaultsRead--;return new Response(JSON.stringify({success:false,code:'QA_RELOAD',message:'保存后的列表刷新失败'}),{status:500,headers:{'Content-Type':'application/json'}});}
 if(u.pathname==='/api/v1/admin/maintenance/jobs'&&method==='GET'&&window.__reviewSlowJobs&&window.__qaModules.jobs.length){await delay(6500,init.signal);window.__reviewLongReads++;}
 const result=await previous(input,init);
 if(u.pathname==='/api/v1/admin/settings/defaults'&&method==='PUT'&&result.ok&&window.__reviewFailAfterSave)window.__reviewFailDefaultsRead=1;
 return result;
};
}`
new vm.Script(fixture)
const browser=await openBrowser({width:1440,height:1050})
const results=[]
const check=(name,ok)=>{results.push({name,ok:!!ok});console.log(`${ok?'PASS':'FAIL'} ${name}`)}
const wait=(expr,ms=30000)=>browser.waitFor(expr,ms)
async function clickTitle(title){await browser.js(`document.querySelector('aside button[title="${title}"]').click()`)}
async function ready(title){return wait(`document.querySelector('h1')?.textContent==='${title}'&&!document.querySelector('[aria-busy=true]')`)}
async function shot(name){await new Promise(r=>setTimeout(r,300));const s=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(s.result.data,'base64'))}
try{
 await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});await browser.goto(web+'/admin');await wait('!!document.querySelector("tbody tr")');
 await browser.js('document.querySelector("button[aria-label=收起侧栏]").click()');
 check('收起侧栏仍可展开日志分组',await browser.js('getComputedStyle(document.querySelector("aside button[title=日志与维护]")).display!=="none"'));
 await clickTitle('日志与维护');await clickTitle('审计日志');
 check('收起侧栏可进入审计页面',await ready('审计日志'));
 check('审计操作显示中文及可查询的原代码',await wait('document.querySelector("tbody strong")?.textContent==="修改用户权限"&&document.querySelector("tbody").innerText.includes("UPDATE_USER")'));
 await browser.js('document.querySelector("button[aria-label=展开侧栏]").click()');await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:420,deviceScaleFactor:1,mobile:false});
 await browser.js('document.querySelector("aside button[title=运行维护]").scrollIntoView({block:"nearest"})');
 check('低高度桌面侧栏可独立滚动且不被页脚遮住',await browser.js('(()=>{const nav=document.querySelector("aside nav"),foot=document.querySelector("aside [class*=sidebarFoot]"),button=document.querySelector("aside button[title=运行维护]");const n=nav.getBoundingClientRect(),b=button.getBoundingClientRect(),f=foot.getBoundingClientRect();return nav.scrollHeight>nav.clientHeight&&b.bottom<=n.bottom+1&&f.top>=n.bottom-1})()'));
 await shot('short-sidebar');await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await clickTitle('内容管理');await ready('内容管理');
 await browser.js('window.__reviewDelayTrips=true');await browser.fill('input[name=moduleQuery]','missing');await browser.clickText('/^搜索$/','form button');await wait('window.__reviewTripPending&&location.search.includes("xq=missing")');
 check('新查询加载时隐藏旧资源和旧删除按钮',await browser.js('document.querySelector("[aria-label=后台管理栏目]").getAttribute("aria-busy")==="true"&&document.querySelectorAll("tbody tr").length===0'));
 check('空查询结果提供清除筛选入口',await wait('document.body.innerText.includes("暂无符合条件的数据")&&[...document.querySelectorAll("button")].some(b=>b.innerText==="清除筛选")'));
 await browser.js('window.__reviewDelayTrips=false;for(let i=1;i<60;i++)window.__qaModules.trips.push({...window.__qaModules.trips[0],id:1000+i,title:"分页旅行 "+i})');
 await browser.js('history.pushState(null,"","/admin?tab=content&xpage=3")');
 check('新查询第 3 页不被旧查询零总数错误改回第一页',await wait('location.search.includes("xpage=3")&&document.querySelectorAll("tbody tr").length===10'));
 await browser.js('history.pushState(null,"","/admin?tab=content&xpage=99")');
 check('真实越界页仍能回退到最后有效页',await wait('location.search.includes("xpage=3")&&document.querySelectorAll("tbody tr").length===10'));
 await browser.fill('input[name=moduleQuery]','missing');await browser.clickText('/^搜索$/','form button');await wait('document.body.innerText.includes("暂无符合条件的数据")');await browser.clickText('/^清除筛选$/');
 check('清除筛选恢复第一页和真实列表',await wait('!location.search.includes("xq=")&&document.querySelectorAll("tbody tr").length===25'));
 await clickTitle('系统设置');await ready('系统设置');await browser.js('window.__reviewFailAfterSave=true');await browser.fill('input[name=defaultTripLimit]','38');await browser.clickText('/保存新账号默认权限/');
 check('保存成功但重读失败时保留已保存基线',await wait('window.__qaModules.defaults.tripLimit===38&&document.body.innerText.includes("保存后的列表刷新失败")&&[...document.querySelectorAll("button")].find(b=>b.innerText==="保存新账号默认权限")?.disabled'));
 await clickTitle('首页概览');
 check('保存已成功的表单离开时不误报未保存',await wait('document.querySelector("h1")?.textContent==="首页概览"&&!document.querySelector("dialog[open]")'));
 check('首页概览具有实时七项指标与真实快捷入口',await wait('document.querySelectorAll("#admin-overview [class*=statCard]").length===7&&document.querySelectorAll("[aria-label=后台快捷入口] button").length===6'));
 await shot('overview-desktop');await browser.clickText('/系统设置/','[aria-label=后台快捷入口] button');await ready('系统设置');await browser.fill('input[name=defaultTripLimit]','39');await clickTitle('首页概览');
 check('概览导航同样保护未保存设置',await wait('document.querySelector("dialog[open]")?.innerText.includes("有未保存的修改")'));
 await browser.clickText('/继续编辑/','dialog[open] button');check('继续编辑保留设置草稿',await browser.js('document.querySelector("input[name=defaultTripLimit]").value==="39"'));
 await clickTitle('首页概览');await browser.clickText('/放弃修改/','dialog[open] button');await ready('首页概览');
 await browser.clickText('/运行维护/','[aria-label=后台快捷入口] button');await ready('运行维护');await browser.js('window.__reviewSlowJobs=true;window.__reviewAborts=0');await browser.clickText('/执行本轮清理/');await browser.fill('input[name=resourceConfirmation]','清理到期数据');await browser.clickText('/^确认执行$/','dialog[open] button');
 check('慢于轮询间隔的维护读取仍能完成',await wait('window.__reviewLongReads>=2&&document.querySelector("tbody")?.innerText.includes("本轮已清理 1 项")',40000));
 check('自动轮询不会反复取消尚未完成的读取',await browser.js('window.__reviewAborts===0'));
 await clickTitle('系统设置');await ready('系统设置');await browser.send('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});await browser.js('window.scrollTo({top:0,behavior:"instant"})');
 check('手机设置页直接呈现表单而非七张全局指标卡',await browser.js('!document.querySelector("#admin-overview")&&document.querySelector("input[name=defaultLevel]").getBoundingClientRect().top<360'));
 check('手机后台没有页面级横向溢出',await browser.js('document.documentElement.scrollWidth<=innerWidth+1'));await shot('settings-mobile');
 await browser.js('document.querySelector("button[aria-label=打开后台导航]").click()');await browser.clickText('/^首页概览$/','dialog[open] button');
 check('手机抽屉可进入独立概览并关闭',await wait('document.querySelector("h1")?.textContent==="首页概览"&&!document.querySelector("dialog[open]")'));
 check('没有浏览器脚本异常',browser.errors.length===0);
}catch(error){check('后台复查脚本完整执行',false);console.error(error);await shot('failure').catch(()=>{})}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({results,errors:browser.errors},null,2));await browser.close()}
process.exitCode=results.every(r=>r.ok)?0:1
