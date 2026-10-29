/** Travel Story 前后端共用的数据结构（与 backend VideoDtos 一一对应）。 */

export type Plan = 'FREE' | 'PRO'
/** 音乐来源：SYSTEM = 旅迹音乐（系统曲库），USER = 我的音乐（会员上传） */
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

/** 旅行氛围分类（后台可调整曲目所属分类，前端只认这 5 个） */
export type MusicCategory = 'WARM' | 'CITY_NIGHT' | 'MORNING' | 'LOFI' | 'CINEMATIC'
export type MusicEnergy = 'LOW' | 'MEDIUM' | 'HIGH'

/** 选择器里的曲目：只有 45 秒试听片段地址（previewUrl），原曲存储路径不会下发到浏览器 */
export type VideoMusic = {
  code: string
  name: string
  category: MusicCategory
  mood: string
  durationSeconds?: number | null
  plan: Plan
  /** 推荐模板（JOURNAL / MINIMAL / CITY） */
  recommendedTemplates: string[]
  artist?: string | null
  moods: string[]
  instruments: string[]
  bpm?: number | null
  energy?: MusicEnergy | null
  essential: boolean
  previewUrl?: string | null
  attributionRequired: boolean
  attributionText?: string | null
  /** 授权协议，例如 CC BY 4.0 / CC0 1.0 */
  license?: string | null
  licenseUrl?: string | null
  source?: string | null
  sourceUrl?: string | null
  commercialUse: boolean
  derivativesAllowed: boolean
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
  /** 音乐来源：SYSTEM 旅迹音乐 / USER 我的音乐 / null 无音乐 */
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
  /** 旅迹音乐代码（musicSource = SYSTEM）；null = 无音乐 */
  musicCode: string | null
  /** 音乐来源：SYSTEM / USER / null（无音乐）。只保存来源 + id，不保存音乐地址 */
  musicSource: MusicSource | null
  /** 「我的音乐」的 id（musicSource = USER） */
  userMusicId: number | null
  coverPhotoId: number | null
  photoIds: number[]
  settings: StorySettings
}

export type VideoRequest = VideoDraft
