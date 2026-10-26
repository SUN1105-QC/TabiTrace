'use client'

/**
 * 旅行地图工作台的地图（MapLibre，沿用项目现有的底图配置）。
 * - Marker 样式来自 point.variant（由 getMapMarkerVariant 统一决定）：已打卡 / 计划编号 / 收藏空心
 * - 选中点位 selectedKey 与列表共用：变化时 flyTo 并打开 Popup；点击 Marker 回调 onSelect
 * - fitKey 变化（切换日期）时重新适配视野；picking 时点击地图回传坐标
 * - 底图来自 lib/map-tiles（环境变量配置的服务商）；开发环境默认 OSM，瓦片慢或失败时切换备用底图（仅开发）
 * - 样式就绪即可使用（点位、路线、选点不等底图瓦片）；底图有问题只在角落给出提示
 * - 只有地图本身无法创建或自定义样式加载失败时，才显示整块的错误与重试
 * - 浏览器不支持 WebGL2（MapLibre 6 的硬性要求）时，自动改用不依赖 WebGL 的基础地图 TripBasicMap
 */

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, Marker, Popup } from 'maplibre-gl'
import { Crosshair, Loader2, RefreshCcw, TriangleAlert } from 'lucide-react'
import type { MapPoint } from '@/utils/travel-map'
import { ensureMaplibreWorker } from '@/components/map/maplibreWorker'
import { isWebGLError, markWebGL2Unavailable, supportsWebGL2 } from '@/components/map/basicMap'
import { TripBasicMap } from './TripBasicMap'
import { MAP_TILES_MISSING, mapTiles, maplibreStyle } from '@/lib/map-tiles'

const VARIANT_LABEL = { checkedIn: '已打卡', planned: '计划中', saved: '已收藏' } as const

/** 开发环境的 OSM 瓦片很慢或无响应时，换成 OpenFreeMap 矢量样式（免 Key，同为 OSM 数据）；生产环境只用配置的服务商 */
const DEV_FALLBACK_STYLE_URL = process.env.NODE_ENV === 'development' ? 'https://tiles.openfreemap.org/styles/positron' : ''
/** 这么久一块底图瓦片都没加载出来，就换备用底图 */
const BASEMAP_TIMEOUT_MS = 8000
/** 连续失败这么多块瓦片（且一块都没成功）也立即换 */
const BASEMAP_MAX_ERRORS = 6

type BasemapNote = null | 'fallback' | 'unavailable' | 'missing'


export type PreviewPoint = { lat: number; lng: number; name: string }

type TripMapProps = {
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
}

/** 按浏览器能力选择地图实现：WebGL2 可用时用 MapLibre，否则用基础地图（Leaflet） */
export function TripMapCanvas(props: TripMapProps) {
  const [engine, setEngine] = useState<'pending' | 'gl' | 'basic'>('pending')
  useEffect(() => { setEngine(supportsWebGL2() ? 'gl' : 'basic') }, [])
  if (engine === 'pending') return <div className="tm-map"><div className="tm-map-state"><Loader2 size={20} className="tm-spin" /> 正在加载地图…</div></div>
  if (engine === 'basic') return <TripBasicMap {...props} />
  return <TripGLMap {...props} onWebGLUnavailable={() => { markWebGL2Unavailable(); setEngine('basic') }} />
}

