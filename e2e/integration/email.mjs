// 邮件（Resend）集成测试
//
// 1) 契约 + 失败处理（不需要真实 Key）：本脚本启动一个模拟 Resend API（默认 127.0.0.1:1090），
//    API 需以 MAIL_PROVIDER=resend、RESEND_BASE_URL=http://127.0.0.1:1090、RESEND_API_KEY=<任意测试值>、
//    APP_PUBLIC_URL=<正式域名> 启动。检查请求格式、发件人、中文内容、有效期说明、链接不含 localhost、
//    服务商 4xx / 5xx / 超时时 API 返回 EMAIL_SEND_FAILED，以及失败后可以立即重试。
//      E2E_API=http://localhost:8081/api/v1 node e2e/integration/email.mjs
//
// 2) 真实发信（需要真实 RESEND_API_KEY 与已验证的发件域名）：API 按正式配置启动，
//      E2E_EMAIL_MODE=live E2E_INBOX=<能收信的真实邮箱> node e2e/integration/email.mjs
//    脚本只确认 API 发送成功；收件箱里的邮件（主题、发件人、验证码、中文、有效期、品牌）需要人工确认。
import http from 'node:http'
import { call, sleep, suite } from '../lib/common.mjs'

const t = suite('email')
const live = process.env.E2E_EMAIL_MODE === 'live'

if (live) {
  const inbox = process.env.E2E_INBOX
  if (!inbox) throw new Error('真实发信需要 E2E_INBOX（能收信的真实邮箱）')
  t.section = '真实发信'
  const r = await call('POST', '/auth/email-verification/send', { body: { email: inbox, purpose: 'register' } })
  t.check('API 通过 Resend 发送注册验证码', r.status === 200 && r.success, `${r.status} ${r.code}`)
  console.log('\n请到收件箱确认：主题「旅迹 TabiTrace 注册验证码」、发件人为已验证域名、6 位验证码、中文正常、有效期说明、品牌文案、链接不含 localhost。')
  t.finish()
} else {
  const port = Number(process.env.E2E_RESEND_STUB_PORT || 1090)
  const captured = []
  let mode = 'ok'
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      captured.push({ path: req.url, method: req.method, auth: req.headers.authorization || '', type: req.headers['content-type'] || '', json: (() => { try { return JSON.parse(body) } catch { return null } })() })
      if (mode === 'hang') return // 不响应，等待 API 超时
      const status = { ok: 200, e500: 500, e401: 401, e422: 422 }[mode]
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(status === 200 ? { id: 'stub-' + captured.length } : { statusCode: status, name: 'stub_error', message: 'stubbed failure' }))
    })
  })
  await new Promise(r => server.listen(port, '127.0.0.1', r))
  const stamp = Date.now().toString(36)
  const mail = n => `tt-mail-${stamp}-${n}@example.test`
  const send = email => call('POST', '/auth/email-verification/send', { body: { email, purpose: 'register' } })
  try {
    t.section = '请求契约'
    const first = mail(1)
    const r = await send(first)
    t.check('发送注册验证码 → 200', r.status === 200, `${r.status} ${r.code}`)
    const req = captured.at(-1)
    t.check('POST {RESEND_BASE_URL}/emails', req?.method === 'POST' && req.path === '/emails', `${req?.method} ${req?.path}`)
    t.check('带 Bearer 授权头（值不输出）', /^Bearer \S{4,}$/.test(req?.auth || ''))
    t.check('JSON 请求体', /application\/json/.test(req?.type || ''))
    const j = req?.json || {}
    t.check('发件人：品牌名 + 配置的发件地址', /^旅迹 TabiTrace <[^@\s]+@[^>\s]+>$/.test(j.from || ''), j.from)
    t.check('发件地址不是占位的 .local 域名', !/\.local>$/.test(j.from || ''), j.from)
    t.check('收件人正确', Array.isArray(j.to) && j.to.length === 1 && j.to[0] === first)
    t.check('中文主题', /[一-龥]/.test(j.subject || '') && /验证码/.test(j.subject || ''), j.subject)
    const code = /\b(\d{6})\b/.exec(j.text || '')?.[1]
    t.check('正文包含 6 位验证码（纯文本与 HTML 都有）', code && (j.html || '').includes(code))
    t.check('有效期说明', /10\s*分钟/.test(j.text || '') && /10\s*分钟/.test(j.html || ''), (j.text || '').slice(0, 120))
    t.check('品牌文案', /旅迹/.test(j.text || '') && /旅迹/.test(j.html || ''))
    t.check('正文没有 localhost / 127.0.0.1', !/localhost|127\.0\.0\.1/i.test((j.text || '') + (j.html || '')))
    t.check('API 响应不包含验证码', !JSON.stringify(r.data || {}).includes(code || '######'))
    const v = await call('POST', '/auth/email-verification/verify', { body: { email: first, code, purpose: 'register' } })
    t.check('用邮件里的验证码可以完成验证', v.success && v.data?.emailVerificationToken, `${v.status} ${v.code}`)

    t.section = '服务商失败'
    for (const [m, label] of [['e500', 'Resend 500'], ['e401', 'Resend 401（Key 无效）'], ['e422', 'Resend 422（发件域名未验证）']]) {
      mode = m
      const fail = await send(mail(m))
      t.check(`${label} → API 503 EMAIL_SEND_FAILED`, fail.status === 503 && fail.code === 'EMAIL_SEND_FAILED', `${fail.status} ${fail.code}`)
    }
    mode = 'hang'
    const t0 = Date.now()
    const hang = await send(mail('hang'))
    const took = Date.now() - t0
    t.check(`Resend 无响应 → ${Math.round(took / 1000)} 秒后返回 EMAIL_SEND_FAILED（不会一直转圈）`, hang.code === 'EMAIL_SEND_FAILED' && took < 15000, `${hang.status} ${hang.code} ${took}ms`)
    mode = 'ok'
    const retry = await send(mail('e500'))
    t.check('发送失败后可以立即重试（失败不占用 60 秒冷却）', retry.status === 200, `${retry.status} ${retry.code}`)

    t.section = '已注册邮箱提醒'
    if (process.env.E2E_EMAIL) {
      captured.length = 0
      const existing = await send(process.env.E2E_EMAIL)
      const j2 = captured.at(-1)?.json || {}
      t.check('已注册邮箱：响应与新邮箱一致（不暴露是否注册）', existing.status === 200 || existing.status === 429, `${existing.status} ${existing.code}`)
      if (existing.status === 200) t.check('提醒邮件里的链接使用正式域名，不含 localhost', /https?:\/\//.test(j2.text || '') && !/localhost|127\.0\.0\.1/i.test((j2.text || '') + (j2.html || '')), (j2.text || '').match(/https?:\/\/\S+/)?.[0])
    } else t.skip('已注册邮箱提醒', '未设置 E2E_EMAIL')
  } finally {
    server.close()
    await sleep(100)
    t.finish()
  }
}
