#!/usr/bin/env node
/**
 * 旅迹本地开发用的邮件接收器（仅开发环境）。
 *
 * - 在 127.0.0.1:1025 提供一个最小 SMTP 服务：后端通过真实的 SMTP 协议把邮件投递到这里（与生产发往真实 SMTP 的代码路径完全相同）
 * - 收到的邮件原样保存为 .eml：backend/.tabitrace/mail-outbox/（已在 .gitignore 中）
 * - 在 http://127.0.0.1:1080 查看最近的邮件（只监听本机）
 *
 * 用法：node backend/scripts/dev-mail-catcher.mjs
 * 环境变量：MAIL_CATCHER_SMTP_PORT（默认 1025）、MAIL_CATCHER_HTTP_PORT（默认 1080）、
 *          MAIL_CATCHER_REJECT=1 时拒收所有邮件（用于测试“邮件发送失败”）
 * 也可以换成 Mailpit 等同类工具，只要监听同一个端口即可。不要在生产环境使用。
 */
import net from 'node:net'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SMTP_PORT = Number(process.env.MAIL_CATCHER_SMTP_PORT || 1025)
const HTTP_PORT = Number(process.env.MAIL_CATCHER_HTTP_PORT || 1080)
const REJECT = process.env.MAIL_CATCHER_REJECT === '1'
const OUTBOX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.tabitrace', 'mail-outbox')
fs.mkdirSync(OUTBOX, { recursive: true })

// ---------------------------------------------------------------- SMTP
net.createServer(socket => {
  socket.setEncoding('latin1') // 按字节原样保存，编码由邮件自己的头声明
  let buffer = '', inData = false, data = '', from = '', to = []
  const reply = line => socket.write(line + '\r\n')
  reply('220 tabitrace-dev-mail-catcher ESMTP')
  socket.on('data', chunk => {
    buffer += chunk
    while (true) {
      if (inData) {
        const end = buffer.indexOf('\r\n.\r\n')
        if (end < 0) { data += buffer; buffer = ''; return }
        data += buffer.slice(0, end); buffer = buffer.slice(end + 5); inData = false
        const raw = data.replace(/\r\n\.\./g, '\r\n.')
        const file = path.join(OUTBOX, `${new Date().toISOString().replace(/[:.]/g, '-')}-${(to[0] || 'unknown').replace(/[^a-zA-Z0-9@._-]/g, '_')}.eml`)
        fs.writeFileSync(file, Buffer.from(raw, 'latin1'))
        console.log(`[mail-catcher] 收到邮件 → ${to.join(', ')}（已保存 ${path.basename(file)}）`)
        data = ''; reply('250 OK: queued')
        continue
      }
      const idx = buffer.indexOf('\r\n')
      if (idx < 0) return
      const line = buffer.slice(0, idx); buffer = buffer.slice(idx + 2)
      const cmd = line.slice(0, 4).toUpperCase()
      if (cmd === 'EHLO') { socket.write('250-tabitrace-dev\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n') }
      else if (cmd === 'HELO') reply('250 tabitrace-dev')
      else if (cmd === 'MAIL') { from = line.slice(10).trim(); to = []; reply('250 OK') }
      else if (cmd === 'RCPT') {
        if (REJECT) { reply('550 5.7.1 Rejected by dev catcher (MAIL_CATCHER_REJECT=1)'); continue }
        to.push(line.replace(/^RCPT TO:\s*/i, '').replace(/[<>]/g, '').trim()); reply('250 OK')
      }
      else if (cmd === 'DATA') { inData = true; data = ''; reply('354 End data with <CR><LF>.<CR><LF>') }
      else if (cmd === 'RSET') { from = ''; to = []; reply('250 OK') }
      else if (cmd === 'NOOP') reply('250 OK')
      else if (cmd === 'QUIT') { reply('221 Bye'); socket.end(); return }
      else reply('502 Command not implemented')
    }
  })
  socket.on('error', () => {})
}).listen(SMTP_PORT, '127.0.0.1', () => console.log(`[mail-catcher] SMTP 127.0.0.1:${SMTP_PORT}${REJECT ? '（拒收模式）' : ''}，邮件保存在 ${OUTBOX}`))

