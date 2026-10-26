/** 工作台左侧的一张步骤卡：两位编号 + 标题 + 副标题，右上角可放次要操作。移动端分步模式下只显示 current 的那一张。 */

import type { ReactNode } from 'react'

export function StudioStep({ id, no, title, sub, aside, current, children }: {
  id: string
  no: number
  title: string
  sub?: string
  aside?: ReactNode
  current?: boolean
  children: ReactNode
}) {
  return (
    <section id={id} className={`vs-card vs-step${current ? ' is-current' : ''}`}>
      <header className="vs-step-head">
        <span className="vs-step-no">{String(no).padStart(2, '0')}</span>
        <div className="vs-step-title">
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {aside && <div className="vs-step-aside">{aside}</div>}
      </header>
      {children}
    </section>
  )
}
