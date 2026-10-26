'use client'

/**
 * 登录页：“回到自己的旅程”。
 * 布局来自 AuthShell（variant="memories"）：<1024px 紧凑 Hero + 上叠卡片；≥1024px 左侧暖色面板 + 旅行照片拼贴，右侧登录卡片。
 * 认证仍走 authApi.login；成功后按 ?next=（登录前所在页面）或 /trips 跳转；已登录用户直接跳走。
 * 忘记密码走 /forgot-password（邮箱验证码 purpose=reset_password）。
 * 注册必须先验证邮箱、验证成功才创建用户，所以不存在“已注册但未验证”的账号，登录无需处理 EMAIL_NOT_VERIFIED。
 * 注销冷静期：?accountDeletion=（设置页注销后跳来）显示删除时间；冷静期内登录会收到 ACCOUNT_DELETION_PENDING，
 * 用户确认「撤销注销并登录」后带 cancelDeletion 再提交一次。
 */

import Link from 'next/link'
import { useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Mail } from 'lucide-react'
import { authApi } from '@/services/tabitrace-api'
import { ApiError } from '@/services/api'
import { utcDate } from '@/utils/video-status'
import { mapLoginError, safeNextPath, validateLoginForm, type LoginField, type LoginFieldErrors } from '@/utils/auth'
import { AuthCard, AuthCardHeader, AuthField, AuthShell, AuthSubmit, AuthSwitch, FormAlert, PasswordField, readNext, useKeyboardSafe, useNextParam, useSignedInRedirect, withNext } from '@/components/auth/AuthKit'
import { MemoriesVisual } from '@/components/auth/AuthVisuals'
import { hdImage } from '@/utils/place-images'

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
  /** 刚申请注销（来自设置页）：删除时间 */
  const scheduled = useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).get('accountDeletion'), () => null)
  /** 登录的账号在注销冷静期：等用户确认是否撤销 */
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null)
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

    await signIn(false)
  }

  const signIn = async (cancelDeletion: boolean) => {
    inflight.current = true
    setBusy(true)
    try {
      await authApi.login({ email: values.email.trim(), password: values.password, ...(cancelDeletion ? { cancelDeletion: true } : {}) })
      setPhase('redirecting')
      router.push(safeNextPath(next ?? readNext()))
      // 跳转期间保持禁用，避免再次提交
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ACCOUNT_DELETION_PENDING') {
        setPendingDeletion(String(error.details?.scheduledAt ?? ''))
        setBusy(false)
        inflight.current = false
        return
      }
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
    <AuthShell
      variant="memories"
      hero={{
        eyebrow: 'WELCOME BACK',
        title: <>继续记录，<br />那些值得回看的旅程。</>,
        sub: <>地图、照片和故事，<br />都在等你回来。</>,
        subShort: '地图、照片和故事，都在等你回来。',
        image: hdImage('20-ueno-park')
      }}
      visual={<MemoriesVisual />}
    >
      <AuthCard ref={formRef} onSubmit={submit} aria-busy={locked}>
        <AuthCardHeader eyebrow="SIGN IN" title="欢迎回来" sub="登录后继续你的旅行记录。" />

        {formError && <FormAlert id="login-form-error">{formError}</FormAlert>}
        {scheduled && !pendingDeletion && (
          <p className="au-notice" role="status">账号已申请注销，将于 {deletionTime(scheduled)} 永久删除。在此之前用这个账号登录，可以撤销注销。</p>
        )}
        {pendingDeletion !== null && (
          <div className="au-notice is-action" role="alert">
            <p>这个账号已申请注销{pendingDeletion ? `，将于 ${deletionTime(pendingDeletion)} 永久删除` : ''}。撤销注销后，账号和全部数据会恢复正常。</p>
            <div className="au-notice-actions">
              <button type="button" className="au-notice-primary" disabled={busy} onClick={() => void signIn(true)}>撤销注销并登录</button>
              <button type="button" className="au-notice-link" disabled={busy} onClick={() => setPendingDeletion(null)}>暂不登录</button>
            </div>
          </div>
        )}

        <div className="au-fields">
          <AuthField
            ref={emailRef} id="login-email" name="email" label="邮箱" icon={Mail} type="email" inputMode="email"
            autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="请输入邮箱" enterKeyHint="next"
            value={values.email} onChange={e => update('email', e.target.value)}
            disabled={phase !== 'form'} readOnly={busy} error={fieldErrors.email} formErrorId={formErrorId}
          />
          <PasswordField
            ref={passwordRef} id="login-password" name="password" label="密码" icon={LockKeyhole}
            autoComplete="current-password" placeholder="请输入密码" enterKeyHint="go"
            value={values.password} onChange={e => update('password', e.target.value)}
            disabled={phase !== 'form'} readOnly={busy} error={fieldErrors.password} formErrorId={formErrorId}
            labelAside={<Link href={withNext('/forgot-password', next)} className="au-label-link">忘记密码？</Link>}
          />
        </div>

        <AuthSubmit
          ref={submitRef} locked={locked} label="登录" status={status}
          lockedLabel={phase === 'checking' ? '正在确认…' : phase === 'redirecting' ? '正在进入…' : '正在登录…'}
        />
        <AuthSwitch prompt="还没有账号？" href={withNext('/register', next)} label="创建账号" />
      </AuthCard>
    </AuthShell>
  )
}

/** 地址参数只在首次渲染时读取，不需要订阅变化 */
const noSubscribe = () => () => {}

/** 后端时间为 UTC（不带时区后缀），按本机时区显示到分钟 */
function deletionTime(value: string) {
  const d = utcDate(value)
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : value
}
