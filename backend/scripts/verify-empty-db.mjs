// 空库迁移验证（MySQL）：
//   1. 对一个真正空的库执行完整迁移（API 的 migrate-only 模式，与生产启动时相同的 Flyway）
//   2. 与已有库（从旧版本一路升级上来的开发库）逐项比较：表、列（类型 / 可空 / 默认值）、索引、唯一约束、外键
//   3. 在空库上启动 API，走真实接口：注册（邮箱验证码）→ 创建旅行 → 打卡
//   4. 确认空库里没有演示用户 / 旅行等 Mock 数据，只有产品目录数据
//
// 用法（数据库账号只需要这两个库的权限，不需要 root）：
//   EMPTY_DB=tabitrace_empty REF_DB=tabitrace DB_USERNAME=tabitrace_app DB_PASSWORD=... node backend/scripts/verify-empty-db.mjs
// 可选：MYSQL_BIN（mysql 客户端）、DB_HOST（默认 127.0.0.1:3306）、MAILBOX_URL（读取验证码，默认本地 dev-mail-catcher）
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')
const backend = path.resolve(here, '..')
const EMPTY = process.env.EMPTY_DB || 'tabitrace_empty', REF = process.env.REF_DB || 'tabitrace'
const USER = process.env.DB_USERNAME || 'tabitrace_app', PASS = process.env.DB_PASSWORD
const [HOST, PORT = '3306'] = (process.env.DB_HOST || '127.0.0.1:3306').split(':')
const MYSQL = process.env.MYSQL_BIN || 'mysql'
const MAILBOX = process.env.MAILBOX_URL || 'http://127.0.0.1:1080'
if (!PASS) throw new Error('需要 DB_PASSWORD')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  — ' + String(detail).slice(0, 600)}`) }
const sql = (db, q) => execFileSync(MYSQL, [`-h${HOST}`, `-P${PORT}`, `-u${USER}`, '-N', '-B', '--default-character-set=utf8mb4', db], { input: q, env: { ...process.env, MYSQL_PWD: PASS } }).toString().trim()
const jdbc = db => `jdbc:mysql://${HOST}:${PORT}/${db}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&sslMode=DISABLED&allowPublicKeyRetrieval=true`
const jar = fs.readdirSync(path.join(backend, 'api/target')).filter(f => /^tabitrace-api-.*\.jar$/.test(f))[0]
if (!jar) throw new Error('先打包 API：mvn -pl api package -DskipTests')
const env = { ...process.env, DB_URL: jdbc(EMPTY), DB_USERNAME: USER, DB_PASSWORD: PASS, VIDEO_MOCK_RENDERER: 'false', STORAGE_MODE: 'local' }

// 0. 必须是真正的空库
const before = sql(EMPTY, `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${EMPTY}'`)
check(`${EMPTY} 是空库（迁移前 0 张表）`, before === '0', `已有 ${before} 张表；请使用一个新建的空库`)
if (before !== '0') process.exit(1)

// 1. 完整迁移
const out = execFileSync('java', ['-jar', path.join(backend, 'api/target', jar), '--server.port=0', '--app.migrate-only=true'], { env, cwd: path.join(backend, 'api') }).toString()
check('空库执行完整迁移（migrate-only 退出码 0）', /数据库迁移完成：当前版本 V\d+/.test(out), out.slice(-800))
const history = sql(EMPTY, 'SELECT CONCAT(version,":",success) FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank').split('\n')
const refHistory = sql(REF, 'SELECT version FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank').split('\n')
check(`迁移历史与已有库一致（${history.length} 个版本全部成功）`, history.every(h => h.endsWith(':1')) && history.map(h => h.split(':')[0]).join() === refHistory.join(), `${history.join(',')} vs ${refHistory.join(',')}`)

