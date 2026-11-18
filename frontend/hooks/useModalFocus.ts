'use client'

import { useEffect, type RefObject } from 'react'

/** 旧版 div 模态框共用的焦点边界；只在挂载时锁定背景，切换照片不反复抢焦点。 */
export function useModalFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const panel = ref.current
    if (!panel) return
    const opener = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () => [...panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el => el.getClientRects().length > 0)
    ;(panel.querySelector<HTMLElement>('[data-modal-initial-focus]') ?? controls()[0])?.focus()
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const all = controls(), first = all[0], last = all.at(-1)
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { e.preventDefault(); first?.focus() }
    }
    panel.addEventListener('keydown', trap)
    return () => {
      panel.removeEventListener('keydown', trap)
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [ref])
}
