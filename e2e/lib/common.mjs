// E2E 共用工具：API 调用、断言记录、测试图片生成。只依赖 Node 20+ 内置模块。
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

export const API = (process.env.E2E_API || 'http://localhost:8080/api/v1').replace(/\/$/, '')
export const WEB = (process.env.E2E_WEB || 'http://localhost:3000').replace(/\/$/, '')
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '../..')
export const sleep = ms => new Promise(r => setTimeout(r, ms))

/** 断言记录：失败不抛出，最后统一汇总；输出里不包含任何密钥、Cookie、验证码 */
export function suite(name) {
  const results = []
  let section = ''
  const check = (label, ok, detail = '') => {
    results.push({ section, label, ok: Boolean(ok), detail: ok ? '' : String(detail).slice(0, 400) })
    console.log(`${ok ? 'PASS' : 'FAIL'} ${section ? `[${section}] ` : ''}${label}${ok ? '' : `  — ${String(detail).slice(0, 400)}`}`)
  }
  const skip = (label, reason) => { results.push({ section, label, ok: true, skipped: true, detail: reason }); console.log(`SKIP ${section ? `[${section}] ` : ''}${label}  — ${reason}`) }
  const finish = () => {
    const failed = results.filter(r => !r.ok)
    const skipped = results.filter(r => r.skipped).length
    console.log(`\n${name}: ${results.length - failed.length - skipped}/${results.length - skipped} PASS${skipped ? `, ${skipped} SKIP` : ''}`)
    const out = process.env.E2E_REPORT_DIR
    if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(results, null, 1)) }
    process.exitCode = failed.length ? 1 : 0
    return failed.length === 0
  }
  return { check, skip, finish, set section(v) { section = v }, get section() { return section } }
}

/** 调用 API：返回 { status, code, data, message, headers } */
export async function call(method, p, { token, body, headers = {}, raw = false } = {}) {
  const h = { ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  if (body !== undefined && !raw) h['Content-Type'] = 'application/json'
  const res = await fetch(API + p, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, code: json?.code ?? null, data: json?.data ?? null, message: json?.message ?? null, success: Boolean(json?.success), headers: res.headers }
}

/** 测试账号登录（E2E_EMAIL / E2E_PASSWORD）；返回访问令牌与 refresh Cookie 值（只在内存中使用） */
export async function login(email = process.env.E2E_EMAIL, password = process.env.E2E_PASSWORD) {
  if (!email || !password) throw new Error('需要设置 E2E_EMAIL / E2E_PASSWORD（测试账号，不要使用真实用户）')
  const res = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const json = await res.json().catch(() => null)
  if (!json?.success) throw new Error(`测试账号登录失败：${res.status} ${json?.code ?? ''}`)
  const refresh = ((res.headers.getSetCookie?.() ?? []).find(c => c.startsWith('tt_refresh=')) || '').split(';')[0].split('=')[1] || ''
  return { token: json.data.accessToken, refresh, user: json.data.user }
}

/** 生成一张真实的 PNG（纯色渐变，RGB，无外部依赖） */
export function makePng(width = 96, height = 64) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2
  const rows = []
  for (let y = 0; y < height; y++) { const row = Buffer.alloc(1 + width * 3); for (let x = 0; x < width; x++) { row[1 + x * 3] = 233; row[2 + x * 3] = 122 + (x % 60); row[3 + x * 3] = 51 + (y % 90) } rows.push(row) }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))])
}

/** 测试用真实 JPG（e2e/fixtures，与前端公开图片分开，清理旧图不影响测试） */
export const fixturePath = (name = 'asakusa.jpg') => path.join(ROOT, 'e2e/fixtures', name)
export const sampleJpg = (name = 'asakusa.jpg') => fs.readFileSync(fixturePath(name))
