import type { PlaceView, TripView } from '@/services/tabitrace-api'
import { photoMedium } from '@/utils/photo-variants'
import { deliverFiles, type ExportFile } from '@/utils/share-export'
import { CHECKIN_EXPORT_FORMATS, REPORT_HEIGHT, REPORT_WIDTH, checkinExportFilename, checkinsCsv, layoutCheckinReport, wrapReportText, type CheckinExportFormat, type CheckinExportRecord } from './checkin-export'
import { checkinMapPoints } from './checkin-map'

const FONT = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
const font = (size: number, bold = false) => `${bold ? 700 : 400} ${size}px ${FONT}`

// 跨域照片按公开资源读取，不携带账户 Cookie；超时后由绘制层保留记录并提示缺图。
async function loadPhoto(url: string): Promise<ImageBitmap> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), mode: 'cors', credentials: 'omit' })
  if (!response.ok) throw new Error('照片加载失败')
  return createImageBitmap(await response.blob())
}

/** CSV 直接导出结构化记录；图片/PDF 共用分页指令和画布，地图页可选且使用同一套记录编号。 */
export async function exportCheckins({ trip, records, scope, format, includePhotos, includeMap = true, places = [], onProgress }: {
  trip: TripView; records: CheckinExportRecord[]; scope: string; format: CheckinExportFormat; includePhotos: boolean
  includeMap?: boolean; places?: PlaceView[]
  onProgress: (message: string) => void
}) {
  if (!records.length) throw new Error('当前范围没有打卡记录')
  const baseName = checkinExportFilename(trip.title, scope)
  if (format === 'csv') {
    const how = await deliverFiles([{ name: `${baseName}.csv`, blob: new Blob([checkinsCsv(records)], { type: 'text/csv;charset=utf-8' }) }])
    return { how, pages: 1, missingPhotos: 0, schematicMap: false }
  }
  onProgress('正在排版打卡记录…')
  // 字体加载完成后再测量和分页，避免测量字体与实际绘制字体不同造成中文换行错位。
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = REPORT_WIDTH; canvas.height = REPORT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器暂不支持图片导出，请改用 CSV 格式')
  const measure = (text: string, size: number, bold = false) => { ctx.font = font(size, bold); return ctx.measureText(text).width }
  const mapPoints = includeMap ? checkinMapPoints(records, places) : []
  const hasMap = mapPoints.length > 0
  const content = layoutCheckinReport(records, includePhotos, measure, hasMap)
  const pages = hasMap ? [null, ...content] : content
  const pdf = format === 'pdf' ? new (await import('jspdf')).jsPDF({ unit: 'mm', format: 'a4', compress: true }) : null
  const files: ExportFile[] = []
  let missingPhotos = 0
  let schematicMap = false
  const titleLines = wrapReportText(trip.title, 1088, s => measure(s, 40, true))
  const drawText = (text: string, x: number, y: number, size: number, bold = false, color = '#302A25') => {
    ctx.font = font(size, bold); ctx.fillStyle = color; ctx.textBaseline = 'top'; ctx.fillText(text, x, y)
  }
  try {
    for (const [index, ops] of pages.entries()) {
      onProgress(`正在生成 ${index + 1} / ${pages.length} 页…`)
      ctx.fillStyle = '#FFFCF7'; ctx.fillRect(0, 0, REPORT_WIDTH, REPORT_HEIGHT)
      drawText('旅迹 TABITRACE · 打卡记录', 76, 58, 21, true, '#B5662D')
      titleLines.slice(0, 2).forEach((line, i) => drawText(i === 1 && titleLines.length > 2 ? `${line.slice(0, -1)}…` : line, 76, 104 + i * 50, 40, true))
      drawText(`${scope === 'ALL' ? `${trip.startDate} - ${trip.endDate}` : scope}  ·  ${records.length} 次打卡  ·  ${new Set(records.map(r => r.date)).size} 天`, 76, 226, 22, false, '#80766C')
      if (ops === null) {
        onProgress('正在生成旅行地图…')
        drawText('旅行地图', 76, 300, 32, true)
        drawText('打卡位置与到达顺序 · 编号与后续打卡记录对应', 76, 353, 22, false, '#80766C')
        const { drawCheckinMap } = await import('./export-checkin-map')
        const map = await drawCheckinMap(ctx, mapPoints, { x: 76, y: 405, width: 1088, height: 830 })
        schematicMap = map.schematic
        drawText(`${mapPoints.length} 次打卡有位置${records.length > mapPoints.length ? ` · ${records.length - mapPoints.length} 次未保存坐标，仍保留文字记录` : ''}`, 76, 1270, 22, false, '#80766C')
        const notes = [
          ...(map.schematic ? ['底图暂不可用：当前为按真实坐标绘制的位置示意图。'] : []),
          '连线仅表示同一天的打卡顺序，不代表实际道路或导航路线。',
          '重复位置的编号合并显示；缺少坐标的记录不连线。',
          ...(map.attribution ? [map.attribution] : [])
        ]
        let y = 1320
        for (const note of notes) for (const line of wrapReportText(note, 1088, s => measure(s, 18))) { drawText(line, 76, y, 18, false, '#80766C'); y += 28 }
      }
      for (const op of ops ?? []) {
        if (op.kind === 'text') drawText(op.text, op.x, op.y, op.size, op.bold, op.color)
        else if (op.kind === 'rule') { ctx.fillStyle = '#E9DFD3'; ctx.fillRect(76, op.y, 1088, 1) }
        else {
          let bitmap: ImageBitmap | undefined
          try {
            bitmap = await loadPhoto(photoMedium(op.photo))
            const scale = Math.max(op.width / bitmap.width, op.height / bitmap.height)
            const w = op.width / scale, h = op.height / scale
            ctx.drawImage(bitmap, (bitmap.width - w) / 2, (bitmap.height - h) / 2, w, h, op.x, op.y, op.width, op.height)
          } catch {
            missingPhotos++
            ctx.fillStyle = '#EEE6DA'; ctx.fillRect(op.x, op.y, op.width, op.height)
            drawText('照片暂时无法加载', op.x + 44, op.y + 96, 22, false, '#80766C')
          } finally { bitmap?.close() }
        }
      }
      drawText('把走过的地方，留成回忆。', 76, 1652, 20, false, '#9A8E82')
      drawText(`${index + 1} / ${pages.length}`, 1060, 1652, 20, false, '#9A8E82')
      if (pdf) {
        if (index > 0) pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297)
      } else {
        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, 0.94))
        if (!blob) throw new Error('图片生成失败，请重试或选择其他格式')
        files.push({ name: `${baseName}${pages.length > 1 ? `-${String(index + 1).padStart(2, '0')}` : ''}.${format === 'jpeg' ? 'jpg' : 'png'}`, blob })
      }
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    if (pdf) files.push({ name: `${baseName}.pdf`, blob: pdf.output('blob') })
    onProgress('正在准备下载…')
    const how = await deliverFiles(files)
    return { how, pages: pages.length, missingPhotos, schematicMap }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : `${CHECKIN_EXPORT_FORMATS.find(f => f.value === format)?.label}导出失败`)
  } finally { canvas.width = 0; canvas.height = 0 }
}
