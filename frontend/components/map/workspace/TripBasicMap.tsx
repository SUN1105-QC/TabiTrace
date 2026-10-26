'use client'

/**
 * 旅行地图工作台的基础地图（Leaflet，不依赖 WebGL）。
 * 在浏览器不支持 WebGL2 时由 TripMapCanvas 自动切换过来；接口与 WebGL 版本相同：
 * 标记（已打卡 / 计划编号 / 收藏）、虚线路线、选中飞到并弹出信息、按日期适配视野、搜索预览点、点地图选位置。
 */

import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'
import { Crosshair, Loader2, RefreshCcw } from 'lucide-react'
import type { MapPoint } from '@/utils/travel-map'
import { addBasemap, domIcon, loadLeaflet, type LeafletModule } from '@/components/map/basicMap'
import { MAP_TILES_MISSING } from '@/lib/map-tiles'
import type { PreviewPoint } from './TripMapCanvas'

const VARIANT_LABEL = { checkedIn: '已打卡', planned: '计划中', saved: '已收藏' } as const
const toLatLng = ([lng, lat]: [number, number]): [number, number] => [lat, lng]

type Props = {
  points: MapPoint[]
  route: [number, number][]
  selectedKey: string | null
  selectNonce?: number
  onSelect: (key: string) => void
  fitKey: string
  center?: [number, number] | null
  preview?: PreviewPoint | null
  picking?: boolean
  onPick?: (lat: number, lng: number) => void
}

