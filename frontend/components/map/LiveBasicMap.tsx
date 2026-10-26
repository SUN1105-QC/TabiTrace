'use client'

/**
 * 探索地图的基础版本（Leaflet，不依赖 WebGL）：浏览器不支持 WebGL2 时由 LiveTravelMap 自动切换。
 * 与 WebGL 版本一致：地点标记（已打卡 / 官方 / 自定义）、手动打卡点、打卡路线、点击地点回调、自动适配视野。
 */

import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'
import { addBasemap, domIcon, loadLeaflet, type LeafletModule } from '@/components/map/basicMap'
import { MAP_TILES_MISSING } from '@/lib/map-tiles'
import type { CheckinView, PlaceView } from '@/services/tabitrace-api'

const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function LiveBasicMap({ places, checkins, route, visitedIds, onSelect }: {
  places: PlaceView[]; checkins: CheckinView[]; route: [number, number][]; visitedIds: Set<number>; onSelect?: (place: PlaceView) => void
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const leaflet = useRef<LeafletModule | null>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const layers = useRef<Leaflet.Layer[]>([])
  const [ready, setReady] = useState(false)
  const [basemapDown, setBasemapDown] = useState(false)
  const [basemapMissing, setBasemapMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    let stopBasemap = () => {}
    loadLeaflet().then(L => {
      if (cancelled || !box.current) return
      leaflet.current = L
      const map = L.map(box.current, { zoomControl: false, minZoom: 2, maxZoom: 18 }).setView([35.682, 139.755], 11)
      L.control.zoom({ position: 'topright', zoomInTitle: '放大', zoomOutTitle: '缩小' }).addTo(map)
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>')
      stopBasemap = addBasemap(L, map, () => setBasemapDown(true), () => setBasemapDown(false), () => setBasemapMissing(true))
      mapRef.current = map
      setReady(true)
    }).catch(err => {
      // 地图脚本加载失败（网络中断 / 版本更新后旧分块失效）：不再一直转圈，显示底图不可用
      console.error('[基础地图] 加载失败', err)
      if (!cancelled) { setBasemapDown(true); setReady(true) }
    })
    const resize = () => mapRef.current?.invalidateSize()
    window.addEventListener('resize', resize)
    return () => { cancelled = true; stopBasemap(); window.removeEventListener('resize', resize); mapRef.current?.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current, L = leaflet.current
    if (!map || !L || !ready) return
    layers.current.forEach(l => l.remove())
    const placeLayers = places.filter(p => valid(p.latitude) && valid(p.longitude)).map(p => {
      const el = document.createElement('button')
      el.type = 'button'; el.title = p.name; el.setAttribute('aria-label', p.name)
      el.className = `ex-basic-marker${visitedIds.has(p.id) ? ' is-visited' : p.sourceType === 'OFFICIAL' ? ' is-official' : ''}${p.sourceType === 'CUSTOM' ? ' is-custom' : ''}`
      el.addEventListener('click', ev => { ev.stopPropagation(); onSelect?.(p) })
      return L.marker([p.latitude!, p.longitude!], { icon: domIcon(L, el), keyboard: false, bubblingMouseEvents: false })
    })
    const orphanLayers = checkins.filter(c => !c.placeId && valid(c.latitude) && valid(c.longitude)).map(c => {
      const el = document.createElement('div')
      el.className = 'ex-basic-marker is-visited is-small'; el.title = c.placeName || '手动打卡'
      return L.marker([c.latitude!, c.longitude!], { icon: domIcon(L, el), keyboard: false, interactive: false })
    })
    const routeLayer = route.length > 1 ? [L.polyline(route.map(([lng, lat]) => [lat, lng] as [number, number]), { color: '#C56A3A', weight: 3, opacity: 0.86, dashArray: '6 6', interactive: false })] : []
    layers.current = [...routeLayer, ...placeLayers, ...orphanLayers]
    layers.current.forEach(l => l.addTo(map))
    const coords = [...placeLayers, ...orphanLayers].map(m => (m as Leaflet.Marker).getLatLng())
    if (coords.length) map.fitBounds(L.latLngBounds(coords), { padding: [70, 70], maxZoom: 13 })
  }, [places, checkins, route, visitedIds, onSelect, ready])

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-[26px] bg-[#efe9de]">
      <div ref={box} className="tm-basic h-full w-full" role="region" aria-label="探索地图" />
      {ready && (
        <div className={`tm-map-note${basemapDown || basemapMissing ? ' is-warn' : ''}`} role="status">
          <span>{basemapMissing ? MAP_TILES_MISSING : basemapDown ? '底图暂时无法加载，地点仍可正常查看' : '当前浏览器未启用 WebGL，已使用基础地图'}</span>
        </div>
      )}
    </div>
  )
}
