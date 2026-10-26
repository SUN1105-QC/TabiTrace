/** 关键业务逻辑：照片时间 / 分页排序、尺寸版本、地图底图、站点地址、偏好、表单校验、总结与成果准备度 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/services/api'
import type { CheckinView, PhotoView, TripSummary } from '@/services/tabitrace-api'
import { buildItems, filterItems, photoTime, sortItems } from '@/utils/gallery'
import { fitWithin, isCoverPhoto, photoMedium, photoSrcSet, photoThumb } from '@/utils/photo-variants'
import { hdSrcSet, hdVariant } from '@/utils/place-images'
import { avatarImage } from '@/utils/avatar'
import { resolveMapTiles } from '@/lib/map-tiles'
import { siteUrl, siteUrlProblem } from '@/lib/site'
import { isValidTimeZone, matchLocale } from '@/lib/preferences'
import { formatCooldown, mapSendCodeError, mapVerifyCodeError, safeNextPath, sanitizeCode, validateRegisterForm } from '@/utils/auth'
import { summarySentence } from '@/utils/summary'
import { calculateTravelReadiness } from '@/utils/trip'

const trip = { startDate: '2026-10-01', endDate: '2026-10-03' }
const photo = (id: number, extra: Partial<PhotoView> = {}): PhotoView => ({ id, tripId: 1, storageKey: `k${id}`, imageUrl: `u${id}`, mimeType: 'image/jpeg', featured: false, ...extra })

describe('照片时间与排序（与后端分页规则一致）', () => {
  it('优先级：拍摄时间 → 打卡时间 → 旅行日期内的上传时间；旅行后补传的不算', () => {
    const c = { id: 9, checkinTime: '2026-10-02T15:00:00+09:00' } as CheckinView
    expect(photoTime(photo(1, { capturedAt: '2026-10-01T01:00:00Z' }), c, trip, 'Asia/Tokyo')?.source).toBe('captured')
    expect(photoTime(photo(2, { checkinId: 9 }), c, trip, 'Asia/Tokyo')?.source).toBe('checkin')
    expect(photoTime(photo(3, { createdAt: '2026-10-02T03:00:00Z' }), undefined, trip, 'Asia/Tokyo')?.source).toBe('uploaded')
    expect(photoTime(photo(4, { createdAt: '2026-11-20T03:00:00Z' }), undefined, trip, 'Asia/Tokyo')).toBeNull()
  })

  it('有时间的在前（按时间），没有时间的在后（按 id）；最新在前时同样如此', () => {
    const items = buildItems([
      photo(1, { capturedAt: '2026-10-02T00:00:00Z' }), photo(2), photo(3, { capturedAt: '2026-10-01T00:00:00Z' }), photo(4)
    ], [], trip, 'Asia/Tokyo')
    expect(sortItems(items, 'OLDEST').map(i => i.photo.id)).toEqual([3, 1, 2, 4])
    expect(sortItems(items, 'NEWEST').map(i => i.photo.id)).toEqual([1, 3, 4, 2])
  })

  it('筛选：精选 / 已关联 / 未关联', () => {
    const items = buildItems([photo(1, { featured: true }), photo(2, { checkinId: 5 }), photo(3)], [], trip, 'UTC')
    expect(filterItems(items, 'FEATURED').map(i => i.photo.id)).toEqual([1])
    expect(filterItems(items, 'LINKED').map(i => i.photo.id)).toEqual([2])
    expect(filterItems(items, 'UNLINKED').map(i => i.photo.id)).toEqual([1, 3])
  })
})

describe('照片尺寸版本', () => {
  it('按长边缩放、不放大', () => {
    expect(fitWithin(4032, 3024, 640)).toEqual({ width: 640, height: 480 })
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(300, 200, 640)).toEqual({ width: 300, height: 200 })
  })
  it('旧照片没有缩略图时回退：thumb → medium → 原图', () => {
    expect(photoThumb({ imageUrl: 'o', thumbUrl: 't', mediumUrl: 'm' })).toBe('t')
    expect(photoThumb({ imageUrl: 'o', mediumUrl: 'm' })).toBe('m')
    expect(photoThumb({ imageUrl: 'o' })).toBe('o')
    expect(photoMedium({ imageUrl: 'o', thumbUrl: 't' })).toBe('o')
  })
  it('封面判断同时认中图地址和旧的原图地址', () => {
    expect(isCoverPhoto('m', { imageUrl: 'o', mediumUrl: 'm' })).toBe(true)
    expect(isCoverPhoto('o', { imageUrl: 'o', mediumUrl: 'm' })).toBe(true)
    expect(isCoverPhoto(null, { imageUrl: 'o' })).toBe(false)
  })
  it('srcset 宽度按原图宽高换算；没有宽高的旧照片不放原图', () => {
    expect(photoSrcSet({ imageUrl: 'o', thumbUrl: 't', mediumUrl: 'm', width: 3024, height: 4032 })).toBe('t 480w, m 1200w, o 3024w')
    expect(photoSrcSet({ imageUrl: 'o', thumbUrl: 't', mediumUrl: 'm' })).toBe('t 640w, m 1600w')
    expect(photoSrcSet({ imageUrl: 'o' })).toBeUndefined()
  })
})

describe('官方高清图与头像档位', () => {
  const url = '/images/explore/hd/1280/03-tokyo-tower.webp'
  it('按显示宽度取不小于它的最小一档，最大 2560；不是官方高清图的地址原样返回', () => {
    expect(hdVariant(url, 300)).toBe('/images/explore/hd/640/03-tokyo-tower.webp')
    expect(hdVariant(url, 1281)).toBe('/images/explore/hd/1920/03-tokyo-tower.webp')
    expect(hdVariant(url, 5000)).toBe('/images/explore/hd/2560/03-tokyo-tower.webp')
    expect(hdVariant('/images/cover.jpg', 300)).toBe('/images/cover.jpg')
    expect(hdSrcSet('https://cdn.example/u.jpg')).toBeUndefined()
  })
  it('srcset 用各档真实宽度（竖拍原图不足 2560 时不谎报）', () => {
    const set = hdSrcSet('/images/explore/hd/1280/21-ueno-zoo-panda.webp')!.split(', ')
    expect(set).toHaveLength(4)
    expect(set[3]).toMatch(/\/2560\/21-ueno-zoo-panda\.webp 1666w$/)
  })
  it('头像：有小图时小尺寸用小图、大屏可换原图；旧头像只有原图；没有头像返回 null', () => {
    expect(avatarImage({ avatarUrl: 'a', avatarSmallUrl: 's' })).toEqual({ src: 's', srcSet: 's 160w, a 512w' })
    expect(avatarImage({ avatarUrl: 'a' })).toEqual({ src: 'a', srcSet: undefined })
    expect(avatarImage({})).toBeNull()
    expect(avatarImage(null)).toBeNull()
  })
})

describe('地图底图提供方', () => {
  it('矢量样式优先，{key} 被替换', () => {
    expect(resolveMapTiles({ styleUrl: 'https://maps.example/style.json?key={key}', apiKey: 'abc', development: false })).toEqual({ kind: 'style', styleUrl: 'https://maps.example/style.json?key=abc', raster: null })
  })
  it('栅格瓦片带署名', () => {
    const r = resolveMapTiles({ tileUrl: 'https://t.example/{z}/{x}/{y}.png', attribution: '© Example', development: false })
    expect(r).toEqual({ kind: 'raster', raster: { url: 'https://t.example/{z}/{x}/{y}.png', attribution: '© Example', maxZoom: 19 }, devOnly: false })
  })
  it('非开发环境没有配置时不会回退到 OSM 官方瓦片', () => {
    expect(resolveMapTiles({ development: false })).toEqual({ kind: 'none' })
    expect(JSON.stringify(resolveMapTiles({ development: false }))).not.toContain('openstreetmap')
  })
})

describe('站点地址（canonical / metadataBase）', () => {
  it('生产必须是正式 https 地址', () => {
    expect(siteUrlProblem({})).toMatch(/缺少 APP_URL/)
    expect(siteUrlProblem({ APP_URL: 'http://tabitrace.example' })).toMatch(/https/)
    expect(siteUrlProblem({ APP_URL: 'https://localhost:3000' })).toMatch(/本机/)
    expect(siteUrlProblem({ APP_URL: 'https://tabitrace.example' })).toBeNull()
  })
  it('去掉末尾斜杠，开发默认 localhost', () => {
    expect(siteUrl({ APP_URL: 'https://tabitrace.example///' }).href).toBe('https://tabitrace.example/')
    expect(siteUrl({}).href).toBe('http://localhost:3000/')
  })
})

describe('偏好设置', () => {
  it('语言匹配', () => {
    expect(matchLocale('zh-TW')).toBe('zh-CN')
    expect(matchLocale('ja')).toBe('ja-JP')
    expect(matchLocale('en-GB')).toBe('en-US')
    expect(matchLocale('fr-FR')).toBeNull()
  })
  it('时区校验', () => {
    expect(isValidTimeZone('Asia/Tokyo')).toBe(true)
    expect(isValidTimeZone('Mars/Base')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})

describe('表单校验与错误映射', () => {
  it('注册表单：昵称、邮箱、密码长度、协议', () => {
    const errors = validateRegisterForm({ nickname: '', email: 'bad', password: '123', consent: false }, true, false)
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['nickname', 'email', 'password']))
    expect(validateRegisterForm({ nickname: 'SUN', email: 'a@b.co', password: '12345678', consent: true }, true, true)).toEqual({})
    expect(validateRegisterForm({ nickname: 'SUN', email: 'a@b.co', password: '12345678', consent: true }, true, false)).toHaveProperty('code')
  })
  it('登录后跳转只接受站内路径', () => {
    expect(safeNextPath('https://evil.example')).toBe('/trips')
    expect(safeNextPath('//evil.example')).toBe('/trips')
    expect(safeNextPath('/login?next=/x')).toBe('/trips')
    expect(safeNextPath('/trips/3/map?day=2')).toBe('/trips/3/map?day=2')
  })
  it('验证码：发送失败 / 冷却 / 验证失败的提示', () => {
    expect(mapSendCodeError(new ApiError('x', 503, 'EMAIL_SEND_FAILED')).message).toMatch(/发送失败/)
    expect(mapSendCodeError(new ApiError('x', 429, 'RESEND_TOO_SOON', { retryAfter: 42 }))).toMatchObject({ retryAfter: 42 })
    expect(mapVerifyCodeError(new ApiError('x', 400, 'CODE_INVALID', { remainingAttempts: 2 }))).toEqual({ message: '验证码不正确，还可以再试 2 次', needResend: false })
    expect(mapVerifyCodeError(new ApiError('x', 400, 'CODE_EXPIRED')).needResend).toBe(true)
    expect(sanitizeCode('12a3 45678')).toBe('123456')
    expect(formatCooldown(59)).toBe('59s')
    expect(formatCooldown(600)).toBe('10 分钟')
  })
})

describe('旅行总结与成果准备度', () => {
  const summary = (over: Partial<TripSummary> = {}): TripSummary => ({
    tripId: 1, title: 't', status: 'ACTIVE', planType: 'FREE', days: 3, places: 4, photos: 6, cities: 1, areas: 2,
    officialPlacesCompleted: 0, officialPlacesTotal: 0, explorationRate: 0, achievements: 1,
    dailyRecords: [], readiness: { featuredPhotos: 1, achievementCount: 1, recordedDays: 2, shareReady: true, videoReady: true }, ...over
  })
  it('总结句只用真实统计', () => {
    expect(summarySentence({ destinationName: '东京' }, summary())).toBe('这次东京旅行一共 3 天，记录了 4 个地点，留下 6 张照片，其中 2 天留下了旅行记录。')
    expect(summarySentence({ destinationName: '' }, summary({ places: 0, photos: 0 }))).toBe('这次旅行一共 3 天，还没有留下打卡或照片。')
  })
  it('成果准备度 = 四项平均', () => {
    const r = calculateTravelReadiness({ id: 1, status: 'ACTIVE' }, summary())
    expect(r.items.map(i => i.key)).toEqual(['days', 'featured', 'story', 'finish'])
    expect(r.percent).toBe(Math.round(((2 / 3) + (1 / 3) + 1 + 0) / 4 * 100))
    expect(calculateTravelReadiness({ id: 1, status: 'COMPLETED' }, summary({ readiness: { featuredPhotos: 5, achievementCount: 1, recordedDays: 3, shareReady: true, videoReady: true } })).percent).toBe(100)
  })
})
