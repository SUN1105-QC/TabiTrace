import type { MetadataRoute } from 'next'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'

/**
 * 添加到主屏幕后以独立窗口打开（不显示浏览器地址栏），像 App 一样使用。
 * iOS 另外依赖 layout.tsx 里的 appleWebApp 与 apple-icon.png；颜色与页面底色 --canvas 一致，启动时不闪白。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE_NAME,
    short_name: '旅迹',
    description: SITE_DESCRIPTION,
    lang: 'zh-CN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FBF7F1',
    theme_color: '#FBF7F1',
    icons: [
      { src: '/brand/tabitrace-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/tabitrace-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/tabitrace-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }
}
