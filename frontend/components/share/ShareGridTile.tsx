/** 九宫格的单个方格外壳：统一圆角与裁切，内容类型由 variant 决定底色。 */

import type { ReactNode } from 'react'

export type GridTileVariant = 'title' | 'image' | 'memo' | 'data' | 'footer'

export function ShareGridTile({ variant, children }: { variant: GridTileVariant; children: ReactNode }) {
  return <div className={`sg-tile is-${variant}`}>{children}</div>
}
