import type { Metadata } from 'next'

/**
 * 站点地址（canonical / OpenGraph / metadataBase 的唯一来源）：服务端环境变量 APP_URL，
 * 与 API 的 APP_PUBLIC_URL 填同一个正式域名。换域名时只改环境变量。
 * 开发环境没配置时用 http://localhost:3000；生产构建没配置或配成本机地址会直接失败（见 next.config.ts），
 * 所以生产页面里不会出现 localhost。
 */
export const DEV_SITE_URL = 'http://localhost:3000'

export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const raw = env.APP_URL?.trim()
  if (raw) return new URL(raw.replace(/\/+$/, '') + '/')
  return new URL(DEV_SITE_URL + '/')
}

/** 生产构建的站点地址检查：返回问题说明，没有问题返回 null */
export function siteUrlProblem(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.APP_URL?.trim()
  if (!raw) return '缺少 APP_URL（正式站点地址，例如 https://tabitrace.example）'
  let u: URL
  try { u = new URL(raw) } catch { return `APP_URL 不是合法地址：${raw}` }
  if (u.protocol !== 'https:') return 'APP_URL 必须是 https 地址'
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(u.hostname)) return 'APP_URL 不能是本机地址'
  return null
}

export const SITE_NAME = '旅迹 TabiTrace'
export const SITE_TITLE = '旅迹 TabiTrace｜记录旅行地图、照片与故事'
export const SITE_DESCRIPTION = '用地图、时间轴、照片和故事记录每一段旅程：行程与打卡、照片精选、旅行海报与九宫格、Travel Story 旅行视频，东京官方探索首发。'

/** 可被搜索引擎收录的公开页面：canonical + OpenGraph + Twitter（相对路径，由 metadataBase 补全为正式域名） */
export function publicPage(path: string, title = SITE_TITLE, description = SITE_DESCRIPTION): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, locale: 'zh_CN', type: 'website' },
    twitter: { card: 'summary', title, description }
  }
}

/** 不应被收录的页面（登录注册、个人数据、仅持链接可见的分享页） */
export const NOINDEX: Metadata['robots'] = { index: false, follow: false }
