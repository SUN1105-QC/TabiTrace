import { isDevelopment } from '@/lib/env'

/**
 * 地图底图提供方（MapTileProvider）：所有地图组件只从这里取底图，不在组件里写死瓦片地址。
 *
 * 配置（构建时写入前端，浏览器可见，只能放带域名限制的公开 key）：
 * - NEXT_PUBLIC_MAP_STYLE_URL   MapLibre 样式 JSON（矢量底图，WebGL 地图使用）
 * - NEXT_PUBLIC_MAP_TILE_URL    栅格瓦片模板 https://…/{z}/{x}/{y}.png（WebGL 与基础地图都能用）
 * - NEXT_PUBLIC_MAP_ATTRIBUTION 栅格瓦片的版权署名（HTML，按服务商许可填写；样式 JSON 自带署名）
 * - NEXT_PUBLIC_MAP_API_KEY     可选：替换以上地址里的 {key}
 *
 * 开发环境没有配置时使用 OpenStreetMap 官方瓦片（只用于本地开发）；
 * 生产环境没有配置时**不会**回退到 OpenStreetMap 官方瓦片服务器（其使用政策不允许商业流量），
 * 地图只显示纯色底 + 标点，并提示底图未配置。
 */
export type MapTileProvider =
  | { kind: 'style'; styleUrl: string; raster: RasterTiles | null }
  | { kind: 'raster'; raster: RasterTiles; devOnly: boolean }
  | { kind: 'none' }

export type RasterTiles = { url: string; attribution: string; maxZoom: number }

/** 仅开发环境：NODE_ENV 在构建时被替换为字面量，生产构建里整段被删除，代码包里不会出现 OSM 官方瓦片地址 */
const OSM_DEV: RasterTiles | null = process.env.NODE_ENV === 'development' ? {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  maxZoom: 19
} : null

type MapEnv = { styleUrl?: string; tileUrl?: string; attribution?: string; apiKey?: string; development: boolean }

const withKey = (url: string, key?: string) => (key ? url.split('{key}').join(encodeURIComponent(key)) : url)

/** 纯函数，便于测试：按环境变量决定底图 */
export function resolveMapTiles(env: MapEnv): MapTileProvider {
  const styleUrl = env.styleUrl?.trim()
  const tileUrl = env.tileUrl?.trim()
  const raster = tileUrl ? { url: withKey(tileUrl, env.apiKey), attribution: env.attribution?.trim() || '', maxZoom: 19 } : null
  if (styleUrl) return { kind: 'style', styleUrl: withKey(styleUrl, env.apiKey), raster }
  if (raster) return { kind: 'raster', raster, devOnly: false }
  if (env.development && OSM_DEV) return { kind: 'raster', raster: OSM_DEV, devOnly: true }
  return { kind: 'none' }
}

export const mapTiles: MapTileProvider = resolveMapTiles({
  styleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL,
  attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
  apiKey: process.env.NEXT_PUBLIC_MAP_API_KEY,
  development: isDevelopment
})

/** 栅格底图（Leaflet 基础地图只能用栅格；只配置了矢量样式时为 null） */
export const rasterTiles: RasterTiles | null = mapTiles.kind === 'none' ? null : mapTiles.raster

/** 生产环境没有配置底图时给用户看的说明 */
export const MAP_TILES_MISSING = '底图服务未配置，地图只显示位置标点'

const PAPER = '#efe9de'
const RASTER_PAINT = { 'raster-opacity': 0.84, 'raster-saturation': -0.45, 'raster-contrast': -0.08 } as const

/** MapLibre 的 style 参数：配置了样式 URL 就直接用；否则用栅格瓦片拼一个暖色样式；都没有时只有纸色背景 */
export function maplibreStyle(): string | Record<string, unknown> {
  if (mapTiles.kind === 'style') return mapTiles.styleUrl
  const layers: unknown[] = [{ id: 'paper-bg', type: 'background', paint: { 'background-color': PAPER } }]
  const sources: Record<string, unknown> = {}
  if (mapTiles.kind === 'raster') {
    sources.basemap = { type: 'raster', tiles: [mapTiles.raster.url], tileSize: 256, maxzoom: mapTiles.raster.maxZoom, attribution: mapTiles.raster.attribution }
    layers.push({ id: 'basemap', type: 'raster', source: 'basemap', paint: RASTER_PAINT })
  }
  return { version: 8, sources, layers }
}
