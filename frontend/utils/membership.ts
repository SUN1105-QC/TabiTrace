/**
 * 会员权益判断的唯一入口：组件里不要自己写 if (user.pro) / if (membership.status === ...)，统一用 hasFeature / gateState。
 * 前端只用来展示；能不能上传、能不能用于视频由后端每次重新判断（403 CUSTOM_MUSIC_REQUIRES_MEMBERSHIP）。
 * 会员（账号级）与 Trip Pro（单次旅行）是两种权益，不要混用。
 */

import type { Membership, MembershipFeature } from '@/types/user-music'

/** 开通 / 续费会员：目前通过「买断 · 终身 Pro」开通 */
export const MEMBERSHIP_URL = '/pricing#pr-lifetime'

export type GateState = 'ACTIVE' | 'LOCKED' | 'EXPIRED'

export function hasFeature(m: Membership | null | undefined, feature: MembershipFeature) {
  return !!m && m.status === 'ACTIVE' && m.features.includes(feature)
}

/** ACTIVE：可以使用；LOCKED：从未开通；EXPIRED：开通过但已到期（只读） */
export function gateState(m: Membership | null | undefined, feature: MembershipFeature): GateState {
  if (hasFeature(m, feature)) return 'ACTIVE'
  return m?.status === 'EXPIRED' ? 'EXPIRED' : 'LOCKED'
}

export const FEATURE_COPY: Record<MembershipFeature, { title: string; pitch: string; locked: string; expired: string }> = {
  CUSTOM_MUSIC: {
    title: '上传自己的音乐',
    pitch: '上传自己的音乐，为 Travel Story 加入真正属于你的声音。',
    locked: '上传自己的音乐是会员专属功能。',
    expired: '会员已到期，续费后可继续使用自定义音乐。'
  }
}
