import { describe, expect, it } from 'vitest'
import type { PlaceView } from '@/services/tabitrace-api'
import { checkinMapPoints, checkinMapSegments, checkinMapViewport, longitudeRange, type CheckinMapPoint } from '@/utils/checkin-map'
import { checkinExportRecords, layoutCheckinReport, type CheckinExportRecord } from '@/utils/checkin-export'

const record = (id: number, latitude?: number, longitude?: number, placeId?: number): CheckinExportRecord => ({ date: '2026-10-30', checkin: { id, tripId: 1, placeId, latitude, longitude, placeName: `地点${id}`, checkinTime: '2026-10-30T09:00:00+09:00', checkinType: 'MANUAL' }, photos: [] })
const point = (number: number, lat: number, lng: number, date = '2026-10-30'): CheckinMapPoint => ({ number, lat, lng, date, id: number, name: `地点${number}` })

describe('导出地图的真实位置与编号', () => {
  const places: PlaceView[] = [{ id: 10, name: '东京站', latitude: 35.68124, longitude: 139.767125, sourceType: 'MANUAL' }]
  it('打卡坐标优先，缺失或非法时回退关联地点；未定位的记录保留序号空档', () => {
    const records = [record(1, 35.7, 139.8, 10), record(2), record(3, undefined, undefined, 10), record(4, 91, 181, 10), record(5, NaN, Infinity)]
    expect(checkinMapPoints(records, places).map(p => [p.number, p.lat, p.lng])).toEqual([[1,35.7,139.8],[3,35.68124,139.767125],[4,35.68124,139.767125]])
  })
  it('接受赤道与零经度，不编造没有坐标的地点', () => {
    expect(checkinMapPoints([record(1,0,0),record(2)])).toEqual([point(1,0,0)])
    expect(checkinMapPoints([])).toEqual([])
  })
  it('地图范围跟随所选日期，单日导出从 1 重新编号', () => {
    const first=record(1,35,139), second={...record(2,36,140),date:'2026-10-31'}
    const timeline=[{date:first.date,items:[first]},{date:second.date,items:[second]}]
    expect(checkinMapPoints(checkinExportRecords(timeline,'2026-10-31'))).toEqual([point(1,36,140,'2026-10-31')].map(p=>({...p,id:2,name:'地点2'})))
  })
  it('只连接同一天且相邻的已定位打卡，不跨缺失坐标或跨天连线', () => {
    const list=[point(1,35,139),point(2,35.2,139.1),point(4,35.4,139.2),point(5,35.6,139.3,'2026-10-31'),point(6,35.8,139.4,'2026-10-31')]
    expect(checkinMapSegments(list).map(([a,b])=>[a.number,b.number])).toEqual([[1,2],[5,6]])
  })
  it('开启地图时，文字记录编号与地图一致，续页不丢编号', () => {
    const items=[record(1,35,139),{...record(2,36,140),checkin:{...record(2).checkin,note:'长笔记\n'.repeat(60)}}]
    const pages=layoutCheckinReport(items,false,(s,size)=>s.length*size,true)
    expect(pages.flat().some(op=>op.kind==='text'&&op.text==='01 · 地点1')).toBe(true)
    expect(pages.slice(1).every(page=>page.some(op=>op.kind==='text'&&op.text==='02 · 地点2'))).toBe(true)
  })
})

describe('地图视野与投影', () => {
  it('完整覆盖所有位置并保留边距，北方在上', () => {
    const list=[point(1,35.7,139.8),point(2,35.6,139.7),point(3,36,140)]
    const view=checkinMapViewport(list,1088,830)
    for(const p of list){const pixel=view.project(p);expect(pixel.x).toBeGreaterThanOrEqual(83);expect(pixel.x).toBeLessThanOrEqual(1005);expect(pixel.y).toBeGreaterThanOrEqual(83);expect(pixel.y).toBeLessThanOrEqual(747)}
    expect(view.project(list[2]).y).toBeLessThan(view.project(list[0]).y)
  })
  it('单点与重复位置居中，不产生无穷缩放', () => {
    const p=point(1,35.7,139.8),view=checkinMapViewport([p,{...p,number:2}],1088,830)
    expect(view.project(p).x).toBeCloseTo(544);expect(view.project(p).y).toBeCloseTo(415)
    expect(view.zoom).toBe(14)
  })
  it('跨日期变更线取最短经度范围，极地投影仍有限', () => {
    const list=[point(1,80,179),point(2,90,-179)]
    const range=longitudeRange(list)
    expect(range.east-range.west).toBeCloseTo(2)
    const view=checkinMapViewport(list,1088,830)
    for(const p of list){expect(Number.isFinite(view.project(p).x)).toBe(true);expect(Number.isFinite(view.project(p).y)).toBe(true)}
  })
})
