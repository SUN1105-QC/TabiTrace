// Browser-only fixtures: all API requests are intercepted before reaching any server.
import fs from 'node:fs'
import path from 'node:path'
import { openBrowser } from '../lib/browser.mjs'

const web = process.env.ADMIN_TEST_WEB || 'http://localhost:3000'
const output = path.resolve('backend/.tabitrace/admin-support-qa')
fs.mkdirSync(output, { recursive: true })
const browser = await openBrowser()
const results = []
const check = (name, ok) => {
  results.push({ name, ok: !!ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}
const fixture = `
localStorage.setItem('tabitrace.dev.dataSource','local');
if(!sessionStorage.getItem('qa-started')){localStorage.setItem('tabitrace-session','1');sessionStorage.setItem('qa-started','1')}
const originalFetch=fetch.bind(window);
window.__qaWrites=[];
window.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href),p=url.pathname;
  if(!p.startsWith('/api/v1/'))return originalFetch(input,init);
  const method=init.method||'GET';const body=init.body?JSON.parse(init.body):{};
  const account={id:900002,role:'USER',email:'fixture@example.test',nickname:'测试旅人',status:'ACTIVE',userLevel:'基础用户',tripLimit:20,tripRetentionMonths:1,canShare:true,canVideo:true,customMusicAccess:'INHERIT',trips:1,photos:1,emailNotifications:false,locale:'zh-CN',timezone:'Asia/Tokyo',createdAt:'2026-11-01T00:00:00',updatedAt:'2026-11-15T00:00:00.123456',...JSON.parse(localStorage.getItem('qa-account')||'{}')};
  const role=localStorage.getItem('qa-role')||'ADMIN';
  const me=role==='ADMIN'?{...account,id:900001,role:'ADMIN',email:'admin@example.test',nickname:'管理员'}:account;
  const now=new Date(),created=new Date(now.getTime()-25*86400000).toISOString(),expires=new Date(now.getTime()+5*86400000).toISOString();
  const trip={id:900010,title:'测试旅程与原始照片备份',destinationName:'东京',startDate:'2026-11-01',endDate:'2026-11-05',status:'PLANNING',planType:'PRO',peopleCount:1,createdAt:created,expiresAt:expires};
  const message={id:900020,userId:account.id,email:account.email,nickname:account.nickname,subject:'申请延长旅程保留时间',content:'希望升级到 50 条旅程、12 个月保留时间。',status:'OPEN',createdAt:created};
  let data=null;
  if(method!=='GET')window.__qaWrites.push({p,method,body});
  if(p.endsWith('/auth/refresh'))data={accessToken:'browser-only-fixture',user:me};
  else if(p.endsWith('/auth/login')){localStorage.setItem('qa-role','ADMIN');data={accessToken:'browser-only-fixture',user:{...me,role:'ADMIN'}};}
  else if(p.endsWith('/auth/logout'))data=null;
  else if(p==='/api/v1/users/me')data=me;
  else if(p==='/api/v1/admin/overview')data={users:1,disabledUsers:0,trips:1,photos:1,videos:0,activeRenders:0,expiringTrips:1,pendingDeletionTrips:0,openMessages:1,photoBytes:1024,videoBytes:0};
  else if(p==='/api/v1/admin/users')data={items:!url.searchParams.get('q')||account.email.includes(url.searchParams.get('q'))?[account]:[],total:1,page:1,pageSize:25};
  else if(p==='/api/v1/admin/users/'+account.id){if(method==='GET')data=account;else{data={...account,...body,updatedAt:'2026-11-15T00:00:01.123456'};localStorage.setItem('qa-account',JSON.stringify(data));}}
  else if(p==='/api/v1/admin/messages/page'){const replied=localStorage.getItem('qa-reply');const items=replied&&url.searchParams.get('status')==='OPEN'?[]:[{...message,...(replied?{reply:replied,status:'REPLIED',repliedAt:created}:{})}];data={items,total:items.length,page:1,pageSize:25};}
  else if(p==='/api/v1/admin/messages')data=localStorage.getItem('qa-reply')&&url.searchParams.get('status')==='OPEN'?[]:[{...message,...(localStorage.getItem('qa-reply')?{reply:localStorage.getItem('qa-reply'),status:'REPLIED',repliedAt:created}:{})}];
  else if(p.endsWith('/reply')){localStorage.setItem('qa-reply',body.reply);data={...message,reply:body.reply,status:'REPLIED'};}
  else if(p==='/api/v1/support/messages'){data=method==='POST'?{...message,id:900021,...body}:[{...message,reply:localStorage.getItem('qa-reply')||'已收到升级申请',status:'REPLIED',repliedAt:created}];}
  else if(p==='/api/v1/trips')data=Array.from({length:Number(localStorage.getItem('qa-trip-count')||1)},(_,i)=>({...trip,id:trip.id+i}));
  else if(p.endsWith('/export'))return new Response(new Blob(['browser-fixture-zip']),{headers:{'Content-Type':'application/zip'}});
  else if(p.endsWith('/summary'))data={tripId:trip.id,places:1,photos:1,days:5,explorationRate:0,readiness:{}};
  else if(p==='/api/v1/membership')data={status:'ACTIVE',features:['CUSTOM_MUSIC']};
  else data=[];
  return new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}});
};`

async function screenshot(name) {
  const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(shot.result.data, 'base64'))
}

try {
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: fixture })
  await browser.goto(`${web}/admin`, 500)
  check('管理员可以看到数据监控与用户列表', await browser.waitFor("document.body.innerText.includes('fixture@example.test')", 45000))
  await screenshot('admin-desktop')
  await browser.clickText('/编辑权限/')
  check('打开权限编辑器', await browser.waitFor("!!document.querySelector('[aria-label=\"编辑用户权限\"]')"))
  const editor = '[aria-label="编辑用户权限"]'
  await browser.fill(`${editor} input[type="number"]`, '50')
  // Select by label to distinguish the two numeric inputs.
  await browser.js(`(()=>{const e=[...document.querySelectorAll('${editor} label')].find(x=>x.innerText.includes('保留月数')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'12');e.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  await browser.clickText('/保存权限/')
  check('配额和保留月数提交正确', await browser.waitFor("window.__qaWrites.some(w=>w.method==='PUT'&&w.body.tripLimit===50&&w.body.tripRetentionMonths===12)"))
  await browser.waitFor("document.body.innerText.includes('保存成功')&&!document.querySelector('button[aria-label=\"刷新数据\"]').disabled")
  await browser.clickText('/留言管理/', 'nav[aria-label="后台栏目"] button')
  check('管理员能读取用户留言', await browser.waitFor("document.body.innerText.includes('申请延长旅程保留时间')"))
  await browser.fill('textarea', '已为你升级配额和保留时间。')
  await browser.clickText('/发送回复/')
  check('管理员回复提交成功', await browser.waitFor("window.__qaWrites.some(w=>w.p.endsWith('/reply')&&w.body.reply.includes('已为你升级'))"))

  for (const width of [360, 768, 1440]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 })
    await browser.goto(`${web}/admin`, 300)
    await browser.waitFor("document.body.innerText.includes('fixture@example.test')")
    check(`${width} 管理后台无页面横向溢出`, await browser.js('document.documentElement.scrollWidth<=innerWidth+1'))
    await screenshot(`admin-${width}`)
  }

  await browser.js("localStorage.setItem('qa-role','USER')")
  await browser.goto(`${web}/support`, 500)
  check('普通用户可查看升级后的配额与保留月数', await browser.waitFor("document.body.innerText.includes('1 / 50')&&document.body.innerText.includes('12 个月')", 30000))
  check('用户可看到管理员回复', await browser.js("document.body.innerText.includes('已为你升级配额和保留时间。')"))
  check('页面不再显示常驻账号横幅', await browser.js("!document.querySelector('.tt-retention-notice')&&!document.querySelector('[aria-label=\"账号配额与保留期限\"]')"))
  const openNotifications = () => browser.js("[...document.querySelectorAll('button[aria-haspopup=\"dialog\"]')].find(b=>b.getBoundingClientRect().width>0).click()")
  await openNotifications()
  check('通知内显示真实账号用量和保留月数', await browser.waitFor("document.querySelector('[role=dialog] [aria-label=\"账号配额与保留期限\"]')?.innerText.includes('1 / 50 条旅程')&&document.querySelector('[role=dialog]').innerText.includes('12 个月')"))
  check('通知内保留到期提醒、删除说明和原图备份入口', await browser.js("(()=>{const p=document.querySelector('[role=dialog]').innerText;return p.includes('将在 7 天内到期')&&p.includes('导出数据和原始照片')&&p.includes('归档不会延长保留期限')})()"))
  await browser.js("document.querySelector('[role=dialog] a[href=\"/support\"]').click()")
  check('联系管理员入口关闭通知并进入留言页面', await browser.waitFor("!document.querySelector('[role=dialog]')&&location.pathname==='/support'"))
  await browser.fill('textarea', '请帮我开通视频功能。')
  await browser.clickText('/发送留言/')
  check('普通用户留言提交成功', await browser.waitFor("window.__qaWrites.some(w=>w.p==='/api/v1/support/messages'&&w.body.content.includes('开通视频'))"))
  for (const width of [360, 768, 1440]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 })
    await browser.goto(`${web}/support`, 300)
    await browser.waitFor("document.body.innerText.includes('旅程备份与到期时间')")
    check(`${width} 留言与备份页面无横向溢出`, await browser.js('document.documentElement.scrollWidth<=innerWidth+1'))
    await openNotifications()
    check(`${width} 通知面板与滚动区在视口内`, await browser.js("(()=>{const p=document.querySelector('[role=dialog]'),r=p.getBoundingClientRect(),s=p.querySelector('.notification-scroll');return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight&&s.scrollHeight>=s.clientHeight})()"))
    await screenshot(`notifications-${width}`)
    await browser.js("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))")
    check(`${width} Escape 可关闭通知`, await browser.waitFor("!document.querySelector('[role=dialog]')"))
    await screenshot(`support-${width}`)
  }
  await browser.js("localStorage.setItem('qa-account',JSON.stringify({userLevel:'SVIP用户',tripLimit:100000,tripRetentionMonths:1200,notifyTripReminder:false,notifyStory:false,notifyShare:false}));localStorage.setItem('qa-trip-count','6');localStorage.removeItem('tabitrace-notifications-read-at')")
  await browser.goto(`${web}/support`,300)
  await browser.waitFor("document.body.innerText.includes('6 / 100000')")
  await openNotifications()
  check('关闭分类通知仍可查看 SVIP 真实配额与全部到期数量', await browser.waitFor("(()=>{const p=document.querySelector('[role=dialog]');return p?.innerText.includes('SVIP用户')&&p.innerText.includes('6 / 100000 条旅程')&&p.innerText.includes('1200 个月')&&p.innerText.includes('6 条旅程将在 7 天内到期')})()"))
  check('账号规则不会产生业务通知或虚假未读红点', await browser.js("document.querySelector('[role=dialog] .popover-head span').innerText.includes('0')&&!document.querySelector('.icon-dot')"))
  await screenshot('notifications-svip')
  await browser.js("localStorage.setItem('qa-trip-count','0')")
  await browser.goto(`${web}/support`,300)
  await browser.waitFor("document.body.innerText.includes('0 / 100000')")
  await openNotifications()
  check('没有旅程或业务通知时仍能查看账号规则', await browser.waitFor("document.querySelector('[role=dialog]')?.innerText.includes('0 / 100000 条旅程')"))
  await browser.goto(`${web}/admin`, 300)
  check('普通用户访问后台自动返回旅程页', await browser.waitFor("location.pathname==='/trips'"))
  await browser.js("localStorage.removeItem('tabitrace-session');localStorage.setItem('qa-role','ADMIN')")
  await browser.goto(`${web}/login?next=%2Ftrips`, 500)
  await browser.waitFor("!!document.querySelector('#login-email')&&!document.querySelector('#login-email').disabled")
  await browser.fill('#login-email', 'admin@example.test')
  await browser.fill('#login-password', 'Browser-Only-123')
  await browser.js("document.querySelector('form').requestSubmit()")
  check('管理员登录优先进入后台，忽略普通旅程 next 参数', await browser.waitFor("location.pathname==='/admin'", 20000))
  check('没有浏览器运行时异常', browser.errors.length === 0)
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ results, errors: browser.errors }, null, 2))
  await browser.close()
}
process.exitCode = results.every(r => r.ok) ? 0 : 1
