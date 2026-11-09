/** Public API models, with no demonstration records bundled into the application. */
export type ExploreCity = {
  id?: number
  code: string
  name: string
  englishName: string
  region?: string | null
  description: string | null
  tags: string[]
  status: 'OPEN' | 'PREPARING' | 'PLANNED'
  href?: string | null
  cover?: string | null
  placeCount?: number
  routeCount?: number
}
export type ExploreCountry = {
  code: string
  slug: string
  name: string
  englishName: string
  theme: string | null
  description: string | null
  cities: ExploreCity[]
}
export type ExploreDirectoryData = {
  countries: ExploreCountry[]
  stats: { countryCount: number; cityCount: number; openCountryCount: number; openCityCount: number; placeCount: number; routeCount: number }
}
