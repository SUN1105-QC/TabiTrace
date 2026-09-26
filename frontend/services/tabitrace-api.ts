import { api, clearTokens, getRefreshToken, jsonBody, saveTokens } from './api'
import type { TripProPlan } from '@/utils/plan'

export type TokenResponse = { accessToken:string; refreshToken:string; expiresInSeconds:number; user:UserView }
export type UserView = { id:number;email:string;nickname:string;avatarUrl?:string;bio?:string;locale?:string;timezone?:string;distanceUnit?:DistanceUnit;defaultVisibility?:string;shareExactLocation?:boolean;shareLinkExpiryDays?:number;emailNotifications:boolean;notifyTripReminder?:boolean;notifyStory?:boolean;notifyAchievement?:boolean;notifyShare?:boolean;createdAt?:string }
export type DistanceUnit = 'KM' | 'MI'
/** 可在设置中心修改的字段（头像走单独的上传接口） */
export type UserSettingsInput = Partial<Pick<UserView,'nickname'|'bio'|'locale'|'timezone'|'distanceUnit'|'shareExactLocation'|'shareLinkExpiryDays'|'notifyTripReminder'|'notifyStory'|'notifyAchievement'|'notifyShare'>>
/** 每段旅行的方案；PRO 旅行附带最近一次成功支付 */
export type TripPlanView = { tripId:number;title:string;destinationName:string;startDate:string;endDate:string;planType:string;status:string;amount?:number;currency?:string;provider?:string;paidAt?:string }
export type AccountOverview = { trips:number;places:number;photos:number;proTrips:number;activeFreeTrips:number;freeTripLimit:number;tripProPrice:number;tripProCurrency:string;plans:TripPlanView[] }
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
export type CheckinView = { id:number;tripId:number;placeId?:number;itineraryItemId?:number;checkinType:string;checkinTime:string;latitude?:number;longitude?:number;placeName:string;area?:string;note?:string;createdAt?:string }
export type TimelinePhoto = { id:number;imageUrl:string;caption?:string;featured:boolean;capturedAt?:string }
/** 旅行详情“最近记录”：CHECKIN 为一次打卡，PHOTOS 为当天单独上传的照片；at 已是用户时区 */
export type RecentRecord = { kind:'CHECKIN'|'PHOTOS';checkinId?:number;placeName?:string;area?:string;checkinType?:string;at:string;photoCount:number;thumbnailUrl?:string;note?:string }
export type TimelineDay = { date:string;items:{checkin:CheckinView;photos:TimelinePhoto[]}[] }
export type TripSummary = { tripId:number;title:string;status:string;planType:string;days:number;places:number;photos:number;cities:number;areas:number;officialPlacesCompleted:number;officialPlacesTotal:number;explorationRate:number;achievements:number;dailyRecords:{date:string;checkins:number;photos:number;hasRecord:boolean}[];readiness:{featuredPhotos:number;achievementCount:number;recordedDays:number;shareReady:boolean;videoReady:boolean} }
export type ShareLinkView = { id:number;token:string;status:string;viewCount:number;createdAt:string;expiresAt?:string;revokedAt?:string;url:string }
export type PhotoView = { id:number;tripId:number;checkinId?:number;storageKey:string;imageUrl:string;width?:number;height?:number;fileSize?:number;mimeType:string;featured:boolean;capturedAt?:string;createdAt?:string }
/** 成就：progress 为 0~100 百分比；conditionType / current / target 为真实进度；requirements 仅在条件是具体地点时有值 */
export type AchievementView = { id:number;code:string;name:string;description?:string;type:string;cityCode?:string;iconUrl?:string;earned:boolean;progress:number;earnedAt?:string;conditionType?:string;current?:number;target?:number;requirements?:{name:string;done:boolean}[] }
export type PaymentView = { id:number;tripId:number;provider:string;providerPaymentId?:string;amount:number;currency:string;status:string;paidAt?:string;createdAt:string }
export type VideoProjectView = { id:number;tripId:number;templateCode:string;aspectRatio:string;duration:number;musicCode:string;showText:boolean;showMap:boolean;showAchievements:boolean;status:string;progress:number;outputUrl?:string;errorMessage?:string;photoIds:number[];createdAt:string;completedAt?:string }
export type PublicShareView = { trip:TripView;summary:TripSummary;timeline:TimelineDay[];featuredPhotos:PhotoView[];achievements:AchievementView[];ownerNickname:string }

/**
 * 当前用户：外壳（Header）与页面会同时请求，这里合并短时间内的重复请求；
 * 保存成功后直接更新缓存并广播 USER_UPDATED_EVENT，外壳据此刷新头像、昵称与通知，而不是整页刷新。
 */
export const USER_UPDATED_EVENT = 'tabitrace:user-updated'
let meCache: { at:number; promise:Promise<UserView> } | null = null
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
  update:async(input:UserSettingsInput)=>rememberUser(await api<UserView>('/users/me',{method:'PUT',body:jsonBody(input)})),
  overview:()=>api<AccountOverview>('/users/me/overview'),
  presignAvatar:(input:{fileName:string;contentType:string;fileSize:number})=>api<PresignView>('/users/me/avatar/presign',{method:'POST',body:jsonBody(input)}),
  setAvatar:async(storageKey:string)=>rememberUser(await api<UserView>('/users/me/avatar',{method:'PUT',body:jsonBody({storageKey})})),
  removeAvatar:async()=>rememberUser(await api<UserView>('/users/me/avatar',{method:'DELETE'})),
  changePassword:(currentPassword:string,newPassword:string)=>api<{signedOutSessions:number}>('/users/me/password',{method:'POST',body:jsonBody({currentPassword,newPassword,refreshToken:getRefreshToken()})}),
  sessions:()=>api<SessionView[]>('/users/me/sessions'),
  revokeSession:(id:number)=>api<void>(`/users/me/sessions/${id}`,{method:'DELETE'}),
  revokeOtherSessions:()=>api<{signedOutSessions:number}>('/users/me/sessions/revoke-others',{method:'POST',body:jsonBody({refreshToken:getRefreshToken()})})
}

