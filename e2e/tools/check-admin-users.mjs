// 管理后台浏览器回归：所有账号 / 写入均在浏览器沙盒内，不发送真实用户修改请求。
import fs from 'node:fs'
import path from 'node:path'
import { openBrowser } from '../lib/browser.mjs'

const web = process.env.ADMIN_TEST_WEB || 'http://localhost:3000'
const output = path.resolve(process.env.ADMIN_TEST_OUTPUT || 'backend/.tabitrace/admin-users-redesign/browser')
fs.mkdirSync(output, { recursive: true })
const results = []
const browser = await openBrowser({ width: 1440, height: 1050 })
const check = (name, ok) => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
const wait = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms))
const fixture = String.raw`
localStorage.setItem('tabitrace.dev.dataSource','local'); localStorage.setItem('tabitrace-session','1');
const defaults=Array.from({length:34},(_,i)=>({id:100+i,email:'traveler'+String(i+1).padStart(2,'0')+'@example.test',nickname:'旅人 '+String(i+1).padStart(2,'0'),role:'USER',status:i===0?'DELETION_PENDING':i===1?'DISABLED':'ACTIVE',userLevel:'基础用户',tripLimit:20,tripRetentionMonths:12,canShare:true,canVideo:true,customMusicAccess:'INHERIT',trips:2,photos:0,createdAt:'2026-11-01T00:00:00',updatedAt:'2026-11-15T10:00:00.000001',avatarUrl:null}));
if(!localStorage.getItem('qa-admin-users'))localStorage.setItem('qa-admin-users',JSON.stringify(defaults));
const allUsers=()=>JSON.parse(localStorage.getItem('qa-admin-users'));
window.__qaWrites=[]; window.__qaReads=[]; window.__qaVersion=10;
window.__qaMessages=[{id:2,userId:133,email:'traveler34@example.test',nickname:'旅人 34',subject:'申请延长旅程保留时间',content:'希望保留十二个月。<img src=x onerror="window.__unsafe=true">',status:'OPEN',createdAt:'2026-11-15T00:00:00'},{id:1,userId:132,email:'traveler33@example.test',nickname:'旅人 33',subject:'视频权限申请',content:'请帮助检查视频权限。',status:'OPEN',createdAt:'2026-11-14T00:00:00'}];
const originalFetch=fetch.bind(window);
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href),p=url.pathname,method=init.method||'GET';
 if(!p.startsWith('/api/v1/'))return originalFetch(input,init);
 const body=init.body?JSON.parse(init.body):{},users=allUsers();
 const response=(data,status=200,code='QA_ERROR',message='测试请求失败')=>new Response(JSON.stringify({success:status<400,data:status<400?data:null,code,message}),{status,headers:{'Content-Type':'application/json'}});
 if(method==='GET')window.__qaReads.push(url.pathname+url.search);else window.__qaWrites.push({p,method,body});
 const me={id:1,email:'admin@example.test',nickname:'管理员',role:'ADMIN',locale:'zh-CN',timezone:'Asia/Tokyo'};
 if(p==='/api/v1/auth/refresh')return response({accessToken:'browser-fixture-only',user:me});
 if(p==='/api/v1/auth/logout')return response(null);
 if(p==='/api/v1/users/me')return response(me);
 if(p==='/api/v1/plans/trip-pro')return response({});
 if(p==='/api/v1/admin/overview'){
  if(window.__qaOverviewFail)return response(null,500);
  const data={users:users.length,disabledUsers:users.filter(u=>u.status==='DISABLED').length,trips:68,photos:0,videos:0,activeRenders:0,expiringTrips:3,pendingDeletionTrips:0,openMessages:window.__qaMessages.filter(m=>m.status==='OPEN').length,photoBytes:0,videoBytes:0};
  return response(window.__qaZero?Object.fromEntries(Object.keys(data).map(k=>[k,0])):data);
 }
 if(p==='/api/v1/admin/users'){
  const q=(url.searchParams.get('q')||'').trim().toLowerCase(),status=url.searchParams.get('status'),page=Number(url.searchParams.get('page')||1),pageSize=Number(url.searchParams.get('pageSize')||25);
  let items=window.__qaZero?[]:users.filter(u=>(!q||(u.nickname+' '+u.email).toLowerCase().includes(q))&&(!status||u.status===status)).sort((a,b)=>b.id-a.id);
  const data={items:items.slice((page-1)*pageSize,page*pageSize),total:items.length,page,pageSize};
  if(q==='slow')await new Promise(r=>setTimeout(r,1800));
  return response(data);
 }
 const target=p.match(new RegExp('^/api/v1/admin/users/([0-9]+)$'));
 if(target){const user=users.find(u=>u.id===Number(target[1]));if(!user)return response(null,404,'USER_NOT_FOUND','用户不存在');
  if(method==='GET')return response(user);
  if(window.__qaOffline)throw new TypeError('Failed to fetch');
  if(window.__qaSaveMode){window.__qaLastSaveStatus=window.__qaSaveMode;return response(null,window.__qaSaveMode,'SAVE_FAILED','保存失败，请重试');}
  if(body.expectedUpdatedAt!==user.updatedAt)return response(null,409,'ADMIN_USER_CHANGED','用户资料已更新，请重新加载最新资料后再保存');
  Object.assign(user,body,{updatedAt:'2026-11-15T10:00:00.'+String(++window.__qaVersion).padStart(6,'0')});localStorage.setItem('qa-admin-users',JSON.stringify(users));return response(user);
 }
 if(p==='/api/v1/admin/messages/page'){const status=url.searchParams.get('status'),page=Number(url.searchParams.get('page')||1),items=window.__qaMessages.filter(m=>!status||m.status===status);return response({items:items.slice((page-1)*25,page*25),total:items.length,page,pageSize:25});}
 const reply=p.match(new RegExp('^/api/v1/admin/messages/([0-9]+)/reply$'));
 if(reply){const m=window.__qaMessages.find(m=>m.id===Number(reply[1]));Object.assign(m,{reply:body.reply,status:'REPLIED',repliedAt:'2026-11-15T10:00:00'});return response(m);}
 return response(null,404,'QA_UNEXPECTED_API','未预期的接口：'+p);
};`;

