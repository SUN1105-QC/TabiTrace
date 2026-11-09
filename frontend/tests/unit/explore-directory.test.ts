import { describe, expect, it } from 'vitest'
import { EXPLORE_COUNTRIES } from '../fixtures/explore-directory'
import { DEFAULT_DIRECTORY_FILTERS, directoryFilterUrl, filterExploreCountries, parseDirectoryFilters } from '@/utils/explore-directory'
import type { ExploreCountry } from '@/constants/explore-catalog'

const cities = (query: string, country = 'ALL', openOnly = false) =>
  filterExploreCountries(EXPLORE_COUNTRIES, { query, country, openOnly }).flatMap(group => group.cities.map(city => city.code))

describe('国家与城市组合筛选', () => {
  it('中文、英文、全角英文和国家/城市组合均可搜索', () => {
    expect(cities('东京')).toEqual(['TOKYO'])
    expect(cities('ＴＯＫＹＯ')).toEqual(['TOKYO'])
    expect(cities('japan kyoto')).toEqual(['KYOTO'])
    expect(cities('日 本')).toEqual(['TOKYO', 'OSAKA', 'KYOTO'])
    expect(cities('中国台湾')).toEqual(['TAIPEI'])
    expect(cities('夜景')).toEqual(['TOKYO'])
  })

  it('国家、关键词和开放状态同时生效，不匹配的国家不留空分组', () => {
    expect(cities('', 'JP', true)).toEqual(['TOKYO'])
    expect(cities('京都', 'JP', true)).toEqual([])
    expect(cities('', 'KR', true)).toEqual([])
    expect(cities('东京', 'CN')).toEqual([])
    expect(filterExploreCountries(EXPLORE_COUNTRIES, { country: 'ALL', query: '不存在的城市', openOnly: false })).toEqual([])
  })

  it('筛选不改变原目录或其他筛选的结果', () => {
    const original = JSON.stringify(EXPLORE_COUNTRIES)
    cities('', 'JP', true)
    expect(JSON.stringify(EXPLORE_COUNTRIES)).toBe(original)
    expect(cities('', 'JP')).toEqual(['TOKYO', 'OSAKA', 'KYOTO'])
  })
})

describe('探索筛选地址', () => {
  it('新增国家来自目录数据，不局限于三个主题；加载中保留深链接', () => {
    const countries: ExploreCountry[] = [...EXPLORE_COUNTRIES, { code: 'FR', slug: 'france', name: '法国', englishName: 'FRANCE', theme: null, description: null, cities: [] }]
    expect(parseDirectoryFilters('?country=fr', countries).country).toBe('FR')
    expect(parseDirectoryFilters('#country-france', countries).country).toBe('FR')
    expect(parseDirectoryFilters('?country=fr', []).country).toBe('FR')
    expect(directoryFilterUrl('/explore', { ...DEFAULT_DIRECTORY_FILTERS, country: 'FR' }, countries)).toBe('/explore?country=FR#country-france')
    expect(filterExploreCountries(countries, { ...DEFAULT_DIRECTORY_FILTERS, country: 'FR' })).toHaveLength(1)
    expect(filterExploreCountries(countries, { ...DEFAULT_DIRECTORY_FILTERS, country: 'FR', openOnly: true })).toEqual([])
  })
  it('兼容国家面包屑锚点，显式参数优先于旧锚点', () => {
    expect(parseDirectoryFilters('#country-japan', EXPLORE_COUNTRIES)).toEqual({ ...DEFAULT_DIRECTORY_FILTERS, country: 'JP' })
    expect(parseDirectoryFilters('?country=kr&q=Seoul&open=1#country-japan', EXPLORE_COUNTRIES)).toEqual({ country: 'KR', query: 'Seoul', openOnly: true })
  })

  it('不支持的国家和开放状态回到合法默认值，关键词限制长度', () => {
    const result = parseDirectoryFilters('?country=unknown&open=yes&q=' + 'x'.repeat(200), EXPLORE_COUNTRIES)
    expect(result.country).toBe('ALL')
    expect(result.openOnly).toBe(false)
    expect(result.query).toHaveLength(120)
  })

  it('刷新可还原筛选，中文与特殊字符安全编码，并保留无关参数', () => {
    const filters = { country: 'JP', query: '东京 & 夜景#', openOnly: true }
    const href = directoryFilterUrl('/explore?source=home', filters, EXPLORE_COUNTRIES)
    const url = new URL(href, 'http://test.invalid')
    expect(url.searchParams.get('source')).toBe('home')
    expect(parseDirectoryFilters(url.search + url.hash, EXPLORE_COUNTRIES)).toEqual(filters)
    const reset = new URL(directoryFilterUrl(href, DEFAULT_DIRECTORY_FILTERS, EXPLORE_COUNTRIES), 'http://test.invalid')
    expect(reset.pathname + reset.search + reset.hash).toBe('/explore?source=home')
  })
})
