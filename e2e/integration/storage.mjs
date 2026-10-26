// 对象存储集成测试（R2 / 本地存储通用，全部经由真实 API）：
// 预签名 → 上传真实 JPG / PNG → 公开地址访问 → 数据库元数据 → 大小上限（正常 / 接近上限 / 超限）→ 删除 → 再访问 404
//
// 用法（对接真实 R2：API 以 STORAGE_MODE=r2 启动，使用测试桶）：
//   E2E_EMAIL=... E2E_PASSWORD=... node e2e/integration/storage.mjs
// 可选：E2E_TRIP_ID 使用已有的测试旅行（默认新建并在结束时删除）
import { call, login, makePng, sampleJpg, suite } from '../lib/common.mjs'

const t = suite('storage')
const MAX = 20 * 1024 * 1024
const { token } = await login()
let tripId = Number(process.env.E2E_TRIP_ID || 0)
let createdTrip = false
if (!tripId) {
  const trip = await call('POST', '/trips', { token, body: { title: 'E2E 存储测试', destinationName: '东京', countryCode: 'JP', city: '东京', startDate: '2026-10-01', endDate: '2026-10-02', peopleCount: 1, joinOfficialExplore: false } })
  if (!trip.success) throw new Error(`创建测试旅行失败：${trip.status} ${trip.code}（可设置 E2E_TRIP_ID 使用已有测试旅行）`)
  tripId = trip.data.id; createdTrip = true
}

async function upload(bytes, contentType, fileName) {
  const presign = await call('POST', `/trips/${tripId}/photos/presign`, { token, body: { fileName, contentType, fileSize: bytes.length } })
  if (!presign.success) return { presign }
  const put = await fetch(presign.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes })
  return { presign, put }
}

