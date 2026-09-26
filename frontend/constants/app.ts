export const APP_NAME = '旅迹 TabiTrace'
export const DEFAULT_LOCALE = 'zh-CN'
export const DEFAULT_TIMEZONE = 'Asia/Tokyo'
export const TOKYO_CITY_CODE = 'TOKYO'

/**
 * 法律文本的正式页面。目前项目还没有使用条款 / 隐私政策页面，保持为 null。
 * 填入真实路由后，注册页会自动显示“我已阅读并同意”确认项并要求勾选，页脚也可以改成链接。
 */
export const LEGAL_LINKS: { terms: string | null; privacy: string | null } = { terms: null, privacy: null }
