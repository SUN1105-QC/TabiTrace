import { api, clearTokens, DEV_UPLOAD_SCHEME, jsonBody, registerDataCache, saveTokens, stageDevUpload } from './api'
import { makePhotoVariants } from '@/utils/photo-variants'
import type { TripProPlan } from '@/utils/plan'
import { runtimePrefs } from '@/lib/preferences'

/** refresh token 由后端写入 HttpOnly Cookie，不出现在响应里 */
export type TokenResponse = { accessToken:string; expiresInSeconds:number; user:UserView }
export type UserView = { id:number;email:string;nickname:string;avatarUrl?:string;avatarSmallUrl?:string|null;bio?:string;locale?:string;timezone?:string;distanceUnit?:DistanceUnit;defaultVisibility?:string;shareExactLocation?:boolean;shareLinkExpiryDays?:number;emailNotifications:boolean;notifyTripReminder?:boolean;notifyStory?:boolean;notifyShare?:boolean;createdAt?:string;/** 买断终身 Pro：账号下所有旅行都是 PRO */lifetimePro?:boolean;lifetimeProAt?:string }
export type DistanceUnit = 'KM' | 'MI'
/** 可在设置中心修改的字段（头像走单独的上传接口） */
export type UserSettingsInput = Partial<Pick<UserView,'nickname'|'bio'|'locale'|'timezone'|'distanceUnit'|'shareExactLocation'|'shareLinkExpiryDays'|'notifyTripReminder'|'notifyStory'|'notifyShare'>>
/** 每段旅行的方案；PRO 旅行附带最近一次成功支付 */
export type TripPlanView = { tripId:number;title:string;destinationName:string;startDate:string;endDate:string;planType:string;status:string;amount?:number;currency?:string;provider?:string;paidAt?:string }
export type AccountOverview = { trips:number;places:number;photos:number;proTrips:number;activeFreeTrips:number;freeTripLimit:number;/** 金额为最小货币单位（分） */tripProAmount:number;lifetimeAmount:number;tripProCurrency:string;lifetimePro:boolean;plans:TripPlanView[] }
export type SessionView = { id:number;device:string;mobile:boolean;signedInAt:string;lastActiveAt:string;expiresAt:string;current:boolean }
type PresignView = { storageKey:string;uploadUrl:string;publicUrl:string;expiresInSeconds:number;mock:boolean }

