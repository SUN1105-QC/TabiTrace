// 公共首页产品截图用的演示旅行：东京三日散步（3 天、9 个计划地点、7 次打卡、8 张照片）。
// 照片用仓库里的官方高清图（frontend/public/images/explore/hd/2560），按真实上传流程生成原图 / 中图 / 缩略图。
// 账号走真实注册流程（测试邮箱收验证码，见 e2e/README.md），是 *@example.test 测试账号。
import { createRequire } from 'node:module'
import path from 'node:path'
import { API, ROOT, call, sleep } from '../lib/common.mjs'

const sharp = createRequire(path.join(ROOT, 'frontend/package.json'))('sharp')
const MAILBOX = (process.env.E2E_MAILBOX_URL || 'http://127.0.0.1:1080').replace(/\/$/, '')
const HD = slug => path.join(ROOT, 'frontend/public/images/explore/hd/2560', `${slug}.webp`)

/** 东京时间的日期（YYYY-MM-DD），offset 为相对今天的天数 */
function tokyoDate(offset) {
  const d = new Date(Date.now() + 9 * 3600e3 + offset * 86400e3)
  return d.toISOString().slice(0, 10)
}

// 计划地点（官方地点名称 → 第几天、计划时间、打卡时间、打卡文字、照片）
const PLAN = [
  { day: 0, name: '浅草寺', time: '09:30', at: '09:42', note: '清晨的浅草寺人还不多，雷门的大灯笼比想象中更大。', photos: [['01-sensoji-kaminarimon', true]] },
  { day: 0, name: '仲见世', time: '11:00', at: '11:20', note: '一路吃过去：人形烧、炸肉饼，还有刚出炉的仙贝。', photos: [['02-nakamise-street', true]] },
  { day: 0, name: '东京晴空塔', time: '16:30', at: '17:05', note: '傍晚登上展望台，看着整座城市慢慢亮起来。', photos: [] },
  // 熊猫照片是竖拍、熊猫在画面最上方：像用户自己裁过一样先裁成 4:3（照片墙、九宫格居中裁切也能看到熊猫）
  { day: 1, name: '上野公园', time: '10:00', at: '10:18', note: '银杏刚开始变黄，坐在长椅上吃了一份鲷鱼烧。', photos: [['20-ueno-park', true], ['21-ueno-zoo-panda', true, { left: 300, top: 0, width: 1366, height: 1025 }]] },
  { day: 1, name: '东京站', time: '14:00', at: '14:25', note: '红砖站舍在阳光下特别好看。', photos: [['07-tokyo-station', true]] },
  { day: 1, name: '银座', time: '16:30', at: '16:50', note: '和光的钟楼正好整点报时。', photos: [['05-ginza-wako', false]] },
  { day: 1, name: '涩谷十字路口', time: '19:00', at: '19:12', note: '绿灯一亮，所有人同时出发。', photos: [['09-shibuya-crossing', false], ['10-hachiko-statue', false]] },
  { day: 2, name: '东京都厅', time: '18:00' },
  { day: 2, name: '歌舞伎町', time: '20:00' }
]

