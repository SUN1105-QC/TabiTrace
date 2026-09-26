'use client'

/** 只有存在未保存修改时出现；保存失败时保留修改并显示原因 */

import { Loader2, TriangleAlert } from 'lucide-react'

export function UnsavedChangesBar({ count, saving, error, onCancel, onSave }: { count: number; saving: boolean; error: string; onCancel: () => void; onSave: () => void }) {
  return (
    <div className={`st-unsaved${error ? ' has-error' : ''}`} role="region" aria-label="未保存的更改">
      <p aria-live="polite">
        {error
          ? <><TriangleAlert size={15} /> 设置保存失败，请重试。<small>{error}</small></>
          : <>有尚未保存的更改<small>{count} 项</small></>}
      </p>
      <div className="st-unsaved-actions">
        <button type="button" className="st-btn is-quiet" onClick={onCancel} disabled={saving}>取消更改</button>
        <button type="button" className="st-btn is-primary" onClick={onSave} disabled={saving}>
          {saving ? <><Loader2 size={14} className="st-spin" /> 保存中…</> : '保存更改'}
        </button>
      </div>
    </div>
  )
}
