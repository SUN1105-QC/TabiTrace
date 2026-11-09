'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, X } from 'lucide-react'
import type { PlaceView, TimelineDay, TripView } from '@/services/tabitrace-api'
import { CHECKIN_EXPORT_FORMATS, checkinExportRecords, type CheckinExportFormat } from '@/utils/checkin-export'
import { checkinMapPoints } from '@/utils/checkin-map'
import styles from './CheckinExportButton.module.css'

export function CheckinExportButton({ trip, timeline, currentDay, places = [] }: { trip: TripView; timeline: TimelineDay[]; currentDay: string; places?: PlaceView[] }) {
  const [open, setOpen] = useState(false)
  const count = timeline.reduce((total, day) => total + day.items.length, 0)
  return <>
    <button type="button" className="tm-btn" disabled={count === 0} title={count === 0 ? '有打卡记录后即可导出' : undefined} onClick={() => setOpen(true)}>
      <Download size={15} aria-hidden="true" />导出打卡记录
    </button>
    {open && <CheckinExportDialog trip={trip} timeline={timeline} currentDay={currentDay} places={places} onClose={() => setOpen(false)} />}
  </>
}

function CheckinExportDialog({ trip, timeline, currentDay, places, onClose }: { trip: TripView; timeline: TimelineDay[]; currentDay: string; places: PlaceView[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [format, setFormat] = useState<CheckinExportFormat>('pdf')
  const [scope, setScope] = useState(currentDay !== 'ALL' && checkinExportRecords(timeline, currentDay).length ? currentDay : 'ALL')
  const [includePhotos, setIncludePhotos] = useState(true)
  const [includeMap, setIncludeMap] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const records = checkinExportRecords(timeline, scope)
  const mapPoints = checkinMapPoints(records, places)
  const withMap = includeMap && mapPoints.length > 0
  const dates = [...new Set(timeline.filter(d => d.items.length > 0).map(d => d.date))].sort()
  const photoCount = records.reduce((n, r) => n + r.photos.length, 0)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function download() {
    if (busy || !records.length) return
    setBusy(true); setError(''); setResult(''); setProgress('正在准备导出…')
    try {
      const { exportCheckins } = await import('@/utils/export-checkins')
      const output = await exportCheckins({ trip, records, scope, format, includePhotos, includeMap: withMap, places, onProgress: setProgress })
      if (output.how === 'cancelled') setResult('已取消分享，可再次导出。')
      else setResult(`${output.how === 'shared' ? '已准备好分享' : '已导出'} ${records.length} 条打卡记录${format === 'csv' ? '' : `，共 ${output.pages} 页`}${output.missingPhotos ? `。${output.missingPhotos} 张照片加载失败，已保留文字记录；可重试或取消包含照片` : '。'}${output.schematicMap ? '底图暂不可用，已附上带编号的位置示意图。' : ''}`)
    } catch (e) { setError(e instanceof Error ? e.message : '导出失败，请重试') }
    finally { setBusy(false); setProgress('') }
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) onClose() }}
      onClick={e => { if (e.target === e.currentTarget && !busy) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>TRAVEL RECORDS</span><h2 id={titleId}>导出打卡记录</h2><p>{trip.title}</p></div>
        <button type="button" className="icon-button" aria-label="关闭导出窗口" disabled={busy} onClick={onClose}><X size={20} /></button>
      </header>
      <div className={styles.body} aria-busy={busy}>
        <fieldset disabled={busy} className={styles.fieldset}>
          <legend>选择导出格式</legend>
          <div className={styles.formats}>
            {CHECKIN_EXPORT_FORMATS.map(option => {
              const Icon = option.value === 'pdf' ? FileText : option.value === 'csv' ? FileSpreadsheet : ImageIcon
              return <label key={option.value} className={`${styles.format} ${format === option.value ? styles.selected : ''}`}>
                <input type="radio" name={`${titleId}-format`} value={option.value} checked={format === option.value} onChange={() => { setFormat(option.value); setResult(''); setError('') }} />
                <Icon size={22} aria-hidden="true" /><b>{option.label}</b><small>{option.description}</small>
              </label>
            })}
          </div>
          <label className={styles.scope}><span>导出范围</span><select value={scope} onChange={e => { setScope(e.target.value); setResult(''); setError('') }} aria-label="导出范围">
            <option value="ALL">整趟旅行</option>
            {dates.map(date => <option key={date} value={date}>{date}（{checkinExportRecords(timeline, date).length} 次打卡）</option>)}
          </select></label>
          {format !== 'csv' && <>
            <label className={styles.photos}><input type="checkbox" aria-label="包含旅行地图" checked={withMap} disabled={!mapPoints.length} onChange={e => { setIncludeMap(e.target.checked); setResult('') }} /><span>包含旅行地图<small>{mapPoints.length ? `在首页附上地图，标记 ${mapPoints.length} 次打卡位置及顺序${records.length > mapPoints.length ? `；${records.length - mapPoints.length} 次打卡没有坐标` : ''}` : '当前范围暂无可定位的打卡，暂不生成地图'}</small></span></label>
            <label className={styles.photos}><input type="checkbox" aria-label="包含打卡照片" checked={includePhotos} onChange={e => { setIncludePhotos(e.target.checked); setResult('') }} /><span>包含打卡照片<small>按记录顺序排版，照片较多时会自动分页</small></span></label>
          </>}
        </fieldset>
        <div className={styles.summary}>
          <strong>{records.length} 条打卡记录<span> · {new Set(records.map(r => r.date)).size} 天{format !== 'csv' && includePhotos ? ` · ${photoCount} 张照片` : ''}</span></strong>
          <p>包含打卡地点、日期时间、区域、笔记和天气。{format === 'csv' ? 'CSV 保留照片数量，不包含地图或图片文件。' : withMap ? '旅行地图与打卡记录一起导出。' : '仅导出已完成的打卡记录。'}</p>
          {(format === 'png' || format === 'jpeg') && <p>多页内容将分别导出为按顺序编号的图片。</p>}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {result && <p className={styles.result} role="status">{result}</p>}
      </div>
      <footer className={styles.footer}>
        <span role="status" aria-live="polite">{progress || '保存这段旅途的每一次到达'}</span>
        <button type="button" className="tm-btn is-primary" disabled={busy || !records.length} onClick={() => void download()}>{busy ? <Loader2 size={16} className={styles.spin} /> : <Download size={16} />}{busy ? '正在导出…' : '开始导出'}</button>
      </footer>
    </dialog>
  )
}
