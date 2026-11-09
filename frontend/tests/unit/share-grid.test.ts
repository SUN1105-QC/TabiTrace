/** 分享九宫格编辑逻辑：放入 / 替换 / 交换格子、地点与时间文案、素材分组 */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PhotoView, TimelineDay, TripView } from '@/services/tabitrace-api'
import { ShareGridCard } from '@/components/share/ShareGridCard'
import { gridMaterialGroups, gridPhotos, gridSlotCount, materialWhen, placeAddress, placeInSlot, swapSlots } from '@/utils/share-grid'

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
  it('可选满 9 张，第 9 格可替换，不能超过 9 张', () => {
    expect(placeInSlot([1, 2, 3, 4, 5, 6, 7, 8], 9, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(placeInSlot([1, 2, 3, 4, 5, 6, 7, 8, 9], 10, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10])
    expect(placeInSlot([1, 2, 3, 4, 5, 6, 7, 8, 9], 10, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
  it('交换两个已选格；涉及自动补齐的格子时不变', () => {
    expect(swapSlots([1, 2, 3], 0, 2)).toEqual([3, 2, 1])
    expect(swapSlots([1, 2], 0, 4)).toEqual([1, 2])
  })
})

describe('标准九宫格成品', () => {
  const trip: TripView = { id: 1, title: '东京自驾游', city: '东京', destinationName: '东京', startDate: '2026-10-01', endDate: '2026-10-03', peopleCount: 1, planType: 'FREE', status: 'COMPLETED', visibility: 'PRIVATE' }
  const photos: PhotoView[] = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, tripId: 1, storageKey: `k${i}`, imageUrl: `/photos/${i + 1}.jpg`, mimeType: 'image/jpeg', featured: false }))
  const render = (items: PhotoView[], editable = false) => renderToStaticMarkup(createElement(ShareGridCard, { trip, timeline: [], photos: items, onSlot: editable ? () => {} : undefined }))

  it('九格都显示照片，原来的第 1、5、9 格可编辑，导出使用相同顺序', () => {
    const html = render(photos, true)
    expect(html.match(/class="sg-tile is-image/g)).toHaveLength(9)
    expect([...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1])).toEqual(photos.map(p => p.imageUrl))
    for (const n of [1, 5, 9]) expect(html).toContain(`aria-label="第 ${n} 张照片格"`)
    const exported = render(photos)
    expect(exported.match(/class="sg-tile is-image"/g)).toHaveLength(9)
    expect(exported).not.toContain('is-editable')
    expect(exported).not.toMatch(/is-(title|data|footer|memo)/)
  })
  it('8 张照片保留 1 个空位；没有照片时保留 9 个空位', () => {
    const eight = render(photos.slice(0, 8))
    expect(eight.match(/class="sg-tile is-image"/g)).toHaveLength(8)
    expect(eight.match(/class="sg-tile is-empty"/g)).toHaveLength(1)
    expect(eight).toContain('待添加照片')
    expect(render([]).match(/class="sg-tile is-empty"/g)).toHaveLength(9)
    expect(render(photos)).not.toContain('is-empty')
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
  it('两种格式最多选 9 张，标准格式默认自动补齐 9 张', () => {
    expect(gridSlotCount()).toBe(9)
    expect(gridSlotCount('scrapbook')).toBe(9)
    const many = Array.from({ length: 12 }, (_, i) => photo(i + 20))
    expect(gridPhotos(many, timeline, { photoIds: [31] }).map(p => p.id)).toEqual([31, 20, 21, 22, 23, 24, 25, 26, 27])
  })
  it('只有 8 张时不重复照片，上传第 9 张后自动补齐', () => {
    const eight = Array.from({ length: 8 }, (_, i) => photo(i + 20))
    expect(gridPhotos(eight, timeline, { photoIds: [] }).map(p => p.id)).toEqual(eight.map(p => p.id))
    expect(gridPhotos([...eight, photo(28)], timeline, { photoIds: [] })).toHaveLength(9)
  })
  it('单日不足 9 张时保留空位，不使用其他日期的照片', () => {
    expect(gridPhotos(photos, timeline, { photoIds: [12], day: '2026-10-01' }).map(p => p.id)).toEqual([11, 10])
  })
})
