// 背景音乐同步：从官方地址下载已核验（APPROVED）的曲目 → 校验 → 分析结构 / 响度 / BPM → 生成试听片段 → 发布到存储。
//
//   node backend/scripts/music/music-sync.mjs                 下载 + 分析 + 生成试听（写 analysis.json）
//   node backend/scripts/music/music-sync.mjs --publish-local <存储根目录>
//        把原曲与试听片段复制到本地存储（开发环境 STORAGE_MODE=local 的 LOCAL_STORAGE_DIR，默认 backend/api/.tabitrace/uploads）
//   node backend/scripts/music/music-sync.mjs --emit-sql <迁移文件路径>   生成 V10 的 video_music 初始迁移（历史，保留）
//   node backend/scripts/music/music-sync.mjs --emit-upsert <迁移文件路径> [曲目代码…]
//        V14 之后新增 / 更新曲目：生成可重复执行的 INSERT … ON DUPLICATE KEY UPDATE（含 energy、derivatives_allowed、recommended_templates）
//
// 生产环境（R2）：用 rclone / aws cli 把 .tabitrace/music/publish/ 同步到存储桶根目录（对象路径与本地一致），见 docs/09_deployment/02_部署设计.md「背景音乐发布」。
// 原曲只缓存在仓库外的 .tabitrace/music/（已加入 .gitignore），不提交到 git。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'

const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1')
const root = path.resolve(here, '../../..')
const work = path.join(root, '.tabitrace', 'music')
const catalog = JSON.parse(fs.readFileSync(path.join(here, 'catalog.json'), 'utf8'))
const analysisFile = path.join(here, 'analysis.json')
const analysis = fs.existsSync(analysisFile) ? JSON.parse(fs.readFileSync(analysisFile, 'utf8')) : {}
const approved = catalog.tracks.filter(t => t.status === 'APPROVED')
const FFMPEG = process.env.FFMPEG_BINARY || 'ffmpeg'
const FFPROBE = process.env.FFPROBE_BINARY || 'ffprobe'
const TARGET_LUFS = -16
const PREVIEW_SECONDS = 45

const args = process.argv.slice(2)
const flag = name => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] || true) : null }

const originalKey = (t, sha) => `music/originals/${t.code.toLowerCase()}-${sha.slice(0, 10)}.mp3`
const previewKey = (t, sha) => `music/previews/${t.code.toLowerCase()}-${sha.slice(0, 10)}.mp3`

async function download(t) {
  const file = path.join(work, 'originals', `${t.code}.mp3`)
  if (fs.existsSync(file) && fs.statSync(file).size > 100_000) return file
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const res = await fetch(t.downloadUrl, { headers: { 'User-Agent': 'TabiTrace music-sync (licensed CC BY 4.0 use; contact via project owner)' } })
  if (!res.ok) throw new Error(`${t.code}: 下载失败 HTTP ${res.status} ${t.downloadUrl}`)
  const type = res.headers.get('content-type') || ''
  const buf = Buffer.from(await res.arrayBuffer())
  // 只接受真正的 MP3（ID3 头或 MPEG 帧同步），避免把错误页当音频
  const isMp3 = buf.slice(0, 3).toString() === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
  if (!isMp3) throw new Error(`${t.code}: 返回的不是 MP3（${type}, ${buf.length} bytes）`)
  fs.writeFileSync(file, buf)
  return file
}

function probeDuration(file) {
  return Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim())
}

/** EBU R128：整体响度 + 每 0.1 秒的短时响度（3 秒窗口），用于推算段落结构 */
function loudness(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=none', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const log = r.stderr
  const points = [...log.matchAll(/t:\s*([\d.]+)\s+TARGET:[^M]*M:\s*(-?[\d.]+)\s+S:\s*(-?[\d.]+)/g)].map(m => ({ t: Number(m[1]), s: Number(m[3]) }))
  const integrated = Number((log.match(/Summary:[\s\S]*?I:\s*(-?[\d.]+) LUFS/) || [])[1])
  return { points, integrated }
}

/**
 * 段落结构（秒）：
 * - mainStart：短时响度第一次达到“主体段”水平（90 分位 - 8 LU）
 * - outroStart：最后一次达到主体段水平
 * - highlightStart：主体段内 15 秒平均响度最高的窗口起点
 * 短时响度是 3 秒的滞后窗口，结果统一前移 1.5 秒。都四舍五入到 0.5 秒。
 */
