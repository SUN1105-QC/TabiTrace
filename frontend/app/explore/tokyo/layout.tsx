import { publicPage } from '@/lib/site'

export const metadata = publicPage('/explore/tokyo', '东京官方探索｜旅迹 TabiTrace', '东京精选地点、街区与旅行灵感：搜索地点、按区域探索，把喜欢的地方加入你的旅行。')

export default function TokyoLayout({ children }: { children: React.ReactNode }) {
  return children
}
