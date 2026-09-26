/**
 * 公共首页的静态演示素材。只用于营销展示，不与任何用户数据混用：
 * - 产品截图来自旅迹真实界面（一段用项目自带城市图片搭建、截图后已删除的演示旅行）
 * - 城市照片是项目自带、已去掉文字的东京图片
 * 需要真实数据的部分（东京官方地点、Trip Pro 价格与规则）由页面向公开接口实时读取。
 */

export const LANDING_IMAGES = {
  heroMain: { src: '/images/explore/nakamise.jpg', alt: '浅草仲见世商店街的人流与店铺' },
  heroPhotoA: { src: '/images/explore/ueno-autumn.jpg', alt: '上野公园秋天的银杏与樱花树' },
  heroPhotoB: { src: '/images/explore/tokyo-station.jpg', alt: '红砖的东京站站舍' },
  storyFrame: { src: '/images/landing/story-frame.webp', alt: 'Travel Story 竖屏短片的开场画面' },
  memories: [
    { src: '/images/explore/asakusa.jpg', alt: '浅草寺雷门的大红灯笼' },
    { src: '/images/explore/ueno-autumn.jpg', alt: '秋天的上野公园' },
    { src: '/images/explore/tocho-night.jpg', alt: '新宿都厅夜景' }
  ]
} as const

/** 首屏组合里的演示卡片内容（示意，不是统计数据） */
export const HERO_DEMO = {
  place: { name: '浅草寺', area: '浅草', status: '09:42 已打卡', note: '清晨的浅草寺人还不多，雷门的大灯笼比想象中更大。' },
  route: ['浅草寺', '上野公园', '东京站', '银座'],
  story: { kicker: 'MY JOURNEY', title: '东京三日散步' }
} as const

/** 真实产品界面截图（WebP，懒加载） */
export const PRODUCT_SHOTS = {
  map: { src: '/images/landing/map-workspace.webp', width: 1160, height: 660, alt: '旅行地图工作台：地图上的打卡与计划地点，右侧是当天行程和下一站' },
  timeline: { src: '/images/landing/timeline.webp', width: 751, height: 780, alt: '旅行时间轴：原计划时间与实际打卡时间、照片和旅行文字' },
  gallery: { src: '/images/landing/gallery.webp', width: 1100, height: 807, alt: '照片与精选：按旅行的每一天整理照片' },
  story: { src: '/images/landing/video-studio.webp', width: 1100, height: 953, alt: 'Travel Story 工作台：选择模板和照片素材，右侧实时预览' },
  poster: { src: '/images/landing/share-poster.webp', width: 700, height: 791, alt: '旅行海报成果示例' },
  grid: { src: '/images/landing/share-grid.webp', width: 700, height: 1024, alt: '九宫格成果示例' },
  long: { src: '/images/landing/share-long.webp', width: 700, height: 1319, alt: '每日长图成果示例' }
} as const
