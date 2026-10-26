'use client'

/**
 * 「我的音乐」数据（模块级共享）：视频页的摘要 / 生成检查与音乐选择器读同一份，上传、改名、删除后两边同时更新。
 * 列表只来自后端（上传完成后重新读取），不在前端拼数据。
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { UserMusic, UserMusicLibrary } from '@/types/user-music'
import { userMusicApi } from '@/services/user-music'

export type UserMusicState = { status: 'idle' | 'loading' | 'ready' | 'error'; library: UserMusicLibrary | null; error: string | null }

const IDLE: UserMusicState = { status: 'idle', library: null, error: null }
let state: UserMusicState = IDLE
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
/** 试听地址缓存：签名地址有有效期，提前 30 秒作废 */
const playUrls = new Map<number, { url: string; until: number }>()

function set(patch: Partial<UserMusicState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

function load(force = false): Promise<void> {
  if (inflight) return inflight
  if (!force && state.status === 'ready') return Promise.resolve()
  set({ status: state.library ? state.status : 'loading', error: null })
  inflight = userMusicApi.library()
    .then(library => set({ status: 'ready', library, error: null }))
    .catch(e => set({ status: state.library ? 'ready' : 'error', error: e instanceof Error ? e.message : '我的音乐加载失败' }))
    .finally(() => { inflight = null })
  return inflight
}

async function rename(id: number, title: string) {
  const updated = await userMusicApi.rename(id, title)
  replace(updated)
  return updated
}

async function remove(id: number) {
  await userMusicApi.remove(id)
  playUrls.delete(id)
  await load(true)
}

/** 上传完成（READY 或 FAILED）后以后端列表为准刷新 */
async function uploaded() { await load(true) }

function replace(m: UserMusic) {
  if (!state.library) return
  set({ library: { ...state.library, items: state.library.items.map(x => (x.id === m.id ? m : x)) } })
}

async function playUrl(id: number) {
  const hit = playUrls.get(id)
  if (hit && hit.until > Date.now()) return hit.url
  const res = await userMusicApi.playUrl(id)
  playUrls.set(id, { url: res.url, until: Date.now() + Math.max(0, res.expiresInSeconds - 30) * 1000 })
  return res.url
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => state
const serverSnapshot = () => IDLE

export function useUserMusic(autoload = true) {
  const s = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  useEffect(() => { if (autoload) void load() }, [autoload])
  const reload = useCallback(() => load(true), [])
  return { ...s, reload, rename, remove, uploaded, playUrl }
}

/** 试听用的播放器代码：与旅迹音乐的代码区分开 */
export const userMusicKey = (id: number) => `user:${id}`
