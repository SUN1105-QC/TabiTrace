import type { ExploreCity, ExploreCountry } from '@/constants/explore-catalog'

export type DirectoryFilters = { country: string; query: string; openOnly: boolean }
export const DEFAULT_DIRECTORY_FILTERS: DirectoryFilters = { country: 'ALL', query: '', openOnly: false }
export const cityIsOpen = (city: ExploreCity) => city.status === 'OPEN' && !!city.href

/** 国家面包屑的旧锚点和可分享的筛选参数使用同一套规则。 */
export function parseDirectoryFilters(snapshot: string, countries: ExploreCountry[] = []): DirectoryFilters {
  const [search, hash = ''] = snapshot.split('#', 2)
  const params = new URLSearchParams(search)
  const requested = params.get('country')
  const country = requested == null
    ? countries.find(c => `country-${c.slug}` === hash)?.code ?? 'ALL'
    : countries.find(c => c.code === requested.toUpperCase())?.code
      ?? (countries.length === 0 && /^[A-Z][A-Z0-9_-]{1,15}$/.test(requested.toUpperCase()) ? requested.toUpperCase() : 'ALL')
  return { country, query: (params.get('q') ?? '').slice(0, 120), openOnly: params.get('open') === '1' }
}

/** 原生 History 更新筛选，不触发整页请求，并保留无关参数。 */
export function directoryFilterUrl(current: string, filters: DirectoryFilters, countries: ExploreCountry[] = []): string {
  const url = new URL(current, 'http://local.invalid')
  const country = countries.find(c => c.code === filters.country)
  if (country) { url.searchParams.set('country', country.code); url.hash = `country-${country.slug}` }
  else { url.searchParams.delete('country'); if (url.hash.startsWith('#country-')) url.hash = '' }
  if (filters.query) url.searchParams.set('q', filters.query.slice(0, 120)); else url.searchParams.delete('q')
  if (filters.openOnly) url.searchParams.set('open', '1'); else url.searchParams.delete('open')
  return url.pathname + url.search + url.hash
}

const normalized = (s: string) => s.normalize('NFKC').toLowerCase().trim()

/** Empty published countries remain visible until a city/status search excludes them. */
export function filterExploreCountries(countries: ExploreCountry[], filters: DirectoryFilters): ExploreCountry[] {
  const words = normalized(filters.query).split(/\s+/).filter(Boolean)
  return countries.filter(country => filters.country === 'ALL' || country.code === filters.country).map(country => ({
    ...country,
    cities: country.cities.filter(city => {
      if (filters.openOnly && !cityIsOpen(city)) return false
      const text = normalized([country.name, country.englishName, country.code, country.theme, country.description,
        city.name, city.englishName, city.region ?? '', city.description, ...city.tags].join(' '))
      return words.every(word => text.includes(word))
    })
  })).filter(country => country.cities.length > 0 || (!words.length && !filters.openOnly))
}