// 2. 结构比较
const shape = db => ({
  tables: sql(db, `SELECT table_name FROM information_schema.tables WHERE table_schema='${db}' AND table_name<>'flyway_schema_history' ORDER BY 1`),
  columns: sql(db, `SELECT CONCAT_WS('|',table_name,column_name,column_type,is_nullable,IFNULL(column_default,'<null>'),extra) FROM information_schema.columns WHERE table_schema='${db}' AND table_name<>'flyway_schema_history' ORDER BY table_name,column_name`),
  indexes: sql(db, `SELECT CONCAT_WS('|',table_name,index_name,non_unique,GROUP_CONCAT(column_name ORDER BY seq_in_index)) FROM information_schema.statistics WHERE table_schema='${db}' AND table_name<>'flyway_schema_history' GROUP BY table_name,index_name,non_unique ORDER BY 1`),
  foreignKeys: sql(db, `SELECT CONCAT_WS('|',k.table_name,k.column_name,k.referenced_table_name,k.referenced_column_name,r.delete_rule) FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r ON r.constraint_schema=k.table_schema AND r.constraint_name=k.constraint_name WHERE k.table_schema='${db}' AND k.referenced_table_name IS NOT NULL ORDER BY 1`),
  checks: sql(db, `SELECT CONCAT_WS('|',table_name,constraint_type,COUNT(*)) FROM information_schema.table_constraints WHERE table_schema='${db}' AND table_name<>'flyway_schema_history' GROUP BY table_name,constraint_type ORDER BY 1`)
})
const a = shape(EMPTY), b = shape(REF)
for (const k of Object.keys(a)) {
  const la = a[k].split('\n'), lb = b[k].split('\n')
  const onlyEmpty = la.filter(x => !lb.includes(x)), onlyRef = lb.filter(x => !la.includes(x))
  check(`${k}：空库与已有库一致（${la.length} 项）`, !onlyEmpty.length && !onlyRef.length, `仅空库：${onlyEmpty.slice(0, 5).join(' ; ')} ｜ 仅已有库：${onlyRef.slice(0, 5).join(' ; ')}`)
}
const core = ['users', 'trips', 'checkins', 'photos', 'user_achievements', 'email_verifications', 'video_projects', 'share_links', 'refresh_tokens', 'payments']
const tables = a.tables.split('\n')
check(`核心表都存在（${core.join('、')}）`, core.every(t => tables.includes(t)), core.filter(t => !tables.includes(t)).join(','))

// 4.（先检查）没有 Mock / 演示数据
const count = t => Number(sql(EMPTY, `SELECT COUNT(*) FROM ${t}`))
check('空库没有任何用户 / 旅行 / 打卡 / 照片（无演示数据）', ['users', 'trips', 'checkins', 'photos', 'video_projects', 'share_links', 'payments'].every(t => count(t) === 0))
check('产品目录数据已写入（官方城市、地点、成就、视频模板 / 音乐）', count('official_cities') > 0 && count('places') > 0 && count('achievements') > 0 && count('video_templates') > 0 && count('video_music') > 0)

// 3. 在空库上启动 API，走真实接口
const port = 18000 + Math.floor(Math.random() * 1000)
const api = spawn('java', ['-jar', path.join(backend, 'api/target', jar), `--server.port=${port}`], { env, cwd: path.join(backend, 'api'), stdio: 'ignore' })
const base = `http://localhost:${port}/api/v1`
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/users/me')).status === 401) break } catch {} await sleep(1000) }
  const call = async (m, p, body, token) => { const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return (await r.json().catch(() => ({}))) }
  const email = `tt-emptydb-${Date.now().toString(36)}@example.test`, password = 'EmptyDb-' + Math.random().toString(36).slice(2, 10)
  await call('POST', '/auth/email-verification/send', { email, purpose: 'register' })
  let code
  for (let i = 0; i < 40 && !code; i++) { await sleep(300); const l = await (await fetch(`${MAILBOX}/api/messages?to=${encodeURIComponent(email)}`)).json().catch(() => []); code = /\b(\d{6})\b/.exec((l.find?.(m => JSON.stringify(m.to ?? '').includes(email)) ?? l[0])?.text || '')?.[1] }
  const v = await call('POST', '/auth/email-verification/verify', { email, code, purpose: 'register' })
  const reg = await call('POST', '/auth/register', { nickname: '空库验证', email, password, emailVerificationToken: v.data?.emailVerificationToken })
  check('空库：注册新用户（邮箱验证码）', reg.success, JSON.stringify(reg).slice(0, 200))
  const token = reg.data?.accessToken
  const trip = await call('POST', '/trips', { title: '空库验证旅行', destinationName: '东京', countryCode: 'JP', city: '东京', startDate: '2026-10-01', endDate: '2026-10-03', peopleCount: 1, joinOfficialExplore: true }, token)
  check('空库：创建旅行（加入东京官方探索）', trip.success, JSON.stringify(trip).slice(0, 200))
  const ck = await call('POST', `/trips/${trip.data?.id}/checkins`, { checkinType: 'MANUAL', checkinTime: '2026-10-01T10:00:00+09:00', latitude: 35.7148, longitude: 139.7967, customPlaceName: '浅草寺', placeName: '浅草寺' }, token)
  check('空库：打卡', ck.success, JSON.stringify(ck).slice(0, 200))
  check('数据落在空库里', count('users') === 1 && count('trips') === 1 && count('checkins') === 1)
} finally {
  api.kill()
}
const pass = results.filter(r => r.ok).length
console.log(`\n${pass}/${results.length} PASS`)
console.log(`验证完成后可以清空 ${EMPTY}（它只包含本次验证写入的一个测试用户）。`)
process.exit(pass === results.length ? 0 : 1)
