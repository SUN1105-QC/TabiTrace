'use client'

import Image from 'next/image'
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import styles from './CountryExploreDirectory.module.css'

/** 只接收站内绝对路径或 HTTPS 图片，拒绝协议相对地址、显式的 .. 路径和其他 URL 协议。 */
export function safeExploreImage(value?: string | null) {
  if (!value) return null
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('..')) return value
  try { return new URL(value).protocol === 'https:' ? value : null } catch { return null }
}

/** 标识跟随实际显示的图片：真实封面失败切到设计包插画时，也必须显示风格示意提示。 */
export function ExploreVisual({ primary, fallback, label, className = '', priority = false, caption }: {
  primary?: string | null; fallback?: string; label: string; className?: string; priority?: boolean; caption?: string
}) {
  const [failed, setFailed] = useState<string[]>([])
  const sources = [safeExploreImage(primary), safeExploreImage(fallback)].filter((s): s is string => !!s)
  // 失败集合按地址记录：每个候选只尝试一次，全部失败后显示中性占位，避免反复加载坏图。
  const source = sources.find(s => !failed.includes(s))
  const illustrated = source?.startsWith('/assets/explore/')
  return <div className={`${styles.visual} ${className}`} data-visual-source={illustrated ? 'illustration' : source ? 'cover' : 'placeholder'}>
    {source ? <Image key={source} src={source} alt={`${label}${illustrated ? ' · 风格示意图' : ''}`} fill unoptimized
      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailed(current => current.includes(source) ? current : [...current, source])} />
      : <div className={styles.imageFallback}><MapPin size={28} aria-hidden="true" /><span>{label}</span></div>}
    {illustrated && <span className={styles.illustrationBadge}>AI 风格示意</span>}
    {caption && <span className={styles.imageCaption}>{caption}</span>}
  </div>
}
