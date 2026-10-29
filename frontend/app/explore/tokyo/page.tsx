'use client'

/**
 * 推荐探索 · 东京。目标是让用户在 30 秒内找到一个想去的地方，页面只有五个一级模块：
 * Explore Hero（搜索 + 分类）→ 为你推荐（3 个）→ 按区域探索 → 旅行灵感（专题）→ 全部地点。
 * 同一个地点最多出现两次：为你推荐 + 全部地点；专题的途经地点只在专题详情里展开。
 * 数据只请求一次（useExploreData），各模块的内容都由 utils/explore 的规则派生。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { PageContainer } from '@/components/common/PageContainer'
import { SiteHeader } from '@/components/common/SiteHeader'
import { ExploreHero } from '@/components/explore/ExploreHero'
import { RecommendedPlaces } from '@/components/explore/RecommendedPlaces'
import { AreaExplorer } from '@/components/explore/AreaExplorer'
import { TravelInspiration } from '@/components/explore/TravelInspiration'
import { AllPlaces, PLACE_PAGE_SIZE } from '@/components/explore/AllPlaces'
import { PlaceDetailDrawer } from '@/components/explore/PlaceDetailDrawer'
import { RouteDrawer } from '@/components/explore/RouteDrawer'
import { TripPickerDialog } from '@/components/explore/TripPickerDialog'
import type { ExploreActions } from '@/components/explore/PlaceActions'
import { useExploreData } from '@/hooks/useExploreData'
import type { OfficialRouteView, PlaceView, TripView } from '@/services/tabitrace-api'
import {
  CATEGORIES, categoryOf, currentSeason, distanceKm, formatKm, searchPlaces, selectAreas, selectInspirations, selectRecommended,
  sortPlaces, toExplorePlace, type Geo, type SortKey
} from '@/utils/explore'

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function TokyoExplorePage() {

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('ALL')
  const [area, setArea] = useState('')
  const [sort, setSort] = useState<SortKey>('RECOMMEND')
  const [view, setView] = useState<'grid' | 'map'>('grid')
  const [limit, setLimit] = useState(PLACE_PAGE_SIZE)
  const [geo, setGeo] = useState<Geo | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [mapSelectedId, setMapSelectedId] = useState<number | null>(null)
  const [openRoute, setOpenRoute] = useState<OfficialRouteView | null>(null)
  /** 加入旅行时需要先选旅行：pending 为正在加入的地点；为空表示只是更换当前旅行 */
  const [picker, setPicker] = useState<{ pending: PlaceView | null } | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 载入后处理链接参数：#place-12 打开地点详情；?filter=NIGHT/ ?area=浅草 直接筛选
  const data = useExploreData('TOKYO', loaded => {
    const m = /^#place-(\d+)$/.exec(window.location.hash)
    if (m && loaded.some(p => p.id === Number(m[1]))) { setDetailId(Number(m[1])); return }
    const params = new URLSearchParams(window.location.search)
    const f = params.get('filter'), a = params.get('area')
    if (f && CATEGORIES.some(c => c.key === f)) setCategory(f)
    if (a && loaded.some(p => p.area === a)) setArea(a)
    if (f || a) setTimeout(() => scrollTo('xp-all'), 300)
  })
  const { places, routes, joined, checkedIn, favorites, target } = data

  const say = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2400)
  }, [])

  // ───────────── 派生数据（一次请求，多个视图） ─────────────
  const all = places.data
  const status = useMemo(() => ({ joined, checkedIn, favorites }), [joined, checkedIn, favorites])
  const byId = useMemo(() => new Map(all.map(p => [p.id, p])), [all])
  const toView = useCallback((p: PlaceView) => toExplorePlace(p, status), [status])
  const recommended = useMemo(() => selectRecommended(all, status).map(toView), [all, status, toView])
  const areas = useMemo(() => selectAreas(all), [all])
  const season = currentSeason()
  const inspirations = useMemo(() => selectInspirations(routes.data, season), [routes.data, season])
  const searched = useMemo(() => searchPlaces(all, query).filter(p => !area || p.area === area), [all, query, area])
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map(c => [c.key, searched.filter(c.match).length])), [searched])
  const list = useMemo(() => sortPlaces(searched.filter(categoryOf(category).match), sort, geo).map(toView), [searched, category, sort, geo, toView])
  const detail = detailId != null && byId.has(detailId) ? toView(byId.get(detailId)!) : null
  const mapSelected = mapSelectedId != null && byId.has(mapSelectedId) ? toView(byId.get(mapSelectedId)!) : null

  // ───────────── 筛选 ─────────────
  const resetPage = () => setLimit(PLACE_PAGE_SIZE)
  const pickCategory = (key: string, scroll = false) => { setCategory(key); resetPage(); if (scroll) scrollTo('xp-all') }
  const pickArea = (name: string, fromCard = false) => {
    setArea(name); resetPage()
    // 从区域卡进入：只看这个区域，清掉其他条件
    if (fromCard) { setCategory('ALL'); setQuery(''); setView('grid'); scrollTo('xp-all') }
  }
  const clearAll = () => { setQuery(''); setCategory('ALL'); setArea(''); resetPage() }

  function changeSort(key: SortKey) {
    if (key !== 'DISTANCE' || geo) { setSort(key); return }
    if (!navigator.geolocation) { say('当前浏览器不支持定位'); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setSort('DISTANCE') },
      () => say('没有获得定位权限，无法按距离排序'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }

  // ───────────── 地点详情（#place-{id}，可分享） ─────────────
  const openDetail = useCallback((id: number) => {
    setDetailId(id)
    history.replaceState(null, '', `#place-${id}`)
  }, [])
  // 已经在本页时，地址栏的 #place-{id} 变化（全局搜索、手动修改、浏览器前进后退）也能打开对应地点
  useEffect(() => {
    const onHash = () => {
      const m = /^#place-(\d+)$/.exec(window.location.hash)
      setDetailId(m && byId.has(Number(m[1])) ? Number(m[1]) : null)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [byId])
  const closeDetail = useCallback(() => {
    setDetailId(null)
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  // ───────────── 加入旅行 / 收藏 / 分享 ─────────────
  const addTo = useCallback(async (trip: TripView, p: PlaceView) => {
    const r = await data.addToTrip(trip, p)
    say(r.ok ? `已将「${p.name}」加入「${trip.title}」` : r.message ?? '加入失败')
  }, [data, say])

  const actions: ExploreActions = {
    busy: data.busy,
    onOpen: p => openDetail(p.id),
    onAdd: p => {
      if (data.signedIn && target) { void addTo(target, p); return }
      setPicker({ pending: p })
    },
    onFavorite: p => {
      if (!data.signedIn) { say('登录后可以收藏地点'); return }
      void data.toggleFavorite(p).then(r => say(r.ok ? (r.on ? `已收藏「${p.name}」` : '已取消收藏') : r.message ?? '收藏失败'))
    },
    onShare: p => { void (async () => {
      const url = `${window.location.origin}/explore/tokyo#place-${p.id}`
      try {
        if (navigator.share) await navigator.share({ title: `${p.name} · 旅迹东京探索`, text: p.tagline ?? p.name, url })
        else { await navigator.clipboard.writeText(url); say('地点链接已复制') }
      } catch { /* 用户取消分享 */ }
    })() }
  }

  async function pickTrip(trip: TripView) {
    const pending = picker?.pending ?? null
    setPicker(null)
    await data.chooseTarget(trip)
    if (pending) await addTo(trip, pending)
    else say(`之后的地点会加入「${trip.title}」`)
  }

  async function addAll(list: PlaceView[]) {
    if (!data.signedIn || !target) { setPicker({ pending: null }); return }
    let ok = 0
    for (const p of list) if ((await data.addToTrip(target, p)).ok) ok++
    say(`已将 ${ok} 个地点加入「${target.title}」`)
  }

  function showOnMap(id: number) {
    closeDetail()
    clearAll()
    setView('grid')
    // 先切回不筛选，再进入地图并选中这个地点
    setTimeout(() => { setView('map'); setMapSelectedId(id); scrollTo('xp-all') }, 30)
  }

  return (
    <main>
      <SiteHeader />
      <PageContainer variant="wide" className="ex-page xp-page">
        <ExploreHero
          query={query}
          category={category}
          stats={{ places: places.loading ? undefined : all.length, areas: places.loading ? undefined : areas.length, routes: routes.loading || routes.error ? undefined : routes.data.length }}
          resultCount={list.length}
          signedIn={data.signedIn}
          target={target}
          allJoined={all.length > 0 && all.every(p => joined.has(p.id))}
          onQuery={q => { setQuery(q); resetPage() }}
          onCategory={key => pickCategory(key, true)}
          onStart={() => scrollTo('xp-recommend')}
          onShowResults={() => scrollTo('xp-all')}
          onChangeTrip={() => setPicker({ pending: null })}
        />

        {/* 地点加载失败时，推荐与区域整块隐藏，错误与重试放在「全部地点」里 */}
        {!places.error && <RecommendedPlaces places={recommended} loading={places.loading} actions={actions} onViewAll={() => { clearAll(); scrollTo('xp-all') }} />}
        {!places.error && <AreaExplorer areas={areas} loading={places.loading} active={area} onPick={name => pickArea(name, true)} />}
        <TravelInspiration routes={inspirations} loading={routes.loading} season={season} onOpen={setOpenRoute} />

        <AllPlaces
          places={list} loading={places.loading} error={places.error} onRetry={data.reloadPlaces}
          query={query} category={category} area={area} areas={areas.map(a => a.name)} sort={sort} view={view} counts={counts}
          limit={limit} mapSelected={mapSelected} actions={actions}
          distanceOf={geo && sort === 'DISTANCE' ? p => formatKm(distanceKm(geo, p), data.unit) : undefined}
          onCategory={key => pickCategory(key)} onArea={name => pickArea(name)} onSort={changeSort}
          onView={v => { setView(v); if (v === 'map') setMapSelectedId(null) }}
          onMore={() => setLimit(n => n + PLACE_PAGE_SIZE)}
          onClearQuery={() => { setQuery(''); resetPage() }}
          onClearAll={clearAll}
          onMapSelect={p => setMapSelectedId(p.id)}
        />
        <p className="xp-credits-note">景点照片来自 Wikimedia Commons，作者与许可证见 <Link href="/credits">图片来源与授权</Link>。</p>
      </PageContainer>

      {detail && (
        <PlaceDetailDrawer place={detail} routes={routes.data} actions={actions} tripTitle={target?.title}
          onOpenRoute={r => { closeDetail(); setOpenRoute(r) }} onShowOnMap={p => showOnMap(p.id)} onClose={closeDetail} />
      )}
      {openRoute && (
        <RouteDrawer route={openRoute} byId={byId} joined={joined} busy={data.busy}
          onAdd={p => actions.onAdd(p)} onAddAll={list => void addAll(list)}
          onOpenPlace={p => { setOpenRoute(null); openDetail(p.id) }} onClose={() => setOpenRoute(null)} />
      )}
      {picker && (
        <TripPickerDialog signedIn={data.signedIn} trips={data.writableTrips} placeName={picker.pending?.name} current={target}
          onPick={t => void pickTrip(t)} onClose={() => setPicker(null)} />
      )}
      {toast && <div className="ex-toast" role="status">{toast}</div>}
    </main>
  )
}
