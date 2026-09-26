/** Travel Story 前后端共用的数据结构（与 backend VideoDtos 一一对应）。 */

export type Plan = 'FREE' | 'PRO'
export type MapMode = 'OFF' | 'SIMPLE' | 'FULL'
/** 成片调色：自然纪实 / 日系清新 / 电影胶片 / 城市质感 */
export type VisualStyle = 'NATURAL' | 'FRESH' | 'FILM' | 'URBAN'
export type VideoStatus = 'DRAFT' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type RenderStage = 'PREPARING' | 'MAP' | 'STORY' | 'MUSIC' | 'EXPORTING' | 'UPLOADING'
export type SceneType = 'OPENING' | 'MAP' | 'PLACE' | 'ACHIEVEMENTS' | 'ENDING'

export type VideoTemplate = {
  code: string
  name: string
  englishName: string
  description: string
  suitableFor: string
  pace: 'SLOW' | 'MEDIUM' | 'FAST'
  transition: string
  transitionSeconds: number
  plan: Plan
  recommendedMusic?: string | null
}

export type VideoMusic = {
  code: string
  name: string
  category: 'NONE' | 'WARM' | 'CITY' | 'FRESH' | 'CINEMATIC' | 'CHILL'
  mood: string
  durationSeconds?: number | null
  plan: Plan
  recommendedTemplate?: string | null
}

export type SegmentOverride = { key: string; enabled?: boolean; title?: string | null }

export type StorySettings = {
  title?: string | null
  endingText?: string | null
  showTitle: boolean
  showDate: boolean
  showPlaceNames: boolean
  showCheckinText: boolean
  showWeather: boolean
  showStats: boolean
  showAchievements: boolean
  showEnding: boolean
  mapMode: MapMode
  segments: SegmentOverride[]
  visualStyle?: VisualStyle | null
}

export type MapPoint = { name: string; area?: string | null; lat: number; lng: number; time: string }

export type Scene = {
  key: string
  type: SceneType
  title: string
  subtitle?: string | null
  start: number
  duration: number
  photoIds: number[]
  enabled: boolean
  pinned: boolean
  meta: {
    kicker?: string
    destination?: string
    mode?: MapMode
    points?: MapPoint[]
    checkinId?: number
    placeName?: string
    note?: string
    shots?: number[]
    items?: string[]
    stats?: string
    endingText?: string
    tagline?: string
  }
}

export type Storyboard = {
  totalDuration: number
  templateCode: string
  resolution: string
  watermark: boolean
  transition: string
  transitionSeconds: number
  scenes: Scene[]
  notices: string[]
  grade?: VisualStyle | null
}

export type VideoProject = {
  id: number
  tripId: number
  name?: string | null
  templateCode: string
  aspectRatio: string
  duration: number
  quality: string
  resolution: string
  watermark: boolean
  musicCode: string
  coverPhotoId?: number | null
  showText: boolean
  showMap: boolean
  showAchievements: boolean
  settings: StorySettings
  status: VideoStatus
  progress: number
  renderStage?: RenderStage | null
  renderer?: 'MOCK' | 'FFMPEG' | null
  outputUrl?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  photoIds: number[]
  createdAt: string
  updatedAt?: string | null
  completedAt?: string | null
}

/** 编辑器里的「正在配置的视频」，提交时原样转成 UpsertVideoProjectRequest。 */
export type VideoDraft = {
  templateCode: string
  aspectRatio: string
  duration: number
  quality: string
  musicCode: string
  coverPhotoId: number | null
  photoIds: number[]
  settings: StorySettings
}

export type VideoRequest = VideoDraft
