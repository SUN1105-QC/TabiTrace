import {CityExplorePage} from '@/components/explore/CityExplorePage'
import {EXPLORE_CITIES} from '@/constants/explore-cities'
import {publicPage} from '@/lib/site'
export const metadata=publicPage('/explore/taipei', '台北推荐探索｜旅迹 TabiTrace', '精选地点、区域与专题路线，把喜欢的地方加入旅行。')

export default function Page(){return <CityExplorePage city={EXPLORE_CITIES[3]} />}
