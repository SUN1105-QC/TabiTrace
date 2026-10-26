/**
 * 海报底部：编号 · 城市英文名 —— 细线 —— Made with 旅迹 TabiTrace。
 * 免费旅行保留署名；Trip Pro 去水印时由分享工作台的 .ss-no-brand 隐藏署名（九宫格、每日长图、旅行手帐同理）。
 */

import type { PosterData } from '@/utils/poster-data'

export function PosterFooter({ data }: { data: PosterData }) {
  return (
    <footer className="cp-foot">
      <span>No.{data.tripNumber} · {data.placeEn.toUpperCase()}</span>
      <i />
      <span className="cp-foot-brand">Made with <b>旅迹 TabiTrace</b></span>
    </footer>
  )
}
