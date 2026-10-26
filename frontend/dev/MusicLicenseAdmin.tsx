'use client'

import { useEffect, useState } from 'react'
import { api } from '@/services/api'

type License = {
  code: string; name: string; artist?: string; source?: string; sourceUrl?: string; license?: string; licenseUrl?: string; licenseNotes?: string
  attributionRequired: boolean; attributionText?: string; commercialUse: boolean; exportAllowed: boolean; status: string; plan: string; enabled: boolean
  licenseCheckedAt?: string; downloadedAt?: string; fileSha256?: string; durationSeconds?: number; bpm?: number; bpmSource?: string
  loudnessLufs?: number; introStart?: number; mainStart?: number; highlightStart?: number; outroStart?: number
}

const clock = (s?: number) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`)

/** 开发环境：逐首查看来源、授权、署名、核验日期与分析数据 */
export function MusicLicenseAdmin() {
  const [rows, setRows] = useState<License[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api<License[]>('/dev/music-licenses').then(setRows).catch(e => setError(e instanceof Error ? e.message : String(e))) }, [])
  return (
    <main style={{ padding: 24, fontSize: 12, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>背景音乐版权后台（仅开发环境）</h1>
      <p style={{ color: '#666', margin: '6px 0 16px' }}>数据源：backend/scripts/music/catalog.json + analysis.json。只有 APPROVED 且启用的曲目会出现在 Travel Story 选择器。</p>
      {error && <p style={{ color: '#b00' }}>加载失败：{error}（需要登录，且后端为 local profile）</p>}
      {!rows && !error && <p>加载中…</p>}
      {rows && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead><tr>{['状态', '曲目', '作者 / 来源', '授权', '署名', '套餐', '时长', 'BPM', '响度', '主体 / 高潮 / 尾声', '核验', '下载', 'sha256'].map(h => <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.code} style={{ borderBottom: '1px solid #eee', verticalAlign: 'top', opacity: r.enabled ? 1 : 0.6 }}>
                <td style={{ padding: 6 }}><b style={{ color: r.status === 'APPROVED' ? '#157a3b' : r.status === 'REJECTED' ? '#b00' : '#a66a00' }}>{r.status}</b></td>
                <td style={{ padding: 6 }}><b>{r.name}</b><br /><span style={{ color: '#888' }}>{r.code}</span></td>
                <td style={{ padding: 6 }}>{r.artist}<br /><a href={r.sourceUrl} target="_blank" rel="noreferrer">{r.source}</a></td>
                <td style={{ padding: 6, maxWidth: 260 }}><a href={r.licenseUrl} target="_blank" rel="noreferrer">{r.license}</a><br /><span style={{ color: '#777' }}>{r.licenseNotes}</span></td>
                <td style={{ padding: 6, maxWidth: 240 }}>{r.attributionRequired ? r.attributionText : '不需要'}</td>
                <td style={{ padding: 6 }}>{r.plan}</td>
                <td style={{ padding: 6 }}>{clock(r.durationSeconds)}</td>
                <td style={{ padding: 6 }}>{r.bpm ?? '—'}{r.bpmSource ? ` (${r.bpmSource})` : ''}</td>
                <td style={{ padding: 6 }}>{r.loudnessLufs ?? '—'}</td>
                <td style={{ padding: 6 }}>{clock(r.mainStart)} / {clock(r.highlightStart)} / {clock(r.outroStart)}</td>
                <td style={{ padding: 6 }}>{r.licenseCheckedAt}</td>
                <td style={{ padding: 6 }}>{r.downloadedAt ?? '—'}</td>
                <td style={{ padding: 6, fontFamily: 'monospace' }}>{r.fileSha256?.slice(0, 12) ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </main>
  )
}
