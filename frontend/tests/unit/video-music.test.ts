import { describe, expect, it } from 'vitest'
import { draftMusic, selectionOf, selectionProblem } from '@/utils/video-music'
import type { UserMusicLibrary } from '@/types/user-music'

describe('用户上传音乐', () => {
  it('重新编辑旧自带音乐时使用无音乐，清空旧代码', () => {
    for (const old of [{ musicSource: 'SYSTEM' as const, musicCode: 'LEGACY' }, { musicCode: 'LEGACY' }, { musicCode: 'NONE' }]) {
      expect(draftMusic(selectionOf(old))).toEqual({ musicSource: null, musicCode: null, userMusicId: null })
    }
  })

  it('保留自己上传的音乐 ID，不把旧曲库代码带入新草稿', () => {
    expect(draftMusic(selectionOf({ musicSource: 'USER', userMusicId: 9, musicCode: 'LEGACY' })))
      .toEqual({ musicSource: 'USER', musicCode: null, userMusicId: 9 })
    expect(selectionOf({ userMusicId: 9 })).toEqual({ source: 'USER', id: 9 })
  })

  it('音乐删除、处理中和会员到期仍阻止生成，并可改为无音乐', () => {
    const library = { canUse: true, membership: { status: 'ACTIVE' }, items: [{ id: 9, title: 'mine', status: 'READY' }] } as UserMusicLibrary
    const selection = { source: 'USER' as const, id: 9 }
    expect(selectionProblem(selection, library)).toBe('')
    expect(selectionProblem(selection, { ...library, items: [] })).toContain('已被删除')
    expect(selectionProblem(selection, { ...library, items: [{ ...library.items[0], status: 'PROCESSING' }] })).toContain('还不能使用')
    const expired = { ...library, canUse: false, membership: { ...library.membership, status: 'EXPIRED' as const } }
    expect(selectionProblem(selection, expired)).toContain('会员已到期')
    expect(selectionProblem(null, expired)).toBe('')
  })
})
