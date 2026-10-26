'use client'

/** 只有存在未保存修改时出现；保存失败时保留修改并显示原因 */

import { Loader2, TriangleAlert } from 'lucide-react'
import { useT } from '@/components/common/PreferencesProvider'

export function UnsavedChangesBar({ count, saving, error, onCancel, onSave }: { count: number; saving: boolean; error: string; onCancel: () => void; onSave: () => void }) {
  const t = useT()
  return (
    <div className={`st-unsaved${error ? ' has-error' : ''}`} role="region" aria-label={t('settings.unsaved.region')}>
      <p aria-live="polite">
        {error
          ? <><TriangleAlert size={15} /> {t('settings.unsaved.failed')}<small>{error}</small></>
          : <>{t('settings.unsaved.title')}<small>{t('settings.unsaved.count', { count })}</small></>}
      </p>
      <div className="st-unsaved-actions">
        <button type="button" className="st-btn is-quiet" onClick={onCancel} disabled={saving}>{t('settings.unsaved.discard')}</button>
        <button type="button" className="st-btn is-primary" onClick={onSave} disabled={saving}>
          {saving ? <><Loader2 size={14} className="st-spin" /> {t('common.saving')}</> : t('common.saveChanges')}
        </button>
      </div>
    </div>
  )
}
