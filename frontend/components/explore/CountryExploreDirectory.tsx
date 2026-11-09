'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, Compass, Globe2, MapPin, RotateCcw, Search, SearchX, X } from 'lucide-react'
import type { ExploreCity, ExploreCountry } from '@/constants/explore-catalog'
import artwork from '@/constants/explore-assets.json'
import { useExploreDirectory } from '@/hooks/useExploreDirectory'
import { useExploreDirectoryFilters } from '@/hooks/useExploreDirectoryFilters'
import { cityIsOpen, filterExploreCountries } from '@/utils/explore-directory'
import { ExploreVisual } from './ExploreVisual'
import styles from './CountryExploreDirectory.module.css'

const EMPTY_COUNTRIES: ExploreCountry[] = []
const stateLabel = { OPEN: '已开放', PREPARING: '筹备中', PLANNED: '计划中' }
const countryArt = artwork.countries as Record<string, { banner: string; thumbnail: string }>
const cityArt = artwork.cities as Record<string, string>
const countryTone: Record<string, string> = { JP: 'japan', KR: 'korea', CN: 'china' }

function CityCard({ city, country }: { city: ExploreCity; country: ExploreCountry }) {
  const open = cityIsOpen(city)
  const content = <>
    <div className={styles.cityCover}>
      <ExploreVisual primary={city.cover} fallback={cityArt[city.code.toLowerCase()]} label={city.name} />
      <span className={`${styles.cityStatus} ${open ? styles.openStatus : ''}`}><span aria-hidden="true" />{stateLabel[city.status]}</span>
    </div>
    <div className={styles.cityBody}>
      <p className={styles.cityLocation}><MapPin size={12} aria-hidden="true" />{city.region ?? country.name}</p>
      <h3>{city.name}<span>{city.englishName}</span></h3>
      <p className={styles.cityDescription}>{city.description || `在${city.name}，发现值得停留的地方。`}</p>
      <ul className={styles.tags} aria-label="城市主题">{city.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
      <div className={styles.cityFooter}>
        <span className={styles.cityCount}>{open && city.placeCount != null ? `${city.placeCount} 个精选地点` : stateLabel[city.status]}</span>
        <span className={styles.cityAction}>{open ? <>探索{city.name}<ArrowRight size={15} aria-hidden="true" /></> : '敬请期待'}</span>
      </div>
    </div>
  </>
  return open ? <Link href={city.href!} className={`${styles.cityCard} ${styles.openCard}`} data-city={city.code}>{content}</Link>
    : <article className={styles.cityCard} data-city={city.code} aria-label={`${city.name} · ${stateLabel[city.status]}`}>{content}</article>
}

function CountrySection({ country, total, index, priority }: { country: ExploreCountry; total: number; index: number; priority: boolean }) {
  // 每组先渲染少量城市，展开后再增加，避免目录较大时一次创建全部封面和卡片。
  const [limit, setLimit] = useState(3)
  const openCount = country.cities.filter(cityIsOpen).length
  return <section className={styles.countrySection} id={`country-${country.slug}`} data-country={country.code}
    data-tone={countryTone[country.code] ?? 'other'} data-single={country.cities.length === 1} aria-labelledby={`country-title-${country.code}`}>
    <header className={styles.countryHeader}>
      <ExploreVisual fallback={countryArt[country.code]?.banner} label={`${country.name}主题`} className={styles.countryBackdrop} priority={priority} />
      <div className={styles.countryHeading}>
        <span className={styles.countryStamp} aria-hidden="true">{country.code}</span>
        <div className={styles.countryText}>
          <p className={styles.eyebrow}>{String(index + 1).padStart(2, '0')} / COUNTRY COLLECTION</p>
          <h2 id={`country-title-${country.code}`}>{country.name}<span>{country.englishName}</span></h2>
          {country.theme && <p className={styles.countryTheme}>{country.theme}</p>}
          {country.description && <p className={styles.countryDescription}>{country.description}</p>}
          <p className={styles.countryMeta}>{country.cities.length} / {total} 座城市<span>·</span>{openCount ? `${openCount} 座已开放` : '正在整理旅途，敬请期待'}</p>
        </div>
      </div>
    </header>
    {country.cities.length ? <>
      <div className={styles.cityGrid}>{country.cities.slice(0, limit).map(city => <CityCard key={city.code} city={city} country={country} />)}</div>
      {country.cities.length > limit && <button type="button" className={styles.moreCities} onClick={() => setLimit(n => n + 6)}>查看更多{country.name}城市（还有 {country.cities.length - limit} 座）<ArrowDown size={14} aria-hidden="true" /></button>}
    </> : <p className={styles.countryEmpty} role="status"><Compass size={20} aria-hidden="true" />正在整理旅途，敬请期待。</p>}
  </section>
}

export function CountryExploreDirectory() {
  const { data, status, retry, forbidden } = useExploreDirectory()
  const countries = data?.countries ?? EMPTY_COUNTRIES
  const { filters, update, reset } = useExploreDirectoryFilters(countries)
  // 手机上的国家条可横向滚动；深链接或重置筛选后，需要让当前选项重新进入可视区域。
  const countryNav = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const nav = countryNav.current
    const selected = nav?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (!nav || !selected) return
    const bounds = nav.getBoundingClientRect()
    const button = selected.getBoundingClientRect()
    if (button.left < bounds.left || button.right > bounds.right) {
      nav.scrollTo({ left: nav.scrollLeft + button.left - bounds.left - (nav.clientWidth - button.width) / 2, behavior: 'auto' })
    }
  }, [filters.country, status])
  const groups = useMemo(() => filterExploreCountries(countries, filters), [countries, filters])
  const matches = useMemo(() => filterExploreCountries(countries, { ...filters, country: 'ALL' }), [countries, filters])
  const firstOpenCity = countries.flatMap(country => country.cities).find(cityIsOpen)
  const resultCount = groups.reduce((n, country) => n + country.cities.length, 0)
  const selectedCountry = countries.find(country => country.code === filters.country)
  const hasFilters = filters.country !== 'ALL' || !!filters.query || filters.openOnly
  const filterKey = JSON.stringify(filters)
  return <div className={styles.directory}>
    <header className={styles.hero}>
      <div className={styles.heroText}>
        <p className={styles.eyebrow}><Globe2 size={14} aria-hidden="true" /> EXPLORE THE WORLD</p>
        <h1>先选一个国家，<br />再走进一座城市。</h1>
        <p className={styles.heroLead}>从国家主题找到旅行方向，在城市里发现值得停留的地方。<br className={styles.desktopBreak} />把喜欢的地点，慢慢收进下一段旅程。</p>
        <div className={styles.heroActions}>
          <a href="#explore-directory" className={styles.primaryAction}><Compass size={16} aria-hidden="true" />浏览国家与城市<ArrowDown size={15} aria-hidden="true" /></a>
          <Link href="/trips" className={styles.quickAction}>查看我的旅行<ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
        {status === 'ready' && data && <p className={styles.heroStats} data-directory-stats>{data.stats.countryCount} 个国家主题<span>·</span>{data.stats.cityCount} 座城市<span>·</span>{data.stats.openCityCount} 座已开放</p>}
        {status === 'loading' && <div className={styles.statsSkeleton} role="status" aria-label="正在加载真实城市统计" />}
      </div>
      <ExploreVisual primary={firstOpenCity?.cover} fallback={artwork.hero} label={firstOpenCity?.name ?? '旅途风景'}
        className={styles.heroImage} priority caption={firstOpenCity ? `${firstOpenCity.englishName} · 下一段旅途，从这里开始` : '下一段旅途，从这里开始'} />
    </header>

    <section className={styles.filters} id="explore-directory" aria-label="探索筛选" aria-busy={status === 'loading'}>
      <div className={styles.sectionIntro}><div><p className={styles.eyebrow}>YOUR NEXT DESTINATION</p><h2>世界很大，从心动的一站开始。</h2></div><span>国家主题 / 城市指南</span></div>
      {status === 'loading' && <div className={styles.loadingPanel} role="status"><span className={styles.loadingLine} /><span className={styles.loadingLine} /><p>正在加载国家与城市目录…</p></div>}
      {status === 'error' && <div className={styles.emptyState} role="alert"><Compass size={30} aria-hidden="true" /><h3>{forbidden ? '当前没有权限查看城市目录' : '城市目录暂时无法加载'}</h3><p>{forbidden ? '请确认登录状态，或稍后重新尝试。' : '请检查网络连接，稍后重新尝试。'}</p><button type="button" className={styles.primaryAction} onClick={retry}><RotateCcw size={15} aria-hidden="true" />重新加载</button></div>}
      {status === 'ready' && countries.length === 0 && <div className={styles.emptyState} role="status"><Globe2 size={30} aria-hidden="true" /><h3>正在整理旅途，敬请期待。</h3><p>国家主题与城市指南发布后，会在这里与你见面。</p></div>}
      {status === 'ready' && countries.length > 0 && <>
        <div ref={countryNav} className={styles.countryNav} role="group" aria-label="国家筛选">
          <button type="button" data-country-filter="ALL" aria-pressed={filters.country === 'ALL'} className={styles.allCountries} onClick={() => update({ country: 'ALL' })}><Globe2 size={22} aria-hidden="true" /><span>全部国家<small>ALL DESTINATIONS</small></span></button>
          {countries.map(country => <button key={country.code} type="button" data-country-filter={country.code}
            aria-pressed={filters.country === country.code} onClick={() => update({ country: country.code })}>
            <span className={styles.countryThumbnail}>{countryArt[country.code]?.thumbnail ? <ExploreVisual fallback={countryArt[country.code].thumbnail} label={`${country.name}主题`} /> : <Globe2 size={24} aria-hidden="true" />}</span>
            <span>{country.name}<small>{country.englishName}</small></span>
            <span className={styles.countryMatchCount} aria-label={`${matches.find(item => item.code === country.code)?.cities.length ?? 0} 座匹配城市`}>{matches.find(item => item.code === country.code)?.cities.length ?? 0}</span>
          </button>)}
        </div>
        <div className={styles.searchRow}>
          <label className={styles.searchBox} htmlFor="explore-city-search"><Search size={17} aria-hidden="true" /><input id="explore-city-search" type="search" maxLength={120} value={filters.query}
            onChange={event => update({ query: event.target.value })} placeholder="搜索国家、城市或旅行主题…" aria-label="搜索国家、城市或旅行主题" />
            {filters.query && <button type="button" aria-label="清空搜索" onClick={() => update({ query: '' })}><X size={16} aria-hidden="true" /></button>}</label>
          <label className={styles.openToggle}><input type="checkbox" checked={filters.openOnly} onChange={event => update({ openOnly: event.target.checked })} />仅看已开放城市</label>
          {hasFilters && <button type="button" className={styles.resetButton} onClick={reset}><RotateCcw size={14} aria-hidden="true" />重置筛选</button>}
        </div>
        <div className={styles.resultLine} aria-live="polite"><span>{hasFilters ? '匹配' : '收录'} {groups.length} 个国家主题 · {resultCount} 座城市{data && !hasFilters ? ` · ${data.stats.placeCount} 个精选地点` : ''}</span><span>已开放的城市可直接进入探索</span></div>
        {hasFilters && <div className={styles.activeFilters} aria-label="当前筛选条件">
          {selectedCountry && <button type="button" onClick={() => update({ country: 'ALL' })}>{selectedCountry.name}<X size={12} aria-hidden="true" /></button>}
          {filters.query && <button type="button" onClick={() => update({ query: '' })}>搜索：{filters.query}<X size={12} aria-hidden="true" /></button>}
          {filters.openOnly && <button type="button" onClick={() => update({ openOnly: false })}>仅看已开放<X size={12} aria-hidden="true" /></button>}
        </div>}
      </>}
    </section>

    {status === 'ready' && countries.length > 0 && <div className={styles.collections}>
      {groups.length ? groups.map((country, groupIndex) => <CountrySection key={`${country.code}:${filterKey}`} country={country} priority={groupIndex === 0}
        total={countries.find(item => item.code === country.code)?.cities.length ?? 0} index={countries.findIndex(item => item.code === country.code)} />)
        : <div className={styles.emptyState} role="status"><SearchX size={30} aria-hidden="true" /><h2>没有找到符合条件的城市</h2><p>试试其他城市、国家名称或旅行主题。</p><div className={styles.emptyActions}>
          {filters.openOnly && <button type="button" className={styles.quickAction} onClick={() => update({ openOnly: false })}>包含筹备与计划中的城市</button>}
          <button type="button" className={styles.primaryAction} onClick={reset}>清除全部筛选</button>
        </div></div>}
    </div>}
    <footer className={styles.directoryNote}><Compass size={17} aria-hidden="true" /><div><p>让每一次出发，都多一点期待。</p><span>标有「AI 风格示意」的图片用于主题展示，实际风景以目的地为准。实景照片的来源与授权见 <Link href="/credits">图片鸣谢</Link>。</span></div></footer>
  </div>
}
