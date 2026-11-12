import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import 'leaflet/dist/leaflet.css'
import './usability.css'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { QuickCheckInProvider } from '@/components/checkin/QuickCheckInProvider'
import { PreferencesProvider } from '@/components/common/PreferencesProvider'
import { DevDataRoot } from '@/components/common/DevDataRoot'
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, LOCALE_COOKIE, TIMEZONE_COOKIE, isValidTimeZone, matchLocale } from '@/lib/preferences'

import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteUrl } from '@/lib/site'

/** 站点级默认值；canonical 只在可收录的公开页面单独设置（lib/site.publicPage），私有页面各自 noindex */
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, siteName: SITE_NAME, locale: 'zh_CN', type: 'website' },
  twitter: { card: 'summary', title: SITE_TITLE, description: SITE_DESCRIPTION },
  // 添加到主屏幕后全屏打开、不显示地址栏（manifest 见 app/manifest.ts）。
  // Next 只输出 mobile-web-app-capable，旧版 iOS 还认 apple-mobile-web-app-capable，一并补上
  appleWebApp: { capable: true, title: '旅迹', statusBarStyle: 'default' },
  other: { 'apple-mobile-web-app-capable': 'yes' }
}

/** 内容铺到全面屏边缘，各组件已用 env(safe-area-inset-*) 避开刘海和底部横条；页面级 viewport（登录等）只追加键盘行为 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FBF7F1'
}

/**
 * iOS Safari 在输入框聚焦时会自动放大页面（字号小于 16px、iPad 外接触控板等情况）。只在 iOS 上给 viewport 追加
 * maximum-scale=1：iOS 仍允许双指缩放，只是不再自动放大；安卓不会自动放大，不加，以免关闭双指缩放。
 * Next 切换页面会重写或追加 viewport 标签（登录页等有自己的设置；可能在 head 也可能在 body；浏览器以最后一个为准），
 * 用 MutationObserver 每次给所有标签补上。
 */
const IOS_NO_FOCUS_ZOOM = `(function(){var n=navigator;if(!(/iP(hone|ad|od)/.test(n.userAgent)||(n.platform==='MacIntel'&&n.maxTouchPoints>1)))return;function f(){document.querySelectorAll('meta[name="viewport"]').forEach(function(m){if(!/maximum-scale/.test(m.content))m.content+=', maximum-scale=1'})}f();new MutationObserver(f).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['content']})})()`

/**
 * 语言与时区的首屏值来自 cookie（用户保存过的偏好会同步写入），服务端与客户端首屏用同一语言渲染；
 * 登录后由 PreferencesProvider 以数据库里的偏好为准。
 * DevDataRoot 只在开发环境生效（数据源切换器）；生产环境原样渲染。
 */

export default async function RootLayout({children}:{children:React.ReactNode}){
  const store = await cookies()
  const savedLocale = matchLocale(store.get(LOCALE_COOKIE)?.value)
  const savedZone = store.get(TIMEZONE_COOKIE)?.value
  const initial = { locale: savedLocale ?? DEFAULT_LOCALE, timeZone: isValidTimeZone(savedZone) ? savedZone : DEFAULT_TIMEZONE }
  return (
    <html lang={initial.locale} data-scroll-behavior="smooth">
      <body>
        <script dangerouslySetInnerHTML={{ __html: IOS_NO_FOCUS_ZOOM }} />
        <DevDataRoot>
          <PreferencesProvider initial={initial} hasSavedLocal={Boolean(savedLocale)}>
            <QuickCheckInProvider>{children}</QuickCheckInProvider>
          </PreferencesProvider>
        </DevDataRoot>
      </body>
    </html>
  )
}
