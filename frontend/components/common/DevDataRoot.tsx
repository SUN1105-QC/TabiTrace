'use client'

import { Fragment, useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { isDevelopment, loadDevDataSwitcher } from '@/lib/env'

type Switcher = ComponentType<{ onSwitched: () => void }>

/**
 * 开发环境：加载开发数据源切换器；切换数据源后给整棵应用子树换一个 key，
 * 所有页面与外壳重新挂载、按新的数据源重新取数（旧数据不会残留在组件 state 里）。
 * 生产环境：原样渲染子树，不加载也不渲染任何开发工具。
 */
function DevRoot({ children }: { children: ReactNode }) {
  const [epoch, setEpoch] = useState(0)
  const [Tool, setTool] = useState<Switcher | null>(null)
  useEffect(() => { void loadDevDataSwitcher()?.then(m => setTool(() => m.DevDataSwitcher)) }, [])
  const remount = useCallback(() => setEpoch(e => e + 1), [])
  return (
    <>
      <Fragment key={epoch}>{children}</Fragment>
      {Tool && <Tool onSwitched={remount} />}
    </>
  )
}

function ProductionRoot({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export const DevDataRoot = isDevelopment ? DevRoot : ProductionRoot