async function ready() { return browser.waitFor("!!document.querySelector('tbody tr')&&!document.querySelector('[aria-label=\"普通用户\"] [role=status]')", 60000) }
async function select(id, waitForEditor = true) {
  await browser.waitFor(`!![...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('traveler${String(id - 99).padStart(2,'0')}@example.test'))`)
  await browser.js(`(()=>{const row=[...document.querySelectorAll('tbody tr')].find(r=>r.innerText.includes('traveler${String(id - 99).padStart(2,'0')}@example.test'));row?.querySelector('button')?.click()})()`)
  if (!waitForEditor) return true
  return browser.waitFor(`!!document.querySelector('[name=tripLimit]')&&document.querySelector('[aria-label="用户权限表单"]').innerText.includes('ID ${id}')`)
}
async function screenshot(name, full = false) {
  await browser.js('window.scrollTo(0,0)')
  const size = await browser.js('({width:innerWidth,height:document.documentElement.scrollHeight})')
  const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full,
    ...(full ? { clip: { x: 0, y: 0, width: size.width, height: Math.min(size.height,8000), scale: 1 } } : {}) })
  fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(shot.result.data, 'base64'))
}
try {
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: fixture })
  await browser.goto(`${web}/admin?pageSize=10`, 500)
  check('管理员身份后加载真实契约列表', await ready())
  check('列表初次读取没有权限写入', await browser.js('window.__qaWrites.every(w=>!w.p.startsWith("/api/v1/admin/"))'))
  check('七项统计且零值显示正确', await browser.js('document.querySelectorAll("#admin-overview article,#admin-overview button[class*=statCard]").length===7&&document.querySelector("#admin-overview").innerText.includes("0 B")'))
  check('新增、选择与批量操作存在，删除已接入确认流程', await browser.js('!![...document.querySelectorAll("button")].find(b=>b.innerText==="新增用户")&&!!document.querySelector("tbody input[type=checkbox]")&&[...document.querySelectorAll("button")].filter(b=>b.innerText.includes("删除用户")).every(b=>!b.disabled)'))
  check('每页 10 条来自分页接口', await browser.js('document.querySelectorAll("tbody tr").length===10&&window.__qaReads.some(p=>p.includes("pageSize=10"))'))
  await browser.clickText('/下一页/', 'button[aria-label]') // 图标按钮由 aria-label 定位。
  await browser.js('document.querySelector("button[aria-label=下一页]").click()')
  check('下一页与 URL 同步', await browser.waitFor('new URL(location.href).searchParams.get("page")==="2"&&document.querySelector("tbody").innerText.includes("traveler24@example.test")'))
  await browser.js('document.querySelector("button[aria-label=上一页]").click()')
  await ready()
  await browser.fill('input[aria-label="搜索用户邮箱或昵称"]', 'traveler34')
  check('昵称邮箱防抖搜索', await browser.waitFor('document.querySelectorAll("tbody tr").length===1&&new URL(location.href).searchParams.get("q")==="traveler34"'))
  await browser.js('document.querySelector("button[aria-label=清空搜索]").click()')
  check('清空搜索恢复第一页', await browser.waitFor('document.querySelectorAll("tbody tr").length===10&&!new URL(location.href).searchParams.has("q")'))
  await browser.fill('#admin-user-status', 'DISABLED')
  check('状态筛选使用服务端数据', await browser.waitFor('document.querySelectorAll("tbody tr").length===1&&document.querySelector("tbody").innerText.includes("traveler02@example.test")'))
  await browser.fill('#admin-user-status', '')
  await browser.waitFor('document.querySelectorAll("tbody tr").length===10')
  check('读取最新用户详情', await select(133))
  await browser.js('window.history.pushState(null,"","?pageSize=10&page=1&backProbe=1")')
  await wait()
  await browser.fill('input[name=tripLimit]', '21')
  await browser.waitFor('document.body.innerText.includes("有未保存的修改")')
  await browser.js('history.back()')
  check('浏览器返回同样保护未保存草稿', await browser.waitFor('document.querySelector("dialog[open]")?.innerText.includes("有未保存")'))
  await browser.clickText('/继续编辑/')
  await select(132, false)
  check('未保存修改切换用户弹出确认', await browser.waitFor('document.querySelector("dialog[open]")?.innerText.includes("有未保存")'))
  await browser.clickText('/继续编辑/')
  check('继续编辑保留原草稿', await browser.js('document.querySelector("input[name=tripLimit]").value==="21"'))
  await select(132, false)
  await browser.clickText('/放弃修改/')
  check('放弃后切换到正确用户', await browser.waitFor('document.querySelector("[aria-label=用户权限表单]")?.innerText.includes("ID 132")'))
  await browser.fill('input[name=tripLimit]', '0')
  const writesBefore = await browser.js('window.__qaWrites.length')
  await browser.clickText('/保存权限/')
  check('非法配额不发送写请求', await browser.js(`window.__qaWrites.length===${writesBefore}&&document.body.innerText.includes('0 不代表不限')`))
  await browser.fill('input[name=tripLimit]', '50')
  await browser.clickText('/保存权限/')
  check('保存成功后使用服务器权威资料', await browser.waitFor('document.body.innerText.includes("保存成功")&&JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===132).tripLimit===50'))
  check('并发令牌保持微秒精度', await browser.js('window.__qaWrites.filter(w=>w.method==="PUT").at(-1).body.expectedUpdatedAt==="2026-11-15T10:00:00.000001"'))
  await browser.fill('input[name=tripLimit]', '51')
  await browser.js('window.__qaSaveMode=500')
  await browser.clickText('/保存权限/')
  check('500 失败保留草稿且没有假成功', await browser.waitFor('document.querySelector("input[name=tripLimit]").value==="51"&&document.body.innerText.includes("保存失败")&&!document.body.innerText.includes("保存成功")'))
  for (const statusCode of [403,422]) {
    await browser.js(`window.__qaSaveMode=${statusCode}`)
    await browser.clickText('/保存权限/')
    check(`${statusCode} 失败保留草稿`, await browser.waitFor(`window.__qaLastSaveStatus===${statusCode}&&document.querySelector('input[name=tripLimit]').value==='51'&&document.body.innerText.includes('保存失败')`))
  }
  await browser.js('window.__qaSaveMode=0;window.__qaOffline=true')
  await browser.clickText('/保存权限/')
  check('离线失败保留草稿且没有写入成功', await browser.waitFor('document.querySelector("input[name=tripLimit]").value==="51"&&document.querySelector("[aria-label=用户权限表单] [role=alert]")!==null'))
  await browser.js('window.__qaOffline=false')
  await browser.js('window.__qaSaveMode=0;const users=JSON.parse(localStorage.getItem("qa-admin-users"));users.find(u=>u.id===132).updatedAt="2026-11-15T10:00:00.000099";localStorage.setItem("qa-admin-users",JSON.stringify(users))')
  await browser.clickText('/保存权限/')
  check('409 冲突保留草稿并提供重新加载', await browser.waitFor('document.body.innerText.includes("用户资料已更新")&&document.querySelector("input[name=tripLimit]").value==="51"'))
  await browser.clickText('/重新加载最新资料/')
  await browser.clickText('/放弃修改/')
  check('冲突后重新读取最新资料', await browser.waitFor('document.querySelector("input[name=tripLimit]")?.value==="50"'))
  await browser.fill('input[name=tripRetentionMonths]', '1')
  await browser.clickText('/保存权限/')
  check('缩短保留期需单独确认', await browser.waitFor('document.querySelector("dialog[open]")?.innerText.includes("自动清理")'))
  await browser.clickText('/继续编辑/')
  check('取消风险确认不保存', await browser.js('JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===132).tripRetentionMonths===12'))
  await browser.clickText('/保存权限/')
  await browser.clickText('/确认变更并保存/')
  check('确认后保存保留月数', await browser.waitFor('JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===132).tripRetentionMonths===1'))
  await browser.fill('#admin-user-status','ACTIVE')
  await browser.waitFor('document.querySelectorAll("tbody tr").length===10')
  await browser.fill('select[name=status]','DISABLED')
  await browser.clickText('/保存权限/')
  check('停用账号前提示会话撤销风险', await browser.waitFor('document.querySelector("dialog[open]")?.innerText.includes("撤销")'))
  await browser.clickText('/确认变更并保存/')
  check('停用保存后从正常用户筛选移除且保留筛选', await browser.waitFor('JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===132).status==="DISABLED"&&!document.querySelector("tbody").innerText.includes("traveler33@example.test")&&new URL(location.href).searchParams.get("status")==="ACTIVE"'))
  await browser.fill('#admin-user-status','')
  await browser.waitFor('document.querySelectorAll("tbody tr").length===10')
  await browser.js('window.__qaOverviewFail=true')
  await browser.js('document.querySelector("button[aria-label=刷新数据]").click()')
  check('统计失败不阻断用户列表', await browser.waitFor('document.body.innerText.includes("概览读取失败")&&document.querySelectorAll("tbody tr").length===10'))
  await browser.js('window.__qaOverviewFail=false')
  await browser.clickText('/重试概览/')
  check('概览失败可独立重试', await browser.waitFor('!document.body.innerText.includes("概览读取失败")'))
  await browser.clickText('/^取消$/')
  await browser.js('window.__qaZero=true;document.querySelector("button[aria-label=刷新数据]").click()')
  check('全零概览与空用户列表有独立正常状态', await browser.waitFor('document.body.innerText.includes("暂无普通用户")&&[...document.querySelectorAll("#admin-overview strong")].every(n=>n.innerText==="0")'))
  await browser.js('window.__qaZero=false;document.querySelector("button[aria-label=刷新数据]").click()')
  await ready()
  await browser.clickText('/留言管理/', 'nav[aria-label=后台栏目] button')
  check('留言页读取真实分页契约', await browser.waitFor('document.body.innerText.includes("申请延长旅程保留时间")'))
  check('留言内容只作文本展示', await browser.js('!window.__unsafe&&!document.querySelector("[class*=messageContent] img")&&document.body.innerText.includes("<img src=x")'))
  await browser.fill('textarea', '已收到申请，权限已按实际情况处理。')
  await browser.clickText('/用户管理/', 'nav[aria-label=后台栏目] button')
  check('未发送留言切换页面也有草稿保护', await browser.waitFor('document.querySelector("dialog[open]")?.innerText.includes("有未保存")'))
  await browser.clickText('/继续编辑/')
  await browser.clickText('/发送回复/')
  check('回复后刷新待处理列表与概览', await browser.waitFor('document.body.innerText.includes("回复已发送")&&window.__qaMessages.filter(m=>m.status==="OPEN").length===1&&document.querySelector("#admin-overview button").innerText.includes("1")'))
  await browser.clickText('/用户管理/', 'nav[aria-label=后台栏目] button')
  await ready()
  await browser.fill('input[aria-label="搜索用户邮箱或昵称"]','nothing-matches')
  check('空结果提供清除筛选入口', await browser.waitFor('document.body.innerText.includes("没有匹配的用户")'))
  await browser.clickText('/清除筛选/')
  await ready()
  await browser.fill('input[aria-label="搜索用户邮箱或昵称"]','slow')
  await wait(500)
  await browser.fill('input[aria-label="搜索用户邮箱或昵称"]','traveler34')
  await wait(2400)
  check('慢请求不会覆盖最新搜索结果', await browser.js('document.querySelectorAll("tbody tr").length===1&&document.querySelector("tbody").innerText.includes("traveler34@example.test")'))
  await browser.js('document.querySelector("button[aria-label=清空搜索]").click()')
  await ready()
  for (const width of [320,375,768,1024,1440]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height:1050, deviceScaleFactor:1, mobile:width<768 })
    await wait()
    check(`${width}px 页面无横向溢出`, await browser.js('document.documentElement.scrollWidth<=innerWidth+1'))
    await select(133)
    check(`${width}px 权限编辑可操作`, await browser.waitFor(width<768 ? '!!document.querySelector("dialog[open] input[name=tripLimit]")' : '!!document.querySelector("section[aria-label=编辑用户权限] input[name=tripLimit]")'))
    if (width<768) {
      check(`${width}px 编辑抽屉没有溢出`, await browser.js('document.querySelector("dialog[open]").scrollWidth<=innerWidth+1'))
      if (width===375) {
        await browser.fill('dialog input[name=tripLimit]','53')
        await browser.clickText('/保存权限/')
        check('375px 手机端可以完整保存权限', await browser.waitFor('JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===133).tripLimit===53'))
        await screenshot('users-375-editor')
      }
      await browser.js('document.querySelector("dialog[open] button[aria-label=关闭对话框]").click()')
      await browser.js('document.querySelector("button[aria-label=打开后台导航]").click()')
      check(`${width}px 导航抽屉可打开`, await browser.waitFor('!!document.querySelector("dialog[open] nav[aria-label=后台导航]")'))
      await browser.send('Input.dispatchKeyEvent', { type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27 })
      await browser.send('Input.dispatchKeyEvent', { type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27 })
      check(`${width}px Esc 关闭抽屉`, await browser.waitFor('!document.querySelector("dialog[open]")'))
    } else { await browser.clickText('/^取消$/') }
    await screenshot(`users-${width}`)
  }
  await select(133)
  await screenshot('users-desktop-editor', true)
  check('没有浏览器脚本异常', browser.errors.length===0)
} catch (error) {
  check('脚本执行完成', false)
  console.error(error)
  await screenshot('failure').catch(()=>{})
} finally {
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({results,errors:browser.errors},null,2))
  await browser.close()
}
process.exitCode = results.every(item=>item.ok) ? 0 : 1
