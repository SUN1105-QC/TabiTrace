/**
 * 分享图的 Free / Pro 导出规格（来自后端方案配置 GET /plans/trip-pro 的 shareFree / sharePro）：
 * - Free：标准清晰度，导出的每张图片右下角加「旅迹 TabiTrace」水印
 * - Trip Pro：高清，不加水印，成品里也不显示品牌署名
 * 方案配置读不到时用下面的默认值（与后端常量一致），不会因为网络问题让 Free 旅行拿到 Pro 规格。
 */

import type { TripView } from '@/services/tabitrace-api'
import type { ShareTier, TripProPlan } from '@/utils/plan'

export const DEFAULT_SHARE_FREE: ShareTier = { quality: 'STANDARD', posterWidth: 1080, scale: 1, tileSize: 720, watermark: true }
export const DEFAULT_SHARE_PRO: ShareTier = { quality: 'HD', posterWidth: 1440, scale: 2, tileSize: 1080, watermark: false }

export function shareTierOf(trip: Pick<TripView, 'planType'> | null | undefined, plan?: TripProPlan | null): ShareTier {
  const pro = trip?.planType === 'PRO'
  return (pro ? plan?.sharePro : plan?.shareFree) ?? (pro ? DEFAULT_SHARE_PRO : DEFAULT_SHARE_FREE)
}

const WATERMARK = '旅迹 TabiTrace'

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('水印添加失败'))
    img.src = src
  })
}

/** 在图片右下角画水印：字号按图片短边缩放，半透明白字加暗色描边，浅色和深色背景上都看得清 */
async function stamp(src: string) {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('水印添加失败')
  ctx.drawImage(img, 0, 0)
  const size = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.032))
  const pad = Math.round(size * 0.9)
  ctx.font = `600 ${size}px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(2, size * 0.14)
  ctx.strokeStyle = 'rgba(40, 28, 20, .35)'
  ctx.fillStyle = 'rgba(255, 255, 255, .82)'
  ctx.strokeText(WATERMARK, canvas.width - pad, canvas.height - pad)
  ctx.fillText(WATERMARK, canvas.width - pad, canvas.height - pad)
  return canvas
}

export async function watermarkDataUrl(dataUrl: string) {
  return (await stamp(dataUrl)).toDataURL('image/png')
}

export async function watermarkBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  try {
    const canvas = await stamp(url)
    const out = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!out) throw new Error('水印添加失败')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
