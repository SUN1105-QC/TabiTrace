'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** 各模块独立加载；请求取消后不写回，避免慢搜索覆盖新筛选结果。 */
export function useAdminResource<T>(loader: (signal: AbortSignal) => Promise<T>, enabled: boolean) {
  type Snapshot = { source: typeof loader; enabled: boolean; data: T | null; loading: boolean; error: string; updatedAt: number | null }
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ source: loader, enabled, data: null, loading: enabled, error: '', updatedAt: null }))
  const controller = useRef<AbortController | null>(null)
  // 查询条件变化后的第一帧就隔离旧结果，避免旧总数修正新页码，或误操作上一组资源。
  const current = snapshot.source === loader && snapshot.enabled === enabled
  const setData = useCallback((data: T | null) => {
    // 保存响应是权威资料，不能再被尚未结束的旧详情读取覆盖。
    controller.current?.abort()
    setSnapshot(previous => ({ ...previous, source: loader, enabled, data, loading: false, error: '' }))
  }, [loader, enabled])
  const load = useCallback(async () => {
    if (!enabled) return false
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setSnapshot(previous => ({ source: loader, enabled, data: previous.source === loader ? previous.data : null,
      updatedAt: previous.source === loader ? previous.updatedAt : null, loading: true, error: '' }))
    // 传入取消信号后，通用 API client 不再添加默认超时，因此这里显式设置读取期限。
    const timeout = setTimeout(() => {
      if (request.signal.aborted) return
      setSnapshot(previous => ({ ...previous, error: '读取超时，请检查网络后重试。', loading: false }))
      request.abort()
    }, 20000)
    try {
      const result = await loader(request.signal)
      if (request.signal.aborted) return false
      setSnapshot({ source: loader, enabled, data: result, updatedAt: Date.now(), loading: false, error: '' })
      return true
    } catch (failure) {
      if (!request.signal.aborted) {
        setSnapshot(previous => ({ ...previous, error: failure instanceof Error ? failure.message : '网络异常，请重试。', loading: false }))
        // 一个并行读取失败时一并取消其余请求，防止失去总超时后的悬挂连接。
        request.abort()
      }
      return false
    } finally { clearTimeout(timeout) }
  }, [loader, enabled])
  useEffect(() => {
    // 严格模式的首次清理先于微任务执行，避免尚未挂载完成就发出重复请求。
    let disposed = false
    queueMicrotask(() => { if (!disposed) void load() })
    return () => { disposed = true; controller.current?.abort() }
  }, [load])
  return { data: current ? snapshot.data : null, loading: current ? snapshot.loading : enabled,
    error: current ? snapshot.error : '', updatedAt: current ? snapshot.updatedAt : null, load, setData }
}
