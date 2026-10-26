'use client'

/**
 * 上传你的音乐：选择文件 → 名称 → 版权确认 → 上传（进度）→ 正在处理音乐… → 完成 / 失败（重新上传）。
 * 在音乐区内展开（桌面右侧面板与手机底部面板里都能用），不叠第二层弹窗。
 * 前端先检查扩展名 / MIME / 大小，后端会再检查一次并按文件内容识别格式。
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, FileAudio, Loader2, RotateCcw, TriangleAlert, Upload, X } from 'lucide-react'
import { ApiError } from '@/services/api'
import { checkMusicFile, mb, uploadErrorMessage, uploadUserMusic, type UploadStage } from '@/services/user-music'
import type { UserMusic, UserMusicLimits } from '@/types/user-music'
import { MEMBERSHIP_URL } from '@/utils/membership'
import { MusicCopyrightNotice } from './MusicCopyrightNotice'

const stem = (name: string) => name.replace(/\.[^.]+$/, '').slice(0, 60)

export function UploadMusicDialog({ limits, onClose, onDone }: {
  limits: UserMusicLimits
  onClose: () => void
  /** 上传结束（READY 或 FAILED），列表需要以后端为准刷新 */
  onDone: (music: UserMusic) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [title, setTitle] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [stage, setStage] = useState<UploadStage | null>(null)
  const [pct, setPct] = useState(0)
  const [error, setError] = useState('')
  const [membershipError, setMembershipError] = useState(false)
  const [result, setResult] = useState<UserMusic | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  const busy = stage !== null
  const accept = [...limits.extensions.map(e => `.${e}`), ...limits.mimeTypes].join(',')

  function choose(f: File | null) {
    setResult(null); setError(''); setMembershipError(false)
    setFile(f)
    if (!f) { setFileError(''); return }
    setFileError(checkMusicFile(f, limits) ?? '')
    setTitle(stem(f.name))
  }

  async function submit() {
    if (!file || fileError || !agreed || busy) return
    setError(''); setMembershipError(false); setResult(null); setPct(0)
    abort.current = new AbortController()
    try {
      const m = await uploadUserMusic(file, { title, copyrightConfirmed: agreed, onStage: setStage, onProgress: setPct, signal: abort.current.signal })
      setResult(m)
      onDone(m)
    } catch (e) {
      setMembershipError(e instanceof ApiError && e.code === 'CUSTOM_MUSIC_REQUIRES_MEMBERSHIP')
      setError(uploadErrorMessage(e))
    } finally {
      setStage(null)
      abort.current = null
    }
  }

  function again() {
    setResult(null); setError(''); setFile(null); setTitle(''); setPct(0)
    if (input.current) input.current.value = ''
    input.current?.click()
  }

  const failed = result?.status === 'FAILED'
  const ready = result?.status === 'READY'

  return (
    <section className="um-upload" aria-labelledby="um-upload-title">
      <header>
        <h4 id="um-upload-title">上传你的音乐</h4>
        <button type="button" className="um-close" onClick={() => { abort.current?.abort(); onClose() }} aria-label="关闭上传"><X size={18} /></button>
      </header>
      <p className="um-upload-hint">支持 {limits.formats.join(' · ')}，推荐文件大小 ≤ {mb(limits.maxFileBytes)}</p>

      {ready ? (
        <div className="um-result is-ok" role="status">
          <CheckCircle2 size={18} />
          <p><b>「{result.title}」已加入我的音乐</b><small>可以试听，也可以点「使用」加入这个 Travel Story。</small></p>
          <button type="button" className="vs-btn" onClick={again}>再上传一首</button>
          <button type="button" className="vs-btn is-primary" onClick={onClose}>完成</button>
        </div>
      ) : (
        <>
          <input ref={input} id="um-file" type="file" accept={accept} className="um-file-input" disabled={busy}
            onChange={e => choose(e.target.files?.[0] ?? null)} />
          <label htmlFor="um-file" className={`um-file${file ? ' has-file' : ''}${busy ? ' is-disabled' : ''}`}>
            <FileAudio size={18} aria-hidden="true" />
            {file ? <span><b>{file.name}</b><small>{mb(file.size)}</small></span> : <span><b>选择音乐文件</b><small>{limits.formats.join(' / ')}</small></span>}
          </label>
          {fileError && <p className="um-error" role="alert"><TriangleAlert size={13} /> {fileError}</p>}

          <label className="um-field">
            <span>名称</span>
            <input type="text" value={title} maxLength={60} onChange={e => setTitle(e.target.value)} placeholder="例如：Tokyo Memories" disabled={busy} />
          </label>

          <MusicCopyrightNotice />
          <label className="um-agree">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={busy} />
            <span>我确认拥有该音乐用于视频创作的合法使用权</span>
          </label>

          {busy && (
            <div className="um-progress" role="status" aria-live="polite">
              <span>{stage === 'preparing' ? '正在准备上传…' : stage === 'uploading' ? `正在上传… ${pct}%` : '正在处理音乐…'}</span>
              <i aria-hidden="true"><b style={{ width: `${stage === 'processing' ? 100 : stage === 'uploading' ? pct : 4}%` }} /></i>
            </div>
          )}
          {failed && (
            <div className="um-result is-failed" role="alert">
              <TriangleAlert size={18} />
              <p><b>音乐处理失败</b><small>{result.failureMessage ?? '请换一个文件重新上传'}</small></p>
              <button type="button" className="vs-btn" onClick={again}><RotateCcw size={13} /> 重新上传</button>
            </div>
          )}
          {error && (
            <div className="um-result is-failed" role="alert">
              <TriangleAlert size={18} />
              <p><b>{membershipError ? '上传自己的音乐是会员专属功能。' : '上传没有完成'}</b><small>{error}</small></p>
              {membershipError
                ? <Link href={MEMBERSHIP_URL} className="vs-btn is-primary">开通会员</Link>
                : <button type="button" className="vs-btn" onClick={() => void submit()}><RotateCcw size={13} /> 重试</button>}
            </div>
          )}

          <button type="button" className="vs-btn is-primary um-submit" onClick={() => void submit()} disabled={!file || !!fileError || !agreed || busy}>
            {busy ? <Loader2 size={15} className="vm-spin" /> : <Upload size={15} />} {busy ? '上传中…' : '上传'}
          </button>
          {!agreed && file && !fileError && <p className="um-need">请先勾选版权确认</p>}
        </>
      )}
    </section>
  )
}