function structure(points, duration) {
  const valid = points.filter(p => p.s > -70)
  if (valid.length < 20) return { introStart: 0, mainStart: 0, highlightStart: 0, outroStart: Math.max(0, duration - 10) }
  const sorted = valid.map(p => p.s).sort((a, b) => a - b)
  const ref = sorted[Math.floor(sorted.length * 0.9)]
  const main = valid.filter(p => p.s >= ref - 8)
  const half = x => Math.max(0, Math.round(x * 2) / 2)
  const mainStart = half(main[0].t - 1.5)
  const outroStart = half(Math.min(duration - 5, main[main.length - 1].t - 1.5))
  let best = mainStart, bestAvg = -Infinity
  for (let start = mainStart; start + 15 <= Math.max(outroStart, mainStart + 15); start += 0.5) {
    const win = valid.filter(p => p.t - 1.5 >= start && p.t - 1.5 < start + 15)
    if (!win.length) continue
    const avg = win.reduce((n, p) => n + p.s, 0) / win.length
    if (avg > bestAvg) { bestAvg = avg; best = start }
  }
  return { introStart: 0, mainStart, highlightStart: half(best), outroStart: Math.max(half(best) + 15, outroStart) }
}

function preview(file, t, info, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const start = Math.max(0, Math.min(info.highlightStart - 10, info.durationSeconds - PREVIEW_SECONDS))
  const len = Math.min(PREVIEW_SECONDS, info.durationSeconds - start)
  const gain = Number.isFinite(info.loudnessLufs) ? Math.max(-12, Math.min(12, TARGET_LUFS - info.loudnessLufs)) : 0
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-ss', String(start), '-t', String(len), '-i', file,
    '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.9:level=disabled,afade=t=in:st=0:d=1.5,afade=t=out:st=${(len - 3).toFixed(2)}:d=3`,
    '-ac', '2', '-ar', '44100', '-b:a', '128k', '-map_metadata', '-1', out])
  return { previewStart: start, previewSeconds: Math.round(len * 10) / 10 }
}

const sqlStr = v => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`)
const sqlNum = v => (v === null || v === undefined || !Number.isFinite(Number(v)) ? 'NULL' : String(v))
const sqlBool = v => (v ? 'TRUE' : 'FALSE')

async function main() {
  const publishLocal = flag('--publish-local')
  const emitSql = flag('--emit-sql')
  const emitUpsert = flag('--emit-upsert')
  if (!publishLocal && !emitSql && !emitUpsert) {
    for (const t of approved) {
      const file = await download(t)
      const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
      if (analysis[t.code]?.sha256 && analysis[t.code].sha256 !== sha256) throw new Error(`${t.code}: 文件与上次核验的 sha256 不一致，请人工确认官方文件是否更新`)
      const durationSeconds = Math.round(probeDuration(file) * 100) / 100
      // 文件没变且已有分析结果时直接复用（响度分析较慢），只重新生成试听片段
      const prev = analysis[t.code]?.sha256 === sha256 && analysis[t.code].loudnessLufs !== undefined ? analysis[t.code] : null
      const { points, integrated } = prev ? { points: null, integrated: prev.loudnessLufs } : loudness(file)
      const s = prev ? { introStart: prev.introStart, mainStart: prev.mainStart, highlightStart: prev.highlightStart, outroStart: prev.outroStart } : structure(points, durationSeconds)
      const info = {
        sha256, bytes: fs.statSync(file).size, durationSeconds, loudnessLufs: integrated, ...s,
        // 只记录官方公布的 BPM；自动估算用官方数据校验只有 5/15 准确，不写入
        bpm: t.bpm ?? null, bpmSource: t.bpm ? 'official' : null, originalKey: originalKey(t, sha256), previewKey: previewKey(t, sha256),
        downloadedAt: analysis[t.code]?.downloadedAt || new Date().toISOString().slice(0, 10)
      }
      Object.assign(info, preview(file, t, info, path.join(work, 'publish', info.previewKey)))
      fs.mkdirSync(path.dirname(path.join(work, 'publish', info.originalKey)), { recursive: true })
      fs.copyFileSync(file, path.join(work, 'publish', info.originalKey))
      analysis[t.code] = info
      console.log(`${t.code.padEnd(26)} ${String(durationSeconds).padStart(7)}s  ${String(integrated).padStart(6)} LUFS  main ${s.mainStart}  hi ${s.highlightStart}  outro ${s.outroStart}  bpm ${info.bpm ?? '-'}`)
      fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2) + '\n')
    }
    return
  }
  if (publishLocal) {
    const dest = path.resolve(String(publishLocal))
    for (const t of approved) {
      const a = analysis[t.code]
      if (!a) throw new Error(`${t.code}: 还没有分析结果，请先运行不带参数的同步`)
      for (const key of [a.originalKey, a.previewKey]) {
        const to = path.join(dest, key)
        fs.mkdirSync(path.dirname(to), { recursive: true })
        fs.copyFileSync(path.join(work, 'publish', key), to)
      }
    }
    console.log(`已发布 ${approved.length} 首（原曲 + 试听）到 ${dest}`)
  }
  if (emitSql) {
    const rows = catalog.tracks.map(t => {
      const a = analysis[t.code] || {}
      return `(${[sqlStr(t.code), sqlStr(t.title), sqlStr(t.category), sqlStr(t.moods.join(',')), sqlNum(a.durationSeconds ?? t.durationSeconds), sqlStr(t.plan),
        sqlStr(t.recommendedTemplate), sqlNum(t.sortOrder), sqlBool(t.status === 'APPROVED'),
        sqlStr(t.artist), sqlStr(t.source), sqlStr(t.sourceUrl), sqlStr(t.downloadUrl), sqlStr(t.license), sqlStr(t.licenseUrl), sqlStr(t.licenseNotes),
        sqlBool(t.attributionRequired), sqlStr(t.attributionText), sqlBool(t.commercialUse), sqlBool(t.exportAllowed), sqlStr(t.status),
        sqlNum(a.bpm ?? t.bpm), sqlStr(a.bpmSource ?? t.bpmSource), sqlStr(t.instruments.join(',')), sqlBool(t.essential),
        sqlStr(a.originalKey), sqlStr(a.previewKey), sqlStr(a.sha256), sqlNum(a.loudnessLufs),
        sqlNum(a.introStart), sqlNum(a.mainStart), sqlNum(a.highlightStart), sqlNum(a.outroStart),
        sqlStr(t.licenseCheckedAt), sqlStr(a.downloadedAt)].join(',')})`
    })
    const sql = `-- 旅迹背景音乐库 v1（由 backend/scripts/music/music-sync.mjs --emit-sql 生成，数据源 catalog.json + analysis.json）
