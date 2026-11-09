'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { ExploreCountry } from '@/constants/explore-catalog'
import { DEFAULT_DIRECTORY_FILTERS, directoryFilterUrl, parseDirectoryFilters, type DirectoryFilters } from '@/utils/explore-directory'

// replaceState 本身不触发 popstate；主动更新筛选时用自定义事件通知订阅者。
const EVENT = 'tabitrace:explore-directory-filters'
const snapshot = () => window.location.search + window.location.hash
const serverSnapshot = () => ''
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('popstate', onChange)
  window.addEventListener('hashchange', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('popstate', onChange)
    window.removeEventListener('hashchange', onChange)
  }
}

/** 地址栏保存筛选条件，支持分享与返回恢复；服务端先使用空快照，避免读取 window 导致水合差异。 */
export function useExploreDirectoryFilters(countries: ExploreCountry[]) {
  const url = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const filters = useMemo(() => parseDirectoryFilters(url, countries), [url, countries])
  function update(patch: Partial<DirectoryFilters>) {
    const next = { ...parseDirectoryFilters(snapshot(), countries), ...patch }
    window.history.replaceState(window.history.state, '', directoryFilterUrl(window.location.href, next, countries))
    window.dispatchEvent(new Event(EVENT))
  }
  return { filters, update, reset: () => update(DEFAULT_DIRECTORY_FILTERS) }
}
