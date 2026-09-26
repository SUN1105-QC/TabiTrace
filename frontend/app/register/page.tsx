'use client'

/**
 * 创建账号页。
 * - Desktop（≥1024px）：左侧品牌介绍 + 产品预览（静态演示截图）+ 注册后能得到什么，右侧 460px 注册卡片。
 * - Tablet（768~1023px）：介绍与注册卡片单列居中。
 * - Mobile（<768px）：与登录页一致的紧凑 Hero（180px）+ 上叠注册卡片。
 * 规则与后端一致（见 utils/auth REGISTER_RULES）；注册成功后接口直接返回登录令牌，进入 ?next= 或创建旅行。
 * 必须先完成邮箱验证码验证（EmailVerificationFields），注册请求带上服务端签发的 emailVerificationToken，服务端再校验并一次性消费。
 * 目前没有第三方登录和使用条款 / 隐私政策页面，因此都不显示；LEGAL_LINKS 配置后会自动出现同意项。
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, LockKeyhole, MapPin, MapPinned, Share2, UserRound } from 'lucide-react'
import { authApi } from '@/services/tabitrace-api'
import { LEGAL_LINKS } from '@/constants/app'
import { HERO_DEMO, PRODUCT_SHOTS } from '@/components/landing/landingDemo'
import { mapRegisterError, normalizeNickname, passwordStrength, REGISTER_RULES, safeNextPath, validateRegisterForm, type RegisterField, type RegisterFieldErrors } from '@/utils/auth'
import { EmailVerificationFields, useEmailVerification } from '@/components/auth/EmailVerification'
import { AuthCardHeader, AuthField, AuthPage, AuthSubmit, AuthSwitch, FormAlert, PasswordField, readNext, useKeyboardSafe, useNextParam, useSignedInRedirect, withNext } from '@/components/auth/AuthKit'

const CONSENT_REQUIRED = Boolean(LEGAL_LINKS.terms && LEGAL_LINKS.privacy)
const FIELD_ORDER: RegisterField[] = ['nickname', 'email', 'code', 'password', 'consent']

export default function RegisterPage() {
  const router = useRouter()
  const next = useNextParam()
  const [values, setValues] = useState({ nickname: '', password: '', consent: false })
  const verification = useEmailVerification('register')
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({})
  const [emailExists, setEmailExists] = useState(false)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useSignedInRedirect('/trips')
  const inflight = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const refs = { nickname: useRef<HTMLInputElement>(null), email: useRef<HTMLInputElement>(null), code: verification.codeRef, password: useRef<HTMLInputElement>(null), consent: useRef<HTMLInputElement>(null) }
  useKeyboardSafe(formRef, submitRef)

  // 发出验证码或验证成功后，“请先完成邮箱验证”这类提交时的提示就不再适用
  useEffect(() => {
    if (verification.sentTo || verification.verified) setFieldErrors(e => (e.code ? { ...e, code: undefined } : e))
  }, [verification.sentTo, verification.verified])

  const update = <K extends keyof typeof values>(field: K, value: (typeof values)[K]) => {
    setValues(v => ({ ...v, [field]: value }))
    if (fieldErrors[field]) setFieldErrors(e => ({ ...e, [field]: undefined }))
    if (formError) setFormError('')
  }

  // 修改邮箱：清掉表单里与邮箱、验证码相关的提示（验证状态由 useEmailVerification 自己重置）
  const changeEmail = (value: string) => {
    verification.setEmail(value)
    setEmailExists(false)
    if (fieldErrors.email || fieldErrors.code) setFieldErrors(e => ({ ...e, email: undefined, code: undefined }))
    if (formError) setFormError('')
  }

  const focusFirstError = (errors: RegisterFieldErrors) => {
    const first = FIELD_ORDER.find(f => errors[f])
    if (!first) return
    // 还没发送验证码时，焦点给到“获取验证码”所在的邮箱栏
    const target = first === 'code' && !verification.sentTo ? refs.email : refs[first]
    target.current?.focus()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inflight.current) return // 防止连点或回车重复提交
    const errors = validateRegisterForm({ ...values, email: verification.email }, CONSENT_REQUIRED, verification.verified)
    setFieldErrors(errors)
    setFormError('')
    setEmailExists(false)
    if (FIELD_ORDER.some(f => errors[f])) { focusFirstError(errors); return }

    inflight.current = true
    setBusy(true)
    try {
      await authApi.register({
        nickname: normalizeNickname(values.nickname), email: verification.email.trim(), password: values.password,
        emailVerificationToken: verification.token ?? ''
      })
      // 注册接口直接返回登录令牌（authApi 已保存），这是真实的自动登录
      setPhase('redirecting')
      router.push(safeNextPath(next ?? readNext(), '/trips/new'))
    } catch (error) {
      const mapped = mapRegisterError(error)
      // 令牌过期 / 已使用 / 不匹配：回到“获取验证码”这一步
      if (mapped.resetVerification) verification.reset()
      setFieldErrors(mapped.fields)
      setEmailExists(mapped.emailExists)
      setFormError(mapped.form)
      setBusy(false)
      inflight.current = false
      if (FIELD_ORDER.some(f => mapped.fields[f])) requestAnimationFrame(() => focusFirstError(mapped.fields))
    }
  }

  const locked = busy || phase !== 'form'
  const status = phase === 'checking' ? '正在确认登录状态…' : phase === 'redirecting' ? '账号已创建，正在进入旅迹…' : busy ? '正在创建账号…' : ''
  const formErrorId = formError ? 'register-form-error' : undefined
  const strength = passwordStrength(values.password)
  const lengthMet = values.password.length >= REGISTER_RULES.passwordMin && values.password.length <= REGISTER_RULES.passwordMax

  return (
    <AuthPage className="mx-auto grid max-w-[1160px] px-4 pb-10 pt-3 md:max-w-[600px] md:px-8 md:py-10 lg:max-w-[1160px] lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:gap-14 lg:py-7">
      <div>
        <div className="au-reg-intro">
          <p className="au-reg-eyebrow">START YOUR JOURNEY</p>
          <h1>从下一段旅行开始，<br />把值得记住的都留下来。</h1>
          <p className="au-reg-sub">
            <span className="md:hidden">旅行、照片和故事，都会留在这里。</span>
            <span className="hidden md:inline">创建账号后，你的旅行、地点、照片、时间轴和分享成果都会保存在同一个旅迹里。</span>
          </p>
        </div>

        {/* 静态演示：真实产品界面截图（来自已删除的演示旅行），不读取任何用户数据 */}
        <div className="au-reg-preview" aria-hidden="true">
          <img src={PRODUCT_SHOTS.map.src} alt="" width={PRODUCT_SHOTS.map.width} height={PRODUCT_SHOTS.map.height} className="au-reg-shot" loading="lazy" decoding="async" />
          <div className="au-reg-place">
            <span><MapPin size={14} /></span>
            <div><b>{HERO_DEMO.place.name}<small> · {HERO_DEMO.place.area}</small></b><em><Check size={12} /> {HERO_DEMO.place.status}</em></div>
          </div>
          <figure className="au-reg-poster"><img src={PRODUCT_SHOTS.poster.src} alt="" width={PRODUCT_SHOTS.poster.width} height={PRODUCT_SHOTS.poster.height} loading="lazy" decoding="async" /></figure>
        </div>

        <ul className="au-reg-benefits" aria-label="注册后你可以">
          <li><MapPinned size={18} aria-hidden="true" /><div><b>旅行地图与打卡</b><span>去过的和计划中的地点，落在同一张地图上</span></div></li>
          <li><Camera size={18} aria-hidden="true" /><div><b>照片与时间轴</b><span>照片按拍摄时间回到旅行的每一天</span></div></li>
          <li><Share2 size={18} aria-hidden="true" /><div><b>分享成果</b><span>海报、九宫格、每日长图与 Travel Story</span></div></li>
        </ul>
      </div>

      <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="auth-card-title" aria-busy={locked} className="warm-card relative z-10 -mt-6 p-6 md:mt-8 md:p-9 lg:mt-0">
        <AuthCardHeader eyebrow="CREATE ACCOUNT" title="创建你的旅迹账户" sub={<p className="mt-1.5 text-sm text-black/50">只需要一分钟。</p>} />

        {formError && <FormAlert id="register-form-error">{formError}</FormAlert>}

        <div className="mt-5 space-y-4 md:mt-6">
          <AuthField
            ref={refs.nickname} id="register-nickname" name="nickname" label="昵称" icon={UserRound}
            autoComplete="nickname" placeholder="例如：SUN" enterKeyHint="next"
            value={values.nickname} onChange={e => update('nickname', e.target.value)}
            disabled={phase !== 'form'} readOnly={busy} error={fieldErrors.nickname} formErrorId={formErrorId}
            hint={`会显示在旅迹和公开分享页上，最多 ${REGISTER_RULES.nicknameMax} 个字。`}
          />
          <EmailVerificationFields
            v={verification} idPrefix="register" emailRef={refs.email}
            disabled={phase !== 'form'} readOnly={busy} formErrorId={formErrorId} codeError={fieldErrors.code}
            emailError={fieldErrors.email && (emailExists
              ? <>{fieldErrors.email}<Link href={withNext('/login', next)} className="au-error-link">去登录 →</Link></>
              : fieldErrors.email)}
          />
          <PasswordField
            ref={refs.password} id="register-password" name="password" label="密码" icon={LockKeyhole}
            autoComplete="new-password" placeholder={`至少 ${REGISTER_RULES.passwordMin} 位`}
            value={values.password} onChange={e => update('password', e.target.value)}
            disabled={phase !== 'form'} readOnly={busy} error={fieldErrors.password} formErrorId={formErrorId}
            hint={
              <div className="au-pw-meta">
                <span className={lengthMet ? 'is-met' : undefined}><Check size={13} aria-hidden="true" />至少 {REGISTER_RULES.passwordMin} 位</span>
                {strength.level > 0 && (
                  <span className="au-strength" data-level={strength.level}>
                    <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />强度 {strength.label}<small>（仅供参考）</small>
                  </span>
                )}
              </div>
            }
          />

          {CONSENT_REQUIRED && (
            <div>
              <div className="au-consent">
                <input
                  ref={refs.consent} id="register-consent" type="checkbox" checked={values.consent}
                  onChange={e => update('consent', e.target.checked)} disabled={locked}
                  aria-invalid={Boolean(fieldErrors.consent)} aria-describedby={fieldErrors.consent ? 'register-consent-error' : undefined}
                />
                <label htmlFor="register-consent">
                  我已阅读并同意 <Link href={LEGAL_LINKS.terms!} target="_blank" rel="noopener">使用条款</Link> 和 <Link href={LEGAL_LINKS.privacy!} target="_blank" rel="noopener">隐私政策</Link>
                </label>
              </div>
              {fieldErrors.consent && <p id="register-consent-error" className="au-error">{fieldErrors.consent}</p>}
            </div>
          )}
        </div>

        <AuthSubmit
          ref={submitRef} locked={locked} label="创建账号" status={status}
          lockedLabel={phase === 'checking' ? '正在确认…' : phase === 'redirecting' ? '账号已创建，正在进入…' : '正在创建账号…'}
        />
        <AuthSwitch prompt="已有账号？" href={withNext('/login', next)} label="登录" />
      </form>
    </AuthPage>
  )
}
