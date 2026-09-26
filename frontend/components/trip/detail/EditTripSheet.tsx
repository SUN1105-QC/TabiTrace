'use client'

/** 编辑旅行：标题、目的地、日期、同行人数。调用已有的 PUT /trips/{id}，其余字段原样带回。 */

import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { tripApi, type TripView } from '@/services/tabitrace-api'

type Form = { title: string; destinationName: string; startDate: string; endDate: string; peopleCount: string }

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.title.trim()) e.title = '请填写旅行标题'
  else if (f.title.trim().length > 200) e.title = '标题最多 200 个字'
  if (!f.destinationName.trim()) e.destinationName = '请填写目的地'
  if (!f.startDate) e.startDate = '请选择开始日期'
  if (!f.endDate) e.endDate = '请选择结束日期'
  else if (f.startDate && f.endDate < f.startDate) e.endDate = '结束日期不能早于开始日期'
  const n = Number(f.peopleCount)
  if (!Number.isInteger(n) || n < 1 || n > 100) e.peopleCount = '同行人数为 1–100'
  return e
}

export function EditTripSheet({ trip, onClose, onSaved }: { trip: TripView; onClose: () => void; onSaved: (t: TripView) => void }) {
  const titleId = useId()
  const first = useRef<HTMLInputElement | null>(null)
  const [form, setForm] = useState<Form>({ title: trip.title, destinationName: trip.destinationName, startDate: trip.startDate, endDate: trip.endDate, peopleCount: String(trip.peopleCount || 1) })
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const set = (k: keyof Form, v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); setServerError('') }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    setSaving(true)
    try {
      const updated = await tripApi.update(trip.id, {
        title: form.title.trim(), destinationName: form.destinationName.trim(), startDate: form.startDate, endDate: form.endDate,
        peopleCount: Number(form.peopleCount), countryCode: trip.countryCode, city: trip.city, coverImage: trip.coverImage
      })
      onSaved(updated)
    } catch (err) {
      setServerError(err instanceof Error && err.message ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const field = (k: keyof Form, label: string, input: React.InputHTMLAttributes<HTMLInputElement>, ref?: React.Ref<HTMLInputElement>) => (
    <label className="td-field" htmlFor={`td-edit-${k}`}>
      <span>{label}</span>
      <input
        ref={ref}
        id={`td-edit-${k}`}
        className="st-input"
        value={form[k]}
        onChange={e => set(k, e.target.value)}
        aria-invalid={Boolean(errors[k])}
        aria-describedby={errors[k] ? `td-edit-${k}-err` : undefined}
        {...input}
      />
      {errors[k] && <small id={`td-edit-${k}-err`} className="st-field-error" role="alert">⚠ {errors[k]}</small>}
    </label>
  )

  return (
    <div className="td-sheet-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <form className="td-sheet td-edit" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit} noValidate>
        <div className="td-edit-head">
          <h2 id={titleId}>编辑旅行</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭" disabled={saving}><X size={16} /></button>
        </div>
        {field('title', '旅行标题', { maxLength: 200, autoComplete: 'off' }, first)}
        {field('destinationName', '目的地', { maxLength: 200, autoComplete: 'off' })}
        <div className="td-field-row">
          {field('startDate', '开始日期', { type: 'date' })}
          {field('endDate', '结束日期', { type: 'date', min: form.startDate || undefined })}
        </div>
        {field('peopleCount', '同行人数', { type: 'number', min: 1, max: 100, inputMode: 'numeric' })}
        {serverError && <p className="st-field-error" role="alert">⚠ {serverError}</p>}
        <div className="td-edit-actions">
          <button type="button" className="st-btn" onClick={onClose} disabled={saving}>取消</button>
          <button type="submit" className="st-btn is-primary" disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </form>
    </div>
  )
}
