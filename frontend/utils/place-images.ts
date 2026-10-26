/**
 * 官方景点图片（public/images/explore/hd/{640,1280,1920,2560}/<slug>.webp，由 scripts/optimize-place-images.mjs 生成）。
 *
 * 一个景点只有一个权威图片地址：后端 places / official_routes / official_cities 的 cover_image（保存的是 1280 档）。
 * 前端不另存地址，这里只负责：
 * - 按显示宽度挑 640 / 1280 / 1920 / 2560 档（手机不下载大图，2 倍屏的超宽封面才用 2560）
 * - 裁切焦点（塔顶、灯笼不被裁掉）
 * - 加载失败的统一占位图
 * - 来源与许可证（地点详情署名、图片来源页）
 * 不是官方高清图的地址（用户上传的照片、旅行封面等）原样返回，不受影响。
 * 将来换成 CDN 时，只要路径结构仍是 …/images/explore/hd/<宽度>/<slug>.webp，组件不用改。
 */

import generated from '@/constants/place-images.generated.json'

export const PLACE_IMAGE_WIDTHS = [640, 1280, 1920, 2560] as const
export const PLACE_IMAGE_FALLBACK = '/images/place-placeholder.webp'

type Variant = { width: number; height: number; bytes: number }
type ImageData = {
  subject: string
  original: { file: string; width: number; height: number; bytes: number }
  variants: Record<string, Variant>
  author: string | null
  license: string
  licenseUrl: string | null
  sourcePage: string
}
const DATA = generated as Record<string, ImageData>

const HD = /^(.*\/images\/explore\/hd\/)(640|1280|1920|2560)\/([a-z0-9-]+)\.webp$/

function parse(url?: string | null) {
  const m = url ? HD.exec(url) : null
  return m ? { base: m[1], slug: m[3] } : null
}

export const isHdImage = (url?: string | null) => Boolean(parse(url))

/** 不小于所需宽度的最小一档（最大 2560）；不是官方高清图的地址原样返回 */
export function hdVariant(url: string, width: number) {
  const h = parse(url)
  if (!h) return url
  const w = PLACE_IMAGE_WIDTHS.find(x => x >= width) ?? 2560
  return `${h.base}${w}/${h.slug}.webp`
}

/** 普通 <img> 用的 srcSet（宽度按实际生成结果，原图不足 1920 时不会谎报） */
export function hdSrcSet(url?: string | null) {
  const h = parse(url)
  if (!h) return undefined
  const v = DATA[h.slug]?.variants
  return PLACE_IMAGE_WIDTHS.map(w => `${h.base}${w}/${h.slug}.webp ${v?.[w]?.width ?? w}w`).join(', ')
}

/**
 * 裁切焦点（object-position）。卡片是 16:10、Hero 是更扁的比例，竖拍或主体偏上的照片需要指定，
 * 否则 object-fit: cover 会从正中裁切，把塔顶、灯笼裁掉。没有列出的按正中。
 */
const FOCUS: Record<string, string> = {
  // 竖拍：塔尖与展望台在上半部，从顶部取景（16:10 只能放下塔的上半段，保留最有辨识度的塔尖和展望台）
  '03-tokyo-tower': '50% 6%',
  // 竖拍：熊猫在画面最上方，居中裁切只剩水盆
  '21-ueno-zoo-panda': '55% 8%'
}

export function imageFocus(url?: string | null) {
  const h = parse(url)
  return (h && FOCUS[h.slug]) || '50% 50%'
}

export type ImageCredit = { slug: string; subject: string; author: string | null; license: string; licenseUrl: string | null; sourcePage: string }

/** 图片的来源与许可证（CC BY / CC BY-SA 需要署名；CC0 不强制，但同样注明来源） */
export function imageCredit(url?: string | null): ImageCredit | null {
  const h = parse(url)
  const d = h ? DATA[h.slug] : undefined
  return h && d ? { slug: h.slug, subject: d.subject, author: d.author, license: d.license, licenseUrl: d.licenseUrl, sourcePage: d.sourcePage } : null
}

export const ALL_IMAGE_CREDITS: ImageCredit[] = Object.entries(DATA).map(([slug, d]) => ({
  slug, subject: d.subject, author: d.author, license: d.license, licenseUrl: d.licenseUrl, sourcePage: d.sourcePage
}))

/**
 * 1×1 透明占位图。桌面版和手机版同时渲染、再用 CSS（.only-desktop / .only-mobile）隐藏其中一个时，
 * display: none 的 <img> 照样会下载。被隐藏那一端用 <picture><source media=… srcSet={BLANK_IMAGE}>，
 * 浏览器在那个宽度下选中这张占位图，就不会下载隐藏的大图。
 */
export const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** 没有旅行封面时的默认大图（首页 Hero、我的旅行顶部）：晴空塔与隅田川，左侧是天空，正好放文字 */
export const DEFAULT_HERO_IMAGE = '/images/explore/hd/1280/04-tokyo-skytree.webp'

/** 站内固定使用的官方景点图（不经过后端的位置：落地页、登录页、首页横幅等），同样指向 1280 档 */
export const hdImage = (slug: string, width: 640 | 1280 | 1920 | 2560 = 1280) => `/images/explore/hd/${width}/${slug}.webp`
