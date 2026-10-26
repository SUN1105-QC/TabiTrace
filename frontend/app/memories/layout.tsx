import type { Metadata } from 'next'

/** 登录后的个人页面与仅凭链接访问的分享页不进入搜索结果 */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return children
}
