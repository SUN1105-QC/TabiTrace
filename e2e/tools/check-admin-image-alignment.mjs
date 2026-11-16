// 以与用户参考图相同的尺寸和 13 个隔离测试用户检查布局，不修改真实账号。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { openBrowser } from '../lib/browser.mjs'

const web = process.env.ADMIN_TEST_WEB || 'http://localhost:3000'
const output = path.resolve(process.env.ADMIN_TEST_OUTPUT || 'backend/.tabitrace/admin-image-alignment')
fs.mkdirSync(output, { recursive: true })
const source = fs.readFileSync('e2e/tools/check-admin-users.mjs','utf8')
let fixture = source.split('const fixture = String.raw`')[1]?.split('`;')[0]
if (!fixture) throw new Error('Missing isolated browser fixture')
fixture = fixture.replace('length:34','length:13').replace("status:i===0?'DELETION_PENDING':i===1?'DISABLED':'ACTIVE'", "status:'ACTIVE'")
  .replace('tripRetentionMonths:12','tripRetentionMonths:1').replace('trips:2','trips:0').replace('trips:68','trips:0').replace('expiringTrips:3','expiringTrips:0')
fixture += '\nwindow.__qaMessages=[];'
new vm.Script(fixture)
const browser = await openBrowser({width:1162,height:1354})
const results = []
const check = (name, ok) => { results.push({name,ok:!!ok}); console.log(`${ok?'PASS':'FAIL'} ${name}`) }
async function shot(name) {
  await browser.js('window.scrollTo({top:0,left:0,behavior:"instant"})')
  await new Promise(resolve=>setTimeout(resolve,300))
  const metrics = await browser.js('({width:innerWidth,height:document.documentElement.scrollHeight})')
  const image = await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.width,height:Math.min(metrics.height,6000),scale:1}})
  fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(image.result.data,'base64'))
}
try {
  await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fixture})
  await browser.goto(web+'/admin',500)
  check('与参考图一致的 13 行测试用户',await browser.waitFor('document.querySelectorAll("tbody tr").length===13',45000))
  await browser.js('document.querySelector("tbody tr input[type=checkbox]").click();document.querySelector("tbody tr button").click()')
  check('表格选择状态和权限面板均可用',await browser.waitFor('!!document.querySelector("[aria-label=用户权限表单]")&&document.querySelector("tbody input[type=checkbox]").checked'))
  const metrics = await browser.js(`(()=>{
    const cards=[...document.querySelectorAll('#admin-overview [class*=statCard]')].map(x=>x.getBoundingClientRect());
    const policy=[...document.querySelectorAll('[class*=policyFields]>label')].map(x=>x.getBoundingClientRect());
    const lower=[...document.querySelectorAll('[class*=editorLower]>fieldset')].map(x=>x.getBoundingClientRect());
    const table=document.querySelector('[class*=tableScroll]'),panel=document.querySelector('section[aria-label=编辑用户权限]');
    return {width:innerWidth,height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,
      fourPlusThree:cards.length===7&&cards.slice(0,4).every(r=>Math.abs(r.top-cards[0].top)<1)&&cards.slice(4).every(r=>Math.abs(r.top-cards[4].top)<1),
      lastRowFills:Math.abs(cards[6].right-cards[3].right)<2,
      policyThreeColumns:policy.length===3&&policy.every(r=>Math.abs(r.top-policy[0].top)<1),
      featureAndStatusSameRow:lower.length===2&&Math.abs(lower[0].top-lower[1].top)<2,
      rowHeight:document.querySelector('tbody tr').getBoundingClientRect().height,
      editorHeight:panel.getBoundingClientRect().height,tableOverflow:table.scrollWidth-table.clientWidth,
      sidebarItems:[...document.querySelectorAll('aside nav summary,aside nav>button')].map(x=>x.innerText.trim())};
  })()`)
  check('统计卡片为 4+3，第二行铺满',metrics.fourPlusThree&&metrics.lastRowFills)
  check('等级 / 配额 / 月数在同一行',metrics.policyThreeColumns)
  check('功能权限与账号状态在同一行',metrics.featureAndStatusSameRow)
  check('紧凑表格行高不超过 44px',metrics.rowHeight<=44)
  check('权限面板高度不超过 370px',metrics.editorHeight<=370)
  check('全部侧栏分组已显示', ['内容管理','媒体管理','系统设置','日志与维护'].every(label=>metrics.sidebarItems.includes(label)))
  check('新增、更多及批量操作区域均存在',await browser.js('!![...document.querySelectorAll("button")].find(b=>b.innerText==="新增用户")&&!!document.querySelector("button[aria-label^=更多操作]")&&document.body.innerText.includes("批量修改权限")'))
  check('桌面无页面级横向溢出',!metrics.overflow)
  await shot('aligned-1162-desktop')
  await browser.js('document.querySelector("button[aria-label^=更多操作]").click()')
  check('更多菜单真实展开并提供已接入的删除入口',await browser.waitFor('!!document.querySelector("[role=menu]:popover-open")&&document.querySelector("[role=menu]:popover-open").innerText.includes("删除用户")'))
  await shot('aligned-1162-menu')
  await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
  await browser.clickText('/新增用户/')
  check('新增入口复用邮箱验证注册流程而非伪造创建',await browser.waitFor('document.querySelector("dialog[open]")?.innerText.includes("验证邮箱")&&!!document.querySelector("input[name=inviteEmail]")'))
  await browser.clickText('/^取消$/')
  await browser.clickText('/批量修改权限/')
  check('选择后可打开真实的批量编辑器',await browser.waitFor('!!document.querySelector("input[name=bulkTripLimit]")&&!document.querySelector("dialog[open]").innerText.includes("正在读取")'))
  await browser.js('(()=>{const row=document.querySelector("input[name=bulkTripLimit]").closest("label");row.querySelector("input[type=checkbox]").click()})()')
  await browser.fill('input[name=bulkTripLimit]','30')
  await browser.clickText('/检查并继续/')
  check('批量执行前确认人数与范围',await browser.waitFor('[...document.querySelectorAll("dialog[open]")].some(d=>d.innerText.includes("确认批量操作")&&d.innerText.includes("1 个用户"))'))
  await browser.clickText('/确认执行/')
  check('批量修改实际走现有 PUT 且保留其他字段',await browser.waitFor('document.body.innerText.includes("1 项成功，0 项未完成")&&window.__qaWrites.some(w=>w.method==="PUT"&&w.body.tripLimit===30&&w.body.tripRetentionMonths===1)'))
  await browser.clickText('/^完成$/')
  await browser.js('document.querySelectorAll("tbody tr input[type=checkbox]")[0].click();document.querySelectorAll("tbody tr input[type=checkbox]")[1].click()')
  await browser.clickText('/^停用$/','footer button')
  await browser.waitFor('document.querySelector("dialog[open]")?.innerText.includes("查看所选 2 个账号")')
  await browser.js('const changed=JSON.parse(localStorage.getItem("qa-admin-users"));changed.find(u=>u.id===111).updatedAt="2026-11-15T10:00:00.999999";localStorage.setItem("qa-admin-users",JSON.stringify(changed))')
  await browser.clickText('/检查并继续/')
  check('两人停用操作显示真实风险和人数',await browser.waitFor('[...document.querySelectorAll("dialog[open]")].some(d=>d.innerText.includes("2 个账号将被停用"))'))
  await browser.clickText('/确认执行/')
  check('批量部分成功与版本冲突分别报告',await browser.waitFor('document.body.innerText.includes("1 项成功，1 项未完成")&&JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===112).status==="DISABLED"&&JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===111).status==="ACTIVE"'))
  await browser.clickText('/重新加载失败用户后重试/')
  await browser.waitFor('document.querySelector("dialog[open]")?.innerText.includes("查看所选 1 个账号")&&!document.querySelector("dialog[open]").innerText.includes("正在读取")')
  await browser.clickText('/检查并继续/')
  await browser.clickText('/确认执行/')
  check('失败项明确重载后可单独重试',await browser.waitFor('document.body.innerText.includes("1 项成功，0 项未完成")&&JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===111).status==="DISABLED"'))
  await browser.clickText('/^完成$/')
  await browser.js('document.querySelector("button[aria-label^=更多操作]").click()')
  await browser.clickText('/启用账号/','[role=menu]:popover-open button')
  await browser.waitFor('document.querySelector("dialog[open]")?.innerText.includes("恢复正常使用")&&!document.querySelector("dialog[open]").innerText.includes("正在读取")')
  await browser.clickText('/检查并继续/')
  await browser.clickText('/确认执行/')
  check('更多菜单的启用操作真实生效',await browser.waitFor('JSON.parse(localStorage.getItem("qa-admin-users")).find(u=>u.id===112).status==="ACTIVE"&&document.body.innerText.includes("1 项成功，0 项未完成")'))
  await browser.clickText('/^完成$/')
  await browser.send('Emulation.setDeviceMetricsOverride',{width:375,height:1000,deviceScaleFactor:1,mobile:true})
  await new Promise(resolve=>setTimeout(resolve,300))
  check('补齐操作栏后手机仍无横向溢出',await browser.js('document.documentElement.scrollWidth<=innerWidth+1'))
  await shot('aligned-375-mobile')
  check('没有运行时脚本异常',browser.errors.length===0)
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify(metrics,null,2))
} catch (error) { check('截图对照脚本完整执行',false); console.error(error); await shot('failure').catch(()=>{}) }
finally {
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({results,errors:browser.errors},null,2))
  await browser.close()
}
process.exitCode=results.every(item=>item.ok)?0:1
