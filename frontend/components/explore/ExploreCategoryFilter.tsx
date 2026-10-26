'use client'

/**
 * 分类胶囊：分类定义只在 utils/explore 的 CATEGORIES 里写一次，Hero 与「全部地点」共用。
 * 旧链接带来的隐藏分类（如 ?filter=FIRST）以一个可清除的胶囊出现。
 */

import { X } from 'lucide-react'
import { CATEGORIES, categoryOf } from '@/utils/explore'

export function ExploreCategoryFilter({ value, onChange, counts, label = '地点分类' }: {
  value: string
  onChange: (key: string) => void
  counts?: Record<string, number>
  label?: string
}) {
  const current = categoryOf(value)
  return (
    <div className="xp-pills" role="group" aria-label={label}>
      {CATEGORIES.filter(c => !c.hidden).map(c => (
        <button key={c.key} type="button" aria-pressed={value === c.key} className={value === c.key ? 'is-active' : ''} onClick={() => onChange(c.key)}>
          {c.label}{counts && c.key !== 'ALL' && <small>{counts[c.key] ?? 0}</small>}
        </button>
      ))}
      {current.hidden && (
        <button type="button" aria-pressed className="is-active" onClick={() => onChange('ALL')} aria-label={`清除分类 ${current.label}`}>
          {current.label}<X size={12} />
        </button>
      )}
    </div>
  )
}
