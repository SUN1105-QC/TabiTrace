// 无界面浏览器（Chrome / Edge，经 Chrome DevTools Protocol 驱动）。不依赖 Playwright 等额外框架，只需要本机装有 Chrome 或 Edge。
// 浏览器路径：E2E_BROWSER 环境变量，否则按平台查找常见安装位置。
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { API, WEB, sleep } from './common.mjs'

const CANDIDATES = {
  win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge']
}

export function browserPath() {
  if (process.env.E2E_BROWSER) return process.env.E2E_BROWSER
  const found = (CANDIDATES[process.platform] || []).find(p => fs.existsSync(p))
  if (!found) throw new Error('找不到 Chrome / Edge，请用 E2E_BROWSER 指定浏览器可执行文件')
  return found
}

export async function openBrowser({ width = 1440, height = 900, mobile = false } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabitrace-e2e-'))
  const port = 9300 + Math.floor(Math.random() * 600)
  const proc = spawn(browserPath(), ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', '--disable-gpu', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 60 && !target; i++) { await sleep(400); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page') } catch {} }
  if (!target) throw new Error('浏览器启动失败')
  const tabs = []
  async function connect(wsUrl, emulate = true) {
  const ws = new WebSocket(wsUrl)
  await new Promise(r => ws.addEventListener('open', r))
  let id = 0
  const pending = new Map(), hooks = [], errors = [], requests = []
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 240))
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 240))
    if (m.method === 'Network.requestWillBeSent') requests.push({ id: m.params.requestId, url: m.params.request.url, method: m.params.request.method, t: Date.now() })
    for (const h of hooks) h(m)
  })
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const js = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error(`${expr.slice(0, 60)} → ${(r.result.exceptionDetails.exception?.description || '').slice(0, 200)}`)
    return r.result?.result?.value
  }
  const goto = async (url, wait = 1200) => {
    await send('Page.navigate', { url })
    for (let i = 0; i < 80; i++) { await sleep(250); if (await js(`document.readyState === 'complete'`).catch(() => false)) break }
    await sleep(wait)
  }
  const waitFor = async (expr, ms = 15000) => { for (let t = 0; t < ms; t += 250) { if (await js(expr).catch(() => false)) return true; await sleep(250) } return false }
  /** 设置 React 受控输入框的值（测试账号与测试数据，不用于真实凭证） */
  const fill = (selector, value) => js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  const clickText = (re, scope = 'button, a') => js(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(scope)})].find(x => ${re}.test(x.innerText.trim()) && !x.disabled); if (!el) return false; el.click(); return true })()`)
  const setFiles = async (selector, files) => {
    const doc = await send('DOM.getDocument', { depth: -1 })
    const node = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector })
    await send('DOM.setFileInputFiles', { nodeId: node.result.nodeId, files })
  }
  /** 以测试会话进入：写入 HttpOnly refresh Cookie 与会话标记（访问令牌由页面自行刷新获得，只存在内存） */
  const session = async refresh => {
    await goto(WEB + '/pricing', 600)
    const u = new URL(API)
    await send('Network.setCookie', { name: 'tt_refresh', value: refresh, domain: u.hostname, path: '/api/v1', httpOnly: true, sameSite: 'Strict' })
    await js(`localStorage.setItem('tabitrace-session', '1'); true`)
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('DOM.enable')
  if (emulate) await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  const tab = { ws, send, js, goto, waitFor, fill, clickText, setFiles, session, hooks, errors, requests }
  tabs.push(tab)
  return tab
  }
  const first = await connect(target.webSocketDebuggerUrl)
  /** 同一浏览器（共享 Cookie 与 localStorage）里新开标签页 */
  const newTab = async () => {
    const created = await first.send('Target.createTarget', { url: 'about:blank' })
    await sleep(500)
    const t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x => x.id === created.result.targetId)
    return connect(t.webSocketDebuggerUrl)
  }
  // 先通过 CDP 让浏览器自己退出：Windows 上只 kill 启动进程会留下渲染 / GPU 子进程，多次运行后堆积上百个 msedge
  const close = async () => {
    await Promise.race([first.send('Browser.close'), sleep(1500)]).catch(() => {})
    tabs.forEach(t => t.ws.close())
    proc.kill()
    await sleep(500)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  return { ...first, newTab, tabs, close }
}
