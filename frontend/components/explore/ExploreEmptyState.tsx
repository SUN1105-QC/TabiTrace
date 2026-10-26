'use client'

/** 空状态与错误状态：搜索 / 筛选没有结果、某个区域没有地点、地点加载失败。 */

import { RefreshCcw, SearchX, TriangleAlert } from 'lucide-react'

export function ExploreEmptyState({ kind, onAction }: { kind: 'search' | 'area' | 'error'; onAction?: () => void }) {
  if (kind === 'error') {
    return (
      <div className="xp-empty is-error" role="alert">
        <TriangleAlert size={22} />
        <p>地点加载失败</p>
        {onAction && <button type="button" className="xp-btn" onClick={onAction}><RefreshCcw size={14} /> 重新加载</button>}
      </div>
    )
  }
  return (
    <div className="xp-empty" role="status">
      <SearchX size={22} />
      {kind === 'area' ? <p>这个区域暂时没有推荐地点。</p> : <><p>没有找到符合条件的地点</p><small>换个关键词或筛选条件试试。</small></>}
      {onAction && <button type="button" className="xp-btn" onClick={onAction}>清除筛选</button>}
    </div>
  )
}
