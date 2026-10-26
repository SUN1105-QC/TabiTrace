#!/usr/bin/env node
/**
 * 官方景点图片：把高清原图（assets-src/places/*.jpg，不进仓库）生成网页用的 WebP。
 *
 *   node scripts/optimize-place-images.mjs
 *
 * 输出
 * - public/images/explore/hd/{640,1280,1920,2560}/<slug>.webp
 *     640：缩略图、小卡；1280：普通卡片、地点详情（数据库里保存的就是这一档的地址）；1920：Hero、大图；
 *     2560：2 倍屏上的超宽封面（旅行详情等）
 *     原图比目标宽度窄时不放大（文件名仍按档位，实际宽度见数据文件）
 * - public/images/place-placeholder.webp     图片加载失败时的统一占位图
 * - constants/place-images.generated.json    每张图的尺寸、文件大小、来源与许可证（前端署名 / 授权页读取）
 *
 * 原图来源与许可证记录在 assets-src/places/SOURCES.json（随仓库提交）；原图丢失时可以按其中的 downloadUrl 重新下载。
 * sharp 随 Next.js 一起安装（node_modules/sharp），不需要额外依赖。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'assets-src/places')
const OUT = path.join(ROOT, 'public/images/explore/hd')
const DATA = path.join(ROOT, 'constants/place-images.generated.json')
const WIDTHS = [640, 1280, 1920, 2560]
// 82–86：天空不出现色带、建筑细节保留；1920 档用于大图，质量略高
const QUALITY = { 640: 82, 1280: 82, 1920: 84, 2560: 82 }
// 质量门槛：卡片源图至少 1200 宽，Hero 源图至少 1920 宽
const MIN_CARD = 1200, MIN_HERO = 1920
// 单个文件的上限：超过时质量降 6（卡片 1280 档约 350KB，大图 1920 档约 650KB）
const LIMIT = { 640: 140 * 1024, 1280: 350 * 1024, 1920: 650 * 1024, 2560: 1100 * 1024 }
const encode = (input, file, w, quality) => sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality, effort: 6, smartSubsample: true }).toFile(file)

const sources = JSON.parse(fs.readFileSync(path.join(SRC, 'SOURCES.json'), 'utf8')).images
for (const w of WIDTHS) fs.mkdirSync(path.join(OUT, String(w)), { recursive: true })

const data = {}
const warnings = []
let totalIn = 0, totalOut = 0, files = 0

for (const s of sources) {
  const input = path.join(SRC, s.file)
  if (!fs.existsSync(input)) { warnings.push(`${s.slug}: 原图不存在（${s.file}）`); continue }
  // rotate()：按 EXIF 方向摆正（手机竖拍的照片）
  const meta = await sharp(input).rotate().metadata()
  const upright = (meta.orientation ?? 1) >= 5
  const ow = upright ? meta.height : meta.width, oh = upright ? meta.width : meta.height
  const variants = {}
  for (const w of WIDTHS) {
    const file = path.join(OUT, String(w), `${s.slug}.webp`)
    // 细节特别多的照片（树叶、人群）超过上限时降一档质量重编，不为了凑大小继续往下压
    let info = await encode(input, file, w, QUALITY[w])
    if (info.size > LIMIT[w]) info = await encode(input, file, w, QUALITY[w] - 6)
    variants[w] = { width: info.width, height: info.height, bytes: info.size }
    totalOut += info.size; files++
  }
  totalIn += fs.statSync(input).size
  if (ow < MIN_CARD) warnings.push(`${s.slug}: 原图宽 ${ow}px，低于卡片要求 ${MIN_CARD}px`)
  else if (ow < MIN_HERO) warnings.push(`${s.slug}: 原图宽 ${ow}px，不足 Hero 的 ${MIN_HERO}px（1920 档实际为 ${variants[1920].width}px）`)
  data[s.slug] = {
    subject: s.subject,
    original: { file: s.file, width: ow, height: oh, bytes: fs.statSync(input).size },
    variants,
    author: s.author, license: s.license, licenseUrl: s.licenseUrl, sourcePage: s.sourcePage
  }
  console.log(`${s.slug.padEnd(34)} ${String(ow).padStart(5)}×${String(oh).padEnd(5)} → ${WIDTHS.map(w => `${w}:${Math.round(variants[w].bytes / 1024)}KB`).join('  ')}`)
}

// 占位图：暖灰底 + 细斜纹，和文字封面同一色系
const PH_W = 1280, PH_H = 800
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PH_W}" height="${PH_H}">
  <defs><pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="24" height="24" fill="#EEE7DC"/><rect width="2" height="24" fill="#F5EFE6"/></pattern></defs>
  <rect width="100%" height="100%" fill="url(#p)"/>
  <g fill="none" stroke="#CDBFAD" stroke-width="6" transform="translate(${PH_W / 2 - 40} ${PH_H / 2 - 56})">
    <path d="M40 4c-20 0-34 15-34 33 0 25 34 63 34 63s34-38 34-63C74 19 60 4 40 4z"/><circle cx="40" cy="37" r="12"/>
  </g></svg>`
await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(path.join(ROOT, 'public/images/place-placeholder.webp'))

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n')
console.log(`\n${Object.keys(data).length} 张原图（${(totalIn / 1048576).toFixed(1)}MB）→ ${files} 个 WebP（${(totalOut / 1048576).toFixed(1)}MB）`)
if (warnings.length) console.log('\n需要注意：\n- ' + warnings.join('\n- '))
