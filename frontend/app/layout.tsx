import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata } from 'next'
import { QuickCheckInProvider } from '@/components/checkin/QuickCheckInProvider'

const SITE_TITLE = '旅迹 TabiTrace｜记录旅行地图、照片与故事'
const SITE_DESCRIPTION = '用地图、时间轴、照片和故事记录每一段旅程：行程与打卡、照片精选、旅行海报与九宫格、Travel Story 旅行视频，东京官方探索首发。'

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: { title: SITE_TITLE, description: SITE_DESCRIPTION, siteName: '旅迹 TabiTrace', locale: 'zh_CN', type: 'website' },
  twitter: { card: 'summary', title: SITE_TITLE, description: SITE_DESCRIPTION }
}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="zh-CN" data-scroll-behavior="smooth"><body><QuickCheckInProvider>{children}</QuickCheckInProvider></body></html>
}
