'use client'

/**
 * 站内通用确认对话框（复用 modal-backdrop / modal-panel 样式）。
 * Esc 或点击遮罩等于“取消”，打开时聚焦第一个操作按钮。按钮建议使用 st-btn 样式。
 */

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function ConfirmDialog({ title, body, actions, onCancel }: { title: string; body: ReactNode; actions: ReactNode; onCancel: () => void }) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('.st-dialog-actions button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal-panel st-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="关闭"><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="st-dialog-body">{body}</div>
          <div className="st-dialog-actions">{actions}</div>
        </div>
      </div>
    </div>
  )
}
