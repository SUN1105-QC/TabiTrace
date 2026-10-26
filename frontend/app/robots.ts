import type { MetadataRoute } from 'next'

/** 只允许搜索引擎收录公开页面；个人旅行、设置和分享链接（仅持有链接的人可见）都不收录 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/explore', '/pricing'], disallow: ['/trips', '/profile', '/memories', '/s/', '/api/', '/login', '/register', '/forgot-password'] }]
  }
}
