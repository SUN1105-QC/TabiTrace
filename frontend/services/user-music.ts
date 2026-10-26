/**
 * 「我的音乐」接口。会员、格式、大小、额度、主人校验全部以后端为准，这里的前端检查只是让用户更早看到提示。
 * 上传流程：申请上传地址 → 直传存储（带进度）→ 完成登记（后端读取文件、按内容识别格式与时长）→ READY / FAILED。
 * 前端不会自己拼一条音乐数据：列表与上传结果都来自后端。
 */

import { ApiError, api, jsonBody } from './api'
import type { Membership, UploadUrlResponse, UserMusic, UserMusicLibrary, UserMusicLimits } from '@/types/user-music'

export const membershipApi = {
  current: () => api<Membership>('/membership')
}

export const userMusicApi = {
  library: () => api<UserMusicLibrary>('/user/music'),
  uploadUrl: (input: { fileName: string; contentType: string; fileSize: number; title?: string; copyrightConfirmed: boolean }) =>
    api<UploadUrlResponse>('/user/music/upload-url', { method: 'POST', body: jsonBody(input) }),
  complete: (musicId: number) => api<UserMusic>('/user/music', { method: 'POST', body: jsonBody({ musicId }) }),
  rename: (id: number, title: string) => api<UserMusic>(`/user/music/${id}`, { method: 'PATCH', body: jsonBody({ title }) }),
  remove: (id: number) => api<void>(`/user/music/${id}`, { method: 'DELETE' }),
  playUrl: (id: number) => api<{ url: string; expiresInSeconds: number }>(`/user/music/${id}/play-url`)
}

/** 扩展名 → 标准 MIME。有的系统（例如 Windows 上的 .m4a）浏览器读不到 MIME，用扩展名补上；后端仍会核对文件内容 */
const MIME_BY_EXT: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/x-m4a', wav: 'audio/wav' }

export const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

export const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`

/** 选择文件后的前端检查（扩展名 + MIME + 大小）：通过返回 null，否则返回中文原因 */
export function checkMusicFile(file: File, limits: UserMusicLimits): string | null {
  const ext = extensionOf(file.name)
  if (!limits.extensions.includes(ext)) return `不支持这个文件格式，请选择 ${limits.formats.join(' / ')} 音乐文件`
  const type = (file.type || '').toLowerCase()
  if (type && !type.startsWith('audio/')) return type.startsWith('video/') ? '这是视频文件，请选择纯音频（MP3 / M4A / WAV）' : '这不是音频文件，请选择 MP3 / M4A / WAV'
  if (file.size <= 0) return '文件是空的，请换一个音乐文件'
  if (file.size > limits.maxFileBytes) return `文件超过 ${mb(limits.maxFileBytes)}（当前 ${mb(file.size)}），请压缩后再上传`
  return null
}

export function contentTypeFor(file: File) {
  const type = (file.type || '').toLowerCase()
  return type || MIME_BY_EXT[extensionOf(file.name)] || 'application/octet-stream'
}

export type UploadStage = 'preparing' | 'uploading' | 'processing'

/** 把各种失败翻译成明确的中文提示（不统一显示 Upload Failed） */
export function uploadErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'CUSTOM_MUSIC_REQUIRES_MEMBERSHIP': return e.message || '上传自己的音乐是会员专属功能。'
      case 'USER_MUSIC_TOO_LARGE':
      case 'USER_MUSIC_TYPE_UNSUPPORTED':
      case 'USER_MUSIC_TYPE_MISMATCH':
      case 'USER_MUSIC_LIMIT':
      case 'USER_MUSIC_STORAGE_FULL':
      case 'COPYRIGHT_CONFIRMATION_REQUIRED':
        return e.message
      default:
        return e.status === 0 ? '网络连接中断，请检查网络后重新上传' : e.message || '上传失败，请稍后再试'
    }
  }
  if (e instanceof UploadError) return e.message
  return '网络连接中断，请检查网络后重新上传'
}

export class UploadError extends Error {}

/** 直传存储：用 XHR 才能拿到上传进度 */
function put(url: string, file: File, contentType: string, onProgress: (pct: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else if (xhr.status === 413) reject(new UploadError('文件太大，存储拒绝了这次上传'))
      else if (xhr.status === 403) reject(new UploadError('上传地址已过期，请重新上传'))
      else reject(new UploadError(`音乐存储失败（${xhr.status}），请稍后重新上传`))
    }
    xhr.onerror = () => reject(new UploadError('网络连接中断，音乐没有上传完成，请重新上传'))
    xhr.ontimeout = () => reject(new UploadError('上传超时，请检查网络后重新上传'))
    xhr.onabort = () => reject(new UploadError('已取消上传'))
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(file)
  })
}

/**
 * 上传一首音乐。返回后端登记后的结果（READY 或 FAILED + 原因）；会员 / 格式 / 大小 / 额度不通过时抛 ApiError。
 */
export async function uploadUserMusic(file: File, opts: {
  title?: string
  copyrightConfirmed: boolean
  onStage?: (stage: UploadStage) => void
  onProgress?: (pct: number) => void
  signal?: AbortSignal
}): Promise<UserMusic> {
  opts.onStage?.('preparing')
  const presign = await userMusicApi.uploadUrl({
    fileName: file.name, contentType: contentTypeFor(file), fileSize: file.size,
    title: opts.title?.trim() || undefined, copyrightConfirmed: opts.copyrightConfirmed
  })
  opts.onStage?.('uploading')
  if (!presign.mock) await put(presign.uploadUrl, file, presign.contentType, opts.onProgress ?? (() => {}), opts.signal)
  opts.onProgress?.(100)
  opts.onStage?.('processing')
  return userMusicApi.complete(presign.music.id)
}
