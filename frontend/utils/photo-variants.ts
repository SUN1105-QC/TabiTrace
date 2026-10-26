/**
 * 照片尺寸版本：上传时在浏览器里生成缩略图与中图，列表不加载原图。
 * - thumb：放进 640×640 的框（照片墙 2~4 列、每格约 180~250 CSS px，2~3 倍屏下短边约 480px 足够清晰），JPEG q0.78
 * - medium：放进 1600×1600 的框（详情大图、封面、分享图），JPEG q0.82
 * - original：原图，只用于下载与视频生成
 * 旧照片（没有尺寸版本）自动回退到原图。
 */

export type PhotoSources = { imageUrl: string; thumbUrl?: string | null; mediumUrl?: string | null }

/** 网格、列表里的小图 */
export const photoThumb = (p: PhotoSources) => p.thumbUrl || p.mediumUrl || p.imageUrl
/** 详情、封面、分享图等较大的展示 */
export const photoMedium = (p: PhotoSources) => p.mediumUrl || p.imageUrl

/**
 * 用户照片的 srcset：thumb（640 框）/ medium（1600 框）/ 原图，宽度按原图宽高换算。
 * 配合 sizes 由浏览器按显示宽度和屏幕倍率自己选：小格子拿 thumb，大图拿 medium，
 * 只有 2 倍屏上的整屏大图才会用到原图。原图宽度未知（旧照片）时不放进候选，最大用 medium。
 */
export function photoSrcSet(p: PhotoSources & { width?: number | null; height?: number | null }) {
  const W = p.width ?? 0, H = p.height ?? 0
  const fit = (box: number) => (W && H ? Math.max(1, Math.round(W * Math.min(1, box / Math.max(W, H)))) : box)
  const parts: string[] = []
  if (p.thumbUrl) parts.push(`${p.thumbUrl} ${fit(VARIANT_SPECS.thumb.box)}w`)
  if (p.mediumUrl) parts.push(`${p.mediumUrl} ${fit(VARIANT_SPECS.medium.box)}w`)
  if (W && p.imageUrl) parts.push(`${p.imageUrl} ${W}w`)
  return parts.length > 1 ? parts.join(', ') : undefined
}

/** 旅行封面保存的是中图地址（旧数据是原图地址）：两种都算是这张照片 */
export const isCoverPhoto = (cover: string | null | undefined, p: PhotoSources) => Boolean(cover) && (cover === p.imageUrl || (!!p.mediumUrl && cover === p.mediumUrl))

export const VARIANT_SPECS = {
  thumb: { box: 640, quality: 0.78 },
  medium: { box: 1600, quality: 0.82 }
} as const
export type VariantName = keyof typeof VARIANT_SPECS

/** 按长边缩放到 box 以内（不放大） */
export function fitWithin(width: number, height: number, box: number) {
  const scale = Math.min(1, box / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * 生成缩略图与中图。浏览器解码不了（如 HEIC）或出错时返回 null，调用方照常只上传原图。
 * createImageBitmap 默认按 EXIF 方向摆正，生成的 JPEG 不带 EXIF（也就不含 GPS 等隐私信息）。
 */
export async function makePhotoVariants(file: Blob): Promise<{ width: number; height: number; thumb: Blob; medium: Blob } | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const out = {} as Record<VariantName, Blob>
    for (const name of ['thumb', 'medium'] as VariantName[]) {
      const spec = VARIANT_SPECS[name]
      const size = fitWithin(bitmap.width, bitmap.height, spec.box)
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap, 0, 0, size.width, size.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', spec.quality))
      if (!blob) return null
      out[name] = blob
    }
    return { width: bitmap.width, height: bitmap.height, ...out }
  } catch {
    return null
  } finally {
    bitmap?.close()
  }
}
