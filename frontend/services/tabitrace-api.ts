import { api, clearTokens, getRefreshToken, jsonBody, saveTokens } from './api'

export type TokenResponse = { accessToken:string; refreshToken:string; expiresInSeconds:number; user:UserView }
export type UserView = { id:number;email:string;nickname:string;avatarUrl?:string;locale?:string;timezone?:string;defaultVisibility?:string;emailNotifications:boolean }

export type TripView = { id:number;title:string;destinationName:string;countryCode?:string;city?:string;startDate:string;endDate:string;peopleCount:number;coverImage?:string;planType:string;status:string;visibility:string;createdAt?:string }
export type PlaceView = { id:number;name:string;countryCode?:string;country?:string;city?:string;area?:string;address?:string;latitude?:number;longitude?:number;category?:string;sourceType:string;description?:string;coverImage?:string }
export type ItineraryView = { id:number;placeId?:number;placeName:string;area?:string;plannedDate:string;plannedTime?:string;note?:string;latitude?:number;longitude?:number;status:string;sortOrder:number;createdAt?:string }
export type CheckinView = { id:number;tripId:number;placeId?:number;itineraryItemId?:number;checkinType:string;checkinTime:string;latitude?:number;longitude?:number;placeName:string;area?:string;note?:string;createdAt?:string }
export type TimelinePhoto = { id:number;imageUrl:string;caption?:string;featured:boolean;capturedAt?:string }
export type TimelineDay = { date:string;items:{checkin:CheckinView;photos:TimelinePhoto[]}[] }
export type TripSummary = { tripId:number;title:string;status:string;planType:string;days:number;places:number;photos:number;cities:number;areas:number;officialPlacesCompleted:number;officialPlacesTotal:number;explorationRate:number;achievements:number;dailyRecords:{date:string;checkins:number;photos:number;hasRecord:boolean}[];readiness:{featuredPhotos:number;achievementCount:number;recordedDays:number;shareReady:boolean;videoReady:boolean} }
export type ShareLinkView = { id:number;token:string;status:string;viewCount:number;createdAt:string;expiresAt?:string;revokedAt?:string;url:string }
export type PhotoView = { id:number;tripId:number;checkinId?:number;storageKey:string;imageUrl:string;width?:number;height?:number;fileSize?:number;mimeType:string;featured:boolean;capturedAt?:string;createdAt?:string }
export type AchievementView = { id:number;code:string;name:string;description?:string;type:string;cityCode?:string;iconUrl?:string;earned:boolean;progress:number;earnedAt?:string }
export type PaymentView = { id:number;tripId:number;provider:string;providerPaymentId?:string;amount:number;currency:string;status:string;paidAt?:string;createdAt:string }
export type VideoProjectView = { id:number;tripId:number;templateCode:string;aspectRatio:string;duration:number;musicCode:string;showText:boolean;showMap:boolean;showAchievements:boolean;status:string;progress:number;outputUrl?:string;errorMessage?:string;photoIds:number[];createdAt:string;completedAt?:string }
export type PublicShareView = { trip:TripView;summary:TripSummary;timeline:TimelineDay[];featuredPhotos:PhotoView[];achievements:AchievementView[];ownerNickname:string }

export const userApi = {
  me:()=>api<UserView>('/users/me'),
  update:(input:Partial<Pick<UserView,'nickname'|'avatarUrl'|'locale'|'timezone'|'defaultVisibility'|'emailNotifications'>>)=>api<UserView>('/users/me',{method:'PUT',body:jsonBody(input)})
}

export const authApi = {
  async register(input:{email:string;password:string;nickname:string}) {
    const data = await api<TokenResponse>('/auth/register',{method:'POST',body:jsonBody(input)},false); saveTokens(data.accessToken,data.refreshToken); return data
  },
  async login(input:{email:string;password:string}) {
    const data = await api<TokenResponse>('/auth/login',{method:'POST',body:jsonBody(input)},false); saveTokens(data.accessToken,data.refreshToken); return data
  },
  async logout() {
    const refreshToken = getRefreshToken()
    try { await api<void>('/auth/logout',{method:'POST',body:jsonBody({refreshToken})}) } finally { clearTokens() }
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
  presignPhoto:(tripId:number,input:any)=>api<{storageKey:string;uploadUrl:string;publicUrl:string;expiresInSeconds:number;mock:boolean}>(`/trips/${tripId}/photos/presign`,{method:'POST',body:jsonBody(input)}),
  registerPhoto:(tripId:number,input:any)=>api<PhotoView>(`/trips/${tripId}/photos`,{method:'POST',body:jsonBody(input)}),
  updatePhoto:(photoId:number,input:any)=>api<PhotoView>(`/photos/${photoId}`,{method:'PUT',body:jsonBody(input)}),
  featurePhoto:(photoId:number)=>api<PhotoView>(`/photos/${photoId}/feature`,{method:'POST'}),
  unfeaturePhoto:(photoId:number)=>api<PhotoView>(`/photos/${photoId}/feature`,{method:'DELETE'}),
  deletePhoto:(photoId:number)=>api<void>(`/photos/${photoId}`,{method:'DELETE'}),
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
