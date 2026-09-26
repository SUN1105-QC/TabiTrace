'use client'

/**
 * 成果卡片的等比缩放框：卡片保持固定设计宽度（导出 PNG 与设计稿一致），
 * 容器比卡片窄时（手机）整体等比缩小到刚好放下，不需要左右滑动；宽度足够时原尺寸居中。
 * 缩放只作用在这一层，导出时截取的是里面未缩放的节点，所以 PNG 仍是原尺寸。
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function ShareScaleFrame({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ scale: 1, height: 0 })

  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const update = () => {
      const scale = i.offsetWidth ? Math.min(1, o.clientWidth / i.offsetWidth) : 1
      setBox({ scale, height: i.offsetHeight * scale })
    }
    update()
    // 外框变宽窄（旋转屏幕）、卡片变高矮（图片加载、切换模式）都重新计算
    const observer = new ResizeObserver(update)
    observer.observe(o)
    observer.observe(i)
    return () => observer.disconnect()
  }, [])

  const scaled = box.scale < 1
  return (
    <div ref={outer} className={`share-scale${scaled ? ' is-scaled' : ''}`} style={{ height: box.height || undefined }}>
      <div ref={inner} className="share-scale-inner" style={scaled ? { transform: `scale(${box.scale})` } : undefined}>
        {children}
      </div>
    </div>
  )
}