/** 创建旅行的目的地搜索结果；official 仅在该城市有官方探索内容时存在（数量为实时统计） */
export type OfficialGuide = { code:string;name:string;placeCount:number;routeCount:number;coverImage?:string|null }
export type DestinationView = { id:number;name:string;nameEn:string;countryCode:string;countryName:string;latitude:number;longitude:number;timezone:string;coverImage?:string|null;official?:OfficialGuide|null }
/** Trip Pro 方案配置（公开）：价格、计费方式、Free 限制与 Travel Story 差异 */
export const planApi = {
  tripPro:()=>api<TripProPlan>('/plans/trip-pro',{},false)
}
export const destinationApi = {
  search:(q:string,limit=8,signal?:AbortSignal)=>api<DestinationView[]>(`/destinations/search?q=${encodeURIComponent(q)}&limit=${limit}`,{signal})
}
export type TripView = { id:number;title:string;destinationName:string;countryCode?:string;city?:string;startDate:string;endDate:string;peopleCount:number;coverImage?:string;planType:string;status:string;visibility:string;createdAt?:string }
export type PlaceView = { id:number;name:string;countryCode?:string;country?:string;city?:string;area?:string;address?:string;latitude?:number;longitude?:number;category?:string;sourceType:string;description?:string;coverImage?:string;tagline?:string;recommendReason?:string;stayMinutes?:number;bestTime?:string;tags?:string[];editorRank?:number;tripCount?:number }
/** 官方专题路线：placeIds 为游览顺序 */
export type OfficialRouteView = { id:number;code:string;title:string;englishTitle:string;description:string;durationHint?:string;season?:string;coverImage?:string;placeIds:number[] }
export type ItineraryView = { id:number;placeId?:number;placeName:string;area?:string;plannedDate:string;plannedTime?:string;note?:string;latitude?:number;longitude?:number;status:string;sortOrder:number;createdAt?:string }
/** timezone：打卡时设备所在时区；weather*：打卡时刻的天气快照（能拿到时才有） */
export type CheckinView = { id:number;tripId:number;placeId?:number;itineraryItemId?:number;checkinType:string;checkinTime:string;latitude?:number;longitude?:number;placeName:string;area?:string;note?:string;createdAt?:string;timezone?:string;weatherCode?:number;weatherText?:string;temperatureC?:number;weatherObservedAt?:string }
export type TimelinePhoto = { id:number;imageUrl:string;thumbUrl?:string|null;mediumUrl?:string|null;caption?:string;featured:boolean;capturedAt?:string }
/** 旅行详情“最近记录”：CHECKIN 为一次打卡，PHOTOS 为当天单独上传的照片；at 已是用户时区 */
export type RecentRecord = { kind:'CHECKIN'|'PHOTOS';checkinId?:number;placeName?:string;area?:string;checkinType?:string;at:string;photoCount:number;thumbnailUrl?:string;note?:string }
export type TimelineDay = { date:string;items:{checkin:CheckinView;photos:TimelinePhoto[]}[] }
export type TripSummary = { tripId:number;title:string;status:string;planType:string;days:number;places:number;photos:number;cities:number;areas:number;officialPlacesCompleted:number;officialPlacesTotal:number;explorationRate:number;dailyRecords:{date:string;checkins:number;photos:number;hasRecord:boolean}[];readiness:{featuredPhotos:number;recordedDays:number;shareReady:boolean;videoReady:boolean} }
export type ShareLinkView = { id:number;token:string;status:string;viewCount:number;createdAt:string;expiresAt?:string;revokedAt?:string;url:string }
/** imageUrl 为原图（下载 / 视频生成）；thumbUrl / mediumUrl 为上传时生成的缩略图与中图，旧照片没有（见 utils/photo-variants） */
export type PhotoView = { id:number;tripId:number;checkinId?:number;storageKey:string;imageUrl:string;thumbUrl?:string|null;mediumUrl?:string|null;width?:number;height?:number;fileSize?:number;mimeType:string;featured:boolean;capturedAt?:string;createdAt?:string }
export type PhotoCounts = { total:number;featured:number;linked:number;unlinked:number }
/** 照片墙分页：nextCursor 为空表示没有更多；counts 是整段旅行的统计 */
export type PhotoPage = { items:PhotoView[];nextCursor:string|null;counts:PhotoCounts }
export type PhotoPageQuery = { filter?:'ALL'|'FEATURED'|'LINKED'|'UNLINKED';sort?:'NEWEST'|'OLDEST';cursor?:string|null;limit?:number }
export type PaymentView = { id:number;tripId?:number|null;product?:string;provider:string;providerPaymentId?:string;amount:number;currency:string;status:string;paidAt?:string;createdAt:string;refundedAmount?:number;expiresAt?:string;lastSyncedAt?:string }
export type CheckoutResponse = { paymentId:number;status:string;checkoutUrl:string|null;mock:boolean }
export type AccountUsageView = {
  day:string;renderRequests:number;outputSeconds:number;activeRenders:number;
  limits:{enforced:boolean;dailyRenders:number;dailyOutputSeconds:number};
  media:{photoBytes:number;musicReservedBytes:number;videoBytes:number;variantEstimateBytes:number;unknownPhotos:number;unknownVideos:number}
}
export const usageApi = { current:(signal?:AbortSignal)=>api<AccountUsageView>('/users/me/usage',{signal}) }
export const paymentApi = {
  history:()=>api<PaymentView[]>('/payments'),
  get:(id:number)=>api<PaymentView>(`/payments/${id}`),
  refresh:(id:number)=>api<PaymentView>(`/payments/${id}/refresh`,{method:'POST'}),
  resume:(id:number)=>api<CheckoutResponse>(`/payments/${id}/resume`,{method:'POST'}),
  cancel:(id:number)=>api<PaymentView>(`/payments/${id}/cancel`,{method:'POST'})
}
export type VideoProjectView = { id:number;tripId:number;templateCode:string;aspectRatio:string;duration:number;musicCode:string;showText:boolean;showAchievements:boolean;status:string;progress:number;outputUrl?:string;errorMessage?:string;photoIds:number[];createdAt:string;completedAt?:string }
export type PublicShareView = { trip:TripView;summary:TripSummary;timeline:TimelineDay[];featuredPhotos:PhotoView[];ownerNickname:string }

