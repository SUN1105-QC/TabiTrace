'use client'

/**
 * 分享成果「查看大图」：全屏深色遮罩里重新渲染一份成品（不可编辑），默认完整适应屏幕；
 * 特别长的成品（每日长图）默认按宽度适应、上下滑动。「原始大小」按设计尺寸显示，可上下左右滑动查看细节。
 * Esc、点遮罩空白处或关闭按钮退出；打开时锁定页面滚动，关闭后焦点回到「查看大图」按钮。
 * 图片与页面里的预览是同一批地址，浏览器已缓存，不会重新下载。
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minimize2, X } from 'lucide-react'

/** 高宽比超过这个值时，「适应屏幕」改为按宽度适应（否则长图会缩得看不清） */
const TALL_RATIO = 2.2
const GUTTER = 16

export function SharePreviewLightbox({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const [actual, setActual] = useState(false)
  const [box, setBox] = useState({ scale: 0, w: 0, h: 0 })

  // 锁定背景滚动、Esc 关闭、焦点进出
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [onClose])

  // 按可用空间计算缩放：内容尺寸变化（图片加载）或窗口变化（旋转屏幕）时重新计算
  useLayoutEffect(() => {
    const v = viewport.current
    const c = content.current
    if (!v || !c) return
    const update = () => {
      const w = c.offsetWidth
      const h = c.offsetHeight
      if (!w || !h) return
      const availW = v.clientWidth - GUTTER * 2
      const availH = v.clientHeight - GUTTER * 2
      const fitWidth = availW / w
      const scale = actual ? 1 : h / w > TALL_RATIO ? Math.min(1, fitWidth) : Math.min(1, fitWidth, availH / h)
      setBox({ scale, w, h })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(v)
    observer.observe(c)
    return () => observer.disconnect()
  }, [actual])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="ss-lightbox" role="dialog" aria-modal="true" aria-label={`查看大图：${title}`}>
      <div className="ss-lightbox-bar">
        <b>{title}</b>
        <button type="button" onClick={() => setActual(a => !a)} aria-pressed={actual}>
          {actual ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}{actual ? '适应屏幕' : '原始大小'}
        </button>
        <button type="button" ref={closeBtn} onClick={onClose} aria-label="关闭大图"><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="ss-lightbox-view" ref={viewport} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
        {/* 外层占位按缩放后的尺寸排版，滚动范围与看到的一致 */}
        <div className="ss-lightbox-stage" style={{ width: box.w * box.scale || undefined, height: box.h * box.scale || undefined, visibility: box.scale ? 'visible' : 'hidden' }}>
          <div className="ss-lightbox-content" ref={content} style={{ transform: `scale(${box.scale || 1})` }}>
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
