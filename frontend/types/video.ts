/** Travel Story 前后端共用的数据结构（与 backend VideoDtos 一一对应）。 */

export type Plan = 'FREE' | 'PRO'
/** USER = 用户上传的音乐；SYSTEM 仅兼容读取历史视频，新项目不再使用。 */
export type MusicSource = 'SYSTEM' | 'USER'
/** 成片调色：自然纪实 / 日系清新 / 电影胶片 / 城市质感 */
export type VisualStyle = 'NATURAL' | 'FRESH' | 'FILM' | 'URBAN'
export type VideoStatus = 'DRAFT' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type RenderStage = 'PREPARING' | 'STORY' | 'MUSIC' | 'EXPORTING' | 'UPLOADING'
/** 分镜段落类型（旅行路线动画已移除；旧版本冻结的分镜里若还有地图段落，前端会跳过） */
export type SceneType = 'OPENING' | 'PLACE' | 'ENDING'

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
  segments: SegmentOverride[]
  visualStyle?: VisualStyle | null
  /** 背景音乐音量 0–100（已统一响度后的比例），默认 50 */
  musicVolume?: number | null
}

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
    weather?: string
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
  /** 系统曲库音乐（musicSource = SYSTEM）；null / 缺省 = 无音乐 */
  musicCode?: string | null
  /** USER 我的音乐 / null 无音乐；SYSTEM 仅用于历史视频 */
  musicSource?: MusicSource | null
  /** 「我的音乐」的 id（musicSource = USER） */
  userMusicId?: number | null
  coverPhotoId?: number | null
  showText: boolean
  showAchievements: boolean
  settings: StorySettings
  status: VideoStatus
  progress: number
  renderStage?: RenderStage | null
  renderer?: 'MOCK' | 'FFMPEG' | null
  outputUrl?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  /** 生成成功但有降级：MUSIC_FALLBACK = 原选择的音乐不可用，本次已用无音乐生成 */
  renderWarning?: string | null
  photoIds: number[]
  createdAt: string
  updatedAt?: string | null
  completedAt?: string | null
  /** 背景音乐的完整署名（CC BY 4.0 要求）；发布时贴进描述 */
  musicCredit?: string | null
}

/** 编辑器里的「正在配置的视频」，提交时原样转成 UpsertVideoProjectRequest。 */
export type VideoDraft = {
  templateCode: string
  aspectRatio: string
  duration: number
  quality: string
  /** 旧协议保留字段；新草稿始终为 null */
  musicCode: string | null
  /** 音乐来源：USER / null（无音乐）。只保存来源 + id，不保存音乐地址 */
  musicSource: MusicSource | null
  /** 「我的音乐」的 id（musicSource = USER） */
  userMusicId: number | null
  coverPhotoId: number | null
  photoIds: number[]
  settings: StorySettings
}

export type VideoRequest = VideoDraft