export function TripBasicMap({ points, route, selectedKey, selectNonce = 0, onSelect, fitKey, center, preview, picking, onPick }: Props) {
  const box = useRef<HTMLDivElement | null>(null)
  const leaflet = useRef<LeafletModule | null>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const markers = useRef<Leaflet.Marker[]>([])
  const routeLine = useRef<Leaflet.Polyline | null>(null)
  const previewMarker = useRef<Leaflet.Marker | null>(null)
  const onSelectRef = useRef(onSelect)
  const onPickRef = useRef(onPick)
  const pickingRef = useRef(picking)
  const [attempt, setAttempt] = useState(0)
  const [ready, setReady] = useState(false)
  const [basemapDown, setBasemapDown] = useState(false)
  const [basemapMissing, setBasemapMissing] = useState(false)
  onSelectRef.current = onSelect
  onPickRef.current = onPick
  pickingRef.current = picking

  // 创建地图（重试时重新创建）
  useEffect(() => {
    let cancelled = false
    let stopBasemap = () => {}
    setReady(false)
    setBasemapDown(false)
    loadLeaflet().then(L => {
      if (cancelled || !box.current) return
      leaflet.current = L
      const map = L.map(box.current, { zoomControl: false, minZoom: 2, maxZoom: 18, worldCopyJump: true }).setView([30, 135], 3)
      L.control.zoom({ position: 'topright', zoomInTitle: '放大', zoomOutTitle: '缩小' }).addTo(map)
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>')
      stopBasemap = addBasemap(L, map, () => setBasemapDown(true), () => setBasemapDown(false), () => setBasemapMissing(true))
      map.on('click', e => { if (pickingRef.current) onPickRef.current?.(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) })
      mapRef.current = map
      setReady(true)
    }).catch(err => {
      // 地图脚本加载失败（网络中断 / 版本更新后旧分块失效）：不再一直转圈，显示底图不可用
      console.error('[基础地图] 加载失败', err)
      if (!cancelled) { setBasemapDown(true); setReady(true) }
    })
    const resize = () => mapRef.current?.invalidateSize()
    window.addEventListener('resize', resize)
    return () => {
      cancelled = true
      stopBasemap()
      window.removeEventListener('resize', resize)
      markers.current = []; routeLine.current = null; previewMarker.current = null
      mapRef.current?.remove(); mapRef.current = null
    }
  }, [attempt])

  // 标记与路线
  useEffect(() => {
    const map = mapRef.current, L = leaflet.current
    if (!map || !L || !ready) return
    markers.current.forEach(m => m.remove())
    markers.current = points.map(p => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `tm-marker is-${p.variant}${p.key === selectedKey ? ' is-selected' : ''}`
      el.setAttribute('aria-label', `${p.name} · ${VARIANT_LABEL[p.variant]}`)
      el.title = p.name
      if (p.variant === 'planned' && p.order) el.textContent = String(p.order)
      el.addEventListener('click', ev => { ev.stopPropagation(); onSelectRef.current(p.key) })
      return L.marker([p.lat, p.lng], { icon: domIcon(L, el), keyboard: false, bubblingMouseEvents: false, zIndexOffset: p.key === selectedKey ? 1000 : 0 }).addTo(map)
    })
    routeLine.current?.remove()
    routeLine.current = route.length > 1 ? L.polyline(route.map(toLatLng), { color: '#E97A33', weight: 3, opacity: 0.8, dashArray: '6 6', interactive: false }).addTo(map) : null
  }, [points, route, selectedKey, ready])

  // 切换日期 / 数据首次到达时适配视野；没有点位时回到目的地中心
  useEffect(() => {
    const map = mapRef.current, L = leaflet.current
    if (!map || !L || !ready) return
    if (points.length === 0) { if (center) map.setView(toLatLng(center), 11); return }
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [70, 70], maxZoom: 14, animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready, points.length === 0, center?.[0], center?.[1]])

  // 选中：飞到点位并打开信息（内容用 textContent 填充，避免注入）
  useEffect(() => {
    const map = mapRef.current, L = leaflet.current
    map?.closePopup()
    if (!map || !L || !ready || !selectedKey) return
    const p = points.find(x => x.key === selectedKey)
    if (!p) return
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 14), { duration: 0.6 })
    const node = document.createElement('div')
    node.className = 'tm-popup'
    const b = document.createElement('b'); b.textContent = p.name
    const s = document.createElement('small'); s.textContent = [VARIANT_LABEL[p.variant], p.area].filter(Boolean).join(' · ')
    node.append(b, s)
    L.popup({ offset: [0, -14], closeButton: false, maxWidth: 240, className: 'tm-basic-popup' }).setLatLng([p.lat, p.lng]).setContent(node).openOn(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, selectNonce, ready])

  // 搜索结果“查看地图”的临时点位
  useEffect(() => {
    const map = mapRef.current, L = leaflet.current
    previewMarker.current?.remove(); previewMarker.current = null
    if (!map || !L || !ready || !preview) return
    const el = document.createElement('div')
    el.className = 'tm-marker is-preview'
    el.title = preview.name
    previewMarker.current = L.marker([preview.lat, preview.lng], { icon: domIcon(L, el), keyboard: false, interactive: false }).addTo(map)
    map.flyTo([preview.lat, preview.lng], Math.max(map.getZoom(), 14), { duration: 0.6 })
  }, [preview, ready])

  return (
    <div className={`tm-map${picking ? ' is-picking' : ''}`}>
      <div ref={box} className="tm-map-canvas tm-basic" aria-label="旅行地图" role="region" />
      {!ready && <div className="tm-map-state"><Loader2 size={20} className="tm-spin" /> 正在加载地图…</div>}
      {picking && ready && <div className="tm-pick-hint"><Crosshair size={14} /> 点击地图选择位置</div>}
      {ready && (
        <div className={`tm-map-note${basemapDown || basemapMissing ? ' is-warn' : ''}`} role="status">
          {basemapMissing
            ? <span>{MAP_TILES_MISSING}</span>
            : basemapDown
            ? <><span>底图暂时无法加载，地点与路线仍可正常使用</span><button type="button" onClick={() => setAttempt(a => a + 1)}><RefreshCcw size={13} /> 重试</button></>
            : <span>当前浏览器未启用 WebGL，已使用基础地图</span>}
        </div>
      )}
    </div>
  )
}
