'use client'

import { useSyncExternalStore } from 'react'

/** 订阅一条媒体查询；服务端渲染与首帧按 false（桌面布局）处理，挂载后立即对齐真实视口。 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    notify => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
