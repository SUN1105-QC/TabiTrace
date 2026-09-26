import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: '创建账号｜旅迹 TabiTrace',
  description: '创建旅迹账号，把旅行地图、照片、时间轴和分享成果保存在同一个地方。'
}

// 与登录页一致：软键盘弹起时缩小布局视口，表单可以滚动，当前输入框和创建按钮不会被挡住
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content'
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
