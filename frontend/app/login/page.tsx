'use client'

/**
 * 登录页。
 * - Desktop（≥768px）保持原有“左图 + 右表单”布局，样式全部写在 md: 前缀里。
 * - Mobile（<768px）登录优先：紧凑 Hero（200~210px）+ 轻微上叠的登录卡片，第一屏即可完成登录。
 * 表单元素与注册页共用 components/auth/AuthKit；认证仍走 authApi.login，成功后按 ?next= 或 /trips 跳转。
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Mail } from 'lucide-react'
import { authApi } from '@/services/tabitrace-api'
import { mapLoginError, safeNextPath, validateLoginForm, type LoginField, type LoginFieldErrors } from '@/utils/auth'
import { AuthCardHeader, AuthField, AuthPage, AuthSubmit, AuthSwitch, FormAlert, PasswordField, readNext, useKeyboardSafe, useNextParam, useSignedInRedirect, withNext } from '@/components/auth/AuthKit'

export default function LoginPage() {
  const router = useRouter()
  const [values, setValues] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useSignedInRedirect('/trips')
  const next = useNextParam()
  const inflight = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  useKeyboardSafe(formRef, submitRef)

  const update = (field: LoginField, value: string) => {
    setValues(v => ({ ...v, [field]: value }))
    if (fieldErrors[field]) setFieldErrors(e => ({ ...e, [field]: undefined }))
    if (formError) setFormError('')
  }

  const focusFirstError = (errors: LoginFieldErrors) => {
    if (errors.email) emailRef.current?.focus()
    else if (errors.password) passwordRef.current?.focus()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inflight.current) return // 防止连点或回车重复提交
    const errors = validateLoginForm(values)
    setFieldErrors(errors)
    setFormError('')
    if (errors.email || errors.password) { focusFirstError(errors); return }

    inflight.current = true
    setBusy(true)
    try {
      await authApi.login({ email: values.email.trim(), password: values.password })
      setPhase('redirecting')
      router.push(safeNextPath(next ?? readNext()))
      // 跳转期间保持禁用，避免再次提交
    } catch (error) {
      const mapped = mapLoginError(error)
      setFieldErrors(mapped.fields)
      setFormError(mapped.form)
      setBusy(false)
      inflight.current = false
      if (mapped.fields.email || mapped.fields.password) requestAnimationFrame(() => focusFirstError(mapped.fields))
    }
  }

  const locked = busy || phase !== 'form'
  const status = phase === 'checking' ? '正在确认登录状态…' : phase === 'redirecting' ? '登录成功，正在进入旅迹…' : busy ? '正在登录…' : ''
  const formErrorId = formError ? 'login-form-error' : undefined

  return (
    <AuthPage className="mx-auto grid max-w-6xl px-4 pb-10 pt-3 md:min-h-[78vh] md:items-center md:gap-8 md:px-8 md:py-10 lg:grid-cols-[1fr_.88fr]">
      <div className="relative h-[200px] overflow-hidden rounded-[22px] min-[390px]:h-[210px] md:h-auto md:min-h-[520px] md:rounded-[34px] md:shadow-card">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/explore/ueno-autumn.jpg" />
          <img src="/images/hero-scenery.jpg" alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/5 md:from-black/65 md:via-black/10 md:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-9 text-white [text-shadow:0_1px_12px_rgba(0,0,0,.28)] md:p-8 md:[text-shadow:none]">
          <p className="hidden text-xs font-bold tracking-[.18em] text-white/60 md:block">WELCOME BACK</p>
          <h1 className="font-serif text-[24px] leading-[1.35] min-[390px]:text-[26px] md:mt-3 md:max-w-xl md:text-5xl md:leading-tight">继续记录，<br className="md:hidden" />那些值得回看的旅程。</h1>
          <p className="mt-1.5 text-[13px] leading-6 text-white/80 md:mt-4 md:max-w-lg md:text-sm md:leading-7 md:text-white/70">
            <span className="md:hidden">地图、照片和故事，都在等你回来。</span>
            <span className="hidden md:inline">地图、照片、时间和一句话，会在旅迹里重新连成完整的旅行故事。</span>
          </p>
        </div>
      </div>

      <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="auth-card-title" aria-busy={locked} className="warm-card relative z-10 -mt-6 p-6 md:mt-0 md:p-9">
        <AuthCardHeader
          eyebrow="SIGN IN"
          title={<><span className="md:hidden">欢迎回来</span><span className="hidden md:inline">登录旅迹</span></>}
          sub={<p className="mt-1.5 text-sm text-black/50 md:hidden">登录后继续你的旅行记录。</p>}
        />

        {formError && <FormAlert id="login-form-error">{formError}</FormAlert>}

        <div className="mt-5 space-y-4 md:mt-7">
          <AuthField
            ref={emailRef} id="login-email" name="email" label="邮箱" icon={Mail} type="email" inputMode="email"
            autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="请输入邮箱"
            value={values.email} onChange={e => update('email', e.target.value)}
            disabled={phase !== 'form'} readOnly={busy} error={fieldErrors.email} formErrorId={formErrorId}
          />
          {/* 项目目前没有找回密码的路由与接口，所以这里不放“忘记密码？” */}
          <PasswordField
            ref={passwordRef} id="login-password" name="password" label="密码" icon={LockKeyhole}
            autoComplete="current-password" placeholder="请输入密码"
            value={values.password} onChange={e => update('password', e.target.value)}
            disabled={phase !== 'form'} readOnly={busy} error={fieldErrors.password} formErrorId={formErrorId}
          />
        </div>

        <AuthSubmit
          ref={submitRef} locked={locked} label="登录" status={status}
          lockedLabel={phase === 'checking' ? '正在确认…' : phase === 'redirecting' ? '正在进入…' : '正在登录…'}
        />
        <AuthSwitch prompt="还没有账号？" href={withNext('/register', next)} label="创建账号" />
      </form>
    </AuthPage>
  )
}
