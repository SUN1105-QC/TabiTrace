/** Travel Story 接口。模板来自后端目录；音乐使用用户上传的 /user/music。 */

import { api, jsonBody } from './api'
import type { Storyboard, VideoDraft, VideoProject, VideoTemplate } from '@/types/video'

export const videoApi = {
  templates: () => api<VideoTemplate[]>('/video-templates'),

  list: (tripId: number) => api<VideoProject[]>(`/trips/${tripId}/video-projects`),
  get: (id: number) => api<VideoProject>(`/video-projects/${id}`),
  create: (tripId: number, draft: VideoDraft) =>
    api<VideoProject>(`/trips/${tripId}/video-projects`, { method: 'POST', body: jsonBody(draft) }),
  update: (id: number, draft: VideoDraft) =>
    api<VideoProject>(`/video-projects/${id}`, { method: 'PUT', body: jsonBody(draft) }),

  /** 未保存设置的分镜预览 */
  preview: (tripId: number, draft: VideoDraft) =>
    api<Storyboard>(`/trips/${tripId}/video-storyboard`, { method: 'POST', body: jsonBody(draft) }),
  storyboard: (id: number) => api<Storyboard>(`/video-projects/${id}/storyboard`),

  /** 开始生成；FAILED 时即重试，COMPLETED 时即按原设置重新生成 */
  render: (id: number) => api<VideoProject>(`/video-projects/${id}/render`, { method: 'POST' }),
  duplicate: (id: number) => api<VideoProject>(`/video-projects/${id}/duplicate`, { method: 'POST' }),
  remove: (id: number) => api<void>(`/video-projects/${id}`, { method: 'DELETE' })
}
