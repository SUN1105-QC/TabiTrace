'use client'

/**
 * 头像：选择图片 → 浏览器端居中裁成正方形，生成 512px 原图和 160px 小图（导航栏用）→ 预签名上传 → 保存到账户。
 * 重新编码也会去掉原图里的 EXIF（包括拍摄位置）。上传后立即生效，不进入“未保存修改”。
 */

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { uploadAvatar, userApi, type UserView } from '@/services/tabitrace-api'
import { useT } from '@/components/common/PreferencesProvider'
import { tr } from '@/i18n'
import { AVATAR_SIZE, AVATAR_SMALL_SIZE } from '@/utils/avatar'
import { Avatar } from './SettingsParts'

const ACCEPT = 'image/jpeg,image/png,image/webp'
const MAX_INPUT = 15 * 1024 * 1024
async function squareAvatar(file: File): Promise<{ full: Blob; small: Blob }> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const encode = async (size: number, quality: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(size, side)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(tr('settings.avatar.unsupported'))
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality))
    if (!blob) throw new Error(tr('settings.avatar.processFailed'))
    return blob
  }
  try { return { full: await encode(AVATAR_SIZE, 0.9), small: await encode(AVATAR_SMALL_SIZE, 0.86) } }
  finally { bitmap.close() }
}

export function AvatarUploader({ user, onChange, onToast }: { user: UserView; onChange: (u: UserView) => void; onToast: (msg: string) => void }) {
  const t = useT()
  const input = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const [error, setError] = useState('')
  const name = user.nickname?.trim() || t('common.meFallback')

  const pick = async (file?: File) => {
    if (!file) return
    setError('')
    if (!ACCEPT.split(',').includes(file.type)) { setError(t('settings.avatar.badType')); return }
    if (file.size > MAX_INPUT) { setError(t('settings.avatar.tooLarge')); return }
    setBusy('upload')
    try {
      const { full, small } = await squareAvatar(file)
      const updated = await uploadAvatar(full, small)
      onChange(updated)
      onToast(t('settings.avatar.updated'))
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('settings.avatar.uploadFailed'))
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    setError('')
    setBusy('remove')
    try { onChange(await userApi.removeAvatar()); onToast(t('settings.avatar.removed')) }
    catch (e) { setError(e instanceof Error && e.message ? e.message : t('settings.avatar.removeFailed')) }
    finally { setBusy(null) }
  }

  return (
    <div className="st-avatar-uploader">
      <Avatar name={name} user={user} size={64} />
      <div className="st-avatar-actions">
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={e => void pick(e.target.files?.[0])} aria-hidden="true" tabIndex={-1} />
        <button type="button" className="st-btn" onClick={() => input.current?.click()} disabled={busy !== null} aria-describedby="avatar-hint">
          {busy === 'upload' ? <Loader2 size={14} className="st-spin" /> : <ImagePlus size={14} />}
          {busy === 'upload' ? t('settings.avatar.uploading') : user.avatarUrl ? t('settings.avatar.change') : t('settings.avatar.upload')}
        </button>
        {user.avatarUrl && (
          <button type="button" className="st-btn is-quiet" onClick={() => void remove()} disabled={busy !== null}>
            <Trash2 size={14} /> {busy === 'remove' ? t('common.removing') : t('common.remove')}
          </button>
        )}
        <p id="avatar-hint" className="st-hint">{t('settings.avatar.hint')}</p>
        {error && <p className="st-field-error" role="alert">⚠ {error}</p>}
      </div>
    </div>
  )
}
