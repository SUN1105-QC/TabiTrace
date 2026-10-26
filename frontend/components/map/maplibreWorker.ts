import * as maplibregl from 'maplibre-gl'

let configured = false

/**
 * 让 MapLibre 从 public/vendor/maplibre-gl/<版本>/ 加载 Web Worker（文件由 scripts/copy-maplibre-worker.mjs 复制）。
 * 必须在创建第一张地图之前调用；没有 Worker 时 GeoJSON 路线与矢量底图都无法加载。
 */
export function ensureMaplibreWorker() {
  if (configured || typeof window === 'undefined') return
  maplibregl.setWorkerUrl(`${window.location.origin}/vendor/maplibre-gl/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`)
  configured = true
}
