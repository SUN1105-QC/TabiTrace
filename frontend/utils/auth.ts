import { ApiError } from '@/services/api'

/**
 * 登录表单的前端校验与错误归类。
 * 后端真实错误：INVALID_CREDENTIALS(401) / USER_DISABLED(403) / VALIDATION_ERROR(400, message 形如 "email: ...")，
 * 网络失败由 services/api 抛出 NETWORK_ERROR(status 0)，其余一律视为服务暂不可用，不把后端原文展示给用户。
 */

export type LoginField = 'email' | 'password'
export type LoginFieldErrors = Partial<Record<LoginField, string>>
export type LoginErrorResult = { fields: LoginFieldErrors; form: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const LOGIN_MESSAGES = {
  emailRequired: '请输入邮箱',
  emailInvalid: '邮箱格式不正确',
  passwordRequired: '请输入密码',
  invalidCredentials: '邮箱或密码不正确',
  userDisabled: '该账号当前不可用',
  network: '暂时无法登录，请检查网络后重试。',
  unavailable: '登录服务暂时不可用，请稍后再试。'
} as const

export function validateLoginForm(values: { email: string; password: string }): LoginFieldErrors {
  const errors: LoginFieldErrors = {}
  const email = values.email.trim()
  if (!email) errors.email = LOGIN_MESSAGES.emailRequired
  else if (!EMAIL_PATTERN.test(email)) errors.email = LOGIN_MESSAGES.emailInvalid
  if (!values.password) errors.password = LOGIN_MESSAGES.passwordRequired
  return errors
}

export function mapLoginError(error: unknown): LoginErrorResult {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return { fields: {}, form: LOGIN_MESSAGES.invalidCredentials }
    if (error.code === 'USER_DISABLED') return { fields: {}, form: LOGIN_MESSAGES.userDisabled }
    if (error.code === 'NETWORK_ERROR' || error.status === 0) return { fields: {}, form: LOGIN_MESSAGES.network }
    if (error.code === 'VALIDATION_ERROR') {
      const field = error.message.split(':')[0]?.trim()
      if (field === 'email') return { fields: { email: LOGIN_MESSAGES.emailInvalid }, form: '' }
      if (field === 'password') return { fields: { password: LOGIN_MESSAGES.passwordRequired }, form: '' }
    }
    return { fields: {}, form: LOGIN_MESSAGES.unavailable }
  }
  // fetch 在部分浏览器离线时直接抛 TypeError
  if (error instanceof TypeError) return { fields: {}, form: LOGIN_MESSAGES.network }
  return { fields: {}, form: LOGIN_MESSAGES.unavailable }
}

/** 只接受站内路径，且不回到登录 / 注册页本身 */
export function safeNextPath(raw: string | null | undefined, fallback = '/trips') {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (/^\/(login|register)(\/|\?|$)/.test(raw)) return fallback
  return raw
}

// ---------------- 注册 ----------------
// 规则与后端一致：RegisterRequest(@Email email, @NotBlank @Size(8,100) password) + UserService.normalizeNickname（最多 30 字）

export const REGISTER_RULES = { nicknameMax: 30, passwordMin: 8, passwordMax: 100 } as const

export type RegisterField = 'nickname' | 'email' | 'code' | 'password' | 'consent'
export type RegisterFieldErrors = Partial<Record<RegisterField, string>>
/** resetVerification：邮箱验证令牌已失效（过期 / 已使用 / 不匹配），需要重新获取验证码 */
export type RegisterErrorResult = { fields: RegisterFieldErrors; form: string; emailExists: boolean; resetVerification: boolean }