// ---------------------------------------------------------------- 简单的 MIME 解码（只为本地查看）
function parseHeaders(block) {
  const headers = {}
  block.replace(/\r\n[ \t]+/g, ' ').split('\r\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) headers[l.slice(0, i).toLowerCase()] = l.slice(i + 1).trim() })
  return headers
}
function decodeWords(s = '') {
  return s.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_, cs, enc, text) => {
    const buf = enc.toUpperCase() === 'B' ? Buffer.from(text, 'base64') : Buffer.from(text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1')
    return buf.toString(/utf-?8/i.test(cs) ? 'utf8' : 'latin1')
  }).replace(/\?=\s+=\?/g, '')
}
function decodeBody(body, headers) {
  const enc = (headers['content-transfer-encoding'] || '').toLowerCase()
  let buf
  if (enc === 'base64') buf = Buffer.from(body.replace(/\s+/g, ''), 'base64')
  else if (enc === 'quoted-printable') buf = Buffer.from(body.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1')
  else buf = Buffer.from(body, 'latin1')
  return buf.toString(/charset="?utf-?8/i.test(headers['content-type'] || '') ? 'utf8' : 'latin1')
}
function findPart(raw, type) {
  const split = raw.indexOf('\r\n\r\n')
  const headers = parseHeaders(raw.slice(0, split)), body = raw.slice(split + 4)
  const ct = headers['content-type'] || 'text/plain'
  const boundary = /boundary="?([^";]+)"?/i.exec(ct)?.[1]
  if (/^multipart\//i.test(ct) && boundary) {
    for (const part of body.split('--' + boundary).slice(1)) {
      if (part.startsWith('--')) break
      const found = findPart(part.replace(/^\r\n/, ''), type)
      if (found != null) return found
    }
    return null
  }
  return ct.toLowerCase().startsWith(type) ? decodeBody(body, headers) : null
}
function readMail(file) {
  const raw = fs.readFileSync(path.join(OUTBOX, file)).toString('latin1')
  const headers = parseHeaders(raw.slice(0, raw.indexOf('\r\n\r\n')))
  return { file, to: headers.to, from: decodeWords(headers.from), subject: decodeWords(headers.subject), date: headers.date, text: findPart(raw, 'text/plain') || '' }
}
const listMails = () => fs.readdirSync(OUTBOX).filter(f => f.endsWith('.eml')).sort().reverse().slice(0, 30).map(readMail)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// ---------------------------------------------------------------- 本机查看页面
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (url.pathname === '/api/messages') {
    const to = url.searchParams.get('to')
    const mails = listMails().filter(m => !to || (m.to || '').toLowerCase().includes(to.toLowerCase()))
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(mails)); return
  }
  const rows = listMails().map(m => `<article><header><b>${esc(m.subject)}</b><small>${esc(m.to)} · ${esc(m.date)}</small></header><pre>${esc(m.text)}</pre></article>`).join('')
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><meta charset="utf-8"><title>旅迹开发邮件</title><style>body{font:14px system-ui;background:#F8F4EE;color:#26221E;max-width:760px;margin:24px auto;padding:0 16px}article{background:#fff;border:1px solid #eadfd2;border-radius:14px;padding:14px 18px;margin:12px 0}header{display:flex;justify-content:space-between;gap:12px}small{color:#8a8078}pre{white-space:pre-wrap;font:13px/1.6 system-ui;margin:10px 0 0}</style><h1>旅迹开发邮件（仅本机）</h1><p>最近 30 封，文件位于 ${esc(OUTBOX)}</p>${rows || '<p>还没有邮件</p>'}`)
}).listen(HTTP_PORT, '127.0.0.1', () => console.log(`[mail-catcher] 查看邮件：http://127.0.0.1:${HTTP_PORT}`))
