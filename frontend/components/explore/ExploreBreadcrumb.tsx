import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function ExploreBreadcrumb({ countryName, countrySlug, cityName }: { countryName: string; countrySlug: string; cityName: string }) {
  return <nav aria-label="探索层级" className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-black/45">
    <Link href="/explore" className="hover:text-warm">推荐探索</Link>
    <ChevronRight size={12} aria-hidden="true" />
    <Link href={`/explore#country-${countrySlug}`} className="hover:text-warm">{countryName}</Link>
    <ChevronRight size={12} aria-hidden="true" />
    <span aria-current="page" className="font-bold text-black/65">{cityName}</span>
    <Link href={`/explore#country-${countrySlug}`} className="ml-auto text-warm">切换国家或城市</Link>
  </nav>
}