try {
  t.section = '预签名'
  const jpg = sampleJpg(), png = makePng()
  const { presign: pj } = await upload(Buffer.alloc(0), 'image/jpeg', 'probe.jpg').catch(() => ({}))
  const probe = await call('POST', `/trips/${tripId}/photos/presign`, { token, body: { fileName: 'a.jpg', contentType: 'image/jpeg', fileSize: jpg.length } })
  t.check('获取上传签名', probe.success && probe.data.uploadUrl && probe.data.storageKey?.startsWith(`users/`), `${probe.status} ${probe.code}`)
  const r2 = /X-Amz-Signature=/.test(probe.data?.uploadUrl || '')
  const u = new URL(probe.data.uploadUrl)
  t.check('存储模式：' + (r2 ? 'R2（S3 预签名）' : '本地存储（开发）'), true)
  if (r2) {
    t.check('预签名有效期 15 分钟（X-Amz-Expires=900）', u.searchParams.get('X-Amz-Expires') === '900', u.searchParams.get('X-Amz-Expires'))
    t.check('签名包含 Content-Length（上传大小由 R2 强制校验）', /content-length/.test(u.searchParams.get('X-Amz-SignedHeaders') || ''), u.searchParams.get('X-Amz-SignedHeaders'))
  } else {
    const exp = Number(u.searchParams.get('expires')) - Math.floor(Date.now() / 1000)
    t.check('上传签名有效期约 15 分钟', exp > 880 && exp <= 900, exp)
  }
  t.check('签名地址不包含任何密钥（只有临时签名）', !/secret|R2_SECRET|X-Amz-Security-Token/i.test(probe.data.uploadUrl))
  t.check('空文件被拒绝', pj?.status === 400, pj?.status)

  t.section = '上传 / 访问'
  const photos = []
  for (const [bytes, type, name] of [[jpg, 'image/jpeg', 'e2e.jpg'], [png, 'image/png', 'e2e.png']]) {
    const { presign, put } = await upload(bytes, type, name)
    t.check(`${name}：上传成功`, put?.ok, `${presign.status} ${presign.code} ${put?.status}`)
    const reg = await call('POST', `/trips/${tripId}/photos`, { token, body: { storageKey: presign.data.storageKey, mimeType: type, fileSize: bytes.length, width: type === 'image/png' ? 96 : undefined, height: type === 'image/png' ? 64 : undefined } })
    t.check(`${name}：登记照片（数据库保存元数据）`, reg.success && reg.data.mimeType === type && reg.data.fileSize === bytes.length && reg.data.storageKey === presign.data.storageKey, `${reg.status} ${reg.code}`)
    const got = await fetch(reg.data.imageUrl)
    const body = Buffer.from(await got.arrayBuffer())
    t.check(`${name}：公开地址可访问，内容一致`, got.status === 200 && (got.headers.get('content-type') || '').startsWith(type.split(';')[0]) && body.equals(bytes), `${got.status} ${got.headers.get('content-type')} ${body.length}/${bytes.length}`)
    photos.push({ ...reg.data, bytes })
  }
  const list = await call('GET', `/trips/${tripId}/photos`, { token })
  t.check('照片列表包含刚上传的照片', photos.every(p => list.data?.some(x => x.id === p.id)))
  const forged = await call('POST', `/trips/${tripId}/photos`, { token, body: { storageKey: `users/0/trips/${tripId}/x.jpg`, mimeType: 'image/jpeg', fileSize: 10 } })
  t.check('登记不属于当前旅行的存储路径被拒绝', forged.status === 400 && forged.code === 'INVALID_STORAGE_KEY', `${forged.status} ${forged.code}`)
  const missing = await call('POST', `/trips/${tripId}/photos`, { token, body: { storageKey: probe.data.storageKey, mimeType: 'image/jpeg', fileSize: jpg.length } })
  t.check('签名后未上传就登记 → PHOTO_UPLOAD_MISSING', missing.code === 'PHOTO_UPLOAD_MISSING', `${missing.status} ${missing.code}`)

  t.section = '大小上限'
  const atMax = await call('POST', `/trips/${tripId}/photos/presign`, { token, body: { fileName: 'max.jpg', contentType: 'image/jpeg', fileSize: MAX } })
  t.check('正好 20MB：允许签名', atMax.success, `${atMax.status} ${atMax.code}`)
  const over = await call('POST', `/trips/${tripId}/photos/presign`, { token, body: { fileName: 'big.jpg', contentType: 'image/jpeg', fileSize: MAX + 1 } })
  t.check('20MB + 1 字节：PHOTO_TOO_LARGE', over.status === 400 && over.code === 'PHOTO_TOO_LARGE', `${over.status} ${over.code}`)
  const near = Buffer.concat([jpg, Buffer.alloc(MAX - 64 * 1024 - jpg.length, 0)])
  const nearUp = await upload(near, 'image/jpeg', 'near-max.jpg')
  t.check(`接近上限（${(near.length / 1048576).toFixed(2)}MB）真实上传成功`, nearUp.put?.ok, `${nearUp.presign.status} ${nearUp.put?.status}`)
  if (r2) {
    const lie = await call('POST', `/trips/${tripId}/photos/presign`, { token, body: { fileName: 'lie.jpg', contentType: 'image/jpeg', fileSize: 1024 } })
    const put = await fetch(lie.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: near })
    t.check('申报 1KB 却上传 19.9MB → R2 拒绝（签名大小不符）', !put.ok, put.status)
  }
  if (nearUp.put?.ok) {
    const reg = await call('POST', `/trips/${tripId}/photos`, { token, body: { storageKey: nearUp.presign.data.storageKey, mimeType: 'image/jpeg', fileSize: near.length } })
    if (reg.success) photos.push({ ...reg.data, bytes: near })
    else t.check('接近上限的照片登记', false, `${reg.status} ${reg.code}`)
  }

  t.section = '删除'
  for (const p of photos) {
    const del = await call('DELETE', `/photos/${p.id}`, { token })
    t.check(`删除照片 #${p.id}`, del.success, `${del.status} ${del.code}`)
    const again = await fetch(p.imageUrl)
    t.check(`删除后公开地址 404（对象已从存储删除）`, again.status === 404, again.status)
  }
  const after = await call('GET', `/trips/${tripId}/photos`, { token })
  t.check('数据库记录与存储一致（列表中不再出现）', !photos.some(p => after.data?.some(x => x.id === p.id)))
} finally {
  if (createdTrip) {
    const del = await call('DELETE', `/trips/${tripId}`, { token })
    t.check('清理：删除测试旅行（连同剩余对象）', del.success, `${del.status} ${del.code}`)
  }
  t.finish()
}
