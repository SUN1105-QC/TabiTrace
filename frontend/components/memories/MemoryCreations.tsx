'use client'

/**
 * 回忆作品：聚合已经真实生成的 Travel Story 视频与仍然有效的分享页。
 * 海报、九宫格、每日长图在「分享成果」里即时生成、不保存在服务器上，所以这里不冒充展示，只给出制作入口。
 * 「重新生成」都回到已有的功能页，不另写生成逻辑。
 */

import Link from 'next/link'
import { useState } from 'react'
import { ExternalLink, Eye, Film, Link2, Play, RefreshCw, Settings2 } from 'lucide-react'
import type { Creation } from '@/services/memories'
import { dot } from '@/utils/memories'
import { MemoryCover } from './MemoryCover'

const PAGE = 4

export function MemoryCreations({ creations, latestTripId }: { creations: Creation[]; latestTripId?: number }) {
  const [all, setAll] = useState(false)
  if (!creations.length) return null
  const shown = all ? creations : creations.slice(0, PAGE)
  return (
    <section className="mm-section" id="mm-creations">
      <header className="mm-section-head">
        <div>
          <p className="mm-eyebrow">MEMORY CREATIONS</p>
          <h2>回忆作品</h2>
          <p>旅行结束后生成的 Travel Story 与分享页，都收在这里。</p>
        </div>
        {creations.length > PAGE && <button type="button" className="mm-text-btn" onClick={() => setAll(a => !a)}>{all ? '收起' : `查看全部 ${creations.length} 个`}</button>}
      </header>
      <div className="mm-creations">
        {shown.map(c => {
          const story = c.type === 'STORY'
          return (
            <article key={`${c.type}-${c.id}`} className="mm-card mm-creation">
              <div className="mm-creation-media">
                <MemoryCover src={c.preview} city={c.tripTitle} title={c.tripTitle} />
                <span className="mm-creation-type">{story ? <><Film size={12} /> Travel Story</> : <><Link2 size={12} /> 分享页</>}</span>
                {story && <span className="mm-play"><Play size={16} /></span>}
              </div>
              <div className="mm-creation-body">
                <b>{c.tripTitle}</b>
                <small>{dot(c.createdAt)}{story && c.duration ? ` · ${c.duration} 秒` : ''}{!story ? ` · ${c.views ?? 0} 次浏览` : ''}</small>
                <div className="mm-creation-actions">
                  <a href={c.url} target="_blank" rel="noreferrer" className="mm-text-btn is-brand">{story ? <><Eye size={13} /> 查看</> : <><ExternalLink size={13} /> 打开</>}</a>
                  {story
                    ? <Link href={`/trips/${c.tripId}/video`} className="mm-text-btn"><RefreshCw size={13} /> 重新生成</Link>
                    : <Link href={`/trips/${c.tripId}/share`} className="mm-text-btn"><Settings2 size={13} /> 管理</Link>}
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {latestTripId && (
        <p className="mm-hint">海报、九宫格与每日长图可以在 <Link href={`/trips/${latestTripId}/share`}>分享成果</Link> 里随时生成并导出。</p>
      )}
    </section>
  )
}
