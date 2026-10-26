/**
 * 开发数据适配层：services/api.ts 的 request() 在开发环境里先问这里。
 * - 返回 null：原样请求本地后端（local 模式，以及任何模式下的登录认证和公共目录接口）
 * - 返回 { data }：由 Mock 内存数据或 Empty 空数据直接作答，请求不会发到后端
 *
 * 安全原则：mock / empty 模式下没有登记的接口一律报错，而不是“漏”到真实后端，
 * 所以 Mock 页面上的删除、上传、打卡等写操作不可能写进本地数据库。
 * 页面与业务组件完全不知道当前是哪种模式。
 */

import { ApiError } from '@/services/api'
import type { UserView } from '@/services/tabitrace-api'
import type { VideoDraft } from '@/types/video'
import { emptyUser } from '@/dev/mocks/users'
import { buildItems, filterItems, sortItems, type GalleryFilter } from '@/utils/gallery'
import { MockStore } from './mockStore'
import { notice, readMode, type DataSourceMode } from './mode'

type Ctx = { m: RegExpMatchArray; q: URLSearchParams; body: any }
type Route = [method: string, pattern: RegExp, handle: (ctx: Ctx) => unknown]

/** 任何模式都直连后端：认证（不 Mock 登录本身）与公共目录（官方地点、目的地、方案、视频模板 / 音乐） */
const PASS_THROUGH = [/^\/auth\//, /^\/plans\//, /^\/destinations\//, /^\/official-cities\//, /^\/places\/search/, /^\/video-templates$/, /^\/video-music$/]

let store: MockStore | null = null
let storeMode: DataSourceMode | null = null
const mock = () => (store ??= new MockStore(window.location.origin))

/** 切换数据源时丢弃 Mock 内存数据：重新进入 Mock 模式时从原始 Fixture 开始 */
export function resetDevData() { store = null }

/** Mock 模式的“上传”：文件只在当前标签页里以 object URL 预览，不会发到任何存储 */
export function stageUpload(storageKey: string, blob: Blob) { mock().uploads.set(storageKey, URL.createObjectURL(blob)) }

const id = (s: string) => Number(s)

/** Mock 模式的照片墙分页：与后端相同的筛选 / 排序规则（复用前端的 photoTime），游标就是已返回的数量 */
function mockPhotoPage(tripId: number, q: URLSearchParams) {
  const s = mock()
  const trip = s.trip(tripId)
  const items = buildItems(s.photosOf(tripId), s.checkinsOf(tripId), trip, s.user.timezone || 'Asia/Tokyo')
  const filter = (q.get('filter') || 'ALL') as GalleryFilter
  const list = sortItems(filterItems(items, filter), q.get('sort') === 'OLDEST' ? 'OLDEST' : 'NEWEST')
  const from = Number(q.get('cursor') || 0), limit = Math.min(60, Number(q.get('limit') || 40))
  const linked = items.filter(i => i.photo.checkinId).length
  return {
    items: list.slice(from, from + limit).map(i => i.photo),
    nextCursor: from + limit < list.length ? String(from + limit) : null,
    counts: { total: items.length, featured: items.filter(i => i.photo.featured).length, linked, unlinked: items.length - linked }
  }
}
const devError = (status: number, code: string, message: string): never => { notice(message); throw new ApiError(message, status, code) }

/** 官方地点来自公共目录（与模式无关的参考数据），加入 Mock 旅行时读取一次详情 */
async function catalogPlace(placeId: number) {
  const { api } = await import('@/services/api')
  for (const code of ['TOKYO']) {
    const list = await api<import('@/services/tabitrace-api').PlaceView[]>(`/official-cities/${code}/places`, {}, false)
    const hit = list.find(p => p.id === placeId)
    if (hit) return hit
  }
  return devError(404, 'PLACE_NOT_FOUND', `公共目录里没有地点 #${placeId}`)
}

const MOCK_ROUTES: Route[] = [
  // 账户
  ['GET', /^\/users\/me$/, () => mock().user],
  ['PUT', /^\/users\/me$/, ({ body }) => mock().updateUser(body)],
  ['GET', /^\/users\/me\/overview$/, () => mock().overview()],
  ['POST', /^\/users\/me\/avatar\/presign$/, () => { const key = `mock/avatar/${Date.now()}`; return { storageKey: key, uploadUrl: `devmem://${key}`, publicUrl: '', expiresInSeconds: 600, mock: true } }],
  ['PUT', /^\/users\/me\/avatar$/, ({ body }) => mock().setAvatar(body.storageKey, body.smallKey)],
  ['DELETE', /^\/users\/me\/avatar$/, () => { const u = mock().user; delete u.avatarUrl; delete u.avatarSmallUrl; return u }],
  ['POST', /^\/users\/me\/password$/, () => devError(409, 'DEV_MOCK_UNSUPPORTED', 'Mock 数据模式下不能修改密码：账户安全操作请切回本地数据库模式')],
  ['GET', /^\/users\/me\/sessions$/, () => mock().sessions],
  ['DELETE', /^\/users\/me\/sessions\/(\d+)$/, ({ m }) => { const s = mock(); s.sessions = s.sessions.filter(x => x.id !== id(m[1]) || x.current) }],
  ['POST', /^\/users\/me\/sessions\/revoke-others$/, () => { const s = mock(); const n = s.sessions.filter(x => !x.current).length; s.sessions = s.sessions.filter(x => x.current); return { signedOutSessions: n } }],
  ['GET', /^\/me\/favorite-places$/, () => [...mock().favorites]],
  ['POST', /^\/places\/(\d+)\/favorite$/, ({ m }) => { mock().favorites.add(id(m[1])) }],
  ['DELETE', /^\/places\/(\d+)\/favorite$/, ({ m }) => { mock().favorites.delete(id(m[1])) }],
  ['GET', /^\/me\/memories$/, ({ q }) => mock().memories(Number(q.get('limit') || 6))],
  ['GET', /^\/me\/memories\/trips$/, ({ q }) => mock().memoryPage(Number(q.get('offset') || 0), Number(q.get('limit') || 6))],

  // 旅行
  ['GET', /^\/trips$/, () => mock().listTrips()],
  ['POST', /^\/trips$/, async ({ body }) => {
    const t = mock().createTrip(body)
    // 与后端一致：选择加入官方探索时，把该城市的官方地点（公共目录）加入旅行
    if (body.joinOfficialExplore && (t.city === '东京' || t.destinationName === '东京')) {
      const { api } = await import('@/services/api')
      for (const p of await api<import('@/services/tabitrace-api').PlaceView[]>('/official-cities/TOKYO/places', {}, false)) mock().addPlace(t.id, p)
    }
    return t
  }],
  ['GET', /^\/trips\/(\d+)$/, ({ m }) => mock().trip(id(m[1]))],
  ['PUT', /^\/trips\/(\d+)$/, ({ m, body }) => mock().updateTrip(id(m[1]), body)],
  ['DELETE', /^\/trips\/(\d+)$/, ({ m }) => mock().deleteTrip(id(m[1]))],
  ['POST', /^\/trips\/(\d+)\/archive$/, ({ m }) => mock().setStatus(id(m[1]), 'ARCHIVED')],
  ['POST', /^\/trips\/(\d+)\/unarchive$/, ({ m }) => mock().setStatus(id(m[1]), 'COMPLETED')],
  ['POST', /^\/trips\/(\d+)\/complete$/, ({ m }) => mock().setStatus(id(m[1]), 'COMPLETED')],

  // 地点与行程
  ['GET', /^\/trips\/(\d+)\/places$/, ({ m }) => mock().places(id(m[1]))],
  ['POST', /^\/trips\/(\d+)\/places$/, async ({ m, body }) => { mock().writable(id(m[1])); return mock().addPlace(id(m[1]), await catalogPlace(Number(body.placeId))) }],
  ['POST', /^\/trips\/(\d+)\/official-places\/(\d+)$/, async ({ m }) => { mock().writable(id(m[1])); return mock().addPlace(id(m[1]), await catalogPlace(id(m[2]))) }],
  ['POST', /^\/trips\/(\d+)\/places\/custom$/, ({ m, body }) => mock().customPlace(id(m[1]), body)],
  ['DELETE', /^\/trips\/(\d+)\/places\/(\d+)$/, ({ m }) => mock().removePlace(id(m[1]), id(m[2]))],
  ['GET', /^\/trips\/(\d+)\/itinerary$/, ({ m }) => mock().itineraryOf(id(m[1]))],
  ['POST', /^\/trips\/(\d+)\/itinerary$/, ({ m, body }) => mock().addItinerary(id(m[1]), body)],
  ['PUT', /^\/trips\/(\d+)\/itinerary\/(\d+)$/, ({ m, body }) => mock().updateItinerary(id(m[1]), id(m[2]), body)],
  ['DELETE', /^\/trips\/(\d+)\/itinerary\/(\d+)$/, ({ m }) => mock().deleteItinerary(id(m[1]), id(m[2]))],
  ['POST', /^\/trips\/(\d+)\/itinerary\/(\d+)\/checkin$/, ({ m, body }) => mock().itineraryCheckin(id(m[1]), id(m[2]), body)],

  // 打卡与照片
  ['GET', /^\/trips\/(\d+)\/checkins$/, ({ m }) => mock().checkinsOf(id(m[1]))],
  ['POST', /^\/trips\/(\d+)\/checkins$/, ({ m, body }) => mock().addCheckin(id(m[1]), body)],
  ['POST', /^\/trips\/(\d+)\/quick-checkins$/, ({ m, body }) => mock().quickCheckin(id(m[1]), body)],
  // 定位与天气：Mock 模式不请求真实服务，也不编造结果（界面显示「位置 / 天气暂未获取」）
  ['GET', /^\/geo\/(reverse|weather)$/, () => null],
  ['PUT', /^\/checkins\/(\d+)$/, ({ m, body }) => mock().updateCheckin(id(m[1]), body)],
  ['DELETE', /^\/checkins\/(\d+)$/, ({ m }) => mock().deleteCheckin(id(m[1]))],
  ['GET', /^\/trips\/(\d+)\/timeline$/, ({ m }) => mock().timeline(id(m[1]))],
  ['GET', /^\/trips\/(\d+)\/recent-records$/, ({ m, q }) => mock().recentRecords(id(m[1]), Number(q.get('limit') || 3))],
  ['GET', /^\/trips\/(\d+)\/photos$/, ({ m }) => mock().photosOf(id(m[1]))],
  ['GET', /^\/trips\/(\d+)\/photos\/page$/, ({ m, q }) => mockPhotoPage(id(m[1]), q)],
  ['POST', /^\/trips\/(\d+)\/photos\/presign$/, ({ m, body }) => mock().presignPhoto(id(m[1]), body)],
  ['POST', /^\/trips\/(\d+)\/photos$/, ({ m, body }) => mock().registerPhoto(id(m[1]), body)],
  ['POST', /^\/trips\/(\d+)\/photos\/(\d+)\/cover$/, ({ m }) => mock().photoCover(id(m[1]), id(m[2]))],
  ['POST', /^\/trips\/(\d+)\/photos\/batch$/, ({ m, body }) => mock().photoBatch(id(m[1]), body.photoIds ?? [], body.action)],
  ['PUT', /^\/photos\/(\d+)$/, ({ m, body }) => mock().updatePhoto(id(m[1]), body)],
  ['POST', /^\/photos\/(\d+)\/feature$/, ({ m }) => mock().featurePhoto(id(m[1]), true)],
  ['DELETE', /^\/photos\/(\d+)\/feature$/, ({ m }) => mock().featurePhoto(id(m[1]), false)],
  ['DELETE', /^\/photos\/(\d+)$/, ({ m }) => mock().deletePhoto(id(m[1]))],

  // 成果
  ['GET', /^\/trips\/(\d+)\/achievements$/, ({ m }) => mock().achievements(id(m[1]))],
  ['GET', /^\/trips\/(\d+)\/summary$/, ({ m }) => mock().summary(id(m[1]))],
  ['GET', /^\/trips\/(\d+)\/share-links$/, ({ m }) => mock().sharesOf(id(m[1]))],
  ['POST', /^\/trips\/(\d+)\/share-links$/, ({ m, body }) => mock().createShare(id(m[1]), body?.expiresAt, window.location.origin)],
  ['DELETE', /^\/trips\/(\d+)\/share-links\/(\d+)$/, ({ m }) => mock().revokeShare(id(m[1]), id(m[2]))],
  ['GET', /^\/share\/([^/]+)$/, ({ m }) => mock().publicShare(decodeURIComponent(m[1]))],
  ['POST', /^\/trips\/(\d+)\/payments\/checkout$/, ({ m }) => mock().checkout(id(m[1]))],
  ['GET', /^\/trips\/(\d+)\/payments\/latest$/, ({ m }) => mock().latestPayment(id(m[1]))],
  ['POST', /^\/payments\/lifetime\/checkout$/, () => mock().checkoutLifetime()],
  ['GET', /^\/payments\/lifetime\/latest$/, () => mock().latestLifetimePayment()],

  // Travel Story
  ['GET', /^\/trips\/(\d+)\/video-projects$/, ({ m }) => mock().videosOf(id(m[1]))],
  ['POST', /^\/trips\/(\d+)\/video-projects$/, ({ m, body }) => mock().saveVideo(id(m[1]), body as VideoDraft)],
  ['POST', /^\/trips\/(\d+)\/video-storyboard$/, ({ m, body }) => mock().storyboard(id(m[1]), body as VideoDraft, mock().trip(id(m[1])).planType === 'PRO')],
  ['GET', /^\/video-projects\/(\d+)$/, ({ m }) => mock().video(id(m[1]))],
  ['PUT', /^\/video-projects\/(\d+)$/, ({ m, body }) => { const v = mock().video(id(m[1])); return mock().saveVideo(v.tripId, body as VideoDraft, v.id) }],
  ['DELETE', /^\/video-projects\/(\d+)$/, ({ m }) => mock().deleteVideo(id(m[1]))],
  ['POST', /^\/video-projects\/(\d+)\/render$/, ({ m }) => mock().renderVideo(id(m[1]))],
  ['POST', /^\/video-projects\/(\d+)\/duplicate$/, ({ m }) => mock().duplicateVideo(id(m[1]))],
  ['GET', /^\/video-projects\/(\d+)\/storyboard$/, ({ m }) => { const v = mock().video(id(m[1])); return mock().storyboard(v.tripId, v, mock().trip(v.tripId).planType === 'PRO') }]
]

const EMPTY_MEMORIES = { overview: { archivedTrips: 0, cities: 0, photos: 0, creations: 0 }, trips: [], hasMore: false, timeline: [], creations: [], photos: [], photoYear: 0, achievements: [], achievementCount: 0, flashback: null }
const EMPTY_OVERVIEW = { trips: 0, places: 0, photos: 0, proTrips: 0, activeFreeTrips: 0, freeTripLimit: 1, tripProAmount: 400, lifetimeAmount: 100000, tripProCurrency: 'CNY', lifetimePro: false, plans: [] }
const notFound = (code: string, message: string) => () => { throw new ApiError(message, 404, code) }

/** Empty 模式：只有读取，全部返回合法的空结构；不存在的实体返回正常的 404 */
const EMPTY_READS: Route[] = [
  ['GET', /^\/geo\/(reverse|weather)$/, () => null],
  ['GET', /^\/users\/me$/, () => emptyUser as UserView],
  ['GET', /^\/users\/me\/overview$/, () => EMPTY_OVERVIEW],
  ['GET', /^\/users\/me\/sessions$/, () => []],
  ['GET', /^\/me\/favorite-places$/, () => []],
  ['GET', /^\/me\/memories$/, () => EMPTY_MEMORIES],
  ['GET', /^\/me\/memories\/trips$/, () => ({ trips: [], hasMore: false })],
  ['GET', /^\/trips$/, () => []],
  ['*', /^\/trips\/\d+(\/.*)?$/, notFound('TRIP_NOT_FOUND', '旅行不存在')],
  ['*', /^\/checkins\/\d+/, notFound('CHECKIN_NOT_FOUND', '打卡不存在')],
  ['*', /^\/photos\/\d+/, notFound('PHOTO_NOT_FOUND', '照片不存在')],
  ['*', /^\/video-projects\/\d+/, notFound('VIDEO_NOT_FOUND', 'Travel Story 不存在')],
  ['GET', /^\/share\/[^/]+$/, notFound('SHARE_LINK_INVALID', '分享链接无效或已失效')]
]

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function route(path: string, init: RequestInit): Promise<{ data: unknown } | null> {
  const mode = readMode()
  if (mode !== storeMode) { resetDevData(); storeMode = mode }
  if (mode === 'local') return null
  const [pathname, query = ''] = path.split('?')
  if (PASS_THROUGH.some(p => p.test(pathname))) return null
  const method = (init.method || 'GET').toUpperCase()
  const ctx = (m: RegExpMatchArray): Ctx => ({ m, q: new URLSearchParams(query), body: typeof init.body === 'string' && init.body ? JSON.parse(init.body) : {} })
  // 很短的延迟：让页面的加载态按真实请求的节奏出现
  await sleep(60)

  if (mode === 'mock') {
    for (const [mth, re, handle] of MOCK_ROUTES) {
      const m = mth === method ? pathname.match(re) : null
      if (m) return { data: clone(await handle(ctx(m))) }
    }
    return devError(501, 'DEV_MOCK_UNSUPPORTED', `Mock 数据层还没有接管 ${method} ${pathname}，请求已拦截，没有发送到本地后端`)
  }

  // 分镜预览虽然是 POST，但只读；其他非 GET 请求都是写操作，一律拦截
  const isRead = method === 'GET' || /\/video-storyboard$/.test(pathname)
  for (const [mth, re, handle] of EMPTY_READS) {
    const m = (mth === '*' || mth === method) ? pathname.match(re) : null
    if (m && isRead) return { data: clone(await handle(ctx(m))) }
  }
  if (!isRead) return devError(409, 'DEV_EMPTY_READONLY', '当前为 Empty 调试模式，写操作不会保存到本地数据库')
  return devError(501, 'DEV_EMPTY_UNSUPPORTED', `Empty 数据层还没有接管 ${method} ${pathname}，请求已拦截，没有发送到本地后端`)
}
