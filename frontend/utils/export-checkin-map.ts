import { mapTiles, maplibreStyle } from '@/lib/map-tiles'
import { ensureMaplibreWorker } from '@/components/map/maplibreWorker'
import { supportsWebGL2 } from '@/components/map/basicMap'
import type { StyleSpecification } from 'maplibre-gl'
import { checkinMapSegments, checkinMapViewport, type CheckinMapPoint } from './checkin-map'

type MapRect = { x: number; y: number; width: number; height: number }
const FONT = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'

/** 单独创建可导出的地图，不改变工作台视野；完成或超时后释放地图、Worker 连接和 DOM。 */
async function basemap(width: number, height: number, viewport: ReturnType<typeof checkinMapViewport>) {
  if (mapTiles.kind === 'none' || !supportsWebGL2()) throw new Error('底图暂不可用')
  const { Map } = await import('maplibre-gl')
  ensureMaplibreWorker()
  const container = document.createElement('div')
  container.dataset.checkinExportMap = 'true'
  container.setAttribute('aria-hidden', 'true')
  container.inert = true
  Object.assign(container.style, { position: 'fixed', left: '-20000px', top: '0', width: `${width}px`, height: `${height}px`, pointerEvents: 'none' })
  document.body.append(container)
  let map: InstanceType<typeof Map> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    map = new Map({ container, style: maplibreStyle() as StyleSpecification | string, center: viewport.center, zoom: viewport.zoom,
      interactive: false, attributionControl: { compact: false }, canvasContextAttributes: { preserveDrawingBuffer: true }, pixelRatio: 1, fadeDuration: 0 })
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('底图加载超时')), 18000)
      map!.once('error', () => reject(new Error('底图加载失败')))
      map!.once('idle', () => resolve())
    })
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法生成地图图片')
    context.drawImage(map.getCanvas(), 0, 0, width, height)
    // 立即检查像素读取权限，避免底图污染整个 PDF / 图片画布。
    context.getImageData(0, 0, 1, 1)
    const credit = container.querySelector('.maplibregl-ctrl-attrib-inner')
    const links = [...(credit?.querySelectorAll<HTMLAnchorElement>('a') ?? [])].map(a => a.href).filter(href => /^https?:\/\//.test(href))
    const attribution = [credit?.textContent?.replace(/\s+/g, ' ').trim() || 'MapLibre', ...new Set(links)].join(' · ')
    return { canvas, attribution }
  } finally {
    clearTimeout(timer)
    map?.remove()
    container.remove()
  }
}

/** 把底图、打卡编号与顺序线一起画进报告；无 WebGL / 离线时明确标为坐标示意。 */
export async function drawCheckinMap(ctx: CanvasRenderingContext2D, points: CheckinMapPoint[], rect: MapRect) {
  const viewport = checkinMapViewport(points, rect.width, rect.height)
  let attribution = '', schematic = false
  try {
    const base = await basemap(rect.width, rect.height, viewport)
    ctx.drawImage(base.canvas, rect.x, rect.y)
    attribution = base.attribution
    base.canvas.width = 0; base.canvas.height = 0
  } catch {
    schematic = true
    // 底图不可用时仍按真实坐标绘制示意，返回标记供报告提示，不能伪装成真实地图。
    ctx.fillStyle = '#F0EBE2'; ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    ctx.strokeStyle = '#DDD5C9'; ctx.lineWidth = 1
    for (let x = 0; x <= rect.width; x += 90) { ctx.beginPath(); ctx.moveTo(rect.x + x, rect.y); ctx.lineTo(rect.x + x, rect.y + rect.height); ctx.stroke() }
    for (let y = 0; y <= rect.height; y += 90) { ctx.beginPath(); ctx.moveTo(rect.x, rect.y + y); ctx.lineTo(rect.x + rect.width, rect.y + y); ctx.stroke() }
  }
  ctx.save()
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.width, rect.height); ctx.clip()
  const project = (p: CheckinMapPoint) => { const at = viewport.project(p); return { x: rect.x + at.x, y: rect.y + at.y } }
  ctx.strokeStyle = '#D76B2A'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.setLineDash([10, 8])
  for (const [from, to] of checkinMapSegments(points)) {
    const a = project(from), b = project(to)
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
  ctx.setLineDash([])
  // 同坐标记录共用一个标记，但保留各自编号；只合并视觉展示，不删除打卡记录。
  const locations = new globalThis.Map<string, CheckinMapPoint[]>()
  for (const point of points) { const key = `${point.lat},${point.lng}`; locations.set(key, [...(locations.get(key) ?? []), point]) }
  for (const group of locations.values()) {
    const at = project(group[0])
    const label = group.length > 3 ? `${group[0].number}+${group.length - 1}` : group.map(p => p.number).join(',')
    ctx.font = `700 22px ${FONT}`
    const width = Math.max(44, ctx.measureText(label).width + 24)
    ctx.fillStyle = '#D76B2A'; ctx.strokeStyle = '#FFFCF7'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.roundRect(at.x - width / 2, at.y - 23, width, 46, 23); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#FFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, at.x, at.y)
  }
  ctx.restore()
  ctx.strokeStyle = '#DED3C6'; ctx.lineWidth = 1; ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  return { attribution, schematic }
}
