export type ExploreCityConfig = {
  code: string; slug: string; name: string; englishName: string
  countryName: string; countrySlug: string; heroImage: string; heroCaption: string
}

export const EXPLORE_CITIES: ExploreCityConfig[] = [
  {code:'TOKYO',slug:'tokyo',name:'东京',englishName:'TOKYO',countryName:'日本',countrySlug:'japan',heroImage:'07-tokyo-station',heroCaption:'东京站丸之内站舍'},
  {code:'SEOUL',slug:'seoul',name:'首尔',englishName:'SEOUL',countryName:'韩国',countrySlug:'korea',heroImage:'seoul-01-gyeongbokgung',heroCaption:'景福宫与光化门'},
  {code:'HONGKONG',slug:'hong-kong',name:'香港',englishName:'HONG KONG',countryName:'中国',countrySlug:'china',heroImage:'hong-kong-04-victoria-harbour',heroCaption:'中国香港 · 维多利亚港'},
  {code:'TAIPEI',slug:'taipei',name:'台北',englishName:'TAIPEI',countryName:'中国',countrySlug:'china',heroImage:'taipei-01-taipei-101',heroCaption:'中国台湾 · 台北101'}
]

/** 官方搜索结果按地点所属城市打开详情，避免所有城市都跳到东京。 */
export function officialExploreHref(city?: string | null) {
  const key=city?.trim().toUpperCase().replaceAll(' ','').replaceAll('-','')
  const item=EXPLORE_CITIES.find(c=>[c.name,c.code,c.englishName.replaceAll(' ','')].includes(key??''))
  return item?`/explore/${item.slug}`:'/explore'
}
