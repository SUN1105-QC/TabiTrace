/**
 * 基础地图（不依赖 WebGL）的共用工具。
 *
 * MapLibre 6 必须使用 WebGL2；浏览器关闭了硬件加速、显卡驱动过旧或显卡被列入黑名单时，
 * 创建 MapLibre 地图会直接抛出 GPUInitializationError。这时改用 Leaflet（普通图片瓦片 + DOM 标记）显示同样的内容。
 */

import { rasterTiles } from '@/lib/map-tiles'
import type * as Leaflet from 'leaflet'

export type LeafletModule = typeof Leaflet

let webgl2: boolean | null = null

/** 浏览器能否创建 WebGL2 上下文（结果缓存；只在客户端调用） */
export function supportsWebGL2() {
  if (webgl2 !== null) return webgl2
  try {
    const canvas = document.createElement('canvas')
    webgl2 = Boolean(canvas.getContext('webgl2'))
  } catch {
    webgl2 = false
  }
  return webgl2
}

/** MapLibre 创建失败且与 WebGL 相关时调用：之后都直接使用基础地图 */
export function markWebGL2Unavailable() { webgl2 = false }

export const isWebGLError = (error: unknown) => /webgl|GPUInitialization/i.test(error instanceof Error ? `${error.name} ${error.message}` : String(error))

let leafletPromise: Promise<LeafletModule> | null = null

/** Leaflet 在导入时就会访问 window，只能在浏览器里按需加载 */
export function loadLeaflet() {
  leafletPromise ??= import('leaflet').then(m => ((m as unknown as { default?: LeafletModule }).default ?? m) as LeafletModule)
  return leafletPromise
}

/** 这么久一块瓦片都没加载出来，或连续失败这么多块，就提示底图不可用 */
const TILE_TIMEOUT_MS = 10000
const TILE_MAX_ERRORS = 6

/**
 * 栅格底图（来自 lib/map-tiles，与 WebGL 版本同一服务商，暖色处理见 .tm-basic-tiles）。
 * 没有可用的栅格瓦片（生产未配置、或只配置了矢量样式）时立即调用 onMissing，不请求任何瓦片。
 * onUnavailable：长时间没有任何瓦片成功时调用；onRecovered：之后有瓦片成功时调用。
 */
export function addBasemap(L: LeafletModule, map: Leaflet.Map, onUnavailable: () => void, onRecovered: () => void, onMissing?: () => void) {
  if (!rasterTiles) { (onMissing ?? onUnavailable)(); return () => {} }
  const layer = L.tileLayer(rasterTiles.url, {
    maxZoom: rasterTiles.maxZoom, attribution: rasterTiles.attribution, className: 'tm-basic-tiles', crossOrigin: false
  })
  let ok = false, errors = 0
  const timer = window.setTimeout(() => { if (!ok) onUnavailable() }, TILE_TIMEOUT_MS)
  layer.on('tileload', () => { if (!ok) { ok = true; window.clearTimeout(timer); onRecovered() } })
  layer.on('tileerror', () => { if (!ok && ++errors >= TILE_MAX_ERRORS) { window.clearTimeout(timer); onUnavailable() } })
  layer.addTo(map)
  return () => window.clearTimeout(timer)
}

/** 把 DOM 元素做成以坐标为中心的 Leaflet 标记图标（尺寸由元素自身的 CSS 决定） */
export function domIcon(L: LeafletModule, element: HTMLElement) {
  return L.divIcon({ html: element, className: 'tm-basic-icon', iconSize: [0, 0], iconAnchor: [0, 0] })
}
