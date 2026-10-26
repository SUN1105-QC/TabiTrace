// E2E 入口：依次运行各套件（每个套件是独立的 Node 脚本），汇总结果，有失败时退出码为 1。
//   node e2e/run.mjs                 默认：关键路径 + 会话 + 移动端布局 + 图片 + Trip Pro + 对象存储
//   node e2e/run.mjs auth-session    只运行指定套件（可多个）
// 集成套件 email 需要 API 以 Resend 模拟模式启动（见 e2e/README.md），默认不运行。
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')
const SUITES = {
  'critical-path': 'flows/critical-path.mjs',
  'auth-session': 'flows/auth-session.mjs',
  'mobile-layout': 'flows/mobile-layout.mjs',
  images: 'flows/images.mjs',
  'trip-pro': 'flows/trip-pro.mjs',
  storage: 'integration/storage.mjs',
  email: 'integration/email.mjs'
}
const DEFAULT = ['critical-path', 'auth-session', 'mobile-layout', 'images', 'trip-pro', 'storage']
const picked = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT
const unknown = picked.filter(n => !SUITES[n])
if (unknown.length) { console.error(`未知套件：${unknown.join(', ')}（可选：${Object.keys(SUITES).join(', ')}）`); process.exit(2) }

const results = []
for (const name of picked) {
  console.log(`\n━━━━ ${name} ━━━━`)
  const r = spawnSync(process.execPath, [path.join(here, SUITES[name])], { stdio: 'inherit', env: process.env })
  results.push([name, r.status === 0])
}
console.log('\n━━━━ 汇总 ━━━━')
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
process.exit(results.every(([, ok]) => ok) ? 0 : 1)
