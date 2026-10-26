import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import 'leaflet/dist/leaflet.css'
import type { Metadata } from 'next'
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
  twitter: { card: 'summary', title: SITE_TITLE, description: SITE_DESCRIPTION }
}

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
        <DevDataRoot>
          <PreferencesProvider initial={initial} hasSavedLocal={Boolean(savedLocale)}>
            <QuickCheckInProvider>{children}</QuickCheckInProvider>
          </PreferencesProvider>
        </DevDataRoot>
      </body>
    </html>
  )
}
