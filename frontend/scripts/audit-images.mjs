#!/usr/bin/env node
/**
 * 全站图片审计（静态部分）：npm run images:audit
 *
 * 1. public/ 下的每张位图：宽高、文件大小、内容哈希、被代码 / 数据库种子引用的次数、是否低于 640 / 1280 / 1920
 * 2. 内容完全相同的图片（重复图片清单）
 * 3. 源码里的图片用法：<img>、next/image、CSS 背景图、行内 backgroundImage、data:image（Base64）、远程图片地址
 * 4. 没有任何引用的图片（候选删除清单，只列出，不删除）
 *
 * 显示尺寸是否够用要在浏览器里量（不同页面、不同屏幕），见 docs 里的运行时审计结果。
 * 输出：控制台摘要 + docs/image-audit.json（完整数据）
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO = path.resolve(ROOT, '..')
const PUBLIC = path.join(ROOT, 'public')
const SRC_DIRS = ['app', 'components', 'hooks', 'utils', 'lib', 'services', 'constants', 'dev', 'i18n']
const MIGRATIONS = path.join(REPO, 'backend/api/src/main/resources/db/migration')
const RASTER = /\.(jpe?g|png|webp|avif|gif)$/i
const SKIP_DIRS = new Set(['generated-videos'])   // 视频成片（用户数据）不在审计范围

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && e.name !== 'node_modules') walk(path.join(dir, e.name), filter, out) }
    else if (filter(e.name)) out.push(path.join(dir, e.name))
  }
  return out
}

// ── 源码与种子 ──
const codeFiles = SRC_DIRS.flatMap(d => walk(path.join(ROOT, d), n => /\.(tsx?|css|json|mjs)$/.test(n)))
const code = codeFiles.map(f => ({ f: path.relative(ROOT, f).replace(/\\/g, '/'), s: fs.readFileSync(f, 'utf8') }))
// 只用于统计引用（不计入下面的源码用法）：测试、脚本、后端代码也可能直接读 public 里的图片
const REF_DIRS = [path.join(ROOT, 'tests'), path.join(ROOT, 'scripts'), path.join(REPO, 'e2e'), path.join(REPO, 'backend/api/src/main/java'), path.join(REPO, 'backend/video-worker/src/main/java')]
const refOnly = REF_DIRS.flatMap(d => walk(d, n => /\.(tsx?|mjs|js|java)$/.test(n)))
  .filter(f => path.basename(f) !== 'audit-images.mjs')
  .map(f => ({ f: path.relative(REPO, f).replace(/\\/g, '/'), s: fs.readFileSync(f, 'utf8') }))
const seeds = walk(MIGRATIONS, n => n.endsWith('.sql')).map(f => ({ f: 'backend/…/' + path.basename(f), s: fs.readFileSync(f, 'utf8') }))

// ── public 位图 ──
const files = walk(PUBLIC, n => RASTER.test(n))
const images = []
for (const file of files) {
  const rel = '/' + path.relative(PUBLIC, file).replace(/\\/g, '/')
  const buf = fs.readFileSync(file)
  let meta = {}
  try { meta = await sharp(buf).metadata() } catch { meta = { broken: true } }
  // hd/ 下的多档图片按 slug 统计引用（数据库与前端只写 1280 档，或经 hdImage(slug) 生成；其余档由 srcset 在运行时生成）
  const hd = /^\/images\/explore\/hd\/(640|1280|1920|2560)\/([a-z0-9-]+)\.webp$/.exec(rel)
  // 首页产品截图的 1 倍 / 高清档由 landingDemo 里的 shot('名称', …) 拼出地址，按名称统计
  const landing = /^\/images\/landing\/([a-z0-9-]+?)(?:@\dx)?\.webp$/.exec(rel)
  const needle = hd ? hd[2] : landing ? `'${landing[1]}'` : rel
  const refsCode = [...code, ...refOnly].filter(c => c.s.includes(needle)).map(c => c.f)
  const refsSeed = seeds.filter(c => c.s.includes(needle)).map(c => c.f)
  images.push({
    path: rel, width: meta.width ?? 0, height: meta.height ?? 0, kb: Math.round(buf.length / 1024), format: meta.format,
    hash: crypto.createHash('md5').update(buf).digest('hex'), broken: Boolean(meta.broken),
    refs: refsCode.length, seedRefs: refsSeed.length, refFiles: [...refsCode, ...refsSeed],
    hdVariant: Boolean(hd)
  })
}

// ── 重复图片 ──
const byHash = new Map()
for (const im of images) byHash.set(im.hash, [...(byHash.get(im.hash) ?? []), im.path])
const duplicates = [...byHash.values()].filter(g => g.length > 1)

// ── 源码里的图片用法 ──
const count = re => code.reduce((n, c) => n + (c.s.match(re)?.length ?? 0), 0)
const usage = {
  imgTags: count(/<img\b/g),
  nextImage: code.filter(c => /from 'next\/image'/.test(c.s)).map(c => c.f),
  placeImageComponent: count(/<PlaceImage\b/g),
  cssBackgroundUrl: code.filter(c => c.f.endsWith('.css')).flatMap(c => [...c.s.matchAll(/background(?:-image)?:[^;}]*url\(([^)]*)\)/g)].map(m => m[1])),
  inlineBackground: code.filter(c => /backgroundImage|--[a-z-]*image[a-z-]*['"]?\s*:\s*`url\(/i.test(c.s)).map(c => c.f),
  dataUri: code.flatMap(c => [...c.s.matchAll(/data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]{0,40})/g)].map(m => `${c.f}（${m[0].length > 60 ? '大' : '小'}）`)),
  // Wikimedia Commons 的 /wiki/File: 是署名用的来源页链接，页面不会加载它，不算远程图片
  remote: [...new Set(code.flatMap(c => [...c.s.matchAll(/https?:\/\/[^\s'"`)]+\.(?:jpe?g|png|webp|avif|gif)/gi)].filter(m => !/\/wiki\/File:/.test(m[0])).map(m => `${m[0]}  ← ${c.f}`)))]
}

// ── 输出 ──
const tier = w => (w < 640 ? '<640' : w < 1280 ? '<1280' : w < 1920 ? '<1920' : '≥1920')
const live = images.filter(i => !i.hdVariant)
const unused = live.filter(i => !i.refs && !i.seedRefs)
console.log(`public 位图 ${images.length} 个（其中官方景点高清图 ${images.length - live.length} 个）`)
console.log(`\n非高清图目录的图片（${live.length}）：`)
for (const i of live.sort((a, b) => a.width - b.width)) {
  console.log(`  ${tier(i.width).padEnd(6)} ${String(i.width).padStart(5)}×${String(i.height).padEnd(5)} ${String(i.kb).padStart(5)}KB  引用 ${String(i.refs + i.seedRefs).padStart(2)}  ${i.path}${i.broken ? '  【无法解码】' : ''}`)
}
console.log(`\n重复图片（内容完全相同）：${duplicates.length ? '' : '无'}`)
for (const g of duplicates) console.log('  ' + g.join('  =  '))
console.log(`\n没有任何引用（候选删除，未删除）：${unused.map(i => i.path).join('  ') || '无'}`)
console.log(`\n源码：<img> ${usage.imgTags} 处，next/image ${usage.nextImage.length} 个文件，PlaceImage ${usage.placeImageComponent} 处`)
console.log(`CSS 背景图：${usage.cssBackgroundUrl.join('  ') || '无'}`)
console.log(`行内背景图：${usage.inlineBackground.join('  ') || '无'}`)
console.log(`data:image：${usage.dataUri.join('  ') || '无'}`)
console.log(`远程图片地址：${usage.remote.length ? '\n  ' + usage.remote.join('\n  ') : '无'}`)

fs.writeFileSync(path.join(REPO, 'docs/image-audit.json'), JSON.stringify({ generatedAt: new Date().toISOString(), images, duplicates, unused: unused.map(i => i.path), usage }, null, 2) + '\n')