/**
 * 当前用户：外壳（Header）与页面会同时请求，这里合并短时间内的重复请求；
 * 保存成功后直接更新缓存并广播 USER_UPDATED_EVENT，外壳据此刷新头像、昵称与通知，而不是整页刷新。
 */
export const USER_UPDATED_EVENT = 'tabitrace:user-updated'
let meCache: { at:number; promise:Promise<UserView> } | null = null
registerDataCache(() => { meCache = null; forgetAccountLocalState() })
function rememberUser(user:UserView) {
  meCache = { at: Date.now(), promise: Promise.resolve(user) }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<UserView>(USER_UPDATED_EVENT, { detail: user }))
  return user
}

export const userApi = {
  me:()=>{
    if (meCache && Date.now() - meCache.at < 5000) return meCache.promise
    const promise = api<UserView>('/users/me')
    meCache = { at: Date.now(), promise }
    promise.catch(() => { if (meCache?.promise === promise) meCache = null })
    return promise
  },
  /** 绕过合并缓存重新读取（例如刚完成买断，需要立刻拿到最新的 lifetimePro），并更新缓存、通知外壳 */
  refresh:async()=>rememberUser(await api<UserView>('/users/me')),
  update:async(input:UserSettingsInput)=>rememberUser(await api<UserView>('/users/me',{method:'PUT',body:jsonBody(input)})),
  overview:()=>api<AccountOverview>('/users/me/overview'),
  presignAvatar:(input:{fileName:string;contentType:string;fileSize:number})=>api<PresignView>('/users/me/avatar/presign',{method:'POST',body:jsonBody(input)}),
  setAvatar:async(storageKey:string,smallKey?:string)=>rememberUser(await api<UserView>('/users/me/avatar',{method:'PUT',body:jsonBody({storageKey,smallKey})})),
  removeAvatar:async()=>rememberUser(await api<UserView>('/users/me/avatar',{method:'DELETE'})),
  changePassword:(currentPassword:string,newPassword:string)=>api<{signedOutSessions:number}>('/users/me/password',{method:'POST',body:jsonBody({currentPassword,newPassword})}),
  sessions:()=>api<SessionView[]>('/users/me/sessions'),
  revokeSession:(id:number)=>api<void>(`/users/me/sessions/${id}`,{method:'DELETE'}),
  revokeOtherSessions:()=>api<{signedOutSessions:number}>('/users/me/sessions/revoke-others',{method:'POST',body:jsonBody({})}),
  /** 注销账号：进入冷静期，所有设备退出（后端同时清掉 refresh Cookie）；本机凭证与账号相关的本地状态一并清理 */
  async requestDeletion(password:string) {
    const r = await api<{scheduledAt:string;coolingOffDays:number}>('/users/me/deletion',{method:'POST',body:jsonBody({password})})
    clearTokens(); meCache = null; forgetAccountLocalState()
    return r
  }
}