export const REGISTER_MESSAGES = {
  nicknameRequired: '请输入昵称',
  nicknameTooLong: `昵称最多 ${REGISTER_RULES.nicknameMax} 个字`,
  emailRequired: '请输入邮箱',
  emailInvalid: '邮箱格式不正确',
  emailExists: '这个邮箱已经有旅迹账号。',
  passwordRequired: '请设置密码',
  passwordTooShort: `密码至少需要 ${REGISTER_RULES.passwordMin} 位`,
  passwordTooLong: `密码最多 ${REGISTER_RULES.passwordMax} 位`,
  passwordBlank: '密码不能全是空格',
  consentRequired: '请先阅读并同意使用条款和隐私政策',
  verificationRequired: '请先完成邮箱验证',
  tokenExpired: '邮箱验证已过期，请重新获取验证码',
  tokenUsed: '这次邮箱验证已经使用过，请重新获取验证码',
  tokenInvalid: '邮箱验证已失效，请重新获取验证码',
  tokenMismatch: '邮箱已修改，请重新验证新的邮箱',
  network: '暂时无法创建账号，请检查网络后重试。',
  unavailable: '注册服务暂时不可用，请稍后再试。'
} as const

/** 与后端 normalizeNickname 相同：去掉首尾空白、连续空白合并成一个 */
export const normalizeNickname = (raw: string) => raw.trim().replace(/\s+/g, ' ')
const codePoints = (s: string) => Array.from(s).length

export function validateRegisterForm(values: { nickname: string; email: string; password: string; consent: boolean }, consentRequired: boolean, emailVerified: boolean): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {}
  const nickname = normalizeNickname(values.nickname)
  if (!nickname) errors.nickname = REGISTER_MESSAGES.nicknameRequired
  else if (codePoints(nickname) > REGISTER_RULES.nicknameMax) errors.nickname = REGISTER_MESSAGES.nicknameTooLong
  const email = values.email.trim()
  if (!email) errors.email = REGISTER_MESSAGES.emailRequired
  else if (!EMAIL_PATTERN.test(email)) errors.email = REGISTER_MESSAGES.emailInvalid
  if (!errors.email && !emailVerified) errors.code = REGISTER_MESSAGES.verificationRequired
  const pw = values.password
  if (!pw) errors.password = REGISTER_MESSAGES.passwordRequired
  else if (pw.length < REGISTER_RULES.passwordMin) errors.password = REGISTER_MESSAGES.passwordTooShort
  else if (pw.length > REGISTER_RULES.passwordMax) errors.password = REGISTER_MESSAGES.passwordTooLong
  else if (!pw.trim()) errors.password = REGISTER_MESSAGES.passwordBlank
  if (consentRequired && !values.consent) errors.consent = REGISTER_MESSAGES.consentRequired
  return errors
}

export function mapRegisterError(error: unknown): RegisterErrorResult {
  const none = { fields: {}, emailExists: false, resetVerification: false }
  if (error instanceof ApiError) {
    if (error.code === 'EMAIL_EXISTS') return { ...none, fields: { email: REGISTER_MESSAGES.emailExists }, form: '', emailExists: true }
    const tokenMessage: Record<string, string> = {
      EMAIL_VERIFICATION_REQUIRED: REGISTER_MESSAGES.verificationRequired, EMAIL_TOKEN_EXPIRED: REGISTER_MESSAGES.tokenExpired,
      EMAIL_TOKEN_USED: REGISTER_MESSAGES.tokenUsed, EMAIL_TOKEN_INVALID: REGISTER_MESSAGES.tokenInvalid, EMAIL_TOKEN_MISMATCH: REGISTER_MESSAGES.tokenMismatch
    }
    if (error.code && tokenMessage[error.code]) return { ...none, fields: { code: tokenMessage[error.code] }, form: '', resetVerification: true }
    if (error.code === 'INVALID_NICKNAME') return { ...none, fields: { nickname: REGISTER_MESSAGES.nicknameTooLong }, form: '' }
    if (error.code === 'NETWORK_ERROR' || error.status === 0) return { ...none, form: REGISTER_MESSAGES.network }
    if (error.code === 'VALIDATION_ERROR') {
      const field = error.message.split(':')[0]?.trim()
      if (field === 'email') return { ...none, fields: { email: REGISTER_MESSAGES.emailInvalid }, form: '' }
      if (field === 'password') return { ...none, fields: { password: REGISTER_MESSAGES.passwordTooShort }, form: '' }
      if (field === 'nickname') return { ...none, fields: { nickname: REGISTER_MESSAGES.nicknameTooLong }, form: '' }
    }
    return { ...none, form: REGISTER_MESSAGES.unavailable }
  }
  if (error instanceof TypeError) return { ...none, form: REGISTER_MESSAGES.network }
  return { ...none, form: REGISTER_MESSAGES.unavailable }
}

