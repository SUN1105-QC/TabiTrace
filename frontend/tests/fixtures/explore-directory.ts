import type { ExploreCountry } from '@/constants/explore-catalog'

export const EXPLORE_COUNTRIES: ExploreCountry[] = [
  {
    code: 'JP', slug: 'japan', name: '日本', englishName: 'JAPAN',
    theme: '传统街巷，城市日常。', description: '从街头的热闹，走到巷子里的安静。选一座城市，慢慢发现属于你的日本。',
    cities: [
      { code: 'TOKYO', name: '东京', englishName: 'TOKYO', status: 'OPEN', href: '/explore/tokyo',
        description: '在寺社、街区与城市夜色之间，寻找东京的另一面。', tags: ['城市漫步', '寺社人文', '夜景'],
        cover: '07-tokyo-station' },
      { code: 'OSAKA', name: '大阪', englishName: 'OSAKA', status: 'PREPARING',
        description: '街头美食与都市日常，下一站一起慢慢探索。', tags: ['街头美食', '都市日常'] },
      { code: 'KYOTO', name: '京都', englishName: 'KYOTO', status: 'PREPARING',
        description: '沿着古都街巷，寻找寺社与庭园之间的片刻安静。', tags: ['古都漫步', '寺社庭园'] }
    ]
  },
  {
    code: 'KR', slug: 'korea', name: '韩国', englishName: 'SOUTH KOREA',
    theme: '走进街头，也走近日常。', description: '以城市为起点，收藏街区里的文化、风格与生活气息。',
    cities: [
      { code: 'SEOUL', name: '首尔', englishName: 'SEOUL', status: 'PLANNED',
        description: '从城市街区出发，发现旅途中的新鲜日常。', tags: ['街区文化', '城市生活'] }
    ]
  },
  {
    code: 'CN', slug: 'china', name: '中国', englishName: 'CHINA',
    theme: '街巷之间，收藏城市烟火。', description: '从熟悉的城市味道，到陌生街角的惊喜，把一座城走进自己的故事。',
    cities: [
      { code: 'TAIPEI', name: '台北', englishName: 'TAIPEI', region: '中国台湾', status: 'PLANNED',
        description: '沿着街巷散步，让城市的味道成为旅行记忆。', tags: ['街巷散步', '城市味道'] }
    ]
  }
]
