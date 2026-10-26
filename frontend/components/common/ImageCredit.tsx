/**
 * 官方景点图片的署名：作者 · 许可证 · 来源（Wikimedia Commons）。
 * CC BY / CC BY-SA 要求在使用处署名并给出许可证；卡片上不放，地点详情、专题详情和「图片来源与授权」页里完整列出。
 * 不是官方高清图（用户照片等）时不显示。
 */

import { imageCredit } from '@/utils/place-images'

export function ImageCredit({ url, label = '图片' }: { url?: string | null; label?: string }) {
  const c = imageCredit(url)
  if (!c) return null
  return (
    <p className="img-credit">
      {label}：<a href={c.sourcePage} target="_blank" rel="noopener noreferrer">{c.author ?? 'Wikimedia Commons 贡献者'}</a>
      {' · '}{c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer license">{c.license}</a> : c.license}
      {' · Wikimedia Commons'}
    </p>
  )
}
