import type { ItineraryView, PlaceView, TripView } from '@/services/tabitrace-api'
import { hdImage } from '@/utils/place-images'
import { ID_BASE, MOCK_TRIP_HOKKAIDO, MOCK_TRIP_KYOTO, MOCK_TRIP_TOKYO } from './ids'

export const mockTrips: TripView[] = [
  { id: MOCK_TRIP_TOKYO, title: '东京五日散步', destinationName: '东京', countryCode: 'JP', city: '东京', startDate: '2026-09-24', endDate: '2026-09-28', peopleCount: 2, coverImage: hdImage('03-tokyo-tower'), planType: 'PRO', status: 'ONGOING', visibility: 'UNLISTED', createdAt: '2026-09-10T03:00:00' },
  { id: MOCK_TRIP_KYOTO, title: '京都春日漫游', destinationName: '京都', countryCode: 'JP', city: '京都', startDate: '2026-04-03', endDate: '2026-04-06', peopleCount: 1, coverImage: hdImage('13-meiji-jingu'), planType: 'FREE', status: 'ARCHIVED', visibility: 'PRIVATE', createdAt: '2026-03-20T03:00:00' },
  { id: MOCK_TRIP_HOKKAIDO, title: '北海道雪国之旅', destinationName: '札幌', countryCode: 'JP', city: '札幌', startDate: '2026-12-20', endDate: '2026-12-24', peopleCount: 3, planType: 'PRO', status: 'PLANNING', visibility: 'PRIVATE', createdAt: '2026-09-15T03:00:00' }
]

const official = (n: number, name: string, area: string, lat: number, lng: number, category: string, cover: string, tagline: string): PlaceView =>
  ({ id: ID_BASE.place + n, name, countryCode: 'JP', country: '日本', city: '东京', area, latitude: lat, longitude: lng, category, sourceType: 'OFFICIAL', coverImage: cover, tagline, description: tagline, tags: [] })
const custom = (n: number, name: string, city: string, area: string, lat: number, lng: number): PlaceView =>
  ({ id: ID_BASE.place + n, name, countryCode: 'JP', country: '日本', city, area, latitude: lat, longitude: lng, category: '自定义', sourceType: 'CUSTOM', tags: [] })

/** 每段旅行收藏的地点（tripId → 地点） */
export const mockTripPlaces: Record<number, PlaceView[]> = {
  [MOCK_TRIP_TOKYO]: [
    official(1, '浅草寺', '浅草', 35.7148, 139.7967, '寺社', hdImage('01-sensoji-kaminarimon'), '东京最古老的寺院，雷门的红灯笼是必拍画面。'),
    official(2, '仲见世商店街', '浅草', 35.7119, 139.7964, '购物', hdImage('02-nakamise-street'), '从雷门一路走到本堂的老街，人形烧现做现卖。'),
    official(3, '上野公园', '上野', 35.7156, 139.7745, '公园', hdImage('20-ueno-park'), '博物馆、动物园和银杏大道都在这里。'),
    official(4, '秋叶原电器街', '秋叶原', 35.6984, 139.7731, '购物', hdImage('19-akihabara'), '动漫、手办和电子产品的聚集地。'),
    official(5, '涩谷十字路口', '涩谷', 35.6595, 139.7005, '地标', hdImage('09-shibuya-crossing'), '世界上最繁忙的十字路口之一。'),
    official(6, '东京都厅展望台', '新宿', 35.6896, 139.6917, '观景', hdImage('16-tokyo-metropolitan-government'), '免费的高空夜景，天气好能看到富士山。'),
    official(7, '东京塔', '港区', 35.6586, 139.7454, '地标', hdImage('03-tokyo-tower'), '夜里亮灯后的东京塔格外温暖。')
  ],
  [MOCK_TRIP_KYOTO]: [
    custom(21, '伏见稻荷大社', '京都', '伏见', 34.9671, 135.7727),
    custom(22, '清水寺', '京都', '东山', 34.9949, 135.785),
    custom(23, '鸭川', '京都', '中京', 35.0086, 135.7713)
  ],
  [MOCK_TRIP_HOKKAIDO]: [
    custom(31, '大通公园', '札幌', '中央区', 43.0598, 141.3469),
    custom(32, '小樽运河', '小樽', '小樽', 43.1977, 140.9941)
  ]
}

const plan = (n: number, placeId: number | undefined, placeName: string, area: string, plannedDate: string, plannedTime: string, lat: number, lng: number, status: string, sortOrder: number, note?: string): ItineraryView =>
  ({ id: ID_BASE.itinerary + n, placeId, placeName, area, plannedDate, plannedTime, latitude: lat, longitude: lng, status, sortOrder, note, createdAt: '2026-09-15T03:00:00' })

export const mockItinerary: Record<number, ItineraryView[]> = {
  [MOCK_TRIP_TOKYO]: [
    plan(1, ID_BASE.place + 7, '东京塔', '港区', '2026-09-27', '19:30', 35.6586, 139.7454, 'DONE', 1),
    plan(2, undefined, '筑地场外市场', '中央区', '2026-09-28', '08:00', 35.6655, 139.7707, 'PLANNED', 2, '早上去吃玉子烧和海鲜丼')
  ],
  [MOCK_TRIP_KYOTO]: [],
  [MOCK_TRIP_HOKKAIDO]: [
    plan(11, ID_BASE.place + 31, '大通公园', '中央区', '2026-12-20', '17:00', 43.0598, 141.3469, 'PLANNED', 1, '白色灯树节'),
    plan(12, ID_BASE.place + 32, '小樽运河', '小樽', '2026-12-22', '16:00', 43.1977, 140.9941, 'PLANNED', 2),
    plan(13, undefined, '二世谷滑雪场', '二世谷', '2026-12-23', '09:00', 42.8048, 140.6874, 'PLANNED', 3)
  ]
}