/** 上传大小上限：与后端 PhotoService / UserService、预签名 URL 里签入的 Content-Length 一致（改动时两边一起改） */
export const PHOTO_MAX_BYTES = 20 * 1024 * 1024
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** 头像：浏览器端先裁成正方形并压缩，再沿用照片的预签名上传通道 */
/** 上传头像原图与小图（小图可选），两张都上传成功后再保存到账户 */
export async function uploadAvatar(blob:Blob, small?:Blob) {
  const put = async (b:Blob, name:string) => {
    const type = b.type || 'image/jpeg'
    if (b.size > AVATAR_MAX_BYTES) throw new Error('头像图片不能超过 5MB')
    const presign = await userApi.presignAvatar({ fileName: name + '.' + (type.split('/')[1] || 'jpg'), contentType: type, fileSize: b.size })
    if (presign.uploadUrl.startsWith(DEV_UPLOAD_SCHEME)) await stageDevUpload(presign.storageKey, b)
    else if (!presign.uploadUrl.startsWith('mock://')) {
      const uploaded = await fetch(presign.uploadUrl,{method:'PUT',headers:{'Content-Type':type},body:b})
      if (!uploaded.ok) throw new Error(`头像上传失败 (${uploaded.status})`)
    }
    return presign.storageKey
  }
  const storageKey = await put(blob, 'avatar')
  const smallKey = small ? await put(small, 'avatar-small') : undefined
  return userApi.setAvatar(storageKey, smallKey)
}

export type EmailVerificationPurpose = 'register' | 'reset_password' | 'change_email'

export const authApi = {
  /** 发送邮箱验证码：响应只有有效期与重发间隔，验证码只会出现在邮件里 */
  sendEmailCode:(input:{email:string;purpose:EmailVerificationPurpose})=>api<{expiresIn:number;resendAfter:number}>('/auth/email-verification/send',{method:'POST',body:jsonBody(input)},false),
  /** 校验验证码，成功后得到短时有效、只能用一次的 emailVerificationToken */
  verifyEmailCode:(input:{email:string;code:string;purpose:EmailVerificationPurpose})=>api<{emailVerificationToken:string;expiresIn:number}>('/auth/email-verification/verify',{method:'POST',body:jsonBody(input)},false),
  async register(input:{email:string;password:string;nickname:string;emailVerificationToken:string}) {
    // 带上访客正在使用的界面语言与时区，注册后界面不会被切回默认语言
    const { locale, timeZone } = runtimePrefs()
    const data = await api<TokenResponse>('/auth/register',{method:'POST',body:jsonBody({ ...input, locale, timezone: timeZone })},false); saveTokens(data.accessToken); if (data.user) rememberUser(data.user); else meCache = null; return data
  },
  /** 忘记密码：邮箱验证令牌（purpose=reset_password）+ 新密码；成功后其他设备全部退出，当前设备直接登录 */
  async resetPassword(input:{email:string;newPassword:string;emailVerificationToken:string}) {
    const data = await api<TokenResponse>('/auth/password-reset',{method:'POST',body:jsonBody(input)},false); saveTokens(data.accessToken); if (data.user) rememberUser(data.user); else meCache = null; return data
  },
  /** cancelDeletion：账号在注销冷静期时，用户确认撤销注销后再提交一次 */
  async login(input:{email:string;password:string;cancelDeletion?:boolean}) {
    const data = await api<TokenResponse>('/auth/login',{method:'POST',body:jsonBody(input)},false); saveTokens(data.accessToken); if (data.user) rememberUser(data.user); else meCache = null; return data
  },
  async logout() {
    // 后端按 Cookie（或访问令牌里的会话）只退出当前设备，并清除 Cookie
    try { await api<void>('/auth/logout',{method:'POST',body:jsonBody({})}) } finally { clearTokens(); meCache = null; forgetAccountLocalState() }
  }
}

/** 退出登录时清掉只属于这个账户的本机状态，下一个在这台设备登录的人不会继承（界面语言与时区属于设备偏好，保留） */
function forgetAccountLocalState() {
  if (typeof window === 'undefined') return
  for (const k of ['tabitrace-live-trip-id', 'tabitrace-notifications-read-at']) window.localStorage.removeItem(k)
}

