// 深度交互回归：全部业务数据由浏览器夹具提供，不创建真实用户或写入生产数据。
import fs from 'node:fs'
import path from 'node:path'
import { openBrowser } from '../lib/browser.mjs'
import { layoutFixture } from '../fixtures/layout-ui.mjs'
const web = process.env.UX_TEST_WEB || 'http://127.0.0.1:3017'
const output = path.resolve('backend/.tabitrace/page-consistency-qa')
fs.mkdirSync(output, { recursive: true })
const b = await openBrowser(), results = []
const check = (name, ok) => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let fixtureId
async function load(route, scenario = '') {
  if (fixtureId) await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixtureId })
  const source = layoutFixture({ web, photoCount: 8 }).replace("if(method==='GET'&&", "if(p.startsWith('/api/v1/official-cities'))return Promise.resolve(new Response(JSON.stringify({success:true,data:[]})));if(method==='GET'&&") + `
    localStorage.setItem('tabitrace-live-trip-id','900002');
    for(const k of Object.keys(localStorage))if(k.startsWith('tabitrace-notifications-read-at'))localStorage.removeItem(k);
    window.__scenario=${JSON.stringify(scenario)};window.__accountId=900001;
    const baseFetch=window.fetch;
    window.fetch=async(input,init)=>{
      const u=new URL(typeof input==='string'?input:input.url,location.href),p=u.pathname;
      if(!p.startsWith('/api/v1/'))return baseFetch(input,init);
      if(window.__scenario==='trip-error'&&p==='/api/v1/trips'||window.__scenario==='share-error'&&p.endsWith('/photos')||window.__scenario==='summary-error'&&p.endsWith('/summary'))return new Response(JSON.stringify({success:false,message:'测试读取失败'}),{status:500});
      if(p==='/api/v1/places/search'){await new Promise(r=>setTimeout(r,500));return new Response(JSON.stringify({success:true,data:[]}));}
      if(p==='/api/v1/video-templates')return new Response(JSON.stringify({success:true,data:[{code:'JOURNAL',name:'旅行手记',englishName:'Travel Journal',description:'记录旅行',suitableFor:'全部旅行',pace:'MEDIUM',transition:'fade',transitionSeconds:.5,plan:'FREE'}]}));
      if(p==='/api/v1/user/music')return new Response(JSON.stringify({success:true,data:{membership:{status:'ACTIVE',source:'OPEN_ACCESS',features:[]},canUpload:true,canUse:true,limits:{maxFileBytes:20971520,maxTracks:20,maxTotalBytes:209715200,minDurationSeconds:10,maxDurationSeconds:600,formats:['MP3','M4A'],extensions:['mp3','m4a'],mimeTypes:['audio/mpeg','audio/mp4']},usage:{tracks:0,bytes:0},items:[]}}));
      const response=await baseFetch(input,init);
      if(p==='/api/v1/users/me'){const e=await response.json();e.data.id=window.__accountId;if(window.__scenario==='avatar-error')e.data.avatarUrl='/qa-missing-avatar.png';return new Response(JSON.stringify(e));}
      if(window.__scenario==='preview-race'&&p.endsWith('/video-storyboard')){const e=await response.json();e.data.scenes[0].title=p.includes('/900001/')?'旧旅行预览标记':'新旅行预览标记';if(p.includes('/900001/'))await new Promise(r=>setTimeout(r,1800));return new Response(JSON.stringify(e));}
      if(window.__scenario==='race'&&p==='/api/v1/trips/900001')await new Promise(r=>setTimeout(r,1500));
      return response;
    };`
  fixtureId = (await b.send('Page.addScriptToEvaluateOnNewDocument', { source })).result.identifier
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await b.goto(web + route, 300)
}
async function key(key, code, shift = false) {
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code, modifiers: shift ? 8 : 0 })
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code })
}
async function openSearch() {
  await b.js("document.querySelector('.workspace-search').focus();document.querySelector('.workspace-search').click()")
  return b.waitFor("document.activeElement===document.querySelector('.command-input input')")
}
try {
  await load('/trips')
  check('进入旅行列表保留已选择的归档旅行', await b.waitFor("document.querySelector('.trip-body h4')?.innerText.includes('京都')&&localStorage.getItem('tabitrace-live-trip-id')==='900002'"))
  check('归档旅行提供回看入口', await b.js("document.querySelector('.trip-body .trip-actions a').innerText.includes('回看')"))
  await load('/trips', 'trip-error')
  check('旅行读取失败有重试入口', await b.waitFor("document.querySelector('[role=alert]')?.innerText.includes('重新加载')"))
  await b.js("window.__scenario='';[...document.querySelectorAll('[role=alert] button')][0].click()")
  check('旅行列表重试可恢复且不要求重复登录', await b.waitFor("!!document.querySelector('.trip-body')&&!document.querySelector('[role=alert]')"))
  check('今日建议为真实入口且使用当前旅行', await b.js("document.querySelectorAll('.trip-suggested-action').length===4&&[...document.querySelectorAll('.trip-suggested-action')].every(a=>a.getAttribute('href').startsWith('/trips/900002/'))"))

  check('搜索打开后聚焦输入框', await openSearch())
  check('搜索锁定背景滚动', await b.js("document.body.style.overflow==='hidden'"))
  await b.fill('.command-input input', 'qzxNoMatch')
  check('无关关键词不再混入照片', await b.waitFor("document.querySelector('.command-results').innerText.includes('没有匹配结果')&&!document.querySelector('.command-result')"))
  await b.fill('.command-input input', '精选照片')
  check('可按精选标记找到照片', await b.waitFor("[...document.querySelectorAll('.command-result b')].some(e=>e.innerText==='精选照片')"))
  await b.fill('.command-input input', '浅草')
  await sleep(250)
  await b.fill('.command-input input', 'a')
  check('清短搜索词后加载指示不会残留', await b.waitFor("!document.querySelector('[aria-label=\"正在搜索\"]')"))
  await b.js("document.querySelector('.command-input input').focus()")
  await key('Tab', 9, true)
  check('搜索 Shift+Tab 保持在弹层内', await b.js("!!document.activeElement.closest('.command-panel')&&document.activeElement!==document.querySelector('.command-input input')"))
  await key('Tab', 9)
  check('搜索 Tab 循环返回输入框', await b.js("document.activeElement===document.querySelector('.command-input input')"))
  await key('Escape', 27)
  check('关闭搜索恢复入口焦点及背景滚动', await b.waitFor("!document.querySelector('.command-panel')&&document.activeElement.classList.contains('workspace-search')&&document.body.style.overflow!== 'hidden'"))

  await b.js("localStorage.setItem('tabitrace-live-trip-id','900001');window.dispatchEvent(new Event('tabitrace:active-trip-changed'))")
  await b.waitFor("!!document.querySelector('.workspace-topbar .icon-dot')")
  await b.js("document.querySelector('.workspace-topbar button[aria-haspopup=dialog]').click()")
  check('桌面读取通知后两套顶栏红点同步消失', await b.waitFor("!document.querySelector('.icon-dot')"))
  await key('Escape', 27)
  await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true })
  check('切换手机布局不会重新出现旧未读点', await b.js("!document.querySelector('.m-topbar .icon-dot')"))
  // 正常换账号会清空用户资料缓存；夹具只替换读取结果，需等待 5 秒合并窗口结束。
  await sleep(5100)
  await b.js("window.__accountId=900009;window.dispatchEvent(new Event('tabitrace:active-trip-changed'))")
  check('更换账号不会继承上个账号的通知已读状态', await b.waitFor("!!document.querySelector('.m-topbar .icon-dot')"))

  await load('/trips/900001/share?mode=nine', 'share-error')
  check('分享页初始读取失败可原地重试', await b.waitFor("document.querySelector('.ss-alert')?.innerText.includes('重新加载')"))
  await b.js("window.__scenario='';[...document.querySelectorAll('.ss-alert button')].find(e=>e.innerText.includes('重新加载')).click()")
  check('分享页重试清除旧错误并恢复预览', await b.waitFor("!document.querySelector('.ss-alert')&&document.querySelectorAll('.sg-tile img').length>0"))
  check('过高的成果预览随页面滚动', await b.waitFor("document.querySelector('.share-scale.is-tall')&&getComputedStyle(document.querySelector('.ss-stage')).position==='static'"))
  await b.js("document.querySelector('.ss-zoom-btn').focus();document.querySelector('.ss-zoom-btn').click()")
  check('成果大图聚焦关闭按钮', await b.waitFor("document.activeElement.getAttribute('aria-label')==='关闭大图'"))
  await key('Tab', 9)
  check('成果大图 Tab 不会跳回背景页面', await b.js("!!document.activeElement.closest('.ss-lightbox')"))
  await key('Escape', 27)
  check('成果大图关闭后恢复入口焦点', await b.waitFor("!document.querySelector('.ss-lightbox')&&document.activeElement.classList.contains('ss-zoom-btn')"))

  for (const suffix of ['map', 'share']) {
    await load(`/trips/900001/${suffix}`, 'race')
    await b.waitFor("document.querySelector('.trip-context select')?.options.length===2")
    await b.fill('.trip-context select', '900002')
    await b.waitFor("location.pathname.includes('/900002/')")
    await sleep(1900)
    check(`${suffix} 慢旧请求不会覆盖已切换的新旅行`, await b.js("document.querySelector('main h1').innerText.includes('京都')"))
  }
  await load('/trips/900001/video', 'preview-race')
  await b.waitFor("document.querySelector('.trip-context select')?.options.length===2")
  await b.fill('.trip-context select', '900002')
  await b.waitFor("document.querySelector('.vs-page')?.innerText.includes('新旅行预览标记')")
  await sleep(2100)
  check('旧旅行的视频分镜响应不污染新旅行预览', await b.js("document.querySelector('.vs-page').innerText.includes('新旅行预览标记')&&!document.querySelector('.vs-page').innerText.includes('旧旅行预览标记')"))
  await load('/trips/900001/gallery')
  await b.waitFor("!!document.querySelector('.gl-card-hit')")
  await b.js("document.querySelector('.gl-card-hit').focus();document.querySelector('.gl-card-hit').click()")
  check('相册详情打开时聚焦关闭按钮', await b.waitFor("document.activeElement.getAttribute('aria-label')==='关闭'&&!!document.activeElement.closest('.gl-detail')"))
  await b.js("document.querySelector('.gl-detail img').dispatchEvent(new Event('error'))")
  check('相册大图失败显示可理解的占位', await b.waitFor("document.querySelector('.gl-detail-media').innerText.includes('照片暂时无法显示')"))
  await b.js("document.querySelector('#gl-detail-checkin').focus()")
  await key('Escape', 27)
  check('详情下拉框聚焦时 Escape 仍能关闭', await b.waitFor("!document.querySelector('.gl-detail')&&document.activeElement.classList.contains('gl-card-hit')"))
  await load('/trips', 'summary-error')
  check('统计接口失败不伪装成零数量，列表仍可用', await b.waitFor("!!document.querySelector('.m-trip-list a')&&document.querySelector('[role=status]')?.innerText.includes('部分统计读取失败')&&document.querySelector('.metric-card b')?.innerText==='—'"))
  await load('/profile', 'avatar-error')
  check('页头和设置头像失败均回退为昵称', await b.waitFor("document.querySelector('.user-avatar')?.tagName==='SPAN'&&!!document.querySelector('.st-avatar.is-initial')"))
  check('没有浏览器运行异常', b.errors.length === 0)
} catch (error) {
  results.push({ name: '专项脚本完成', ok: false, detail: String(error) })
  console.log('FAIL ' + String(error))
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ results, errors: b.errors }, null, 2))
  await b.close()
}
process.exitCode = results.every(item => item.ok) ? 0 : 1
