/**
 * 分享图共用的小工具：日本城市的日文汉字写法、路线图背景的道路纹理。
 * 城市海报的数据整理见 utils/poster-data.ts。
 */

import type { TripView } from '@/services/tabitrace-api'
import { cityOf } from '@/utils/share-long'

/** 日本城市在海报上用日文汉字竖排（東京、横浜…），其余城市保持原名 */
const JA_KANJI: Record<string, string> = { 东京: '東京', 横滨: '横浜', 福冈: '福岡', 冲绳: '沖縄', 神户: '神戸', 广岛: '広島', 镰仓: '鎌倉', 箱根: '箱根' }
export const cityKanji = (trip: TripView) => JA_KANJI[cityOf(trip)] ?? cityOf(trip)

/** 地图背景的道路纹理：由旅行 id 决定的伪随机曲线，同一趟旅行每次导出都一样 */
export function roadTexture(seed: number, width: number, height: number, count = 9) {
  let s = seed * 9301 + 49297
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  return Array.from({ length: count }, (_, i) => {
    const horizontal = i % 2 === 0
    const a = rand() * (horizontal ? height : width), b = rand() * (horizontal ? height : width)
    const c1 = rand() * (horizontal ? height : width), c2 = rand() * (horizontal ? height : width)
    return horizontal
      ? `M -10 ${a.toFixed(1)} C ${(width * 0.33).toFixed(1)} ${c1.toFixed(1)}, ${(width * 0.66).toFixed(1)} ${c2.toFixed(1)}, ${width + 10} ${b.toFixed(1)}`
      : `M ${a.toFixed(1)} -10 C ${c1.toFixed(1)} ${(height * 0.33).toFixed(1)}, ${c2.toFixed(1)} ${(height * 0.66).toFixed(1)}, ${b.toFixed(1)} ${height + 10}`
  })
}
