'use client'

/**
 * 推荐探索 · 东京探索指南。
 * 首屏城市专题 → 探索方式入口 → 粘性筛选栏 → 编辑精选 → 按主题探索 → 全部地点（混排）→ 底部行动出口。
 * 地点、专题路线、编辑内容与热度全部来自后端官方内容库；收藏与加入旅行是真实操作。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { ExploreHero } from '@/components/explore/ExploreHero'
import { ExploreModes } from '@/components/explore/ExploreModes'
import { ExploreFilterBar } from '@/components/explore/ExploreFilterBar'
import { EditorPicks } from '@/components/explore/EditorPicks'
import { RouteBanner, RouteCard } from '@/components/explore/RouteCards'
import { PlaceCard } from '@/components/explore/PlaceCard'
import { InfoCardView } from '@/components/explore/InfoCardView'
import { RouteDrawer } from '@/components/explore/RouteDrawer'
import { ExploreMapView } from '@/components/explore/ExploreMapView'
import { ExploreGuide } from '@/components/explore/ExploreGuide'
import type { ExploreActions } from '@/components/explore/PlaceActions'
import { hasSession } from '@/services/api'
import { tripApi, userApi, type DistanceUnit, type OfficialRouteView, type PlaceView } from '@/services/tabitrace-api'
import { FILTERS, currentSeason, distanceKm, filterOf, formatKm, infoCards, mixedList, sortPlaces, type Geo, type SortKey } from '@/utils/explore'

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

export default function TokyoExplorePage() {
  const [places, setPlaces] = useState<PlaceView[]>([])
  const [routes, setRoutes] = useState<OfficialRouteView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trip, setTrip] = useState<{ id: number; title: string } | null>(null)
  const [added, setAdded] = useState<Set<number>>(new Set())
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState('ALL')
  const [sort, setSort] = useState<SortKey>('RECOMMEND')
  const [view, setView] = useState<'grid' | 'map'>('grid')
  const [geo, setGeo] = useState<Geo | null>(null)
  const [geoDenied, setGeoDenied] = useState(false)
  // 距离单位来自设置中心 · 旅行偏好（未登录时用公里）
  const [unit, setUnit] = useState<DistanceUnit>('KM')
  useEffect(() => { if (hasSession()) userApi.me().then(u => setUnit(u.distanceUnit === 'MI' ? 'MI' : 'KM')).catch(() => {}) }, [])
  const [openRoute, setOpenRoute] = useState<OfficialRouteView | null>(null)
  const [selected, setSelected] = useState<PlaceView | null>(null)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const say = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const [ps, rs] = await Promise.all([tripApi.officialPlaces('TOKYO'), tripApi.officialRoutes('TOKYO')])
        setPlaces(ps)
        setRoutes(rs)
        const tripId = Number(localStorage.getItem('tabitrace-live-trip-id') || 0)
        if (tripId && hasSession()) {
          const [t, existing] = await Promise.all([tripApi.get(tripId).catch(() => null), tripApi.places(tripId).catch(() => [])])
          if (t) setTrip({ id: t.id, title: t.title })
          setAdded(new Set(existing.filter(p => p.sourceType === 'OFFICIAL').map(p => p.id)))
        }
        if (hasSession()) setFavorites(new Set(await tripApi.favoritePlaces().catch(() => [])))
      } catch (e) {
        setError(errMsg(e, '无法读取东京官方内容'))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const byId = useMemo(() => new Map(places.map(p => [p.id, p])), [places])
  const season = currentSeason()
  const orderedRoutes = useMemo(() => [...routes].sort((a, b) => Number(b.season === season) - Number(a.season === season)), [routes, season])
  const themeRoutes = orderedRoutes.slice(0, 3)
  const bannerRoutes = orderedRoutes.slice(3)
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.key, places.filter(f.match).length])), [places])
  const visible = useMemo(() => sortPlaces(places.filter(filterOf(filter).match), filter === 'HOT' ? 'HOT' : sort, geo), [places, filter, sort, geo])
  const infos = useMemo(() => infoCards(places, geo, geoDenied, unit), [places, geo, geoDenied, unit])
  const items = useMemo(() => (filter === 'ALL' ? mixedList(visible, bannerRoutes, infos) : visible.map(place => ({ kind: 'place' as const, place }))), [filter, visible, bannerRoutes, infos])

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // 分享链接带 #place-id 时，载入后定位到对应地点；带 ?filter=NIGHT 等参数时（如从成就页跳来）直接切到对应分类
  useEffect(() => {
    if (loading) return
    const m = /^#place-(\d+)$/.exec(window.location.hash)
    if (m) { setTimeout(() => focusPlace(Number(m[1])), 300); return }
    const f = new URLSearchParams(window.location.search).get('filter')
    if (f && FILTERS.some(x => x.key === f)) { setFilter(f); setTimeout(() => scrollTo('ex-all'), 300) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  function focusPlace(id: number) {
    const p = byId.get(id)
    if (!p) return
    if (!filterOf(filter).match(p)) setFilter('ALL')
    setView('grid')
    setTimeout(() => {
      document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlight(id)
      setTimeout(() => setHighlight(h => (h === id ? null : h)), 1800)
    }, 80)
  }

  function pickFilter(key: string) {
    setFilter(key)
    scrollTo('ex-all')
  }

  function locate(then?: () => void) {
    if (!navigator.geolocation) { setGeoDenied(true); say('当前浏览器不支持定位'); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); then?.() },
      () => { setGeoDenied(true); say('没有获得定位权限，无法按距离排序') },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    )
  }

  function changeSort(key: SortKey) {
    if (key === 'DISTANCE' && !geo) { locate(() => setSort('DISTANCE')); return }
    setSort(key)
  }

  const add = useCallback(async (p: PlaceView) => {
    if (!trip) { say('请先创建或打开一段旅行，再把地点加进去'); return false }
    setBusy(b => new Set(b).add(p.id))
    try {
      await tripApi.addOfficial(trip.id, p.id)
      setAdded(a => new Set(a).add(p.id))
      return true
    } catch (e) {
      const msg = errMsg(e, '加入失败')
      if (msg.includes('已加入')) { setAdded(a => new Set(a).add(p.id)); return true }
      say(msg)
      return false
    } finally {
      setBusy(b => { const n = new Set(b); n.delete(p.id); return n })
    }
  }, [trip, say])

  const actions: ExploreActions = {
    added, favorites, busy,
    onAdd: async p => { if (await add(p)) say(`已将「${p.name}」加入「${trip?.title}」`) },
    onFavorite: async p => {
      if (!hasSession()) { say('登录后可以收藏地点'); return }
      const on = !favorites.has(p.id)
      setFavorites(f => { const n = new Set(f); if (on) n.add(p.id); else n.delete(p.id); return n })
      try {
        await tripApi.setFavorite(p.id, on)
        say(on ? `已收藏「${p.name}」` : '已取消收藏')
      } catch (e) {
        setFavorites(f => { const n = new Set(f); if (on) n.delete(p.id); else n.add(p.id); return n })
        say(errMsg(e, '收藏失败'))
      }
    },
    onShare: async p => {
      const url = `${window.location.origin}/explore/tokyo#place-${p.id}`
      try {
        if (navigator.share) await navigator.share({ title: `${p.name} · 旅迹东京探索指南`, text: p.tagline ?? p.name, url })
        else { await navigator.clipboard.writeText(url); say('地点链接已复制') }
      } catch { /* 用户取消分享 */ }
    }
  }

  async function addAll(list: PlaceView[]) {
    if (!trip) { say('请先创建或打开一段旅行，再把地点加进去'); return }
    let ok = 0
    for (const p of list) if (await add(p)) ok++
    say(`已将 ${ok} 个地点加入「${trip.title}」`)
  }

  const selectOnMap = useCallback((p: PlaceView) => setSelected(p), [])
  const openMap = () => { setView('map'); setTimeout(() => scrollTo('ex-all'), 50) }
  const openRouteByCode = (code: string) => { const r = routes.find(x => x.code === code); if (r) setOpenRoute(r) }

  return (
    <main>
      <SiteHeader />
      <div className="ex-page">
        <ExploreHero
          stats={{ places: places.length, routes: routes.length, areas: new Set(places.map(p => p.area).filter(Boolean)).size }}
          season={season}
          seasonRoute={routes.find(r => r.season === season)}
          trip={trip}
          onStart={() => scrollTo('ex-modes')}
          onMap={openMap}
          onFilter={pickFilter}
          onRoute={openRouteByCode}
        />

        {error && <div className="ex-alert"><TriangleAlert size={15} /> {error}</div>}

        {loading ? (
          <div className="ex-loading">
            <div className="skeleton" style={{ height: 96, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 420, borderRadius: 16 }} />
          </div>
        ) : (
          <>
            <ExploreModes places={places} active={filter} onPick={pickFilter} />
            <ExploreFilterBar filter={filter} sort={sort} view={view} counts={counts} onFilter={pickFilter} onSort={changeSort} onView={v => { setView(v); if (v === 'map') setSelected(null) }} />

            {filter === 'ALL' && view === 'grid' && (
              <>
                <EditorPicks places={places} actions={actions} />
                {themeRoutes.length > 0 && (
                  <section className="ex-section">
                    <header className="ex-section-head">
                      <div>
                        <p className="ex-eyebrow">THEME ROUTES</p>
                        <h2>按主题探索东京</h2>
                        <p>把顺路的地点串成一条线，照着走就是一段完整的半天或一天。</p>
                      </div>
                    </header>
                    <div className="ex-routes">
                      {themeRoutes.map(r => <RouteCard key={r.id} route={r} byId={byId} onOpen={setOpenRoute} />)}
                    </div>
                  </section>
                )}
              </>
            )}

            <section className="ex-section" id="ex-all">
              <header className="ex-section-head">
                <div>
                  <p className="ex-eyebrow">ALL PLACES</p>
                  <h2>{filter === 'ALL' ? '全部地点' : filterOf(filter).label}</h2>
                  <p>{filter === 'ALL' ? '精选东京城市体验，与值得加入旅行的地点。' : `共 ${visible.length} 个地点${sort === 'DISTANCE' && geo ? '，按离你的距离排序' : ''}`}</p>
                </div>
              </header>
              {view === 'map' ? (
                <ExploreMapView places={visible} selected={selected} actions={actions} onSelect={selectOnMap} />
              ) : visible.length === 0 ? (
                <p className="ex-empty">这个分类下暂时没有地点。</p>
              ) : (
                <div className="ex-grid">
                  {items.map(item =>
                    item.kind === 'place' ? (
                      <PlaceCard key={`p${item.place.id}`} place={item.place} actions={actions} highlight={highlight === item.place.id}
                        distance={geo && sort === 'DISTANCE' ? formatKm(distanceKm(geo, item.place), unit) : undefined} />
                    ) : item.kind === 'route' ? (
                      <RouteBanner key={`r${item.route.id}`} route={item.route} byId={byId} onOpen={setOpenRoute} />
                    ) : (
                      <InfoCardView key={`i${item.info.key}`} info={item.info} onPlace={p => focusPlace(p.id)} onFilter={pickFilter} onLocate={() => locate()} />
                    )
                  )}
                </div>
              )}
            </section>

            <ExploreGuide tripId={trip?.id ?? 0} onMap={() => { setFilter('ALL'); openMap() }} />
          </>
        )}
      </div>

      {openRoute && <RouteDrawer route={openRoute} byId={byId} actions={actions} onAddAll={list => void addAll(list)} onClose={() => setOpenRoute(null)} />}
      {toast && <div className="ex-toast" role="status">{toast}</div>}
    </main>
  )
}
