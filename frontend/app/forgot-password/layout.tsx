import type { Metadata, Viewport } from 'next'
import { NOINDEX } from '@/lib/site'

export const metadata: Metadata = {
  robots: NOINDEX,
  title: '重置密码｜旅迹 TabiTrace',
  description: '通过邮箱验证码重置旅迹账号的登录密码。'
}

// 与登录、注册页一致：软键盘弹起时缩小布局视口，表单可以滚动，当前输入框和按钮不会被挡住
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content'
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
