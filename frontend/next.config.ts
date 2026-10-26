import type { NextConfig } from 'next'
import { siteUrlProblem } from './lib/site'

/**
 * 生产部署（Railway 等）：浏览器只访问网页同源的 /api/v1，由 Next.js 转发到内网 API（API_INTERNAL_URL，
 * 例如 http://api.railway.internal:8080）。好处：
 * - API 不需要对公网开放，也不需要跨域（CORS）
 * - 登录用的 HttpOnly Cookie 是第一方 Cookie，Safari 等浏览器不会拦截
 * rewrites 在构建时生成，API_INTERNAL_URL 需要在构建阶段就配置好。
 * 本地开发不设置 API_INTERNAL_URL，前端直连 localhost:8080。
 */
const apiInternalUrl = process.env.API_INTERNAL_URL?.replace(/\/$/, '')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // 不允许被其他网站用 iframe 嵌入（防点击劫持）
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // 定位与相机只给本站使用（快速打卡、拍照上传）
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=()' }
]

/**
 * 地图底图：生产构建没有配置服务商时不会回退到 OpenStreetMap 官方瓦片（见 lib/map-tiles.ts），
 * 地图只显示纯色底 + 标点。这里在构建日志里醒目提示，避免不知不觉上线一个没有底图的版本。
 */
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() && !process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim()) {
  console.warn('\n[TabiTrace] ⚠ 未配置地图底图服务商（NEXT_PUBLIC_MAP_STYLE_URL 或 NEXT_PUBLIC_MAP_TILE_URL）：'
    + '生产环境的地图将只显示标点，不会使用 OpenStreetMap 官方瓦片服务器。见 docs/09_deployment/02_部署设计.md「地图底图」。\n')
}

/**
 * 站点地址（canonical / OpenGraph / metadataBase）：生产构建与启动都必须配置正式的 https APP_URL，
 * 否则直接失败——不能带着 localhost 的 canonical 上线。
 */
if (process.env.NODE_ENV === 'production') {
  const problem = siteUrlProblem()
  if (problem) throw new Error(`[TabiTrace] ${problem}。在部署平台的 web 服务变量里设置 APP_URL（与 API 的 APP_PUBLIC_URL 相同）。`)
}

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return apiInternalUrl ? [{ source: '/api/v1/:path*', destination: `${apiInternalUrl}/api/v1/:path*` }] : []
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // 官方景点高清图：内容固定，缓存 30 天。文件名不带哈希，换图时请换文件名（或清 CDN 缓存）
      { source: '/images/explore/hd/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }] }
    ]
  }
}

export default nextConfig
