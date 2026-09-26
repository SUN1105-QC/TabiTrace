'use client'

/**
 * 登录 / 注册共用的 Auth 组件与行为：
 * - AuthPage：页面外壳（公共页头 + 内容区），两种布局各自传入栅格样式
 * - AuthCardHeader / AuthField / PasswordField / FormAlert / AuthSubmit / AuthSwitch：表单卡片里的统一元素
 * - useSignedInRedirect：已登录用户打开登录 / 注册页时，确认会话有效后直接跳走
 * - useKeyboardSafe：软键盘弹起时，让当前输入框和提交按钮留在可见区域
 */

import Link from 'next/link'
import { forwardRef, useEffect, useLayoutEffect, useState, type InputHTMLAttributes, type ReactNode, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, type LucideIcon } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { userApi } from '@/services/tabitrace-api'
import { hasSession } from '@/services/api'
import { safeNextPath } from '@/utils/auth'

export type AuthPhase = 'form' | 'checking' | 'redirecting'

export const readNext = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next'))

/** 挂载后才读取 ?next=，避免服务端与客户端渲染出不同的链接 */
export function useNextParam() {
  const [next, setNext] = useState<string | null>(null)
  useEffect(() => { setNext(readNext()) }, [])
  return next
}

/** 把当前的 ?next= 带到另一页（登录 ↔ 注册），只带站内路径 */
export function withNext(path: string, next: string | null) {
  const safe = next ? safeNextPath(next, '') : ''
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path
}

export function useSignedInRedirect(fallback: string) {
  const router = useRouter()
  const [phase, setPhase] = useState<AuthPhase>('form')
  useLayoutEffect(() => {
    if (!hasSession()) return
    setPhase('checking')
    let alive = true
    // 会话失效时 api 层会清掉令牌并抛错，这里回到表单
    userApi.me()
      .then(() => { if (!alive) return; setPhase('redirecting'); router.replace(safeNextPath(readNext(), fallback)) })
      .catch(() => { if (alive) setPhase('form') })
    return () => { alive = false }
  }, [router, fallback])
  return [phase, setPhase] as const
}

export function useKeyboardSafe(formRef: RefObject<HTMLFormElement | null>, submitRef: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const active = document.activeElement
      if (!(active instanceof HTMLInputElement) || !formRef.current?.contains(active)) return
      submitRef.current?.scrollIntoView({ block: 'nearest' })
      // 优先保证当前输入框可见
      if (active.getBoundingClientRect().top < vv.offsetTop + 8) active.scrollIntoView({ block: 'nearest' })
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [formRef, submitRef])
}

export function AuthPage({ className, children }: { className: string; children: ReactNode }) {
  return (
    <main>
      <SiteHeader />
      <section className={className}>{children}</section>
    </main>
  )
}

export function AuthCardHeader({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <p className="text-xs font-bold tracking-[.18em] text-warm">{eyebrow}</p>
      <h2 id="auth-card-title" className="mt-2 font-serif text-[28px] leading-tight md:text-4xl">{title}</h2>
      {sub}
    </>
  )
}

export function FormAlert({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="alert" id={id} className="au-alert">
      <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string
  label: string
  icon: LucideIcon
  error?: ReactNode
  /** 字段下方的说明（错误出现时仍保留，便于理解规则） */
  hint?: ReactNode
  /** 表单级错误的 id，一并关联到输入框 */
  formErrorId?: string
  trailing?: ReactNode
}

export const AuthField = forwardRef<HTMLInputElement, FieldProps>(function AuthField({ id, label, icon: Icon, error, hint, formErrorId, trailing, className, ...input }, ref) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`, formErrorId].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink/80">{label}</label>
      <div className="relative mt-2">
        <Icon size={17} aria-hidden="true" className="au-icon" />
        <input ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={`au-input${trailing ? ' has-toggle' : ''}${className ? ` ${className}` : ''}`} {...input} />
        {trailing}
      </div>
      {error && <p id={`${id}-error`} className="au-error"><AlertCircle size={13} aria-hidden="true" className="shrink-0" /><span>{error}</span></p>}
      {hint && <div id={`${id}-hint`} className="au-hint">{hint}</div>}
    </div>
  )
})

export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, 'type' | 'trailing'>>(function PasswordField(props, ref) {
  const [show, setShow] = useState(false)
  return (
    <AuthField
      ref={ref} {...props} type={show ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false}
      trailing={
        <button
          type="button" onClick={() => setShow(v => !v)} disabled={props.disabled}
          aria-label={show ? '隐藏密码' : '显示密码'} aria-pressed={show} aria-controls={props.id}
          className="au-toggle"
        >
          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
    />
  )
})

export const AuthSubmit = forwardRef<HTMLButtonElement, { locked: boolean; label: string; lockedLabel: string; status: string }>(function AuthSubmit({ locked, label, lockedLabel, status }, ref) {
  return (
    <>
      <button ref={ref} type="submit" disabled={locked} aria-disabled={locked} className="au-submit">
        {locked
          ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" />{lockedLabel}</>
          : <>{label} <ArrowRight size={17} aria-hidden="true" /></>}
      </button>
      {/* 给读屏软件的状态播报 */}
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
    </>
  )
})

export function AuthSwitch({ prompt, href, label }: { prompt: string; href: string; label: string }) {
  return (
    <p className="mt-4 text-center text-[13px] text-black/45 md:mt-5 md:text-xs">
      {prompt}<Link href={href} className="inline-flex min-h-11 items-center px-1 font-bold text-warm">{label}</Link>
    </p>
  )
}
