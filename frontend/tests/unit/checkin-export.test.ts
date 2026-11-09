import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CheckinView, TimelineDay, TimelinePhoto } from '@/services/tabitrace-api'
import { REPORT_BOTTOM, REPORT_TOP, checkinExportFilename, checkinExportRecords, checkinsCsv, layoutCheckinReport, wrapReportText, type CheckinExportRecord } from '@/utils/checkin-export'
import { deliverFiles } from '@/utils/share-export'

const checkin = (id: number, extra: Partial<CheckinView> = {}): CheckinView => ({ id, tripId: 1, checkinType: 'MANUAL', checkinTime: '2026-10-31T10:00:00+09:00', placeName: '浅草寺', ...extra })
const photo = (id: number): TimelinePhoto => ({ id, imageUrl: `/photo/${id}.jpg`, featured: false })
const record = (id: number, extra: Partial<CheckinView> = {}, photos: TimelinePhoto[] = []): CheckinExportRecord => ({ date: '2026-10-31', checkin: checkin(id, extra), photos })
const measure = (s: string, size: number) => Array.from(s).length * size

describe('完整打卡导出数据', () => {
  it('全部导出不受 30 条页面分页限制，同一地点的多次打卡均保留', () => {
    const timeline: TimelineDay[] = [{ date: '2026-10-31', items: Array.from({ length: 45 }, (_, i) => ({ checkin: checkin(i + 1), photos: [photo(i)] })) }]
    expect(checkinExportRecords(timeline)).toHaveLength(45)
    expect(new Set(checkinExportRecords(timeline).map(r => r.checkin.id)).size).toBe(45)
  })
  it('按后端返回的当地日期筛选，保留范围外日期，按实际时间排序', () => {
    const timeline: TimelineDay[] = [
      { date: '2026-11-01', items: [{ checkin: checkin(3, { checkinTime: '2026-10-31T16:00:00Z' }), photos: [] }] },
      { date: '2026-10-31', items: [{ checkin: checkin(1, { checkinTime: '2026-10-31T00:00:00Z' }), photos: [] }, { checkin: checkin(2, { checkinTime: '2026-10-31T08:00:00+09:00' }), photos: [] }] }
    ]
    expect(checkinExportRecords(timeline).map(r => r.checkin.id)).toEqual([2, 1, 3])
    expect(checkinExportRecords(timeline, '2026-11-01').map(r => r.checkin.id)).toEqual([3])
    expect(checkinExportRecords(timeline, '2026-11-02')).toEqual([])
    expect(checkinExportRecords([])).toEqual([])
  })
  it('文件名去除非法路径和控制字符', () => {
    expect(checkinExportFilename('东京/旅行:*?\n', 'ALL')).toBe('东京_旅行____-打卡记录-全部')
    expect(checkinExportFilename('', '2026-10-31')).toBe('旅行-打卡记录-2026-10-31')
  })
})

describe('CSV 完整性与公式防护', () => {
  it('中文 BOM、双引号、逗号、换行和零度气温均正确保留', () => {
    const csv = checkinsCsv([record(1, { placeName: '东京,"站"', note: '第一行\n第二行', temperatureC: 0 }, [photo(1), photo(2)])])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"东京,""站"""')
    expect(csv).toContain('"第一行\n第二行"')
    expect(csv).toContain('"0","2"\r\n')
  })
  it('用户填写的公式和前导空白不会成为 Excel 公式', () => {
    for (const value of ['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', '  =1', '\t=1']) {
      expect(checkinsCsv([record(1, { note: value })])).toContain(`"'${value}"`)
    }
  })
})

describe('图片与 PDF 分页', () => {
  it('中文、emoji、长网址和空行换行不丢字', () => {
    expect(wrapReportText('东京🗼旅行', 2, s => Array.from(s).length)).toEqual(['东京', '🗼旅', '行'])
    expect(wrapReportText('a\n\nb', 10, s => s.length)).toEqual(['a', '', 'b'])
    const url = 'https://example.com/' + 'x'.repeat(300)
    expect(wrapReportText(url, 40, s => s.length).join('')).toBe(url)
  })
  it('很长的笔记跨页完整保留，正文和照片不超出页面内容区', () => {
    const note = Array.from({ length: 180 }, (_, i) => `第${i + 1}行：今天走过东京的小街。`).join('\n')
    const photos = Array.from({ length: 16 }, (_, i) => photo(i + 1))
    const pages = layoutCheckinReport([record(1, { note }, photos)], true, measure)
    expect(pages.length).toBeGreaterThan(5)
    const all = pages.flat()
    expect(all.filter(op => op.kind === 'photo')).toHaveLength(16)
    for (const line of note.split('\n')) expect(all.some(op => op.kind === 'text' && op.text === line)).toBe(true)
    for (const op of all) {
      expect(op.y).toBeGreaterThanOrEqual(REPORT_TOP)
      expect(op.y + (op.kind === 'photo' ? op.height : op.kind === 'text' ? op.size : 0)).toBeLessThanOrEqual(REPORT_BOTTOM)
    }
    for (const page of pages) expect(page.some(op => op.kind === 'text' && op.text === '浅草寺')).toBe(true)
  })
  it('取消包含照片后不生成照片块，30 条以上记录不会被截断', () => {
    const records = Array.from({ length: 46 }, (_, i) => record(i, { placeName: `地点${i}` }, [photo(i)]))
    const all = layoutCheckinReport(records, false, measure).flat()
    expect(all.some(op => op.kind === 'photo')).toBe(false)
    for (const r of records) expect(all.some(op => op.kind === 'text' && op.text === r.checkin.placeName)).toBe(true)
  })
})

describe('移动端文件分享', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('保留 PDF、JPG、PNG 和 CSV 的实际 MIME 类型', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.stubGlobal('navigator', { canShare: () => true, share })
    const types = ['application/pdf', 'image/jpeg', 'image/png', 'text/csv;charset=utf-8']
    expect(await deliverFiles(types.map((type, i) => ({ name: `file${i}`, blob: new Blob(['sample'], { type }) })))).toBe('shared')
    expect(share.mock.calls[0][0].files.map((f: File) => f.type)).toEqual(types)
  })
})