async function mailCode(to) {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILBOX}/api/messages?to=${encodeURIComponent(to)}`)).json().catch(() => [])
    const hit = (Array.isArray(list) ? list : []).find(m => JSON.stringify(m.to ?? '').includes(to))
    const code = /\b(\d{6})\b/.exec(hit?.text || '')?.[1]
    if (code) return code
    await sleep(300)
  }
  throw new Error(`测试邮箱没有收到验证码（${MAILBOX}）`)
}

/** 注册测试账号（<prefix>-*@example.test）并登录，返回访问令牌与 refresh Cookie 值 */
export async function registerDemoUser(prefix = 'tt-landing') {
  const stamp = Date.now().toString(36)
  const email = `${prefix}-${stamp}@example.test`
  const password = `Ld-${stamp}-${Math.random().toString(36).slice(2, 10)}`
  const sent = await call('POST', '/auth/email-verification/send', { body: { email, purpose: 'register' } })
  if (sent.status !== 200) throw new Error(`发送验证码失败：${sent.status} ${sent.code}`)
  const verified = await call('POST', '/auth/email-verification/verify', { body: { email, code: await mailCode(email), purpose: 'register' } })
  const reg = await call('POST', '/auth/register', { body: { nickname: '小林', email, password, emailVerificationToken: verified.data?.emailVerificationToken } })
  if (!reg.success) throw new Error(`注册失败：${reg.status} ${reg.code}`)
  const res = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const refresh = ((res.headers.getSetCookie?.() ?? []).find(c => c.startsWith('tt_refresh=')) || '').split(';')[0].split('=')[1]
  return { email, token: (await res.json()).data.accessToken, refresh }
}

async function put(url, buf, type) {
  const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': type }, body: buf })
  if (!r.ok) throw new Error(`上传失败 ${r.status}`)
}

/** 与网页上传一致：原图 + 中图（1600 框）+ 缩略图（640 框） */
async function uploadPhoto(token, tripId, checkinId, slug, featured, crop) {
  const source = sharp(HD(slug))
  const original = await (crop ? source.extract(crop) : source).jpeg({ quality: 90 }).toBuffer()
  const meta = await sharp(original).metadata()
  const ps = (await call('POST', `/trips/${tripId}/photos/presign`, { token, body: { fileName: `${slug}.jpg`, contentType: 'image/jpeg', fileSize: original.length } })).data
  await put(ps.uploadUrl, original, 'image/jpeg')
  const keys = {}
  for (const [variant, box, quality] of [['thumb', 640, 78], ['medium', 1600, 82]]) {
    const buf = await sharp(original).resize(box, box, { fit: 'inside' }).jpeg({ quality }).toBuffer()
    const v = (await call('POST', `/trips/${tripId}/photos/presign`, { token, body: { fileName: `${variant}.jpg`, contentType: 'image/jpeg', fileSize: buf.length, variantOf: ps.storageKey, variant } })).data
    await put(v.uploadUrl, buf, 'image/jpeg')
    keys[`${variant}Key`] = v.storageKey
  }
  const saved = await call('POST', `/trips/${tripId}/photos`, { token, body: { checkinId, storageKey: ps.storageKey, mimeType: 'image/jpeg', fileSize: original.length, width: meta.width, height: meta.height, featured, ...keys } })
  if (!saved.success) throw new Error(`保存照片失败：${saved.status} ${saved.code}`)
}

/** 创建演示旅行，返回旅行 id。默认升级为 Trip Pro（成果没有水印）；pro: false 时保持免费版（7 次打卡、8 张照片，在免费上限内） */
export async function createDemoTrip(token, { pro = true, title = '东京三日散步' } = {}) {
  const day = n => tokyoDate(n - 2)   // 第 3 天是今天：前两天的打卡都已经发生，「下一站」是今天傍晚的东京都厅
  const trip = (await call('POST', '/trips', { token, body: { title, destinationName: '东京', city: '东京', countryCode: 'JP', startDate: day(0), endDate: day(2), peopleCount: 2, coverImage: '/images/explore/hd/1280/01-sensoji-kaminarimon.webp', joinOfficialExplore: true } })).data
  if (!trip?.id) throw new Error('创建旅行失败')
  if (pro) await call('POST', `/trips/${trip.id}/payments/checkout`, { token })
  const places = (await call('GET', '/official-cities/TOKYO/places', { token })).data ?? []
  for (const [i, p] of PLAN.entries()) {
    const place = places.find(x => x.name === p.name)
    if (!place) throw new Error(`找不到官方地点：${p.name}`)
    const item = (await call('POST', `/trips/${trip.id}/itinerary`, { token, body: { placeId: place.id, plannedDate: day(p.day), plannedTime: p.time, sortOrder: i } })).data
    if (!p.at) continue
    const checkin = (await call('POST', `/trips/${trip.id}/itinerary/${item.id}/checkin`, { token, body: { checkinTime: `${day(p.day)}T${p.at}:00+09:00`, note: p.note } })).data
    if (!checkin?.id) throw new Error(`打卡失败：${p.name}`)
    for (const [slug, featured, crop] of p.photos) await uploadPhoto(token, trip.id, checkin.id, slug, featured, crop)
  }
  return trip.id
}
