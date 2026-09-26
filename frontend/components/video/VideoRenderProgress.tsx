'use client'

/** 分阶段生成状态：完全由后端 status / renderStage / progress 驱动，前端不做任何计时模拟。 */

import { Check, Circle, LoaderCircle } from 'lucide-react'
import type { VideoProject } from '@/types/video'
import { RENDER_STEPS, isMock, stepStates, utcDate } from '@/utils/video-status'

/** 排队超过这么久还没有被拾取，多半是 video-worker 没有运行 */
const LONG_QUEUE_MS = 60_000

export function VideoRenderProgress({ project }: { project: VideoProject }) {
  const states = stepStates(project)
  const queuedAt = utcDate(project.updatedAt)?.getTime()
  const waitingTooLong = project.status === 'QUEUED' && !!queuedAt && Date.now() - queuedAt > LONG_QUEUE_MS
  return (
    <div className="ts-progress">
      <div className="ts-progress-head">
        <b>{project.status === 'QUEUED' ? '已进入队列，等待渲染…' : '正在生成 Travel Story'}</b>
        <em>{project.progress}%</em>
      </div>
      <div className="ts-progress-bar"><span style={{ width: `${project.progress}%` }} /></div>
      <ol className="ts-steps">
        {RENDER_STEPS.map((s, i) => (
          <li key={s.key} className={`is-${states[i]}`}>
            <span className="ts-step-icon">
              {states[i] === 'done' ? <Check size={12} /> : states[i] === 'active' ? <LoaderCircle size={12} className="animate-spin" /> : <Circle size={9} />}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
      {waitingTooLong && (
        <p className="ts-mock">已经排队超过 1 分钟：视频是逐个生成的，前面可能还有视频在渲染；如果一直不动，请确认视频渲染服务（video-worker）正在运行。</p>
      )}
      {isMock(project) && (
        <p className="ts-mock">Local Mock Renderer · 本地模拟渲染只推进状态，不会生成真实 MP4。启动 video-worker 后才会出片。</p>
      )}
    </div>
  )
}
