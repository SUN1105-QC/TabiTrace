'use client'

import { useEffect, useState } from 'react'
import { planApi } from '@/services/tabitrace-api'

/**
 * 是否「全部功能免费开放」：来自公开方案接口 GET /plans/trip-pro 的 openAccess。
 * 同一页面会话里只请求一次；读取失败按未开放处理（照旧显示升级入口），不影响页面其他内容。
 */
let cached: Promise<boolean> | null = null

export function loadOpenAccess(): Promise<boolean> {
  cached ??= planApi.tripPro().then(p => Boolean(p.openAccess)).catch(() => { cached = null; return false })
  return cached
}

export function useOpenAccess(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let alive = true
    void loadOpenAccess().then(v => { if (alive) setOpen(v) })
    return () => { alive = false }
  }, [])
  return open
}
