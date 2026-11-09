'use client'

/** 用户音乐选择器：上传、试听和使用自己的音乐，也可以选择无音乐。 */
import { useEffect } from 'react'
import { Check, Music2, TriangleAlert, Volume2 } from 'lucide-react'
import { useMusicPlayer } from '@/hooks/useMusicPlayer'
import { useUserMusic } from '@/hooks/useUserMusic'
import { selectionLabel, selectionProblem, type MusicSelection } from '@/utils/video-music'
import { UserMusicTab } from './UserMusicTab'

export function MusicSelector({ selection, volume, onVolume, onChange }: {
  selection: MusicSelection
  volume: number
  onVolume: (v: number) => void
  onChange: (sel: MusicSelection) => void
}) {
  const { state: player, toggle, stop, setVolume } = useMusicPlayer()
  const mine = useUserMusic()
  useEffect(() => { setVolume(volume) }, [volume, setVolume])
  useEffect(() => () => stop(), [stop])
  const selected = selection ? mine.library?.items.find(m => m.id === selection.id) : null
  const problem = selectionProblem(selection, mine.library)

  return (
    <div className="vm-selector">
      <div className="vm-head">
        <h3>背景音乐</h3>
        <span className="vm-current">{selection == null ? '无音乐' : `已选：${selectionLabel(selection, mine.library?.items ?? null)}`}</span>
      </div>
      <p className="vm-tagline">上传自己的音乐，为这趟旅行配上喜欢的声音。</p>
      <button type="button" className={`vm-none${selection == null ? ' is-selected' : ''}`} aria-pressed={selection == null}
        onClick={() => { stop(); onChange(null) }}>
        <Music2 size={18} aria-hidden="true" />
        <span><b>{selection == null ? '已选择无音乐' : '不使用背景音乐'}</b><small>成片只有画面与转场，适合之后自己配乐或配音。</small></span>
        {selection == null && <Check size={16} aria-hidden="true" />}
      </button>
      {problem && <p className="vm-warn" role="alert"><TriangleAlert size={13} /> {problem}</p>}
      <UserMusicTab selection={selection} player={player} toggle={toggle} stop={stop}
        onSelect={id => onChange({ source: 'USER', id })} />
      {selected && (
        <>
          <div className="vs-music-volume">
            <label htmlFor="vm-volume"><Volume2 size={13} /> 音乐音量</label>
            <input id="vm-volume" type="range" min={0} max={100} step={5} value={volume} onChange={e => onVolume(Number(e.target.value))} aria-valuetext={`${volume}%`} />
            <output htmlFor="vm-volume">{volume}%</output>
          </div>
          <p className="vm-note">成片会自动统一响度，片头淡入 1 秒、片尾淡出 1.8 秒；音乐比视频短时自动循环。</p>
          <p className="vs-music-credit">「{selected.title}」是你上传的音乐，只用于你自己的旅行视频；请确保你拥有它的使用授权。</p>
        </>
      )}
    </div>
  )
}
