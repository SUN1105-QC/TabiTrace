'use client'

/**
 * 旅迹 Auth Design System：登录、注册、忘记密码（以及以后的重置密码、修改邮箱）共用。
 *
 * 布局（样式见 globals.css 的 au- 前缀，一份响应式规则）：
 * - AuthShell：公共页头 + 统一栅格。<1024px 为紧凑布局（Hero 图 + 上叠卡片）；≥1024px 为左右双栏
 *   · variant="memories"：左侧为暖色面板 + 旅行照片拼贴（登录、找回密码：“回到自己的旅程”）
 *   · variant="product"：左侧为产品预览（注册：“从这里开始一段新的旅迹”）
 * - AuthCard / AuthCardHeader / AuthFooter
 * 表单元素：AuthField / PasswordField / PasswordRuleHint / FormAlert / AuthSubmit / AuthSwitch
 * 行为：useSignedInRedirect（已登录直接跳走）、useKeyboardSafe（软键盘不遮挡）、useNextParam / withNext（保留 ?next=）
 */

import Link from 'next/link'
import { forwardRef, useEffect, useLayoutEffect, useState, type CSSProperties, type FormHTMLAttributes, type InputHTMLAttributes, type ReactNode, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Loader2, type LucideIcon } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { LEGAL_LINKS } from '@/constants/app'
import { userApi } from '@/services/tabitrace-api'
import { hasSession } from '@/services/api'
import { passwordStrength, REGISTER_RULES, safeNextPath } from '@/utils/auth'

export type AuthPhase = 'form' | 'checking' | 'redirecting'

export const readNext = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next'))

/** 挂载后才读取 ?next=，避免服务端与客户端渲染出不同的链接 */
export function useNextParam() {
  const [next, setNext] = useState<string | null>(null)
  useEffect(() => { setNext(readNext()) }, [])
  return next
}

/** 把当前的 ?next= 带到另一页（登录 ↔ 注册 ↔ 找回密码），只带站内路径 */
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

// ---------------------------------------------------------------- 布局

export type AuthHero = {
  eyebrow: string
  title: ReactNode
  /** 桌面端的完整说明 */
  sub: ReactNode
  /** 手机紧凑 Hero 里的一句话（最多一行） */
  subShort: ReactNode
  /** 紧凑 Hero 的背景图（只在 <1024px 时加载） */
  image: string
}

export function AuthShell({ variant, hero, visual, children }: { variant: 'memories' | 'product'; hero: AuthHero; visual?: ReactNode; children: ReactNode }) {
  return (
    <main className="au-page">
      <SiteHeader />
      <section className={`au-shell is-${variant}`}>
        <div className="au-side" style={{ '--au-hero-image': `url(${hero.image})` } as CSSProperties}>
          <div className="au-intro">
            <p className="au-eyebrow">{hero.eyebrow}</p>
            <h1>{hero.title}</h1>
            <p className="au-sub"><span className="au-sub-short">{hero.subShort}</span><span className="au-sub-long">{hero.sub}</span></p>
          </div>
          {/* 桌面端视觉：手机端 display:none，里面的懒加载图片不会被下载 */}
          {visual && <div className="au-visual">{visual}</div>}
        </div>
        <div className="au-main">{children}</div>
      </section>
      <AuthFooter />
    </main>
  )
}

/** 表单卡片：统一圆角、内边距、上叠效果 */
export const AuthCard = forwardRef<HTMLFormElement, FormHTMLAttributes<HTMLFormElement>>(function AuthCard({ className, ...props }, ref) {
  return <form ref={ref} noValidate aria-labelledby="auth-card-title" className={`au-card${className ? ` ${className}` : ''}`} {...props} />
})

export function AuthCardHeader({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <p className="au-card-eyebrow">{eyebrow}</p>
      <h2 id="auth-card-title" className="au-card-title">{title}</h2>
      {sub && <p className="au-card-sub">{sub}</p>}
    </>
  )
}

/** 隐私政策 / 使用条款：只有真实页面存在时才显示（constants/app.ts 的 LEGAL_LINKS） */
export function AuthFooter() {
  if (!LEGAL_LINKS.privacy && !LEGAL_LINKS.terms) return null
  return (
    <footer className="au-footer">
      {LEGAL_LINKS.privacy && <Link href={LEGAL_LINKS.privacy}>隐私政策</Link>}
      {LEGAL_LINKS.terms && <Link href={LEGAL_LINKS.terms}>使用条款</Link>}
    </footer>
  )
}

// ---------------------------------------------------------------- 表单元素

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
  /** label 右侧的操作（例如“忘记密码？”） */
  labelAside?: ReactNode
}

export const AuthField = forwardRef<HTMLInputElement, FieldProps>(function AuthField({ id, label, icon: Icon, error, hint, formErrorId, trailing, labelAside, className, ...input }, ref) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`, formErrorId].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <div className="au-label-row">
        <label htmlFor={id} className="au-label">{label}</label>
        {labelAside}
      </div>
      <div className="au-input-wrap">
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

/** 设置新密码时的规则提示：只展示后端真实规则（至少 8 位），强度仅供参考 */
export function PasswordRuleHint({ value }: { value: string }) {
  const strength = passwordStrength(value)
  const lengthMet = value.length >= REGISTER_RULES.passwordMin && value.length <= REGISTER_RULES.passwordMax
  return (
    <div className="au-pw-meta">
      <span className={lengthMet ? 'is-met' : undefined}><Check size={13} aria-hidden="true" />至少 {REGISTER_RULES.passwordMin} 位</span>
      {strength.level > 0 && (
        <span className="au-strength" data-level={strength.level}>
          <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />强度 {strength.label}<small>（仅供参考）</small>
        </span>
      )}
    </div>
  )
}

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
    <p className="au-switch">
      {prompt}<Link href={href}>{label}</Link>
    </p>
  )
}
