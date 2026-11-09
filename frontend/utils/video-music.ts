/** Travel Story 只接受用户上传的音乐；旧项目的自带配乐在重新编辑时转为无音乐。 */
import type { MusicSource } from '@/types/video'
import type { UserMusic, UserMusicLibrary } from '@/types/user-music'

export const DEFAULT_MUSIC_VOLUME = 50
export const clock = (s?: number | null) => (s != null && Number.isFinite(s) && s >= 0 ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '--:--')
export type MusicSelection = { source: 'USER'; id: number } | null

export function selectionOf(d: { musicSource?: MusicSource | null; musicCode?: string | null; userMusicId?: number | null }): MusicSelection {
  if (d.musicSource === 'USER' || (d.musicSource == null && d.userMusicId != null)) return d.userMusicId != null ? { source: 'USER', id: d.userMusicId } : null
  return null
}

export function draftMusic(sel: MusicSelection): { musicSource: MusicSource | null; musicCode: null; userMusicId: number | null } {
  return sel ? { musicSource: 'USER', musicCode: null, userMusicId: sel.id } : { musicSource: null, musicCode: null, userMusicId: null }
}

export function selectionLabel(sel: MusicSelection, mine: UserMusic[] | null) {
  if (!sel) return '无音乐'
  if (!mine) return '我的音乐'
  const m = mine.find(x => x.id === sel.id)
  return m ? `${m.title}（我的音乐）` : '原音乐已被删除'
}

export function selectionProblem(sel: MusicSelection, mine: UserMusicLibrary | null): string {
  if (!sel || !mine) return ''
  const m = mine.items.find(x => x.id === sel.id)
  if (!m) return '原音乐已被删除，请在「背景音乐」里重新选择'
  if (!mine.canUse) return mine.membership.status === 'EXPIRED' ? '会员已到期，续费后可继续使用自定义音乐；也可以选择无音乐' : '使用自己的音乐需要开通会员，也可以选择无音乐'
  if (m.status !== 'READY') return `「${m.title}」还不能使用，请换一首音乐`
  return ''
}
