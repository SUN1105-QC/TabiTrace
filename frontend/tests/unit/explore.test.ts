/**
 * 推荐探索的规则（utils/explore.ts）：分类映射、搜索、为你推荐（不随机、多样、排除已加入、已打卡降权）、
 * 区域聚合、旅行灵感排序。地点数据取自官方种子数据的子集。
 */
import { describe, expect, it } from 'vitest'
import type { OfficialRouteView, PlaceView } from '@/services/tabitrace-api'
import { CATEGORIES, categoryOf, searchPlaces, selectAreas, selectInspirations, selectRecommended, toExplorePlace } from '@/utils/explore'

const p = (id: number, name: string, area: string, category: string, tags: string[], extra: Partial<PlaceView> = {}): PlaceView =>
  ({ id, name, area, category, tags, sourceType: 'OFFICIAL', tagline: `${name}的一句话`, ...extra })

const PLACES: PlaceView[] = [
  p(1, '浅草寺', '浅草', '寺院', ['MUST', 'CULTURE', 'FREE', 'PHOTO', 'FIRST', 'WALK'], { editorRank: 1, coverImage: '/a.jpg' }),
  p(2, '雷门', '浅草', '地标', ['PHOTO', 'FREE', 'FIRST', 'CULTURE'], { coverImage: '/a.jpg' }),
  p(4, '仲见世', '浅草', '街区', ['WALK', 'FOOD', 'SHOP', 'FREE'], { coverImage: '/n.jpg' }),
  p(6, '神田明神', '秋叶原', '神社', ['CULTURE', 'FREE']),
  p(8, '上野公园', '上野', '公园', ['NATURE', 'WALK', 'FREE', 'PHOTO', 'FIRST'], { coverImage: '/u.jpg' }),
  p(14, '银座', '银座', '街区', ['MUST', 'SHOP', 'WALK', 'FOOD', 'FIRST'], { editorRank: 3, coverImage: '/g.jpg' }),
  p(17, '涩谷十字路口', '涩谷', '城市地标', ['MUST', 'PHOTO', 'NIGHT', 'FREE', 'FIRST'], { editorRank: 5, coverImage: '/s.jpg' }),
  p(20, '明治神宫', '原宿', '神社', ['MUST', 'CULTURE', 'NATURE', 'FREE', 'WALK'], { editorRank: 4 }),
  p(24, '东京都厅', '新宿', '观景台', ['NIGHT', 'FREE', 'RAIN', 'PHOTO'], { coverImage: '/t.jpg' }),
  p(26, '东京塔', '港区', '地标', ['MUST', 'NIGHT', 'PHOTO', 'FIRST'], { editorRank: 2, coverImage: '/tt.jpg' }),
  p(28, '台场海滨公园', '台场', '海滨', ['NIGHT', 'WALK', 'NATURE', 'FREE', 'PHOTO'], { coverImage: '/r.jpg' }),
  p(30, '丰洲市场', '台场', '市场', ['FOOD', 'RAIN', 'FREE'])
]
const none = { joined: new Set<number>(), checkedIn: new Set<number>() }
const names = (list: PlaceView[]) => list.map(x => x.name)

describe('分类', () => {
  it('胶囊顺序固定为 全部 / 寺社 / 城市 / 公园 / 购物 / 美食 / 夜景', () => {
    expect(CATEGORIES.filter(c => !c.hidden).map(c => c.label)).toEqual(['全部', '寺社', '城市', '公园', '购物', '美食', '夜景'])
  })
  it('寺社按类别（寺院 / 神社）、夜景按标签映射；未知键回到全部', () => {
    expect(names(PLACES.filter(categoryOf('SHRINE').match))).toEqual(['浅草寺', '神田明神', '明治神宫'])
    expect(names(PLACES.filter(categoryOf('NIGHT').match))).toEqual(['涩谷十字路口', '东京都厅', '东京塔', '台场海滨公园'])
    expect(names(PLACES.filter(categoryOf('PARK').match))).toEqual(['上野公园', '台场海滨公园'])
    expect(categoryOf('NOPE').key).toBe('ALL')
  })
})

describe('搜索', () => {
  it('按地点名、区域、分类名搜索，忽略空格', () => {
    expect(names(searchPlaces(PLACES, '浅草'))).toEqual(['浅草寺', '雷门', '仲见世'])
    expect(names(searchPlaces(PLACES, '银 座'))).toEqual(['银座'])
    expect(names(searchPlaces(PLACES, '寺社'))).toEqual(['浅草寺', '神田明神', '明治神宫'])
    expect(searchPlaces(PLACES, '公园').length).toBe(2)
    expect(searchPlaces(PLACES, '').length).toBe(PLACES.length)
    expect(searchPlaces(PLACES, '不存在的地方')).toEqual([])
  })
})

describe('为你推荐', () => {
  it('默认：编辑精选优先，区域与大类都不重复 → 浅草寺 · 东京塔 · 银座', () => {
    expect(names(selectRecommended(PLACES, none))).toEqual(['浅草寺', '东京塔', '银座'])
  })
  it('结果稳定：同样的输入总是同样的输出（不随机）', () => {
    expect(names(selectRecommended([...PLACES].reverse(), none))).toEqual(names(selectRecommended(PLACES, none)))
  })
  it('排除已加入当前旅行的地点，已打卡的地点降权', () => {
    const r = selectRecommended(PLACES, { joined: new Set([26]), checkedIn: new Set([1]) })
    expect(names(r)).not.toContain('东京塔')
    expect(names(r)).not.toContain('浅草寺')
    expect(new Set(r.map(x => x.area)).size).toBe(3)
  })
  it('全部都已加入（旅行加入了官方探索）时仍给出 3 个，不会空着', () => {
    expect(selectRecommended(PLACES, { joined: new Set(PLACES.map(x => x.id)), checkedIn: new Set() })).toHaveLength(3)
  })
  it('候选不足 3 个不同区域时逐步放宽', () => {
    const asakusa = PLACES.filter(x => x.area === '浅草')
    expect(selectRecommended(asakusa, none)).toHaveLength(3)
  })
})

describe('区域与旅行灵感', () => {
  it('区域只来自真实数据，按地点数排序，标签最多 3 个', () => {
    const areas = selectAreas(PLACES)
    expect(areas[0]).toMatchObject({ name: '浅草', count: 3, note: '传统东京' })
    expect(areas.map(a => a.name)).not.toContain('东京站')
    expect(areas.every(a => a.tags.length <= 3)).toBe(true)
  })
  it('旅行灵感当季在前，最多 4 条', () => {
    const r = (id: number, season?: string) => ({ id, code: `R${id}`, title: `专题${id}`, englishTitle: '', description: '', season, placeIds: [] }) as OfficialRouteView
    const list = selectInspirations([r(1), r(2), r(3, '秋'), r(4), r(5)], '秋')
    expect(list.map(x => x.id)).toEqual([3, 1, 2, 4])
  })
  it('视图模型：卡片只保留精简字段与状态', () => {
    const v = toExplorePlace(PLACES[0], { joined: new Set([1]), checkedIn: new Set(), favorites: new Set([1]) })
    expect(v).toMatchObject({ id: 1, name: '浅草寺', area: '浅草', category: '寺院', joined: true, favorite: true, checkedIn: false })
    expect(v.tags.length).toBeLessThanOrEqual(2)
  })
})
