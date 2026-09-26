'use client'

/**
 * 设置中心的基础件：一个 Section 卡片里放多行 SettingsRow（左侧名称说明、右侧控件），
 * 加上可访问的 Switch 与确认对话框（复用站内 modal 样式）。
 */

import type { ReactNode } from 'react'

export { ConfirmDialog } from '@/components/common/ConfirmDialog'

export function SettingsSection({ title, description, children, tone, action }: { title: string; description?: string; children: ReactNode; tone?: 'danger'; action?: ReactNode }) {
  return (
    <section className={`st-section${tone === 'danger' ? ' is-danger' : ''}`}>
      <header className="st-section-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      <div className="st-rows">{children}</div>
    </section>
  )
}

/** label 与控件通过 htmlFor 关联；describedBy 串起说明和错误，屏幕阅读器会一起读出 */
export function SettingsRow({ label, description, htmlFor, error, errorId, children, stack }: {
  label: string
  description?: ReactNode
  htmlFor?: string
  error?: string
  errorId?: string
  children: ReactNode
  stack?: boolean
}) {
  return (
    <div className={`st-row${stack ? ' is-stack' : ''}${error ? ' has-error' : ''}`}>
      <div className="st-row-text">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="st-row-label">{label}</span>}
        {description && <p id={htmlFor ? `${htmlFor}-desc` : undefined}>{description}</p>}
      </div>
      <div className="st-row-control">
        {children}
        {error && <p className="st-field-error" id={errorId} role="alert">⚠ {error}</p>}
      </div>
    </div>
  )
}

export function Switch({ id, checked, onChange, label, disabled, busy, describedBy }: { id?: string; checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; busy?: boolean; describedBy?: string }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      disabled={disabled}
      className={`st-switch${checked ? ' is-on' : ''}${busy ? ' is-busy' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="st-switch-knob" aria-hidden="true" />
      <span className="st-switch-text" aria-hidden="true">{checked ? '开' : '关'}</span>
    </button>
  )
}

export function Avatar({ name, url, size = 56 }: { name: string; url?: string | null; size?: number }) {
  const initial = Array.from(name.trim() || '旅')[0]
  return url
    ? <img className="st-avatar" src={url} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="st-avatar is-initial" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">{initial}</span>
}
