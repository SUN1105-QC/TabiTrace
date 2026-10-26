import type { PhotoView } from '@/services/tabitrace-api'
import generated from '@/constants/place-images.generated.json'
import { hdImage } from '@/utils/place-images'
import { ID_BASE, MOCK_TRIP_KYOTO, MOCK_TRIP_TOKYO } from './ids'

/**
 * 照片全部使用项目里的官方高清图（public/images/explore/hd，不依赖随机网络图片），
 * 和真实照片一样有缩略图 / 中图 / 原图三档：thumb = 640 档、medium = 1920 档、原图 = 2560 档。
 * 京都旅行没有专门的素材，借用画面相近的东京照片（神社、庭园、水边）作开发占位。
 */
const C = ID_BASE.checkin
const VARIANTS = generated as Record<string, { variants: Record<string, { width: number; height: number; bytes: number }> }>
const p = (n: number, tripId: number, checkinId: number | undefined, slug: string, featured: boolean, capturedAt: string): PhotoView => {
  const original = VARIANTS[slug].variants['2560']
  return {
    id: ID_BASE.photo + n, tripId, checkinId, storageKey: `mock/${tripId}/${n}.webp`,
    imageUrl: hdImage(slug, 2560), mediumUrl: hdImage(slug, 1920), thumbUrl: hdImage(slug, 640),
    width: original.width, height: original.height, fileSize: original.bytes, mimeType: 'image/webp', featured, capturedAt, createdAt: capturedAt
  }
}

export const mockPhotos: PhotoView[] = [
  p(1, MOCK_TRIP_TOKYO, C + 1, '01-sensoji-kaminarimon', true, '2026-09-24T00:32:00Z'),
  p(2, MOCK_TRIP_TOKYO, C + 1, '04-tokyo-skytree', false, '2026-09-24T00:40:00Z'),
  p(3, MOCK_TRIP_TOKYO, C + 2, '02-nakamise-street', false, '2026-09-24T02:12:00Z'),
  p(4, MOCK_TRIP_TOKYO, C + 2, '26-tsukiji-outer-market', true, '2026-09-24T03:30:00Z'),
  p(5, MOCK_TRIP_TOKYO, C + 3, '20-ueno-park', true, '2026-09-25T04:12:00Z'),
  p(6, MOCK_TRIP_TOKYO, C + 3, '21-ueno-zoo-panda', false, '2026-09-25T04:30:00Z'),
  p(7, MOCK_TRIP_TOKYO, C + 4, '19-akihabara', false, '2026-09-25T07:42:00Z'),
  p(8, MOCK_TRIP_TOKYO, C + 4, '18-kanda-myojin', false, '2026-09-25T07:50:00Z'),
  p(9, MOCK_TRIP_TOKYO, C + 5, '09-shibuya-crossing', true, '2026-09-26T09:22:00Z'),
  p(10, MOCK_TRIP_TOKYO, C + 5, '10-hachiko-statue', false, '2026-09-26T09:40:00Z'),
  p(11, MOCK_TRIP_TOKYO, C + 6, '16-tokyo-metropolitan-government', true, '2026-09-26T11:12:00Z'),
  p(12, MOCK_TRIP_TOKYO, undefined, '17-kabukicho', false, '2026-09-26T12:30:00Z'),
  p(13, MOCK_TRIP_TOKYO, C + 7, '03-tokyo-tower', true, '2026-09-27T10:42:00Z'),
  p(14, MOCK_TRIP_TOKYO, C + 7, '24-rainbow-bridge', false, '2026-09-27T10:50:00Z'),
  p(21, MOCK_TRIP_KYOTO, C + 21, '13-meiji-jingu', true, '2026-04-02T23:25:00Z'),
  p(22, MOCK_TRIP_KYOTO, C + 22, '08-imperial-palace', true, '2026-04-04T06:35:00Z'),
  p(23, MOCK_TRIP_KYOTO, C + 22, '15-shinjuku-gyoen', false, '2026-04-04T07:10:00Z'),
  p(24, MOCK_TRIP_KYOTO, C + 23, '25-odaiba-seaside-park', true, '2026-04-05T09:05:00Z'),
  p(25, MOCK_TRIP_KYOTO, undefined, '12-omotesando', false, '2026-04-06T01:20:00Z')
]
