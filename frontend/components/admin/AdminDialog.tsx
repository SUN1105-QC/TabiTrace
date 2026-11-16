'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './admin.module.css'

/** 原生模态框负责焦点约束与背景隔离，关闭后恢复触发按钮的焦点。 */
export function AdminDialog({ title, children, onClose, fullScreen = false }: {
  title: string; children: ReactNode; onClose: () => void; fullScreen?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    ref.current?.showModal()
    const dialog = ref.current
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus() }
  }, [])
  return (
    <dialog ref={ref} className={`${styles.dialog} ${fullScreen ? styles.fullScreen : ''}`}
      aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === event.currentTarget) {
        const box = event.currentTarget.getBoundingClientRect()
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
      } }}>
      <div className={styles.dialogHeading}><h2 id={titleId}>{title}</h2><button type="button" className={styles.iconButton} aria-label="关闭对话框" onClick={onClose}><X size={19} /></button></div>
      <div className={styles.dialogBody}>{children}</div>
    </dialog>
  )
}