function TripGLMap({ points, route, selectedKey, selectNonce = 0, onSelect, fitKey, center, preview, picking, onPick, onWebGLUnavailable }: TripMapProps & { onWebGLUnavailable: () => void }) {
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
  const [basemapNote, setBasemapNote] = useState<BasemapNote>(null)
  /** 整块失败时给用户看的具体原因（同时输出到控制台，便于排查） */
  const [errorReason, setErrorReason] = useState('')
  routeRef.current = route
  onSelectRef.current = onSelect
  onPickRef.current = onPick
  pickingRef.current = picking

  // 创建地图（重试时重新创建）
  useEffect(() => {
    if (!box.current) return
    setState('loading')
    setBasemapNote(null)
    setErrorReason('')
    const fail = (reason: string, detail?: unknown) => {
      console.error('[旅行地图] 加载失败：' + reason, detail ?? '')
      setErrorReason(reason)
      setState('error')
    }
    const styleUrl = mapTiles.kind === 'style' ? mapTiles.styleUrl : undefined
    const canFallback = mapTiles.kind === 'raster' && mapTiles.devOnly
    let map: MapLibreMap
    let styleReady = false
    try {
      ensureMaplibreWorker()
      map = new maplibregl.Map({ container: box.current, center: [135, 30], zoom: 2.5, minZoom: 2, maxZoom: 18, attributionControl: { compact: true }, style: maplibreStyle() as maplibregl.StyleSpecification | string })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (isWebGLError(error)) { console.info('[旅行地图] 浏览器无法使用 WebGL2，改用基础地图：', message); onWebGLUnavailable(); return }
      fail('地图组件初始化失败', error)
      return
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // 路线图层：首次就绪和切换底图样式后都要（重新）加上；DOM Marker 不受样式切换影响
    const addRoute = () => {
      if (map.getSource('trip-route')) return
      map.addSource('trip-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeRef.current } } })
      map.addLayer({ id: 'trip-route-line', type: 'line', source: 'trip-route', paint: { 'line-color': '#E97A33', 'line-width': 3, 'line-opacity': 0.8, 'line-dasharray': [2, 2] } })
    }

    // ---- 内置底图的瓦片健康检查：长时间没有任何瓦片成功，或连续失败，就换备用底图 ----
    let usingFallback = false, tileOk = false, tileErrors = 0
    let basemapTimer = 0
    const watchBasemap = () => { window.clearTimeout(basemapTimer); basemapTimer = window.setTimeout(nextBasemap, BASEMAP_TIMEOUT_MS) }
    const nextBasemap = () => {
      window.clearTimeout(basemapTimer)
      if (tileOk || styleUrl) return
      if (usingFallback || !canFallback) { setBasemapNote('unavailable'); return }
      usingFallback = true; tileOk = false; tileErrors = 0
      setBasemapNote('fallback')
      map.once('style.load', () => { addRoute(); watchBasemap() })
      map.setStyle(DEV_FALLBACK_STYLE_URL, { diff: false })
      watchBasemap() // 备用样式本身也可能加载不出来
    }
    map.on('sourcedata', e => {
      const ev = e as unknown as { sourceId?: string; tile?: { state?: string } }
      if (ev.sourceId !== 'trip-route' && ev.tile?.state === 'loaded' && !tileOk) {
        tileOk = true
        window.clearTimeout(basemapTimer)
        setBasemapNote(n => (n === 'unavailable' ? null : n))
      }
    })

    // 样式本身加载不出来（只可能发生在自定义样式上）才算地图失败
    // 兜底：20 秒内样式仍未就绪才算失败
    const styleTimer = window.setTimeout(() => { if (!styleReady) fail(styleUrl ? '地图样式加载超时，请检查网络' : '地图初始化超时') }, 20000)
    map.on('error', e => {
      const err = e as unknown as { sourceId?: string; tile?: unknown; error?: { message?: string } }
      if (styleReady || err.tile || (err.sourceId && err.sourceId !== 'trip-route')) {
        if (!tileOk && !styleUrl && mapTiles.kind !== 'none' && ++tileErrors >= BASEMAP_MAX_ERRORS) nextBasemap()
        return
      }
      // 内置样式不需要联网，这时的其他错误（如 Worker 暂时加载不到）不应让整张地图不可用，交给上面的兜底计时判断；
      // 只有自定义样式本身加载失败才立即判为失败
      if (styleUrl) fail('地图样式加载失败，请检查网络', err.error)
      else console.warn('[旅行地图] 非致命错误：', err.error?.message ?? err)
    })
    // 样式就绪就能用：点位、路线、选点都不依赖底图瓦片
    map.once('style.load', () => {
      styleReady = true
      window.clearTimeout(styleTimer)
      addRoute()
      map.resize()
      setState('ready')
      if (mapTiles.kind === 'none') setBasemapNote('missing')
      else if (!styleUrl) watchBasemap()
    })
    map.on('click', e => { if (pickingRef.current) onPickRef.current?.(Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6))) })
    mapRef.current = map
    const resize = () => map.resize()
    window.addEventListener('resize', resize)
    const current = markers.current
    return () => {
      window.clearTimeout(styleTimer)
      window.clearTimeout(basemapTimer)
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
    void source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } })
    // attempt：重试会重建地图并清掉旧 Marker，而状态可能“就绪→加载→就绪”合并成一次更新，所以要显式依赖它
  }, [points, route, state, selectedKey, attempt])

  // 切换日期 / 数据首次到达时适配视野；没有点位时回到目的地中心
  useEffect(() => {
    const map = mapRef.current
    if (!map || state !== 'ready') return
    if (points.length === 0) { if (center) map.jumpTo({ center, zoom: 11 }); return }
    const b = points.reduce((acc, p) => acc.extend([p.lng, p.lat]), new maplibregl.LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat]))
    map.fitBounds(b, { padding: 70, maxZoom: 14, duration: 500 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, state, attempt, points.length === 0, center?.[0], center?.[1]])

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
  }, [selectedKey, selectNonce, state, attempt])

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
  }, [preview, state, attempt])

  return (
    <div className={`tm-map${picking ? ' is-picking' : ''}`}>
      <div ref={box} className="tm-map-canvas" aria-label="旅行地图" role="region" />
      {state === 'loading' && <div className="tm-map-state"><Loader2 size={20} className="tm-spin" /> 正在加载地图…</div>}
      {state === 'error' && (
        <div className="tm-map-state is-error" role="alert">
          <TriangleAlert size={20} />
          <p>地图加载失败</p>
          <small>行程和打卡仍然可以在右侧使用。</small>
          {errorReason && <small className="tm-map-reason">原因：{errorReason}</small>}
          <button type="button" className="tm-btn" onClick={() => setAttempt(a => a + 1)}><RefreshCcw size={14} /> 重新加载地图</button>
        </div>
      )}
      {picking && state === 'ready' && <div className="tm-pick-hint"><Crosshair size={14} /> 点击地图选择位置</div>}
      {state === 'ready' && basemapNote && (
        <div className={`tm-map-note${basemapNote === 'unavailable' ? ' is-warn' : ''}`} role="status">
          {basemapNote === 'missing'
            ? <span>{MAP_TILES_MISSING}</span>
            : basemapNote === 'fallback'
            ? <span>默认底图加载较慢，已切换到备用底图</span>
            : <><span>底图暂时无法加载，地点与路线仍可正常使用</span><button type="button" onClick={() => setAttempt(a => a + 1)}><RefreshCcw size={13} /> 重试</button></>}
        </div>
      )}
    </div>
  )
}
