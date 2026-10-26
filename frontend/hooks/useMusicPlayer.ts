'use client'

/**
 * Travel Story 音乐试听：整个页面共用一个 <audio>（模块级单例），所以任何地方开始试听新曲目，上一首都会自动停止，
 * 不会出现多首同时播放。
 * - toggle(code)：同一首在播放 → 暂停；暂停中 → 从暂停处继续；另一首 → 停掉当前，从头播放新曲目
 * - 页面切到后台（visibilitychange / pagehide）→ 暂停
 * - 最后一个使用它的组件卸载（离开视频页、关闭音乐面板）→ 停止并释放音频
 * 试听只用后端下发的 45 秒片段（previewUrl），不接触原曲。
 */

import { useEffect, useSyncExternalStore } from 'react'

export type MusicPlayerState = {
  /** 当前载入的曲目（播放或暂停中）；没有为 null */
  code: string | null
  playing: boolean
  loading: boolean
  current: number
  duration: number
  /** 试听失败过的曲目 */
  failed: string[]
}

const IDLE: MusicPlayerState = { code: null, playing: false, loading: false, current: 0, duration: 0, failed: [] }
let state: MusicPlayerState = IDLE
let audio: HTMLAudioElement | null = null
let volume = 0.5
let users = 0
const listeners = new Set<() => void>()

function set(patch: Partial<MusicPlayerState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

function element() {
  if (audio || typeof window === 'undefined') return audio
  audio = new Audio()
  audio.preload = 'none'
  audio.addEventListener('timeupdate', () => { if (audio) set({ current: audio.currentTime }) })
  audio.addEventListener('loadedmetadata', () => { if (audio && Number.isFinite(audio.duration)) set({ duration: audio.duration }) })
  audio.addEventListener('playing', () => set({ playing: true, loading: false }))
  audio.addEventListener('pause', () => set({ playing: false, loading: false }))
  audio.addEventListener('ended', () => set({ playing: false, current: 0 }))
  audio.addEventListener('error', () => {
    // 换曲目时清空 src 也会触发 error：只有正在载入的曲目才记为失败
    if (state.code && audio?.getAttribute('src')) set({ ...IDLE, failed: [...new Set([...state.failed, state.code])] })
  })
  return audio
}

function stop() {
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
  set({ code: null, playing: false, loading: false, current: 0, duration: 0 })
}

async function toggle(code: string, url: string | null | undefined) {
  const el = element()
  if (!el || !url) return
  if (state.code === code) {
    if (state.playing) { el.pause(); return }
    try { set({ loading: true }); await el.play() } catch { set({ ...IDLE, failed: [...new Set([...state.failed, code])] }) }
    return
  }
  el.pause()
  el.src = url
  el.volume = volume
  set({ code, playing: false, loading: true, current: 0, duration: 0, failed: state.failed.filter(c => c !== code) })
  try { await el.play() } catch (e) {
    // 用户很快又切到别的曲目时，上一首的 play() 会被中断：不算失败
    if ((e as Error)?.name === 'AbortError' || state.code !== code) return
    set({ ...IDLE, failed: [...new Set([...state.failed, code])] })
  }
}

/** 试听音量跟随视频设置里的音乐音量（0–100），听到的就是成片里的相对音量 */
function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v / 100))
  if (audio) audio.volume = volume
}

function pause() { audio?.pause() }

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => state
const serverSnapshot = () => IDLE

export function useMusicPlayer() {
  const s = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  useEffect(() => {
    users++
    const hidden = () => { if (document.visibilityState === 'hidden') pause() }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', pause)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', pause)
      users--
      if (users <= 0) stop()
    }
  }, [])
  return { state: s, toggle, stop, pause, setVolume }
}
