import Link from 'next/link'
import { Brand } from './Brand'

export function SiteFooter() {
  return (
    <footer className="border-t border-black/[0.06] bg-white/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Brand />
          <p className="mt-3 max-w-lg text-sm leading-6 text-black/45">记录全球旅行，收藏地点、照片与故事，让每一次出发都留下可以回看的作品。</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-black/45">
          <Link href="/explore">官方探索</Link><Link href="/pricing">Pro</Link><Link href="/profile">个人资料</Link><span>隐私政策</span><span>利用规约</span>
        </div>
      </div>
      <div className="border-t border-black/[0.05] px-5 py-5 text-center text-xs text-black/35">© 2026 TabiTrace · Made for every journey.</div>
    </footer>
  )
}
