'use client'

/**
 * 忘记密码：邮箱 → 获取验证码（purpose=reset_password）→ 验证 → 设置新密码 → 直接登录。
 * 复用注册页同一套邮箱验证码组件与 AuthShell（variant="memories"，与登录页属于同一阶段：“回到自己的旅程”）。
 * 后端对“邮箱是否注册”给出一致的响应，未注册的邮箱只会收到一封说明邮件；重置成功后其他设备全部退出登录。
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'
import { authApi } from '@/services/tabitrace-api'
import { mapResetError, safeNextPath, validateResetForm, type ResetField, type ResetFieldErrors } from '@/utils/auth'
import { EmailVerificationFields, useEmailVerification } from '@/components/auth/EmailVerification'
import { MemoriesVisual } from '@/components/auth/AuthVisuals'
import { AuthCard, AuthCardHeader, AuthShell, AuthSubmit, AuthSwitch, FormAlert, PasswordField, PasswordRuleHint, readNext, useKeyboardSafe, useNextParam, useSignedInRedirect, withNext } from '@/components/auth/AuthKit'
import { hdImage } from '@/utils/place-images'

const FIELD_ORDER: ResetField[] = ['email', 'code', 'password']

export default function ForgotPasswordPage() {
  const router = useRouter()
  const next = useNextParam()
  const verification = useEmailVerification('reset_password')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ResetFieldErrors>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useSignedInRedirect('/trips')
  const inflight = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  useKeyboardSafe(formRef, submitRef)

  // 发出验证码或验证成功后，“请先完成邮箱验证”这类提示就不再适用
  useEffect(() => {
    if (verification.sentTo || verification.verified) setFieldErrors(e => (e.code ? { ...e, code: undefined } : e))
  }, [verification.sentTo, verification.verified])

  const focusFirstError = (errors: ResetFieldErrors) => {
    const first = FIELD_ORDER.find(f => errors[f])
    if (first === 'password') passwordRef.current?.focus()
    else if (first === 'code' && verification.sentTo) verification.codeRef.current?.focus()
    else if (first) emailRef.current?.focus()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inflight.current) return
    const errors = validateResetForm({ email: verification.email, password }, verification.verified)
    setFieldErrors(errors)
    setFormError('')
    if (FIELD_ORDER.some(f => errors[f])) { focusFirstError(errors); return }

    inflight.current = true
    setBusy(true)
    try {
      await authApi.resetPassword({ email: verification.email.trim(), newPassword: password, emailVerificationToken: verification.token ?? '' })
      setPhase('redirecting')
      router.push(safeNextPath(next ?? readNext()))
    } catch (error) {
      const mapped = mapResetError(error)
      if (mapped.resetVerification) verification.reset()
      setFieldErrors(mapped.fields)
      setFormError(mapped.form)
      setBusy(false)
      inflight.current = false
      if (FIELD_ORDER.some(f => mapped.fields[f])) requestAnimationFrame(() => focusFirstError(mapped.fields))
    }
  }

  const locked = busy || phase !== 'form'
  const status = phase === 'checking' ? '正在确认登录状态…' : phase === 'redirecting' ? '密码已重置，正在进入旅迹…' : busy ? '正在重置密码…' : ''
  const formErrorId = formError ? 'reset-form-error' : undefined

  return (
    <AuthShell
      variant="memories"
      hero={{
        eyebrow: 'ACCOUNT RECOVERY',
        title: <>别担心，<br />你的旅程都还在。</>,
        sub: <>验证邮箱后设置新密码，<br />旅行、照片和故事不会受到影响。</>,
        subShort: '验证邮箱后，就可以设置新密码。',
        image: hdImage('07-tokyo-station')
      }}
      visual={<MemoriesVisual />}
    >
      <AuthCard ref={formRef} onSubmit={submit} aria-busy={locked}>
        <AuthCardHeader eyebrow="RESET PASSWORD" title="重置密码" sub="输入注册时使用的邮箱，我们会发送 6 位验证码。" />

        {formError && <FormAlert id="reset-form-error">{formError}</FormAlert>}

        <div className="au-fields">
          <EmailVerificationFields
            v={verification} idPrefix="reset" emailRef={emailRef}
            disabled={phase !== 'form'} readOnly={busy} formErrorId={formErrorId}
            emailError={fieldErrors.email} codeError={fieldErrors.code}
          />
          <PasswordField
            ref={passwordRef} id="reset-password" name="new-password" label="新密码" icon={LockKeyhole}
            autoComplete="new-password" placeholder="至少 8 位" enterKeyHint="go"
            value={password} onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: undefined })); if (formError) setFormError('') }}
            disabled={phase !== 'form'} readOnly={busy} error={fieldErrors.password} formErrorId={formErrorId}
            hint={<PasswordRuleHint value={password} />}
          />
        </div>

        <AuthSubmit
          ref={submitRef} locked={locked} label="重置密码并登录" status={status}
          lockedLabel={phase === 'checking' ? '正在确认…' : phase === 'redirecting' ? '正在进入…' : '正在重置…'}
        />
        <p className="au-note">重置后，其他设备上的登录会全部退出。</p>
        <AuthSwitch prompt="想起密码了？" href={withNext('/login', next)} label="返回登录" />
      </AuthCard>
    </AuthShell>
  )
}
