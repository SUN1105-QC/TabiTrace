// 新管理模块回归：所有邮箱、账号、资源与写请求均在浏览器内隔离，不发真实邮件或删除业务数据。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { openBrowser } from '../lib/browser.mjs'

const web = process.env.ADMIN_TEST_WEB || 'http://localhost:3000'
const output = path.resolve(process.env.ADMIN_TEST_OUTPUT || 'backend/.tabitrace/admin-full-features/browser')
fs.mkdirSync(output,{recursive:true})
const base = fs.readFileSync('e2e/tools/check-admin-users.mjs','utf8').split('const fixture = String.raw`')[1]?.split('`;')[0]
if (!base) throw new Error('Missing browser-only fixture')
const fixture = base + String.raw`
{
const data={invitations:[],trips:[{id:901,userId:133,email:'traveler34@example.test',nickname:'旅人34',title:'模块验收旅行',destinationName:'东京',status:'PLANNING',visibility:'PRIVATE',photos:1,checkins:1,activeShares:1,createdAt:'2026-11-01T00:00:00',updatedAt:'2026-11-15T10:00:00.000001',expiresAt:'2027-11-01T00:00:00',expired:false}],media:[{id:801,userId:133,tripId:901,title:'照片 #801',email:'traveler34@example.test',kind:'PHOTO',status:'READY',fileSize:1024,createdAt:'2026-11-15T10:00:00',updatedAt:'2026-11-15T10:00:00.000001'},{id:802,userId:133,tripId:901,title:'处理中视频',email:'traveler34@example.test',kind:'VIDEO',status:'PROCESSING',fileSize:null,createdAt:'2026-11-15T10:00:00',updatedAt:'2026-11-15T10:00:00.000001'},{id:803,userId:133,title:'自己的音乐',email:'traveler34@example.test',kind:'MUSIC',status:'READY',fileSize:2048,createdAt:'2026-11-15T10:00:00',updatedAt:'2026-11-15T10:00:00.000001'}],defaults:{userLevel:'基础用户',tripLimit:20,tripRetentionMonths:1,canShare:true,canVideo:true,customMusicAccess:'INHERIT',updatedAt:'2026-11-15T10:00:00.000001'},maintenance:{expiredTrips:1,dueAccounts:1,musicFiles:1,pendingVideoFiles:2},jobs:[],audit:Array.from({length:30},(_,i)=>({id:i+1,adminId:1,userId:133,action:'UPDATE_USER',details:'requestId=fixture-'+i+';result=SUCCESS;<img src=x onerror="window.__unsafe=true">',createdAt:'2026-11-15T10:00:00'}))};
window.__qaModules=data;
const previous=window.fetch;let version=1000,jobReads=0;
const stamp=()=> '2026-11-16T01:00:00.'+String(++version).padStart(6,'0');
const response=(value,status=200,message='测试操作失败')=>new Response(JSON.stringify({success:status<400,data:status<400?value:null,code:status===409?'ADMIN_RESOURCE_CHANGED':'QA_ERROR',message}),{status,headers:{'Content-Type':'application/json'}});
const paged=(items,p)=>({items:items.slice((p-1)*25,p*25),total:items.length,page:p,pageSize:25});
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href),p=url.pathname,method=init.method||'GET',body=init.body?JSON.parse(init.body):{},page=Number(url.searchParams.get('page')||1),q=(url.searchParams.get('q')||'').toLowerCase();
 if(!p.startsWith('/api/v1/admin/'))return previous(input,init);
 const handled=['/api/v1/admin/invitations','/api/v1/admin/trips','/api/v1/admin/media','/api/v1/admin/settings/','/api/v1/admin/audit-logs','/api/v1/admin/maintenance'].some(x=>p.startsWith(x))||p.match(new RegExp('^/api/v1/admin/users/[0-9]+/(?:deletion|cancel-deletion)$'));
 if(!handled)return previous(input,init);
 if(method==='GET')window.__qaReads.push(p+url.search);else window.__qaWrites.push({p,method,body});
 if(window.__qaModuleFail&&method==='GET')return response(null,500,'栏目读取失败');
 if(p==='/api/v1/admin/invitations'){
  if(method==='GET')return response(paged([...data.invitations].reverse(),page));
  if(window.__qaMailFail)return response(null,503,'邀请邮件发送失败，请稍后重试');
  const i={id:data.invitations.length+1,email:body.email,nickname:body.nickname,status:'PENDING',createdAt:stamp(),updatedAt:stamp()};data.invitations.push(i);return response(i);
 }
 const invite=p.match(new RegExp('^/api/v1/admin/invitations/([0-9]+)/(RESEND|REVOKE)$'));
 if(invite){const i=data.invitations.find(i=>i.id===Number(invite[1]));if(body.expectedUpdatedAt!==i.updatedAt)return response(null,409,'邀请已更新');i.updatedAt=stamp();if(invite[2]==='REVOKE')i.status='REVOKED';return response(i);}
 const deletion=p.match(new RegExp('^/api/v1/admin/users/([0-9]+)/(deletion|cancel-deletion)$'));
 if(deletion){const users=allUsers(),u=users.find(u=>u.id===Number(deletion[1]));if(body.expectedUpdatedAt!==u.updatedAt)return response(null,409,'用户资料已更新，请重新加载');
  if(deletion[2]==='deletion'){if(body.confirmationEmail!==u.email)return response(null,400);u.deletionPreviousStatus=u.status;u.status='DELETION_PENDING';u.deletionRequestedByAdmin=true;u.deletionScheduledAt='2026-11-23T01:00:00';}
  else{u.status=u.deletionPreviousStatus||'ACTIVE';u.deletionScheduledAt=null;u.deletionRequestedByAdmin=false;}
  u.updatedAt=stamp();localStorage.setItem('qa-admin-users',JSON.stringify(users));return response(u);
 }
 if(p==='/api/v1/admin/settings/runtime')return response({storageMode:'local',mailProvider:'smtp',javaVersion:21,costEnforce:true,accountDailyRenders:20,accountDailySeconds:6000,globalActiveRenders:3});
 if(p==='/api/v1/admin/settings/defaults'){if(method==='GET')return response(data.defaults);if(body.expectedUpdatedAt!==data.defaults.updatedAt)return response(null,409,'默认权限已更新，请重新加载');Object.assign(data.defaults,body,{updatedAt:stamp()});return response(data.defaults);}
 if(p==='/api/v1/admin/trips'){let items=data.trips.filter(t=>(!q||(t.title+' '+t.email).toLowerCase().includes(q))&&(!url.searchParams.get('status')||t.status===url.searchParams.get('status')));return response(paged(items,page));}
 const trip=p.match(new RegExp('^/api/v1/admin/trips/([0-9]+)/action$'));
 if(trip){const t=data.trips.find(t=>t.id===Number(trip[1]));if(body.expectedUpdatedAt!==t.updatedAt)return response(null,409,'资料已更新，请重新加载后再操作');
  if(body.action==='DELETE'){if(body.confirmation!==t.title)return response(null,400);data.trips=data.trips.filter(x=>x!==t);}
  else{if(body.action==='ARCHIVE')t.status='ARCHIVED';if(body.action==='UNARCHIVE')t.status='COMPLETED';if(body.action==='REVOKE_SHARES')t.activeShares=0;t.updatedAt=stamp();}return response(null);
 }
 if(p==='/api/v1/admin/media')return response(paged(data.media.filter(m=>(!q||(m.title+' '+m.email).toLowerCase().includes(q))&&(!url.searchParams.get('kind')||m.kind===url.searchParams.get('kind'))&&(!url.searchParams.get('status')||m.status===url.searchParams.get('status'))),page));
 const medium=p.match(new RegExp('^/api/v1/admin/media/(PHOTO|VIDEO|MUSIC)/([0-9]+)/deletion$'));
 if(medium){const m=data.media.find(m=>m.kind===medium[1]&&m.id===Number(medium[2]));if(body.expectedUpdatedAt!==m.updatedAt)return response(null,409);if(m.kind==='MUSIC')m.status='DELETED';else data.media=data.media.filter(x=>x!==m);return response(null);}
 if(p==='/api/v1/admin/audit-logs')return response(paged([...data.audit].reverse().filter(a=>!q||a.action.toLowerCase().includes(q)||String(a.userId)===q),page));
 if(p==='/api/v1/admin/maintenance')return response(data.maintenance);
 if(p==='/api/v1/admin/maintenance/jobs'){
  if(method==='POST'){const j={id:data.jobs.length+1,kind:body.kind,status:'QUEUED',createdAt:stamp()};data.jobs.unshift(j);jobReads=0;return response(j);}
  if(data.jobs[0]?.status==='QUEUED'&&++jobReads>1){data.jobs[0].status='COMPLETED';data.jobs[0].result='本轮已清理 1 项；未完成项继续重试。';data.jobs[0].completedAt=stamp();data.maintenance.expiredTrips=0;}return response(data.jobs);
 }
 return response(null,404,'未处理测试接口 '+p);
};
}`
new vm.Script(fixture)
const browser = await openBrowser({width:1440,height:1050})
const results=[]
const check=(name,ok)=>{results.push({name,ok:!!ok});console.log(`${ok?'PASS':'FAIL'} ${name}`)}
const exists=expression=>browser.waitFor(expression,30000)
async function nav(section,title){
  await browser.js(`document.querySelector('aside button[title="${title}"]').click()`)
  await exists(`document.querySelector('h1')?.textContent==='${title}'&&!!document.querySelector('[aria-label="后台管理栏目"]')&&document.querySelector('[aria-label="后台管理栏目"]').getAttribute('aria-busy')==='false'`)
  check(`${title} 使用真实接口契约`,await exists(`window.__qaReads.some(p=>p.includes('${section}'))`))
}
async function finishDialog(){await exists('[...document.querySelectorAll("dialog[open] button")].some(b=>b.innerText==="完成"&&!b.disabled)');await browser.clickText('/^完成$/','dialog[open] button');await exists('!document.querySelector("dialog[open]")')}
async function confirm(){await browser.clickText('/^确认执行$/','dialog[open] button');await exists('!document.querySelector("dialog[open]")')}
async function shot(name){await browser.js(name.includes('mobile') ? "window.scrollTo({top:document.querySelector('form[class*=editorPanel]').getBoundingClientRect().top+scrollY-80,left:0,behavior:'instant'})" : "window.scrollTo({top:0,left:0,behavior:'instant'})");await new Promise(resolve=>setTimeout(resolve,300));const image=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${name}.png`),Buffer.from(image.result.data,'base64'))}
try{
 await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});await browser.goto(`${web}/admin`);await exists('!!document.querySelector("tbody tr")');
 await browser.clickText('/^新增用户$/');await browser.fill('input[name=inviteEmail]','invited@example.test');await browser.fill('input[name=inviteNickname]','受邀者');await browser.clickText('/发送注册邀请/','dialog[open] button');
 check('新增发送邀请且没有绕过邮箱验证代建账号',await exists('document.body.innerText.includes("邀请邮件已发送")&&window.__qaModules.invitations.length===1&&JSON.parse(localStorage.getItem("qa-admin-users")).length===34'));
 await finishDialog();await nav('/invitations','注册邀请');
 await browser.clickText('/^重发$/','tbody button');await confirm();check('邀请可重发',await browser.js('window.__qaWrites.some(w=>w.p.endsWith("/RESEND"))'));
 await browser.clickText('/^撤销$/','tbody button');await confirm();check('邀请可撤销并展示实际状态',await exists('document.querySelector("tbody")?.innerText.includes("已撤销")'));
 await browser.clickText('/邀请新用户/');await browser.fill('input[name=inviteEmail]','failure@example.test');await browser.fill('input[name=inviteNickname]','邮件失败');await browser.js('window.__qaMailFail=true');await browser.clickText('/发送注册邀请/','dialog[open] button');
 check('邮件发送失败保留输入并显示真实错误',await exists('document.querySelector("dialog[open]")?.innerText.includes("邀请邮件发送失败")&&document.querySelector("input[name=inviteEmail]").value==="failure@example.test"'));
 await browser.clickText('/^取消$/','dialog[open] button');await exists('[...document.querySelectorAll("dialog[open]")].some(d=>d.innerText.includes("有未保存的修改"))');await browser.clickText('/放弃修改/','dialog[open] button');
 await nav('/trips','内容管理');await browser.clickText('/^归档$/','tbody button');await confirm();check('旅程可归档',await exists('window.__qaModules.trips[0].status==="ARCHIVED"&&document.querySelector("tbody").innerText.includes("已归档")'));
 await browser.clickText('/取消归档/','tbody button');await confirm();check('取消归档恢复已完成',await exists('window.__qaModules.trips[0].status==="COMPLETED"'));
 await browser.clickText('/撤销分享/','tbody button');await confirm();check('可撤销旅程的所有分享链接',await exists('window.__qaModules.trips[0].activeShares===0'));
 await browser.clickText('/^删除$/','tbody button');check('旅程删除须填写完整名称',await browser.js('[...document.querySelectorAll("dialog[open] button")].find(b=>b.innerText==="确认执行").disabled'));
 await browser.fill('input[name=resourceConfirmation]','模块验收旅行');await browser.js('window.__qaModules.trips[0].updatedAt="2026-11-16T02:00:00.999999"');await browser.clickText('/^确认执行$/','dialog[open] button');
 check('内容版本冲突保留确认信息且没有删除',await exists('document.querySelector("dialog[open]")?.innerText.includes("资料已更新")&&window.__qaModules.trips.length===1'));
 await browser.clickText('/^取消$/','dialog[open] button');await browser.clickText('/放弃修改/','dialog[open] button');await exists('!!document.querySelector("tbody tr")');
 await browser.clickText('/^删除$/','tbody button');await browser.fill('input[name=resourceConfirmation]','模块验收旅行');await confirm();check('确认后真实提交旅程删除契约',await exists('window.__qaModules.trips.length===0&&document.body.innerText.includes("暂无符合条件的数据")'));
 await nav('/media','媒体管理');check('媒体按类型展示资源元数据',await exists('document.querySelectorAll("tbody tr").length===3'));
 await browser.js('var select=document.querySelector("select[aria-label=媒体类型]");select.value="PHOTO";select.dispatchEvent(new Event("change",{bubbles:true}))');
 check('媒体筛选与 URL 一致',await exists('location.search.includes("kind=PHOTO")&&document.querySelectorAll("tbody tr").length===1'));
 await browser.clickText('/删除资源/','tbody button');await browser.fill('input[name=resourceConfirmation]','删除');await confirm();check('照片删除使用归属和版本接口',await exists('!window.__qaModules.media.some(m=>m.kind==="PHOTO")'));
 await browser.js('var select=document.querySelector("select[aria-label=媒体类型]");select.value="";select.dispatchEvent(new Event("change",{bubbles:true}))');await exists('document.querySelectorAll("tbody tr").length===2');
 check('正在处理的视频禁止删除',await browser.js('[...document.querySelectorAll("tbody tr")].find(r=>r.innerText.includes("处理中视频")).querySelector("button").disabled'));
 await browser.js('[...document.querySelectorAll("tbody tr")].find(r=>r.innerText.includes("自己的音乐")).querySelector("button").click()');await browser.fill('input[name=resourceConfirmation]','删除');await confirm();check('用户音乐删除显示软删除状态',await exists('document.querySelector("tbody").innerText.includes("已删除")'));
 await nav('/settings/defaults','系统设置');await exists('!!document.querySelector("input[name=defaultTripLimit]")');await browser.fill('input[name=defaultTripLimit]','35');await browser.clickText('/保存新账号默认权限/');
 check('默认权限真实保存并保留原成本限额',await exists('window.__qaModules.defaults.tripLimit===35&&document.body.innerText.includes("新账号默认权限已保存")&&document.body.innerText.includes("6000")'));
 await shot('settings-desktop');await browser.fill('input[name=defaultTripLimit]','36');await browser.js('document.querySelector("button[aria-label=刷新数据]").click()');await exists('document.querySelector("dialog[open]")?.innerText.includes("有未保存的修改")');await browser.clickText('/放弃修改/','dialog[open] button');
 check('放弃设置草稿后刷新读取新资料且不误报失败',await exists('document.querySelector("input[name=defaultTripLimit]")?.value==="35"&&!document.body.innerText.includes("部分数据刷新失败")'));
 await browser.fill('input[name=defaultTripLimit]','36');await browser.js('[...document.querySelectorAll("aside button")].find(b=>b.textContent.includes("日志与维护")).click()');await browser.js('document.querySelector("aside button[title=审计日志]").click()');
 check('系统设置也有未保存修改保护',await exists('document.querySelector("dialog[open]")?.innerText.includes("有未保存的修改")'));
 await browser.clickText('/放弃修改/','dialog[open] button');await exists('document.querySelector("h1")?.textContent==="审计日志"&&document.querySelectorAll("tbody tr").length===25');
 check('审计日志采用服务端分页',await browser.js('document.body.innerText.includes("共 30 条")'));
 await browser.js('document.querySelector("button[aria-label=下一页]").click()');check('审计第二页与 URL 同步',await exists('location.search.includes("xpage=2")&&document.querySelectorAll("tbody tr").length===5'));
 await browser.js('document.querySelector("tbody details summary").click()');check('审计详情只作为文本显示',await browser.js('!window.__unsafe&&!document.querySelector("tbody pre img")&&document.querySelector("tbody pre").innerText.includes("<img")'));
 await nav('/maintenance','运行维护');await exists('document.querySelectorAll(".undefined").length===0&&document.body.innerText.includes("冷静期已到的账号")');
 await browser.clickText('/执行本轮清理/');await browser.fill('input[name=resourceConfirmation]','清理到期数据');await confirm();
 check('维护任务持久化入队',await exists('window.__qaModules.jobs.length===1&&document.querySelector("tbody").innerText.includes("排队中")'));
 check('维护任务轮询到完成并显示结果',await exists('document.querySelector("tbody")?.innerText.includes("本轮已清理 1 项")'));
 await shot('maintenance-desktop');await browser.js('window.__qaModuleFail=true');await browser.js('document.querySelector("button[aria-label=刷新数据]").click()');
 check('栏目读取失败显示错误而非假数据成功',await exists('document.body.innerText.includes("栏目读取失败")'));
 await browser.js('window.__qaModuleFail=false');await browser.clickText('/重试当前栏目/');check('失败可独立重试',await exists('!document.body.innerText.includes("栏目读取失败")'));
 await browser.js('document.querySelector("aside button[title=用户管理]").click()');await exists('document.querySelector("h1")?.textContent==="用户管理"&&!!document.querySelector("button[aria-label^=更多操作]")');
 await browser.js('document.querySelector("button[aria-label^=更多操作]").click()');await browser.clickText('/删除用户/','[role=menu]:popover-open button');await exists('!!document.querySelector("input[name=deletionConfirmation]")');
 check('删除账号明确提示冷静期和影响',await browser.js('document.querySelector("dialog[open]").innerText.includes("7 天冷静期")&&[...document.querySelectorAll("dialog[open] button")].find(b=>b.innerText==="确认安排删除").disabled'));
 await browser.fill('input[name=deletionConfirmation]','traveler34@example.test');await browser.clickText('/确认安排删除/','dialog[open] button');check('删除账号进入冷静期且未物理删除',await exists('document.body.innerText.includes("1 项成功，0 项未完成")&&JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===133).status==="DELETION_PENDING"'));
 await finishDialog();await browser.js('document.querySelector("button[aria-label^=更多操作]").click()');await browser.clickText('/撤销删除/','[role=menu]:popover-open button');await browser.fill('input[name=deletionConfirmation]','撤销删除');await browser.clickText('/确认撤销删除/','dialog[open] button');
 check('可撤销冷静期内的账号删除',await exists('JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===133).status==="ACTIVE"&&document.body.innerText.includes("1 项成功，0 项未完成")'));await finishDialog();
 await browser.js('[...document.querySelectorAll("tbody input[type=checkbox]")].slice(0,2).forEach(i=>i.click())');await browser.clickText('/^删除$/','footer button');await exists('document.querySelector("dialog[open]")?.innerText.includes("删除用户 · 2 人")');await browser.fill('input[name=deletionConfirmation]','删除 2 个账号');await browser.clickText('/确认安排删除/','dialog[open] button');
 check('批量删除逐项执行并报告结果',await exists('document.body.innerText.includes("2 项成功，0 项未完成")&&JSON.parse(localStorage.getItem("qa-admin-users")).filter(u=>u.deletionRequestedByAdmin).length===2'));await finishDialog();
 await browser.js('[...document.querySelectorAll("tbody input[type=checkbox]")].filter(i=>!i.disabled).slice(0,2).forEach(i=>i.click())');await browser.clickText('/^删除$/','footer button');await exists('document.querySelector("dialog[open]")?.innerText.includes("删除用户 · 2 人")&&!!document.querySelector("input[name=deletionConfirmation]:not(:disabled)")');
 await browser.js('const changed=JSON.parse(localStorage.getItem("qa-admin-users"));const first=changed.filter(u=>u.status!=="DELETION_PENDING").sort((a,b)=>b.id-a.id)[0];window.__qaDeletionConflict=first.id;first.updatedAt="2026-11-16T03:00:00.999999";localStorage.setItem("qa-admin-users",JSON.stringify(changed))');
 await browser.fill('input[name=deletionConfirmation]','删除 2 个账号');await browser.clickText('/确认安排删除/','dialog[open] button');
 check('批量删除版本冲突逐项反馈且不误删冲突账号',await exists('document.body.innerText.includes("1 项成功，1 项未完成")&&JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===window.__qaDeletionConflict).status!=="DELETION_PENDING"'));
 await browser.clickText('/重新加载失败账号后重试/','dialog[open] button');await exists('!!document.querySelector("input[name=deletionConfirmation]:not(:disabled)")&&document.querySelector("dialog[open]").innerText.includes("删除用户 · 1 人")');
 const conflictEmail=await browser.js('JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===window.__qaDeletionConflict).email');await browser.fill('input[name=deletionConfirmation]',conflictEmail);await browser.clickText('/确认安排删除/','dialog[open] button');
 check('批量删除失败项明确重载后可单独重试',await exists('document.body.innerText.includes("1 项成功，0 项未完成")&&JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===window.__qaDeletionConflict).status==="DELETION_PENDING"'));await finishDialog();
 await nav('/settings/defaults','系统设置');await browser.send('Emulation.setDeviceMetricsOverride',{width:375,height:1000,deviceScaleFactor:1,mobile:true});
 check('新设置页面手机无横向溢出',await browser.js('document.documentElement.scrollWidth<=innerWidth+1'));await shot('settings-mobile');
 check('没有运行时脚本异常',browser.errors.length===0);
}catch(error){check('新管理模块脚本完整执行',false);console.error(error);await shot('failure').catch(()=>{})}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({results,errors:browser.errors},null,2));await browser.close()}
process.exitCode=results.every(r=>r.ok)?0:1