export const tripApi = {
  list:()=>api<TripView[]>('/trips'),
  get:(id:number)=>api<TripView>(`/trips/${id}`),
  create:(input:{title:string;destinationName:string;countryCode?:string;city?:string;startDate:string;endDate:string;peopleCount:number;coverImage?:string;joinOfficialExplore:boolean})=>api<TripView>('/trips',{method:'POST',body:jsonBody(input)}),
  update:(id:number,input:any)=>api<TripView>(`/trips/${id}`,{method:'PUT',body:jsonBody(input)}),
  delete:(id:number)=>api<void>(`/trips/${id}`,{method:'DELETE'}),
  archive:(id:number)=>api<TripView>(`/trips/${id}/archive`,{method:'POST'}),
  unarchive:(id:number)=>api<TripView>(`/trips/${id}/unarchive`,{method:'POST'}),
  officialCity:(code='TOKYO')=>api<any>(`/official-cities/${code}`,{},false),
  officialPlaces:(code='TOKYO')=>api<PlaceView[]>(`/official-cities/${code}/places`,{},false),
  officialRoutes:(code='TOKYO')=>api<OfficialRouteView[]>(`/official-cities/${code}/routes`,{},false),
  favoritePlaces:()=>api<number[]>('/me/favorite-places'),
  setFavorite:(placeId:number,on:boolean)=>api<void>(`/places/${placeId}/favorite`,{method:on?'POST':'DELETE'}),
  searchPlaces:(q:string)=>api<PlaceView[]>(`/places/search?q=${encodeURIComponent(q)}`,{},false),
  addPlace:(tripId:number,placeId:number,sortOrder?:number)=>api<PlaceView>(`/trips/${tripId}/places`,{method:'POST',body:jsonBody({placeId,sortOrder})}),
  addOfficial:(tripId:number,placeId:number)=>api<PlaceView>(`/trips/${tripId}/official-places/${placeId}`,{method:'POST'}),
  places:(tripId:number)=>api<PlaceView[]>(`/trips/${tripId}/places`),
  customPlace:(tripId:number,input:any)=>api<PlaceView>(`/trips/${tripId}/places/custom`,{method:'POST',body:jsonBody(input)}),
  removePlace:(tripId:number,placeId:number)=>api<void>(`/trips/${tripId}/places/${placeId}`,{method:'DELETE'}),
  itinerary:(tripId:number)=>api<ItineraryView[]>(`/trips/${tripId}/itinerary`),
  addItinerary:(tripId:number,input:any)=>api<ItineraryView>(`/trips/${tripId}/itinerary`,{method:'POST',body:jsonBody(input)}),
  updateItinerary:(tripId:number,itemId:number,input:any)=>api<ItineraryView>(`/trips/${tripId}/itinerary/${itemId}`,{method:'PUT',body:jsonBody(input)}),
  deleteItinerary:(tripId:number,itemId:number)=>api<void>(`/trips/${tripId}/itinerary/${itemId}`,{method:'DELETE'}),
  itineraryCheckin:(tripId:number,itemId:number,input:any)=>api<CheckinView>(`/trips/${tripId}/itinerary/${itemId}/checkin`,{method:'POST',body:jsonBody(input)}),
  checkins:(tripId:number)=>api<CheckinView[]>(`/trips/${tripId}/checkins`),
  addCheckin:(tripId:number,input:any)=>api<CheckinView>(`/trips/${tripId}/checkins`,{method:'POST',body:jsonBody(input)}),
  /** 快速打卡：打卡 + 天气快照 + 已上传照片的元数据，一次事务保存（照片须先用 stageTripPhoto 上传到存储） */
  quickCheckin:(tripId:number,input:QuickCheckinInput)=>api<{checkin:CheckinView;photos:PhotoView[]}>(`/trips/${tripId}/quick-checkins`,{method:'POST',body:jsonBody(input)}),
  updateCheckin:(id:number,input:any)=>api<CheckinView>(`/checkins/${id}`,{method:'PUT',body:jsonBody(input)}),
  deleteCheckin:(id:number)=>api<void>(`/checkins/${id}`,{method:'DELETE'}),
  timeline:(tripId:number)=>api<TimelineDay[]>(`/trips/${tripId}/timeline`),
  recentRecords:(tripId:number,limit=3)=>api<RecentRecord[]>(`/trips/${tripId}/recent-records?limit=${limit}`),
  presignPhoto:(tripId:number,input:any)=>api<{storageKey:string;uploadUrl:string;publicUrl:string;expiresInSeconds:number;mock:boolean}>(`/trips/${tripId}/photos/presign`,{method:'POST',body:jsonBody(input)}),
  registerPhoto:(tripId:number,input:any)=>api<PhotoView>(`/trips/${tripId}/photos`,{method:'POST',body:jsonBody(input)}),
  updatePhoto:(photoId:number,input:any)=>api<PhotoView>(`/photos/${photoId}`,{method:'PUT',body:jsonBody(input)}),
  featurePhoto:(photoId:number)=>api<PhotoView>(`/photos/${photoId}/feature`,{method:'POST'}),
  unfeaturePhoto:(photoId:number)=>api<PhotoView>(`/photos/${photoId}/feature`,{method:'DELETE'}),
  deletePhoto:(photoId:number)=>api<void>(`/photos/${photoId}`,{method:'DELETE'}),
  /** 设为旅行封面（照片必须属于该旅行），返回更新后的旅行 */
  photoCover:(tripId:number,photoId:number)=>api<TripView>(`/trips/${tripId}/photos/${photoId}/cover`,{method:'POST'}),
  /** 批量精选 / 取消精选 / 删除 */
  photoBatch:(tripId:number,photoIds:number[],action:'FEATURE'|'UNFEATURE'|'DELETE')=>api<{action:string;affected:number}>(`/trips/${tripId}/photos/batch`,{method:'POST',body:jsonBody({photoIds,action})}),
  photos:(tripId:number)=>api<PhotoView[]>(`/trips/${tripId}/photos`),
  photoPage:(tripId:number,q:PhotoPageQuery={})=>{const p=new URLSearchParams();if(q.filter)p.set('filter',q.filter);if(q.sort)p.set('sort',q.sort);if(q.cursor)p.set('cursor',q.cursor);if(q.limit)p.set('limit',String(q.limit));return api<PhotoPage>(`/trips/${tripId}/photos/page?${p}`)},
  summary:(tripId:number)=>api<TripSummary>(`/trips/${tripId}/summary`),
  complete:(tripId:number)=>api<TripView>(`/trips/${tripId}/complete`,{method:'POST'}),
  createShare:(tripId:number,expiresAt?:string)=>api<ShareLinkView>(`/trips/${tripId}/share-links`,{method:'POST',body:jsonBody(expiresAt?{expiresAt}:{})}),
  shares:(tripId:number)=>api<ShareLinkView[]>(`/trips/${tripId}/share-links`),
  revokeShare:(tripId:number,shareId:number)=>api<void>(`/trips/${tripId}/share-links/${shareId}`,{method:'DELETE'}),
  publicShare:(token:string)=>api<PublicShareView>(`/share/${token}`,{},false),
  checkout:(tripId:number)=>api<CheckoutResponse>(`/trips/${tripId}/payments/checkout`,{method:'POST'}),
  /** 买断 · 终身 Pro */
  checkoutLifetime:()=>api<CheckoutResponse>('/payments/lifetime/checkout',{method:'POST'}),
  latestLifetimePayment:()=>api<PaymentView|null>('/payments/lifetime/latest'),
  latestPayment:(tripId:number)=>api<PaymentView>(`/trips/${tripId}/payments/latest`),
  createVideo:(tripId:number,input:any)=>api<VideoProjectView>(`/trips/${tripId}/video-projects`,{method:'POST',body:jsonBody(input)}),
  videos:(tripId:number)=>api<VideoProjectView[]>(`/trips/${tripId}/video-projects`),
  video:(id:number)=>api<VideoProjectView>(`/video-projects/${id}`),
  updateVideo:(id:number,input:any)=>api<VideoProjectView>(`/video-projects/${id}`,{method:'PUT',body:jsonBody(input)}),
  renderVideo:(id:number)=>api<VideoProjectView>(`/video-projects/${id}/render`,{method:'POST'}),
  deleteVideo:(id:number)=>api<void>(`/video-projects/${id}`,{method:'DELETE'})
}

