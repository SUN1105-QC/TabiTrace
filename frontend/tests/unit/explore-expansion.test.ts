import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import content from '../../assets-src/places/EXPANSION_CITIES.json'
import generated from '@/constants/place-images.generated.json'
import {EXPLORE_CITIES,officialExploreHref} from '@/constants/explore-cities'
import {imageCredit} from '@/utils/place-images'

describe('新增城市的完整内容与站内入口',()=>{
  it('官方搜索链接不会把其他城市带回东京',()=>{
    for(const [name,slug] of [['东京','tokyo'],['Seoul','seoul'],['首尔','seoul'],['香港','hong-kong'],['Hong Kong','hong-kong'],['台北','taipei'],['Taipei','taipei']])expect(officialExploreHref(name)).toBe('/explore/'+slug)
    expect(officialExploreHref('尚未开放的城市')).toBe('/explore')
  })
  for(const city of content.cities){
    it(`${city.name}的地点与路线完整，途经地点只属于本城`,()=>{
      expect(city.places).toHaveLength(30);expect(city.routes).toHaveLength(6)
      const keys=city.places.map(p=>p[0]);expect(new Set(keys).size).toBe(30)
      for(const route of city.routes){const stops=route[4] as string[];expect(stops.length).toBeGreaterThan(1);expect(new Set(stops).size).toBe(stops.length);expect(stops.every(k=>keys.includes(k))).toBe(true)}
      expect(EXPLORE_CITIES.find(c=>c.code===city.code)?.slug).toBe(city.slug)
    })
    it(`${city.name}的所有地点都附带实图、四档资源和授权记录`,()=>{
      for(const [index,p] of city.places.entries()){
        const slug=`${city.slug}-${String(index+1).padStart(2,'0')}-${p[0]}`
        const metadata=(generated as Record<string,{original:{width:number};variants:Record<string,{width:number}>}>)[slug]
        expect(metadata,slug).toBeTruthy();expect(metadata.original.width).toBeGreaterThanOrEqual(1200)
        for(const width of [640,1280,1920,2560])expect(fs.existsSync(path.resolve(`public/images/explore/hd/${width}/${slug}.webp`)),slug).toBe(true)
        const credit=imageCredit(`/images/explore/hd/1280/${slug}.webp`)
        expect(credit?.sourcePage).toContain('commons.wikimedia.org/wiki/File:');expect(credit?.author).toBeTruthy();expect(credit?.license).toBeTruthy();expect(credit?.licenseUrl).toMatch(/^https:/)
      }
    })
  }
})
