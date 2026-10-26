/** 分享九宫格编辑逻辑：放入 / 替换 / 交换格子、地点与时间文案、素材分组 */
import { describe, expect, it } from 'vitest'
import type { PhotoView, TimelineDay } from '@/services/tabitrace-api'
import { gridMaterialGroups, gridPhotos, materialWhen, placeAddress, placeInSlot, swapSlots } from '@/utils/share-grid'

describe('照片格操作', () => {
  it('没选满：接在已选之后，不留空格', () => {
    expect(placeInSlot([1, 2], 9, 5)).toEqual([1, 2, 9])
  })
  it('选中已有照片的格子：替换', () => {
    expect(placeInSlot([1, 2, 3], 9, 1)).toEqual([1, 9, 3])
  })
  it('放入的照片已在别的格子：两格交换', () => {
    expect(placeInSlot([1, 2, 3], 3, 0)).toEqual([3, 2, 1])
  })
  it('最多 6 张', () => {
    expect(placeInSlot([1, 2, 3, 4, 5, 6], 9, 6)).toEqual([1, 2, 3, 4, 5, 6])
    expect(placeInSlot([1, 2, 3, 4, 5, 6], 9, 5)).toEqual([1, 2, 3, 4, 5, 9])
  })
  it('交换两个已选格；涉及自动补齐的格子时不变', () => {
    expect(swapSlots([1, 2, 3], 0, 2)).toEqual([3, 2, 1])
    expect(swapSlots([1, 2], 0, 4)).toEqual([1, 2])
  })
})

describe('地点与时间文案', () => {
  const trip = { city: '东京', destinationName: '东京' }
  it('次级地址：城市 + 区域；区域缺失时只有城市；不重复城市名', () => {
    expect(placeAddress(trip, { area: '浅草' })).toBe('东京 浅草')
    expect(placeAddress(trip, { area: '' })).toBe('东京')
    expect(placeAddress(trip, { area: '东京站' })).toBe('东京站')
    expect(placeAddress({ city: '', destinationName: '' }, { area: '镰仓' })).toBe('镰仓')
  })
  it('DAY · 时间；没有关联打卡时用日期', () => {
    expect(materialWhen({ dayNo: 1, date: '2026-10-01', time: '10:30' })).toBe('DAY 01 · 10:30')
    expect(materialWhen({ dayNo: null, date: '2026-10-03', time: '18:05' })).toBe('10.03 · 18:05')
    expect(materialWhen({ dayNo: null, date: null, time: '' })).toBe('')
  })
})

describe('素材分组与自动补齐', () => {
  const checkin = (id: number, time: string, placeName: string, area?: string) => ({ id, tripId: 1, checkinType: 'MANUAL', checkinTime: time, placeName, area })
  const timeline: TimelineDay[] = [
    { date: '2026-10-01', items: [{ checkin: checkin(1, '2026-10-01T10:30:00+09:00', '浅草寺', '浅草'), photos: [] }] },
    { date: '2026-10-02', items: [] },
    { date: '2026-10-03', items: [{ checkin: checkin(2, '2026-10-03T19:00:00+09:00', '东京塔', '港区'), photos: [] }] }
  ]
  const photo = (id: number, checkinId?: number, featured = false): PhotoView => ({ id, tripId: 1, checkinId, storageKey: `k${id}`, imageUrl: `u${id}`, mimeType: 'image/jpeg', featured })
  const photos = [photo(10, 1), photo(11, 1, true), photo(12, 2), photo(13)]

  it('按天分组、精选在前；未关联打卡的照片单独一组；地点来自打卡', () => {
    const groups = gridMaterialGroups(photos, timeline, { city: '东京', destinationName: '东京' })
    expect(groups.map(g => g.key)).toEqual(['2026-10-01', '2026-10-03', 'loose'])
    expect(groups[0].items.map(m => m.photo.id)).toEqual([11, 10])
    expect(groups[0].items[0]).toMatchObject({ placeName: '浅草寺', address: '东京 浅草', dayNo: 1 })
    expect(groups[1].title).toMatch(/^DAY 02 · 10\.03/)
    expect(groups[2].items[0]).toMatchObject({ placeName: null, address: null, dayNo: null })
  })
  it('只看某一天时只有那一天', () => {
    expect(gridMaterialGroups(photos, timeline, { city: '东京', destinationName: '东京' }, '2026-10-03').map(g => g.key)).toEqual(['2026-10-03'])
  })
  it('没选满时自动补齐，手动指定的排在前面', () => {
    expect(gridPhotos(photos, timeline, { photoIds: [12] }).map(p => p.id)[0]).toBe(12)
    expect(gridPhotos(photos, timeline, { photoIds: [] })).toHaveLength(4)
  })
})