/** 头像：浏览器端先裁成正方形并压缩，再沿用照片的预签名上传通道 */
export async function uploadAvatar(blob:Blob) {
  const type = blob.type || 'image/jpeg'
  const presign = await userApi.presignAvatar({ fileName: 'avatar.' + (type.split('/')[1] || 'jpg'), contentType: type, fileSize: blob.size })
  if (!presign.uploadUrl.startsWith('mock://')) {
    const uploaded = await fetch(presign.uploadUrl,{method:'PUT',headers:{'Content-Type':type},body:blob})
    if (!uploaded.ok) throw new Error(`头像上传失败 (${uploaded.status})`)
  }
  return userApi.setAvatar(presign.storageKey)
}

export type EmailVerificationPurpose = 'register' | 'reset_password' | 'change_email'

export const authApi = {
  /** 发送邮箱验证码：响应只有有效期与重发间隔，验证码只会出现在邮件里 */
  sendEmailCode:(input:{email:string;purpose:EmailVerificationPurpose})=>api<{expiresIn:number;resendAfter:number}>('/auth/email-verification/send',{method:'POST',body:jsonBody(input)},false),
  /** 校验验证码，成功后得到短时有效、只能用一次的 emailVerificationToken */
  verifyEmailCode:(input:{email:string;code:string;purpose:EmailVerificationPurpose})=>api<{emailVerificationToken:string;expiresIn:number}>('/auth/email-verification/verify',{method:'POST',body:jsonBody(input)},false),
  async register(input:{email:string;password:string;nickname:string;emailVerificationToken:string}) {
    const data = await api<TokenResponse>('/auth/register',{method:'POST',body:jsonBody(input)},false); saveTokens(data.accessToken,data.refreshToken); meCache = null; return data
  },
  async login(input:{email:string;password:string}) {
    const data = await api<TokenResponse>('/auth/login',{method:'POST',body:jsonBody(input)},false); saveTokens(data.accessToken,data.refreshToken); meCache = null; return data
  },
  async logout() {
    const refreshToken = getRefreshToken()
    try { await api<void>('/auth/logout',{method:'POST',body:jsonBody({refreshToken})}) } finally { clearTokens(); meCache = null }
  }
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
  achievements:(tripId:number)=>api<AchievementView[]>(`/trips/${tripId}/achievements`),
  summary:(tripId:number)=>api<TripSummary>(`/trips/${tripId}/summary`),
  complete:(tripId:number)=>api<TripView>(`/trips/${tripId}/complete`,{method:'POST'}),
  createShare:(tripId:number,expiresAt?:string)=>api<ShareLinkView>(`/trips/${tripId}/share-links`,{method:'POST',body:jsonBody(expiresAt?{expiresAt}:{})}),
  shares:(tripId:number)=>api<ShareLinkView[]>(`/trips/${tripId}/share-links`),
  revokeShare:(tripId:number,shareId:number)=>api<void>(`/trips/${tripId}/share-links/${shareId}`,{method:'DELETE'}),
  publicShare:(token:string)=>api<PublicShareView>(`/share/${token}`,{},false),
  checkout:(tripId:number)=>api<any>(`/trips/${tripId}/payments/checkout`,{method:'POST'}),
  latestPayment:(tripId:number)=>api<PaymentView>(`/trips/${tripId}/payments/latest`),
  createVideo:(tripId:number,input:any)=>api<VideoProjectView>(`/trips/${tripId}/video-projects`,{method:'POST',body:jsonBody(input)}),
  videos:(tripId:number)=>api<VideoProjectView[]>(`/trips/${tripId}/video-projects`),
  video:(id:number)=>api<VideoProjectView>(`/video-projects/${id}`),
  updateVideo:(id:number,input:any)=>api<VideoProjectView>(`/video-projects/${id}`,{method:'PUT',body:jsonBody(input)}),
  renderVideo:(id:number)=>api<VideoProjectView>(`/video-projects/${id}/render`,{method:'POST'}),
  deleteVideo:(id:number)=>api<void>(`/video-projects/${id}`,{method:'DELETE'})
}

export async function uploadTripPhoto(tripId:number,file:File,input?:{checkinId?:number;featured?:boolean;capturedAt?:string}) {
  const mime = file.type || 'image/jpeg'
  const presign = await tripApi.presignPhoto(tripId,{fileName:file.name,contentType:mime,fileSize:file.size})
  if (!presign.uploadUrl.startsWith('mock://')) {
    const uploaded = await fetch(presign.uploadUrl,{method:'PUT',headers:{'Content-Type':mime},body:file})
    if (!uploaded.ok) throw new Error(`图片上传失败 (${uploaded.status})`)
  }
  let width:number|undefined, height:number|undefined
  try { const bitmap = await createImageBitmap(file); width=bitmap.width;height=bitmap.height;bitmap.close() } catch {}
  return tripApi.registerPhoto(tripId,{checkinId:input?.checkinId,storageKey:presign.storageKey,width,height,fileSize:file.size,mimeType:mime,featured:Boolean(input?.featured),capturedAt:input?.capturedAt})
}
