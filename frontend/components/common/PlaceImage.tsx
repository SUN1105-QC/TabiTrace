'use client'

/**
 * 景点图片：next/image（fill）+ 自定义 loader，按 sizes 从 640 / 1280 / 1920 / 2560 四档里挑，
 * 不经过 Next 的运行时图片优化（档位在构建前已经生成好，也方便以后放到 CDN）。
 * - 父元素负责固定宽高比（aspect-ratio）并设为 position: relative，加载前后高度不变
 * - 加载失败时换成统一占位图；开发环境在控制台提示路径错误，不会悄悄隐藏
 * - 不是官方高清图的地址（例如旧数据、用户封面）照常显示，只是不做多档选择
 */

import Image, { type ImageLoaderProps } from 'next/image'
import { useState } from 'react'
import { PLACE_IMAGE_FALLBACK, hdVariant, imageFocus, isHdImage } from '@/utils/place-images'

const hdLoader = ({ src, width }: ImageLoaderProps) => hdVariant(src, width)

export function PlaceImage({ src, alt, sizes, eager = false, className }: {
  src: string
  alt: string
  /** 与布局一致的显示宽度，例如卡片 "(max-width: 767px) 100vw, (max-width: 1366px) 33vw, 25vw" */
  sizes: string
  /** 首屏的 Hero / 第一张推荐：立即加载并提高优先级；其余默认懒加载 */
  eager?: boolean
  className?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const url = failedSrc === src ? PLACE_IMAGE_FALLBACK : src
  const hd = isHdImage(url)
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      loader={hd ? hdLoader : undefined}
      unoptimized={!hd}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      className={className}
      style={{ objectFit: 'cover', objectPosition: imageFocus(url) }}
      onError={() => {
        if (failedSrc === src) return
        if (process.env.NODE_ENV !== 'production') console.warn(`[PlaceImage] 图片加载失败，已换成占位图：${src}`)
        setFailedSrc(src)
      }}
    />
  )
}
