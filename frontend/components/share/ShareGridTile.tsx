/**
 * 九宫格的单个方格外壳：统一圆角与裁切，内容类型由 variant 决定底色。
 * 编辑时照片格可以点选（onSelect）：选中的格子描边高亮，再从素材列表里挑照片替换。
 * 导出 PNG 前页面会取消选中，成品里不会出现描边。
 */

import type { ReactNode } from 'react'

export type GridTileVariant = 'title' | 'image' | 'memo' | 'data' | 'footer'

export type GridTileEdit = { active?: boolean; label?: string; onSelect?: () => void }

export function ShareGridTile({ variant, children, edit }: { variant: GridTileVariant; children: ReactNode; edit?: GridTileEdit }) {
  const cls = `sg-tile is-${variant}${edit?.onSelect ? ' is-editable' : ''}${edit?.active ? ' is-active' : ''}`
  if (!edit?.onSelect) return <div className={cls}>{children}</div>
  return (
    <div className={cls} role="button" tabIndex={0} aria-pressed={edit.active} aria-label={edit.label}
      onClick={edit.onSelect} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit.onSelect?.() } }}>
      {children}
    </div>
  )
}
