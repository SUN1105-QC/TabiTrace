import { hdImage } from '@/utils/place-images'
/**
 * 公共首页的静态演示素材。只用于营销展示，不与任何用户数据混用：
 * - 产品截图来自旅迹真实界面：一段用官方高清图搭建、截图后已删除的演示旅行，在 1440 宽、2 倍屏下截取，
 *   每张有 1 倍（<name>.webp）和高清（<name>@2x.webp，时间轴是 @3x）两档。重新截取：cd frontend && npm run images:landing
 *   地图截图里的底图是 OpenStreetMap（截图保留了 © OpenStreetMap contributors 署名）
 * - 城市照片是官方景点高清图（Wikimedia Commons，作者与许可证见 /credits 与 assets-src/places/SOURCES.json）
 * 需要真实数据的部分（东京官方地点、Trip Pro 价格与规则）由页面向公开接口实时读取。
 */

export type ProductShot = { src: string; srcSet: string; width: number; height: number; alt: string }
const shot = (name: string, width: number, height: number, alt: string, scale = 2): ProductShot => ({
  src: `/images/landing/${name}.webp`,
  srcSet: `/images/landing/${name}.webp ${width}w, /images/landing/${name}@${scale}x.webp ${width * scale}w`,
  width, height, alt
})

export const LANDING_IMAGES = {
  heroMain: { src: hdImage('02-nakamise-street'), alt: '浅草仲见世商店街的人流与店铺' },
  heroPhotoA: { src: hdImage('20-ueno-park'), alt: '上野公园的樱花' },
  heroPhotoB: { src: hdImage('07-tokyo-station'), alt: '红砖的东京站站舍' },
  storyFrame: shot('story-frame', 290, 516, 'Travel Story 竖屏短片的开场画面'),
  memories: [
    { src: hdImage('01-sensoji-kaminarimon'), alt: '浅草寺雷门的大红灯笼' },
    { src: hdImage('20-ueno-park'), alt: '春天的上野公园' },
    { src: hdImage('16-tokyo-metropolitan-government'), alt: '新宿东京都厅夜景' }
  ]
} as const

/** 首屏组合里的演示卡片内容（示意，不是统计数据） */
export const HERO_DEMO = {
  place: { name: '浅草寺', area: '浅草', status: '09:42 已打卡', note: '清晨的浅草寺人还不多，雷门的大灯笼比想象中更大。' },
  route: ['浅草寺', '上野公园', '东京站', '银座'],
  story: { kicker: 'MY JOURNEY', title: '东京三日散步' }
} as const

/** 真实产品界面截图（WebP，懒加载）：width / height 是 1 倍图的尺寸，2 倍图是它的两倍 */
export const PRODUCT_SHOTS = {
  map: shot('map-workspace', 1166, 628, '旅行地图工作台：地图上的打卡与计划地点，右侧是全部行程和下一站'),
  timeline: shot('timeline', 799, 780, '旅行时间轴：原计划时间与实际打卡时间、照片和旅行文字', 3),
  gallery: shot('gallery', 1166, 807, '照片与精选：按旅行的每一天整理照片'),
  story: shot('video-studio', 1166, 953, 'Travel Story 工作台：选择模板和照片素材，右侧实时预览'),
  poster: shot('share-poster', 724, 965, '旅行海报成果示例'),
  grid: shot('share-grid', 724, 760, '九宫格成果示例'),
  long: shot('share-long', 724, 1364, '每日长图成果示例')
} as const
