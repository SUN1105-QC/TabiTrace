'use client'

/**
 * 头像：选择图片 → 浏览器端居中裁成正方形并压到 512px → 预签名上传 → 保存到账户。
 * 重新编码也会去掉原图里的 EXIF（包括拍摄位置）。上传后立即生效，不进入“未保存修改”。
 */

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { uploadAvatar, userApi, type UserView } from '@/services/tabitrace-api'
import { Avatar } from './SettingsParts'

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_INPUT = 15 * 1024 * 1024
const SIZE = 512

async function squareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(SIZE, side)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持图片处理')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9))
  if (!blob) throw new Error('图片处理失败')
  return blob
}

export function AvatarUploader({ user, onChange, onToast }: { user: UserView; onChange: (u: UserView) => void; onToast: (msg: string) => void }) {
  const input = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const [error, setError] = useState('')
  const name = user.nickname?.trim() || '旅行中的我'

  const pick = async (file?: File) => {
    if (!file) return
    setError('')
    if (!ACCEPT.split(',').includes(file.type)) { setError('请选择 JPG、PNG 或 WebP 图片'); return }
    if (file.size > MAX_INPUT) { setError('图片太大，请选择 15MB 以内的图片'); return }
    setBusy('upload')
    try {
      const updated = await uploadAvatar(await squareAvatar(file))
      onChange(updated)
      onToast('头像已更新')
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : '头像上传失败，请重试')
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    setError('')
    setBusy('remove')
    try { onChange(await userApi.removeAvatar()); onToast('已移除头像') }
    catch (e) { setError(e instanceof Error && e.message ? e.message : '移除失败，请重试') }
    finally { setBusy(null) }
  }

  return (
    <div className="st-avatar-uploader">
      <Avatar name={name} url={user.avatarUrl} size={64} />
      <div className="st-avatar-actions">
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={e => void pick(e.target.files?.[0])} aria-hidden="true" tabIndex={-1} />
        <button type="button" className="st-btn" onClick={() => input.current?.click()} disabled={busy !== null} aria-describedby="avatar-hint">
          {busy === 'upload' ? <Loader2 size={14} className="st-spin" /> : <ImagePlus size={14} />}
          {busy === 'upload' ? '上传中…' : user.avatarUrl ? '更换头像' : '上传头像'}
        </button>
        {user.avatarUrl && (
          <button type="button" className="st-btn is-quiet" onClick={() => void remove()} disabled={busy !== null}>
            <Trash2 size={14} /> {busy === 'remove' ? '移除中…' : '移除'}
          </button>
        )}
        <p id="avatar-hint" className="st-hint">JPG、PNG 或 WebP，会自动裁成正方形。</p>
        {error && <p className="st-field-error" role="alert">⚠ {error}</p>}
      </div>
    </div>
  )
}
