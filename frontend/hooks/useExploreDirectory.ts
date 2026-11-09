'use client'

import { useEffect, useState } from 'react'
import type { ExploreDirectoryData } from '@/constants/explore-catalog'
import { api, ApiError } from '@/services/api'

type State = { status: 'loading' | 'error' | 'ready'; data: ExploreDirectoryData | null; forbidden?: boolean }

/** 只读取真实公开目录；失败保持错误态，由用户重试，不用示例城市替代接口结果。 */
export function useExploreDirectory() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<State>({ status: 'loading', data: null })
  useEffect(() => {
    // 页面离开或发起下一轮重试时取消旧请求；旧结果不能覆盖新一轮状态。
    const abort = new AbortController()
    // 最后的 false 表示公开请求，不因目录访问失败触发登录续期或跳转登录页。
    api<ExploreDirectoryData>('/official-cities/directory', { signal: abort.signal }, false)
      .then(data => { if (!abort.signal.aborted) setState({ status: 'ready', data }) })
      .catch(error => { if (!abort.signal.aborted) setState({ status: 'error', data: null, forbidden: error instanceof ApiError && [401, 403].includes(error.status) }) })
    return () => abort.abort()
  }, [attempt])
  return {
    ...state,
    retry: () => { setState({ status: 'loading', data: null }); setAttempt(n => n + 1) }
  }
}
