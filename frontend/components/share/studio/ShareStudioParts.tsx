'use client'

/**
 * 分享工作台的小部件：模板切换（分段控件）、导出操作条、分享链接卡、Trip Pro 权益卡。
 * 手机优先：按钮高度 ≥ 44px、离屏幕边缘留白；桌面沿用同一套组件，只是排列不同。
 */

import Link from 'next/link'
import { Check, Copy, Crown, Download, ExternalLink, Grid3x3, Link2, Loader2, Trash2 } from 'lucide-react'
import type { ShareLinkView, TripView } from '@/services/tabitrace-api'
import type { ShareTier } from '@/utils/plan'

export type ShareMode = 'poster' | 'nine' | 'long'
export const SHARE_MODES: [ShareMode, string][] = [['poster', '城市海报'], ['nine', '九宫格'], ['long', '每日长图']]

export function ShareTemplateTabs({ value, onChange }: { value: ShareMode; onChange: (m: ShareMode) => void }) {
  return (
    <div className="ss-seg" role="tablist" aria-label="分享模板">
      {SHARE_MODES.map(([m, label]) => (
        <button key={m} type="button" role="tab" aria-selected={value === m} className={value === m ? 'is-active' : ''} onClick={() => onChange(m)}>{label}</button>
      ))}
    </div>
  )
}

/** 导出：主按钮「导出整张 PNG」，九宫格额外有次按钮「分别导出 9 张」；导出中显示进度并禁用 */
export function ShareActionBar({ mode, tilesLabel = '分别导出 9 张', busy, progress, onExport, onExportTiles }: {
  mode: ShareMode
  /** 第二个按钮的文字：标准九宫格「分别导出 9 张」，旅行手帐「分别导出照片卡」 */
  tilesLabel?: string
  busy: boolean
  progress: string
  onExport: () => void
  onExportTiles: () => void
}) {
  return (
    <div className={`ss-actions${mode === 'nine' ? ' has-two' : ''}`}>
      <button type="button" className="ss-btn is-primary" onClick={onExport} disabled={busy}>
        {busy && progress.startsWith('整张') ? <Loader2 size={16} className="ss-spin" /> : <Download size={16} />}
        {busy && progress.startsWith('整张') ? '正在导出…' : mode === 'nine' ? '导出整张 PNG' : '导出 PNG'}
      </button>
      {mode === 'nine' && (
        <button type="button" className="ss-btn is-ghost" onClick={onExportTiles} disabled={busy}>
          {busy && !progress.startsWith('整张') ? <Loader2 size={16} className="ss-spin" /> : <Grid3x3 size={16} />}
          {busy && !progress.startsWith('整张') ? progress : tilesLabel}
        </button>
      )}
    </div>
  )
}

/**
 * 分享链接：地址由后端按正式站点地址（APP_PUBLIC_URL）生成，这里原样展示；
 * 生产环境 API 启动校验要求它是 https 正式域名，不会出现 localhost。
 */
export function ShareLinkCard({ links, creating, onCreate, onCopy, onRevoke }: {
  links: ShareLinkView[]
  creating: boolean
  onCreate: () => void
  onCopy: (l: ShareLinkView) => void
  onRevoke: (l: ShareLinkView) => void
}) {
  const active = links.filter(l => l.status === 'ACTIVE')
  const live = active.filter(l => !l.expiresAt || new Date(l.expiresAt).getTime() >= Date.now())
  return (
    <section className="ss-card ss-link" aria-labelledby="ss-link-title">
      <header className="ss-card-head">
        <h2 id="ss-link-title">分享链接</h2>
        <span className="ss-visibility">{live.length ? 'UNLISTED' : 'PRIVATE → UNLISTED'}</span>
      </header>
      <p className="ss-desc">创建后，持有链接的人可访问此分享页；旅行本身仍是私有的。有效期与位置精度可在<Link href="/profile?tab=privacy">隐私与分享</Link>中设置。</p>
      {active.map(l => {
        // 已过期的链接访问不到，只保留删除
        const expired = Boolean(l.expiresAt && new Date(l.expiresAt).getTime() < Date.now())
        return (
          <div key={l.id} className={`ss-link-row${expired ? ' is-expired' : ''}`}>
            <div className="ss-link-url">
              <span title={l.url}>{l.url.replace(/^https?:\/\//, '')}</span>
              <small>{expired ? '已过期，无法访问' : l.expiresAt ? `${l.expiresAt.slice(0, 10).replace(/-/g, '.')} 失效` : '长期有效'} · {l.viewCount} 次访问</small>
            </div>
            <div className="ss-link-actions">
              {!expired && <button type="button" onClick={() => onCopy(l)}><Copy size={15} />复制</button>}
              {!expired && <a href={l.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />打开</a>}
              <button type="button" className="is-danger" onClick={() => onRevoke(l)} aria-label="删除这个分享链接"><Trash2 size={15} />删除</button>
            </div>
          </div>
        )
      })}
      <button type="button" className={`ss-btn ${live.length ? 'is-ghost' : 'is-dark'}`} onClick={onCreate} disabled={creating}>
        {creating ? <Loader2 size={16} className="ss-spin" /> : <Link2 size={16} />}{live.length ? '再创建一个链接' : '创建分享链接'}
      </button>
    </section>
  )
}

/** Trip Pro 权益卡：只写这趟旅行真实拥有 / 可以解锁的能力（分享图本身对所有旅行开放） */
export function TripProCard({ trip, tier }: { trip: TripView; tier: ShareTier }) {
  const pro = trip.planType === 'PRO'
  const perks = ['不限数量的打卡与照片', '分享图高清无水印', 'Travel Story 全部模板', '1080p 高清视频', '视频无水印']
  return (
    <section className={`ss-card ss-pro${pro ? ' is-pro' : ''}`} aria-labelledby="ss-pro-title">
      <header className="ss-card-head">
        <Crown size={16} aria-hidden="true" />
        <h2 id="ss-pro-title">{pro ? 'Trip Pro 已解锁' : '免费旅行'}</h2>
        {!pro && <Link href={`/pricing?trip=${trip.id}`} className="ss-text-btn">了解 Trip Pro →</Link>}
      </header>
      <ul className="ss-perks">
        {perks.map(p => <li key={p} className={pro ? 'is-on' : ''}>{pro && <Check size={12} aria-hidden="true" />}{p}</li>)}
      </ul>
      {!pro && tier.watermark && <p className="ss-desc">分享图（海报 / 九宫格 / 长图）对所有旅行开放；免费旅行导出标准清晰度，并带水印。</p>}
    </section>
  )
}
