import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata } from 'next'
import { QuickCheckInProvider } from '@/components/checkin/QuickCheckInProvider'

export const metadata: Metadata = {
  title: '旅迹 TabiTrace｜把旅行变成值得回看的作品',
  description: '全球旅行打卡、时间轴、照片、旅行统计、分享图与 Travel Story 旅行视频。'
}

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="zh-CN"><body><QuickCheckInProvider>{children}</QuickCheckInProvider></body></html>
}
