'use client'

/**
 * 旅行地图工作台的地图（MapLibre，沿用项目现有的底图配置）。
 * - Marker 样式来自 point.variant（由 getMapMarkerVariant 统一决定）：已打卡 / 计划编号 / 收藏空心
 * - 选中点位 selectedKey 与列表共用：变化时 flyTo 并打开 Popup；点击 Marker 回调 onSelect
 * - fitKey 变化（切换日期）时重新适配视野；picking 时点击地图回传坐标
 * - 地图初始化失败或底图样式加载失败时显示错误与重试
 */

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'
import { Crosshair, Loader2, RefreshCcw, TriangleAlert } from 'lucide-react'
import type { MapPoint } from '@/utils/travel-map'

const VARIANT_LABEL = { checkedIn: '已打卡', planned: '计划中', saved: '已收藏' } as const

export type PreviewPoint = { lat: number; lng: number; name: string }

export function TripMapCanvas({ points, route, selectedKey, selectNonce = 0, onSelect, fitKey, center, preview, picking, onPick }: {
  points: MapPoint[]
  route: [number, number][]
  selectedKey: string | null
  selectNonce?: number
  onSelect: (key: string) => void
  fitKey: string
  /** 目的地中心：没有任何点位时使用（目的地库里没有这座城市时为空，显示大范围） */
  center?: [number, number] | null
  preview?: PreviewPoint | null
  picking?: boolean
  onPick?: (lat: number, lng: number) => void
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef(new Map<string, Marker>())
  const popup = useRef<Popup | null>(null)
  const previewMarker = useRef<Marker | null>(null)
  const routeRef = useRef(route)
  const onSelectRef = useRef(onSelect)
  const onPickRef = useRef(onPick)
  const pickingRef = useRef(picking)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  routeRef.current = route
  onSelectRef.current = onSelect
  onPickRef.current = onPick
  pickingRef.current = picking

  // 创建地图（重试时重新创建）
  useEffect(() => {
    if (!box.current) return
    setState('loading')
    let map: MapLibreMap
    let loaded = false
    try {
      const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL
      const fallbackStyle: maplibregl.StyleSpecification = {
        version: 8,
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
        layers: [
          { id: 'paper-bg', type: 'background', paint: { 'background-color': '#efe9de' } },
          { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.84, 'raster-saturation': -0.45, 'raster-contrast': -0.08 } }
        ]
      }
      map = new maplibregl.Map({ container: box.current, center: [135, 30], zoom: 2.5, minZoom: 2, maxZoom: 18, attributionControl: {}, style: styleUrl || fallbackStyle })
    } catch {
      setState('error')
      return
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    // 底图瓦片偶尔加载失败不影响使用；只有样式本身加载不出来才算地图失败
    const timer = window.setTimeout(() => { if (!loaded) setState('error') }, 20000)
    map.on('error', e => {
      const err = e as unknown as { sourceId?: string; tile?: unknown }
      if (!loaded && !err.sourceId && !err.tile) setState('error')
    })
    map.on('load', () => {
      loaded = true
      window.clearTimeout(timer)
      map.addSource('trip-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeRef.current } } })
      map.addLayer({ id: 'trip-route-line', type: 'line', source: 'trip-route', paint: { 'line-color': '#E97A33', 'line-width': 3, 'line-opacity': 0.8, 'line-dasharray': [2, 2] } })
      map.resize()
      setState('ready')
    })
    map.on('click', e => { if (pickingRef.current) onPickRef.current?.(Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6))) })
    mapRef.current = map
    const resize = () => map.resize()
    window.addEventListener('resize', resize)
    const current = markers.current
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', resize)
      current.forEach(m => m.remove()); current.clear()
      popup.current?.remove(); previewMarker.current?.remove()
      map.remove(); mapRef.current = null
    }
  }, [attempt])

  // 点位与 Marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || state !== 'ready') return
    markers.current.forEach(m => m.remove()); markers.current.clear()
    points.forEach(p => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `tm-marker is-${p.variant}${p.key === selectedKey ? ' is-selected' : ''}`
      el.setAttribute('aria-label', `${p.name} · ${VARIANT_LABEL[p.variant]}`)
      el.title = p.name
      if (p.variant === 'planned' && p.order) el.textContent = String(p.order)
      el.addEventListener('click', ev => { ev.stopPropagation(); onSelectRef.current(p.key) })
      markers.current.set(p.key, new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map))
    })
    const source = map.getSource('trip-route') as GeoJSONSource | undefined
    source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } })
  }, [points, route, state, selectedKey])

  // 切换日期 / 数据首次到达时适配视野；没有点位时回到目的地中心
  useEffect(() => {
    const map = mapRef.current
    if (!map || state !== 'ready') return
    if (points.length === 0) { if (center) map.jumpTo({ center, zoom: 11 }); return }
    const b = points.reduce((acc, p) => acc.extend([p.lng, p.lat]), new maplibregl.LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat]))
    map.fitBounds(b, { padding: 70, maxZoom: 14, duration: 500 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, state, points.length === 0, center?.[0], center?.[1]])

  // 选中：飞到点位并打开 Popup（内容用 textContent 填充，避免注入）
  useEffect(() => {
    const map = mapRef.current
    popup.current?.remove()
    if (!map || state !== 'ready' || !selectedKey) return
    const p = points.find(x => x.key === selectedKey)
    if (!p) return
    map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 14), duration: 600 })
    const node = document.createElement('div')
    node.className = 'tm-popup'
    const b = document.createElement('b'); b.textContent = p.name
    const s = document.createElement('small'); s.textContent = [VARIANT_LABEL[p.variant], p.area].filter(Boolean).join(' · ')
    node.append(b, s)
    popup.current = new maplibregl.Popup({ offset: 18, closeButton: false, maxWidth: '240px' }).setLngLat([p.lng, p.lat]).setDOMContent(node).addTo(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, selectNonce, state])

  // 搜索结果“查看地图”的临时点位
  useEffect(() => {
    const map = mapRef.current
    previewMarker.current?.remove(); previewMarker.current = null
    if (!map || state !== 'ready' || !preview) return
    const el = document.createElement('div')
    el.className = 'tm-marker is-preview'
    el.title = preview.name
    previewMarker.current = new maplibregl.Marker({ element: el }).setLngLat([preview.lng, preview.lat]).addTo(map)
    map.flyTo({ center: [preview.lng, preview.lat], zoom: Math.max(map.getZoom(), 14), duration: 600 })
  }, [preview, state])

  return (
    <div className={`tm-map${picking ? ' is-picking' : ''}`}>
      <div ref={box} className="tm-map-canvas" aria-label="旅行地图" role="region" />
      {state === 'loading' && <div className="tm-map-state"><Loader2 size={20} className="tm-spin" /> 正在加载地图…</div>}
      {state === 'error' && (
        <div className="tm-map-state is-error" role="alert">
          <TriangleAlert size={20} />
          <p>地图加载失败</p>
          <small>行程和打卡仍然可以在右侧使用。</small>
          <button type="button" className="tm-btn" onClick={() => setAttempt(a => a + 1)}><RefreshCcw size={14} /> 重新加载地图</button>
        </div>
      )}
      {picking && state === 'ready' && <div className="tm-pick-hint"><Crosshair size={14} /> 点击地图选择位置</div>}
    </div>
  )
}