async function putUpload(presign:{storageKey:string;uploadUrl:string}, body:Blob, type:string) {
  if (presign.uploadUrl.startsWith(DEV_UPLOAD_SCHEME)) { await stageDevUpload(presign.storageKey, body); return }
  if (presign.uploadUrl.startsWith('mock://')) return
  const uploaded = await fetch(presign.uploadUrl,{method:'PUT',headers:{'Content-Type':type},body})
  if (!uploaded.ok) throw new Error(`图片上传失败 (${uploaded.status})`)
}

/**
 * 上传照片：原图 + 浏览器生成的缩略图 / 中图（列表不加载原图）。
 * 尺寸版本生成或上传失败不影响原图上传，照片照常登记，显示时回退原图。
 */
/** 登记照片需要的元数据（文件已经在存储里） */
export type StagedPhoto = { storageKey:string;width?:number;height?:number;fileSize:number;mimeType:string;thumbKey?:string;mediumKey?:string;featured?:boolean;capturedAt?:string }
export type QuickCheckinInput = {
  checkin:{ placeId?:number;itineraryItemId?:number;checkinTime:string;latitude?:number;longitude?:number;placeName?:string;area?:string;note?:string;timezone?:string;accuracyM?:number }
  photos:StagedPhoto[]
  captureWeather:boolean
}
export type ReverseGeo = { label:string;placeName?:string;area?:string;city?:string;country?:string;countryCode?:string;nearPlaceId?:number;nearPlaceName?:string;nearPlaceDistanceM?:number;source:string }
export type WeatherSnapshot = { code:number;text:string;temperatureC:number;observedAt:string;source:string }
/** 快速打卡的自动信息：拿不到时返回 null（不是错误），界面显示「暂未获取」 */
export const geoApi = {
  reverse:(lat:number,lng:number,accuracy?:number,tripId?:number)=>api<ReverseGeo|null>(`/geo/reverse?lat=${lat}&lng=${lng}${accuracy!=null?`&accuracy=${Math.round(accuracy)}`:''}${tripId?`&tripId=${tripId}`:''}`),
  weather:(lat:number,lng:number,at?:string)=>api<WeatherSnapshot|null>(`/geo/weather?lat=${lat}&lng=${lng}${at?`&at=${encodeURIComponent(at)}`:''}`)
}

