import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: '登录｜旅迹 TabiTrace',
  description: '登录旅迹，继续记录你的旅行地图、照片与故事。'
}

// 只在登录页让软键盘缩小布局视口：表单可以滚动，当前输入框和登录按钮不会被键盘挡住
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content'
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
