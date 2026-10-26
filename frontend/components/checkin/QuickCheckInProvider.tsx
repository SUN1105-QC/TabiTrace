'use client'

/**
 * 全局快速打卡：Header、Hero、今天可以做、移动端底部相机按钮都调用同一个 openQuickCheckIn()，
 * 业务逻辑只有一份（QuickCheckInSheet：照片上传复用 stageTripPhoto，保存走 POST /trips/{id}/quick-checkins）。
 * openQuickCheckIn(tripId, prefill, { camera: true })：在同一次点击里直接唤起相机（必须同步触发，
 * 否则移动端浏览器会拦截），同时打开快速打卡面板；用户取消拍照时面板里仍有「快速拍照 / 从相册选择」。
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { QuickCheckInSheet, type IncomingPhotos } from './QuickCheckInSheet'

/** 预填：从地图工作台“到达打卡”进入时带上地点 / 行程项，打卡会自动完成对应行程 */
export type QuickCheckInPrefill = {
  placeId?: number
  placeName?: string
  area?: string
  itineraryItemId?: number
  /** 今天不在旅行日期内时使用的日期（例如计划的日期） */
  date?: string
  note?: string
  latitude?: number
  longitude?: number
}

type OpenOptions = { camera?: boolean }

type QuickCheckInContextValue = {
  openQuickCheckIn: (tripId?: number, prefill?: QuickCheckInPrefill, options?: OpenOptions) => void
  /** 每次打卡成功后自增，首页等页面据此刷新数据 */
  checkinVersion: number
}

const QuickCheckInContext = createContext<QuickCheckInContextValue>({ openQuickCheckIn: () => {}, checkinVersion: 0 })

export function useQuickCheckIn() {
  return useContext(QuickCheckInContext)
}

export function QuickCheckInProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const [requestedTripId, setRequestedTripId] = useState<number | null>(null)
  const [prefill, setPrefill] = useState<QuickCheckInPrefill | null>(null)
  const [incoming, setIncoming] = useState<IncomingPhotos | null>(null)
  const [version, setVersion] = useState(0)
  const camera = useRef<HTMLInputElement | null>(null)

  const openQuickCheckIn = useCallback((tripId?: number, p?: QuickCheckInPrefill, options?: OpenOptions) => {
    if (options?.camera && camera.current) {
      camera.current.value = ''
      camera.current.click()
    }
    setRequestedTripId(tripId ?? null)
    setPrefill(p ?? null)
    setIncoming(null)
    setSession(s => s + 1)
    setOpen(true)
  }, [])

  const value = useMemo(() => ({ openQuickCheckIn, checkinVersion: version }), [openQuickCheckIn, version])

  return (
    <QuickCheckInContext.Provider value={value}>
      {children}
      {/* 底部相机按钮直接拍照用的入口：拍完的照片交给面板 */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-hidden="true" tabIndex={-1}
        onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) setIncoming({ files, source: 'camera', nonce: Date.now() }) }} />
      {open && (
        <QuickCheckInSheet
          key={session}
          preferredTripId={requestedTripId}
          prefill={prefill}
          incoming={incoming}
          onClose={() => setOpen(false)}
          onSaved={() => setVersion(v => v + 1)}
        />
      )}
    </QuickCheckInContext.Provider>
  )
}