/** 只把照片（原图 + 缩略图 + 中图）上传到存储，不登记：快速打卡随后和打卡一起在同一事务里登记 */
export async function stageTripPhoto(tripId:number,file:File,input?:{featured?:boolean;capturedAt?:string}):Promise<StagedPhoto> {
  const mime = file.type || 'image/jpeg'
  if (file.size > PHOTO_MAX_BYTES) throw new Error('单张照片不能超过 20MB')
  const variants = await makePhotoVariants(file)
  const presign = await tripApi.presignPhoto(tripId,{fileName:file.name,contentType:mime,fileSize:file.size})
  await putUpload(presign, file, mime)
  const keys: { thumbKey?:string; mediumKey?:string } = {}
  if (variants) {
    try {
      for (const [name, blob] of [['thumb', variants.thumb], ['medium', variants.medium]] as const) {
        const v = await tripApi.presignPhoto(tripId,{fileName:`${name}.jpg`,contentType:'image/jpeg',fileSize:blob.size,variantOf:presign.storageKey,variant:name})
        await putUpload(v, blob, 'image/jpeg')
        keys[name === 'thumb' ? 'thumbKey' : 'mediumKey'] = v.storageKey
      }
    } catch { delete keys.thumbKey; delete keys.mediumKey }
  }
  return {storageKey:presign.storageKey,width:variants?.width,height:variants?.height,fileSize:file.size,mimeType:mime,featured:Boolean(input?.featured),capturedAt:input?.capturedAt,...keys}
}

export async function uploadTripPhoto(tripId:number,file:File,input?:{checkinId?:number;featured?:boolean;capturedAt?:string}) {
  const staged = await stageTripPhoto(tripId,file,input)
  return tripApi.registerPhoto(tripId,{checkinId:input?.checkinId,...staged})
}