export type PasswordStrength = { level: 0 | 1 | 2 | 3; label: '' | '弱' | '一般' | '良好' }

/**
 * 仅作参考的密码强度提示，不参与校验（后端只要求 8~100 位）。
 * 未满 8 位不给强度；之后按长度与字符种类计分。
 */
export function passwordStrength(pw: string): PasswordStrength {
  if (pw.length < REGISTER_RULES.passwordMin) return { level: 0, label: '' }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length
  const score = (pw.length >= 12 ? 1 : 0) + (kinds >= 2 ? 1 : 0) + (kinds >= 3 ? 1 : 0)
  if (score >= 2) return { level: 3, label: '良好' }
  if (score === 1) return { level: 2, label: '一般' }
  return { level: 1, label: '弱' }
}

// ---------------- 邮箱验证码 ----------------
// 规则由后端决定（6 位数字、10 分钟有效、60 秒冷却、最多错 5 次）；前端倒计时只是提示，不是安全限制

export const CODE_LENGTH = 6
export const isValidEmail = (email: string) => EMAIL_PATTERN.test(email.trim())
/** 只保留数字，最多 6 位（兼容粘贴“123 456”） */
export const sanitizeCode = (raw: string) => raw.replace(/\D/g, '').slice(0, CODE_LENGTH)

export type CodeSendError = { field: 'email' | 'code'; message: string; retryAfter?: number }

export function mapSendCodeError(error: unknown): CodeSendError {
  if (error instanceof ApiError) {
    const retryAfter = Number(error.details?.retryAfter) || undefined
    if (error.code === 'RESEND_TOO_SOON') return { field: 'code', message: `请在 ${retryAfter ?? 60} 秒后重新获取验证码`, retryAfter }
    if (error.code === 'TOO_MANY_REQUESTS') return { field: 'code', message: `获取验证码太频繁了，请约 ${Math.max(1, Math.ceil((retryAfter ?? 60) / 60))} 分钟后再试`, retryAfter }
    if (error.code === 'EMAIL_SEND_FAILED') return { field: 'code', message: '验证码邮件发送失败，请稍后重试。' }
    if (error.code === 'INVALID_EMAIL' || error.code === 'VALIDATION_ERROR') return { field: 'email', message: REGISTER_MESSAGES.emailInvalid }
    if (error.code === 'NETWORK_ERROR' || error.status === 0) return { field: 'code', message: '发送失败，请检查网络后重试。' }
    return { field: 'code', message: '验证码暂时无法发送，请稍后再试。' }
  }
  return { field: 'code', message: '发送失败，请检查网络后重试。' }
}

/** needResend：验证码已过期 / 已锁定 / 已失效，只能重新获取 */
export function mapVerifyCodeError(error: unknown): { message: string; needResend: boolean } {
  if (error instanceof ApiError) {
    if (error.code === 'CODE_INVALID') {
      const remaining = Number(error.details?.remainingAttempts)
      return remaining > 0 ? { message: `验证码不正确，还可以再试 ${remaining} 次`, needResend: false } : { message: '验证码不正确或已失效，请重新获取', needResend: true }
    }
    if (error.code === 'CODE_EXPIRED') return { message: '验证码已过期，请重新获取', needResend: true }
    if (error.code === 'CODE_LOCKED') return { message: '验证码错误次数过多，已失效，请重新获取', needResend: true }
    if (error.code === 'VALIDATION_ERROR') return { message: '请输入 6 位数字验证码', needResend: false }
    if (error.code === 'NETWORK_ERROR' || error.status === 0) return { message: '验证失败，请检查网络后重试。', needResend: false }
    return { message: '暂时无法验证，请稍后再试。', needResend: false }
  }
  return { message: '验证失败，请检查网络后重试。', needResend: false }
}

/** 倒计时文案：100 秒以内显示秒，更长显示分钟 */
export const formatCooldown = (seconds: number) => (seconds < 100 ? `${seconds}s` : `${Math.ceil(seconds / 60)} 分钟`)
