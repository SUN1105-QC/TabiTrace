import type { CheckinView } from '@/services/tabitrace-api'
import { ID_BASE, MOCK_TRIP_KYOTO, MOCK_TRIP_TOKYO } from './ids'

const P = ID_BASE.place
const c = (n: number, tripId: number, placeId: number | undefined, placeName: string, area: string, checkinTime: string, lat: number, lng: number, note: string, itineraryItemId?: number): CheckinView =>
  ({ id: ID_BASE.checkin + n, tripId, placeId, itineraryItemId, checkinType: 'MANUAL', checkinTime, latitude: lat, longitude: lng, placeName, area, note, createdAt: checkinTime })

/** 打卡时间都带 +09:00，与后端返回格式一致 */
export const mockCheckins: CheckinView[] = [
  c(1, MOCK_TRIP_TOKYO, P + 1, '浅草寺', '浅草', '2026-09-24T09:30:00+09:00', 35.7148, 139.7967, '清晨的雷门人还不多，香火味很重。'),
  c(2, MOCK_TRIP_TOKYO, P + 2, '仲见世商店街', '浅草', '2026-09-24T11:10:00+09:00', 35.7119, 139.7964, '人形烧刚出炉，烫手但很香。'),
  c(3, MOCK_TRIP_TOKYO, P + 3, '上野公园', '上野', '2026-09-25T13:10:00+09:00', 35.7156, 139.7745, '坐在长椅上吃了鲷鱼烧，看熊猫排队的人好多。'),
  c(4, MOCK_TRIP_TOKYO, P + 4, '秋叶原电器街', '秋叶原', '2026-09-25T16:40:00+09:00', 35.6984, 139.7731, '找到了一直想要的手办。'),
  c(5, MOCK_TRIP_TOKYO, P + 5, '涩谷十字路口', '涩谷', '2026-09-26T18:20:00+09:00', 35.6595, 139.7005, '绿灯一亮，所有人同时出发。'),
  c(6, MOCK_TRIP_TOKYO, P + 6, '东京都厅展望台', '新宿', '2026-09-26T20:10:00+09:00', 35.6896, 139.6917, '免费的夜景，一眼望不到头的灯。'),
  c(7, MOCK_TRIP_TOKYO, P + 7, '东京塔', '港区', '2026-09-27T19:40:00+09:00', 35.6586, 139.7454, '夜里的东京塔比想象中更暖。', ID_BASE.itinerary + 1),
  c(21, MOCK_TRIP_KYOTO, P + 21, '伏见稻荷大社', '伏见', '2026-04-03T08:20:00+09:00', 34.9671, 135.7727, '千本鸟居一直走到山腰，越往上人越少。'),
  c(22, MOCK_TRIP_KYOTO, P + 22, '清水寺', '东山', '2026-04-04T15:30:00+09:00', 34.9949, 135.785, '樱花刚好满开。'),
  c(23, MOCK_TRIP_KYOTO, P + 23, '鸭川', '中京', '2026-04-05T18:00:00+09:00', 35.0086, 135.7713, '河边坐满了看夕阳的人。')
]
