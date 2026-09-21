/**
 * 官方地点封面兜底：后端 place.coverImage 目前为空，用 public/images 下已有的东京素材
 * 按「地点名 → 商圈」两级匹配，保证推荐列表始终有配图且与地点对应。
 */

const BY_NAME: Record<string, string> = {
  东京晴空塔: '/images/night.jpg',
  仲见世: '/images/nakamise.jpg',
  东京塔: '/images/night.jpg',
  彩虹大桥: '/images/night.jpg',
  台场海滨公园: '/images/odaiba.jpg',
  秋叶原UDX: '/images/akihabara.jpg'
}

const BY_AREA: Record<string, string> = {
  浅草: '/images/asakusa.jpg',
  秋叶原: '/images/akihabara.jpg',
  上野: '/images/ueno.jpg',
  东京站: '/images/tokyo-station.jpg',
  银座: '/images/ginza.jpg',
  涩谷: '/images/shibuya.jpg',
  原宿: '/images/harajuku.jpg',
  新宿: '/images/shinjuku.jpg',
  港区: '/images/night.jpg',
  台场: '/images/odaiba.jpg'
}

const ROTATION = ['/images/asakusa.jpg', '/images/ueno.jpg', '/images/shibuya.jpg', '/images/ginza.jpg']

export function placeImage(place: { name?: string; area?: string; coverImage?: string }, index = 0) {
  return place.coverImage
    || (place.name ? BY_NAME[place.name] : undefined)
    || (place.area ? BY_AREA[place.area] : undefined)
    || ROTATION[index % ROTATION.length]
}
