'use client'

/**
 * 邮箱 + 验证码字段（注册 / 以后的重置密码、修改邮箱共用，purpose 由调用方传入）。
 * - 获取验证码：只有邮箱格式正确时可用；发送中 / 60 秒倒计时（以服务端返回的 resendAfter、retryAfter 为准）
 * - 验证码：6 位数字，输满自动校验，也可以点“验证”；成功后拿到 emailVerificationToken（只保存在内存里）
 * - 修改邮箱：立刻清掉令牌、验证码和已验证状态，必须重新验证；进行中的请求结果会被丢弃
 * 前端倒计时只是提示，真正的频率限制、有效期和错误次数都由后端执行。
 */

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Mail } from 'lucide-react'
import { authApi, type EmailVerificationPurpose } from '@/services/tabitrace-api'
import { CODE_LENGTH, formatCooldown, isValidEmail, mapSendCodeError, mapVerifyCodeError, sanitizeCode } from '@/utils/auth'

export function useEmailVerification(purpose: EmailVerificationPurpose) {
  const [email, setEmailValue] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  // 每次修改邮箱 / 重置都会换代，旧请求返回时直接丢弃
  const generation = useRef(0)
  const codeRef = useRef<HTMLInputElement>(null)
  // 状态更新之前的连点 / 自动校验与按钮同时触发，用 ref 立即拦住
  const sendingRef = useRef(false)
  const verifyingRef = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown(s => Math.max(0, s - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  const reset = useCallback((message = '') => {
    generation.current += 1
    sendingRef.current = false; verifyingRef.current = false
    setCode(''); setSentTo(null); setToken(null); setCooldown(0)
    setSending(false); setVerifying(false); setNotice(''); setCodeError(message || null)
  }, [])

  const setEmail = (value: string) => {
    setEmailValue(value)
    setEmailError(null)
    // 修改邮箱：之前的验证全部作废
    if (sentTo || token || code) reset()
  }

  const normalized = email.trim().toLowerCase()
  const verified = Boolean(token)
  const canSend = isValidEmail(email) && !sending && !verifying && cooldown <= 0 && !verified

  const send = async () => {
    if (!isValidEmail(email)) { setEmailError('邮箱格式不正确'); return }
    if (!canSend || sendingRef.current) return
    sendingRef.current = true
    const gen = generation.current
    setSending(true); setCodeError(null); setNotice('')
    try {
      const res = await authApi.sendEmailCode({ email: normalized, purpose })
      if (gen !== generation.current) return
      setSentTo(normalized); setCode(''); setToken(null)
      setCooldown(res.resendAfter)
      setNotice(`验证码已发送至 ${normalized}，${Math.round(res.expiresIn / 60)} 分钟内有效。`)
      requestAnimationFrame(() => codeRef.current?.focus())
    } catch (error) {
      if (gen !== generation.current) return
      const mapped = mapSendCodeError(error)
      if (mapped.field === 'email') setEmailError(mapped.message)
      else setCodeError(mapped.message)
      if (mapped.retryAfter) setCooldown(mapped.retryAfter)
    } finally {
      if (gen === generation.current) { setSending(false); sendingRef.current = false }
    }
  }

  const verify = async (value: string) => {
    if (!sentTo || value.length !== CODE_LENGTH || verifyingRef.current || verified) return
    verifyingRef.current = true
    const gen = generation.current
    setVerifying(true); setCodeError(null)
    try {
      const res = await authApi.verifyEmailCode({ email: sentTo, code: value, purpose })
      if (gen !== generation.current) return
      setToken(res.emailVerificationToken)
      setNotice('')
    } catch (error) {
      if (gen !== generation.current) return
      const mapped = mapVerifyCodeError(error)
      setCodeError(mapped.message)
      if (mapped.needResend) { setCode(''); setSentTo(null); setCooldown(0) }
    } finally {
      if (gen === generation.current) { setVerifying(false); verifyingRef.current = false }
    }
  }

  const changeCode = (raw: string) => {
    const value = sanitizeCode(raw)
    setCode(value)
    if (codeError) setCodeError(null)
    if (value.length === CODE_LENGTH) void verify(value) // 输满 6 位自动校验
  }

  return {
    purpose, email, setEmail, code, changeCode, sentTo, sending, verifying, verified, token, cooldown, canSend,
    emailError, setEmailError, codeError, setCodeError, notice, send, verify, reset, codeRef
  }
}

export type EmailVerificationState = ReturnType<typeof useEmailVerification>

type Props = {
  v: EmailVerificationState
  idPrefix: string
  emailRef: RefObject<HTMLInputElement | null>
  /** 表单提交时的邮箱错误（可以带“去登录”链接），优先于字段自身的错误 */
  emailError?: ReactNode
  /** 表单提交时的验证码错误（如“请先完成邮箱验证”） */
  codeError?: string
  disabled: boolean
  readOnly: boolean
  formErrorId?: string
}

export function EmailVerificationFields({ v, idPrefix, emailRef, emailError, codeError, disabled, readOnly, formErrorId }: Props) {
  const emailId = `${idPrefix}-email`, codeId = `${idPrefix}-code`
  const shownEmailError = emailError || v.emailError
  const shownCodeError = v.codeError || codeError
  const sendLabel = v.verified ? '已验证' : v.sending ? '发送中…' : v.cooldown > 0 ? `重新发送 ${formatCooldown(v.cooldown)}` : v.sentTo ? '重新发送' : '获取验证码'
  const emailDescribed = [shownEmailError && `${emailId}-error`, formErrorId].filter(Boolean).join(' ') || undefined
  const codeDescribed = [`${codeId}-status`, formErrorId].filter(Boolean).join(' ')

  return (
    <>
      <div>
        <label htmlFor={emailId} className="text-sm font-medium text-ink/80">邮箱</label>
        <div className="au-row mt-2">
          <div className="au-input-wrap">
            <Mail size={17} aria-hidden="true" className="au-icon" />
            <input
              ref={emailRef} id={emailId} name="email" type="email" inputMode="email" autoComplete="email"
              autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="name@example.com" enterKeyHint="next"
              value={v.email} onChange={e => v.setEmail(e.target.value)} disabled={disabled} readOnly={readOnly}
              aria-invalid={Boolean(shownEmailError)} aria-describedby={emailDescribed} className="au-input"
            />
          </div>
          <button type="button" onClick={v.send} disabled={!v.canSend || disabled || readOnly} aria-disabled={!v.canSend || disabled || readOnly}
            aria-controls={codeId} className="au-code-btn">
            {v.sending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}{sendLabel}
          </button>
        </div>
        {shownEmailError && <p id={`${emailId}-error`} className="au-error"><AlertCircle size={13} aria-hidden="true" className="shrink-0" /><span>{shownEmailError}</span></p>}
      </div>

      <div>
        <label htmlFor={codeId} className="text-sm font-medium text-ink/80">验证码</label>
        <div className="au-row mt-2">
          <div className="au-input-wrap">
            <KeyRound size={17} aria-hidden="true" className="au-icon" />
            <input
              ref={v.codeRef} id={codeId} name="one-time-code" type="text" inputMode="numeric" pattern="[0-9]*"
              autoComplete="one-time-code" maxLength={CODE_LENGTH} enterKeyHint="done"
              placeholder={v.sentTo ? '6 位数字' : '先获取验证码'} value={v.code} onChange={e => v.changeCode(e.target.value)}
              disabled={disabled || !v.sentTo || v.verified} readOnly={readOnly || v.verifying}
              aria-invalid={Boolean(shownCodeError)} aria-describedby={codeDescribed}
              className={`au-input au-code-input${v.verified ? ' is-verified' : ''}`}
            />
            {v.verified && <CheckCircle2 size={18} aria-hidden="true" className="au-code-ok" />}
          </div>
          {!v.verified && (
            <button type="button" onClick={() => v.verify(v.code)} disabled={disabled || readOnly || !v.sentTo || v.code.length !== CODE_LENGTH || v.verifying}
              className="au-code-btn is-ghost">
              {v.verifying ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" />正在验证…</> : '验证'}
            </button>
          )}
        </div>
        {/* 发送结果、验证结果都会被读屏软件播报 */}
        <div id={`${codeId}-status`} role="status" aria-live="polite">
          {v.verified
            ? <p className="au-success"><CheckCircle2 size={14} aria-hidden="true" />邮箱验证成功</p>
            : shownCodeError
              ? <p className="au-error"><AlertCircle size={13} aria-hidden="true" className="shrink-0" /><span>{shownCodeError}</span></p>
              : v.notice
                ? <p className="au-hint">{v.notice}没收到的话请查看垃圾邮件；如果这个邮箱已经注册过，邮件里会提示你直接登录。</p>
                : null}
        </div>
      </div>
    </>
  )
}
