import { publicPage } from '@/lib/site'

export const metadata = publicPage('/pricing', 'Trip Pro｜旅迹 TabiTrace', '按旅行一次性购买、不自动续费：Trip Pro 为这一趟旅行解锁不限打卡与照片、高清无水印的分享成果和 1080P Travel Story。')

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
