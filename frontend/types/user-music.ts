/** 账号会员与「我的音乐」（会员上传的自定义音乐）。数值限制全部来自后端，前端不写死。 */

export type MembershipStatus = 'NONE' | 'ACTIVE' | 'EXPIRED'
/** 会员权益：目前只有自定义音乐 */
export type MembershipFeature = 'CUSTOM_MUSIC'

export type Membership = {
  status: MembershipStatus
  /** LIFETIME（买断终身 Pro）/ SUBSCRIPTION / GRANT */
  source?: string | null
  startedAt?: string | null
  /** 为空且 ACTIVE = 永久 */
  expiresAt?: string | null
  lifetime: boolean
  features: MembershipFeature[]
}

export type UserMusicStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETED'

export type UserMusic = {
  id: number
  title: string
  originalFilename: string
  format?: 'MP3' | 'M4A' | 'WAV' | null
  mimeType: string
  fileSize: number
  durationSeconds?: number | null
  status: UserMusicStatus
  failureCode?: string | null
  /** 失败原因（中文，可直接展示） */
  failureMessage?: string | null
  createdAt: string
  updatedAt?: string | null
}

export type UserMusicLimits = {
  maxFileBytes: number
  maxTracks: number
  maxTotalBytes: number
  minDurationSeconds: number
  maxDurationSeconds: number
  formats: string[]
  extensions: string[]
  mimeTypes: string[]
}

export type UserMusicLibrary = {
  membership: Membership
  /** 由后端按会员状态给出；会员到期后只读：可以查看、试听、删除 */
  canUpload: boolean
  canUse: boolean
  limits: UserMusicLimits
  usage: { tracks: number; bytes: number }
  items: UserMusic[]
}

export type UploadUrlResponse = {
  music: UserMusic
  uploadUrl: string
  /** 上传时必须带的 Content-Type（预签名地址签入了它） */
  contentType: string
  expiresInSeconds: number
  mock: boolean
}