-- 只有 status=APPROVED 且 enabled 的曲目会出现在 Travel Story 音乐选择器；REVIEW_REQUIRED 只保留版权核验记录。
ALTER TABLE video_music
  ADD COLUMN artist VARCHAR(100) NULL,
  ADD COLUMN source VARCHAR(100) NULL,
  ADD COLUMN source_url VARCHAR(500) NULL,
  ADD COLUMN download_url VARCHAR(500) NULL,
  ADD COLUMN license VARCHAR(60) NULL,
  ADD COLUMN license_url VARCHAR(500) NULL,
  ADD COLUMN license_notes VARCHAR(1000) NULL,
  ADD COLUMN attribution_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN attribution_text VARCHAR(400) NULL,
  ADD COLUMN commercial_use BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN export_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'REVIEW_REQUIRED',
  ADD COLUMN bpm INT NULL,
  ADD COLUMN bpm_source VARCHAR(20) NULL,
  ADD COLUMN instruments VARCHAR(300) NULL,
  ADD COLUMN essential BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN object_key VARCHAR(300) NULL,
  ADD COLUMN preview_key VARCHAR(300) NULL,
  ADD COLUMN file_sha256 CHAR(64) NULL,
  ADD COLUMN loudness_lufs DECIMAL(6,2) NULL,
  ADD COLUMN intro_start DECIMAL(7,2) NULL,
  ADD COLUMN main_start DECIMAL(7,2) NULL,
  ADD COLUMN highlight_start DECIMAL(7,2) NULL,
  ADD COLUMN outro_start DECIMAL(7,2) NULL,
  ADD COLUMN license_checked_at DATE NULL,
  ADD COLUMN downloaded_at DATE NULL,
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- “无音乐”保留为系统选项
UPDATE video_music SET status='APPROVED', license='NONE', export_allowed=TRUE WHERE code='NONE';

INSERT INTO video_music(code,name,category,mood,duration_seconds,plan,recommended_template,sort_order,enabled,
  artist,source,source_url,download_url,license,license_url,license_notes,attribution_required,attribution_text,commercial_use,export_allowed,status,
  bpm,bpm_source,instruments,essential,object_key,preview_key,file_sha256,loudness_lufs,intro_start,main_start,highlight_start,outro_start,license_checked_at,downloaded_at) VALUES
${rows.join(',\n')};

