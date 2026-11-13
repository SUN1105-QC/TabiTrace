import { PageContainer } from '@/components/common/PageContainer'
import { SiteHeader } from '@/components/common/SiteHeader'
import { CountryExploreDirectory } from '@/components/explore/CountryExploreDirectory'
import { publicPage } from '@/lib/site'

export const metadata = publicPage('/explore', '按国家与城市探索｜旅迹 TabiTrace', '先选一个国家，再走进一座城市。浏览国家主题与已开放的城市指南，把喜欢的地点加入下一段旅行。')

export default function ExplorePage() {
  return <main><SiteHeader /><PageContainer variant="medium" className="xp-directory-page"><CountryExploreDirectory /></PageContainer></main>
}
