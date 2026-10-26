'use client'

/**
 * 会员权益的统一门槛：<MembershipGate feature="CUSTOM_MUSIC" membership={m}>…</MembershipGate>
 * - 有效会员：直接显示内容
 * - 从未开通：锁定卡片（说明权益 + 开通会员），不隐藏入口，让用户知道有这项权益
 * - 已到期：只读提示（续费会员）；readOnlyChildren 时内容照常显示在提示下面（查看、试听、删除仍可用）
 * 只负责展示；后端会再次检查会员（403）。
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Clock3, Lock, Music4 } from 'lucide-react'
import type { Membership, MembershipFeature } from '@/types/user-music'
import { FEATURE_COPY, MEMBERSHIP_URL, gateState } from '@/utils/membership'

export function MembershipGate({ feature, membership, children, readOnlyChildren = false, footer }: {
  feature: MembershipFeature
  membership: Membership | null | undefined
  children: ReactNode
  /** 会员到期后是否仍显示内容（只读） */
  readOnlyChildren?: boolean
  /** 锁定卡片下方的补充内容（例如「继续使用旅迹免费音乐」） */
  footer?: ReactNode
}) {
  const state = gateState(membership, feature)
  const copy = FEATURE_COPY[feature]
  if (state === 'ACTIVE') return <>{children}</>
  if (state === 'EXPIRED') {
    return (
      <>
        <div className="mg-expired" role="status">
          <Clock3 size={16} aria-hidden="true" />
          <p>{copy.expired}</p>
          <Link href={MEMBERSHIP_URL} className="vs-btn is-primary">续费会员</Link>
        </div>
        {readOnlyChildren && children}
      </>
    )
  }
  return (
    <div className="mg-locked">
      <span className="mg-icon" aria-hidden="true"><Music4 size={22} /><Lock size={12} /></span>
      <h4>{copy.title}</h4>
      <p>{copy.pitch}</p>
      <span className="mg-badge">会员专属</span>
      <Link href={MEMBERSHIP_URL} className="vs-btn is-primary mg-cta">开通会员</Link>
      {footer}
    </div>
  )
}