-- 旧的合成占位音轨下线：已有视频改用同类正式曲目，然后删除占位记录
UPDATE video_projects SET music_code = CASE music_code
  WHEN 'WARM_JOURNEY' THEN 'SB_WANDERLUST'
  WHEN 'SLOW_MORNING' THEN 'KM_MORNING'
  WHEN 'CITY_WALK' THEN 'KM_COOL_VIBES'
  WHEN 'TOKYO_NIGHT' THEN 'KM_LATE_NIGHT_RADIO'
  WHEN 'MEMORIES' THEN 'SB_HOME_WAS_YOU'
  ELSE music_code END
WHERE music_code IN ('WARM_JOURNEY','SLOW_MORNING','CITY_WALK','TOKYO_NIGHT','MEMORIES');
DELETE FROM video_music WHERE code IN ('WARM_JOURNEY','SLOW_MORNING','CITY_WALK','TOKYO_NIGHT','MEMORIES');

-- 每个模板的默认音乐
${catalog.tracks.filter(t => t.recommendedTemplate).map(t => `UPDATE video_templates SET recommended_music='${t.code}' WHERE code='${t.recommendedTemplate}';`).join('\n')}
`
    fs.writeFileSync(path.resolve(String(emitSql)), sql)
    console.log('已生成迁移', emitSql)
  }
  if (emitUpsert) {
    // 新增 / 更新曲目（V14 之后的字段）：只写指定曲目，可重复执行；只有授权已核验（APPROVED）且音频已分析发布的曲目才会启用
    const codes = args.slice(args.indexOf('--emit-upsert') + 2).filter(x => !x.startsWith('--'))
    const picked = catalog.tracks.filter(t => !codes.length || codes.includes(t.code))
    const rows = picked.map(t => {
      const a = analysis[t.code] || {}
      const ready = t.status === 'APPROVED' && !!a.originalKey && !!a.previewKey
      const templates = t.recommendedTemplates ?? (t.recommendedTemplate ? [t.recommendedTemplate] : [])
      return `(${[sqlStr(t.code), sqlStr(t.title), sqlStr(t.category), sqlStr(t.moods.join(',')), sqlNum(a.durationSeconds ?? t.durationSeconds), sqlStr(t.plan),
        sqlStr(templates.join(',') || null), sqlNum(t.sortOrder), sqlBool(ready),
        sqlStr(t.artist), sqlStr(t.source), sqlStr(t.sourceUrl), sqlStr(t.downloadUrl), sqlStr(t.license), sqlStr(t.licenseUrl), sqlStr(t.licenseNotes),
        sqlBool(t.attributionRequired), sqlStr(t.attributionText), sqlBool(t.commercialUse), sqlBool(t.derivativeAllowed), sqlBool(t.exportAllowed), sqlStr(t.status),
        sqlNum(a.bpm ?? t.bpm), sqlStr(a.bpmSource ?? t.bpmSource), sqlStr(t.energy ?? null), sqlStr(t.instruments.join(',')), sqlBool(t.essential),
        sqlStr(a.originalKey), sqlStr(a.previewKey), sqlStr(a.sha256), sqlNum(a.loudnessLufs),
        sqlNum(a.introStart), sqlNum(a.mainStart), sqlNum(a.highlightStart), sqlNum(a.outroStart),
        sqlStr(t.licenseCheckedAt), sqlStr(a.downloadedAt)].join(',')})`
    })
    const cols = 'code,name,category,mood,duration_seconds,plan,recommended_templates,sort_order,enabled,artist,source,source_url,download_url,license,license_url,license_notes,attribution_required,attribution_text,commercial_use,derivatives_allowed,export_allowed,status,bpm,bpm_source,energy,instruments,essential,object_key,preview_key,file_sha256,loudness_lufs,intro_start,main_start,highlight_start,outro_start,license_checked_at,downloaded_at'
    const update = cols.split(',').filter(c => c !== 'code').map(c => `${c}=VALUES(${c})`).join(',\n  ')
    const sql = `-- 背景音乐曲目更新（由 backend/scripts/music/music-sync.mjs --emit-upsert 生成，数据源 catalog.json + analysis.json）
-- 授权已核验（APPROVED）且音频已下载、分析、发布到存储的曲目才会启用；其余只保留授权记录。
INSERT INTO video_music(${cols}) VALUES
${rows.join(',\n')}
ON DUPLICATE KEY UPDATE
  ${update};
`
    fs.writeFileSync(path.resolve(String(emitUpsert)), sql)
    console.log(`已生成曲目更新迁移（${picked.length} 首）`, emitUpsert)
  }
}

main().catch(e => { console.error(e.message || e); process.exit(1) })
