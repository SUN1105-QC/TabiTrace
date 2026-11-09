import type { CheckinView, TimelineDay, TimelinePhoto } from '@/services/tabitrace-api'
import { timeOfDay, toDate } from '@/lib/time'

export type CheckinExportFormat = 'pdf' | 'png' | 'jpeg' | 'csv'
export type CheckinExportRecord = { date: string; checkin: CheckinView; photos: TimelinePhoto[] }
export const CHECKIN_EXPORT_FORMATS: { value: CheckinExportFormat; label: string; description: string }[] = [
  { value: 'pdf', label: 'PDF 文档', description: 'A4 自动分页，适合保存和打印' },
  { value: 'png', label: 'PNG 图片', description: '清晰无损，按页导出图片' },
  { value: 'jpeg', label: 'JPG 图片', description: '文件更小，便于发送和分享' },
  { value: 'csv', label: 'CSV 表格', description: '可用 Excel 打开，整理完整文字记录' }
]

/** 直接读取完整时间轴，不受页面分页、计划完成状态或地图节点合并影响。 */
export function checkinExportRecords(timeline: TimelineDay[], day = 'ALL'): CheckinExportRecord[] {
  return timeline.filter(d => day === 'ALL' || d.date === day)
    .flatMap(d => d.items.map(item => ({ date: d.date, ...item })))
    .sort((a, b) => a.date.localeCompare(b.date) || (toDate(a.checkin.checkinTime)?.getTime() ?? 0) - (toDate(b.checkin.checkinTime)?.getTime() ?? 0) || a.checkin.id - b.checkin.id)
}

/** 引号、换行与 Excel 公式前缀都按数据处理；UTF-8 BOM 保证中文可直接打开。 */
// 使用前置单引号阻止表格软件把笔记识别成公式；双引号转义负责保留原有标点与换行。
function csvCell(value: string | number | undefined | null) {
  let text = value == null ? '' : String(value)
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function checkinsCsv(records: CheckinExportRecord[]) {
  const rows: (string | number | undefined)[][] = [['日期', '时间', '地点', '区域', '打卡笔记', '天气', '温度（°C）', '照片数量']]
  for (const { date, checkin: c, photos } of records) rows.push([date, timeOfDay(c.checkinTime), c.placeName, c.area, c.note, c.weatherText, c.temperatureC, photos.length])
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function checkinExportFilename(title: string, scope: string) {
  const safe = title.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/g, '').slice(0, 70) || '旅行'
  return `${safe}-打卡记录-${scope === 'ALL' ? '全部' : scope}`
}

export type ReportOp =
  | { kind: 'text'; x: number; y: number; text: string; size: number; bold?: boolean; color?: string }
  | { kind: 'photo'; x: number; y: number; width: number; height: number; photo: TimelinePhoto }
  | { kind: 'rule'; y: number }
export const REPORT_WIDTH = 1240
export const REPORT_HEIGHT = 1754
export const REPORT_TOP = 300
export const REPORT_BOTTOM = 1570

/** 在实际字体度量下换行；完整保留段落，超长网址和中文也能折行。 */
export function wrapReportText(text: string, width: number, measure: (text: string) => number) {
  const lines: string[] = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = ''
    for (const char of Array.from(paragraph)) {
      if (line && measure(line + char) > width) { lines.push(line); line = '' }
      line += char
    }
    lines.push(line)
  }
  return lines
}

/** 分页先于绘图，长笔记与多张照片可跨页；每页保留地点标题，不裁切记录。 */
// 此处只生成绘图指令，不加载图片；排版与下载分离后，失败照片不会改变记录顺序。
export function layoutCheckinReport(records: CheckinExportRecord[], includePhotos: boolean, measure: (text: string, size: number, bold?: boolean) => number, numbered = false) {
  const pages: ReportOp[][] = [[]]
  let y = REPORT_TOP
  let current: CheckinExportRecord
  let currentNumber = 0
  const placeTitle = () => `${numbered ? `${String(currentNumber).padStart(2, '0')} · ` : ''}${current.checkin.placeName || '未命名地点'}`
  const text = (value: string, size = 24, bold = false, color?: string) => {
    pages[pages.length - 1].push({ kind: 'text', x: 76, y, text: value, size, bold, color })
    y += size + 14
  }
  const heading = (continued: boolean) => {
    const c = current.checkin
    text(`${current.date.replace(/-/g, '.')}  ${timeOfDay(c.checkinTime)}${continued ? ' · 续' : ''}`, 20, false, '#A96834')
    for (const line of wrapReportText(placeTitle(), 1088, s => measure(s, 30, true))) {
      if (y + 44 > REPORT_BOTTOM) { pages.push([]); y = REPORT_TOP }
      text(line, 30, true)
    }
  }
  const ensure = (height: number) => {
    if (y + height <= REPORT_BOTTOM) return
    pages.push([]); y = REPORT_TOP
    heading(true)
  }
  for (const [index, record] of records.entries()) {
    current = record
    currentNumber = index + 1
    const titleLines = wrapReportText(placeTitle(), 1088, s => measure(s, 30, true)).length
    if (y + 34 + titleLines * 44 + 100 > REPORT_BOTTOM && pages[pages.length - 1].length) { pages.push([]); y = REPORT_TOP }
    heading(false)
    const c = record.checkin
    const details = [c.area, c.weatherText && `${c.weatherText}${c.temperatureC != null ? ` ${c.temperatureC}°C` : ''}`].filter(Boolean).join(' · ')
    if (details) for (const line of wrapReportText(details, 1088, s => measure(s, 22))) { ensure(36); text(line, 22, false, '#80766C') }
    if (c.note) {
      y += 8
      for (const line of wrapReportText(c.note, 1088, s => measure(s, 24))) { ensure(38); text(line) }
    }
    if (includePhotos) {
      for (let i = 0; i < record.photos.length; i += 3) {
        ensure(250)
        record.photos.slice(i, i + 3).forEach((photo, col) => pages[pages.length - 1].push({ kind: 'photo', x: 76 + col * 368, y, width: 352, height: 224, photo }))
        y += 246
      }
    }
    if (y + 30 <= REPORT_BOTTOM) pages[pages.length - 1].push({ kind: 'rule', y: y + 10 })
    y += 48
  }
  return pages
}
