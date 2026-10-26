import { notFound } from 'next/navigation'
import { isDevelopment } from '@/lib/env'
import { MusicLicenseAdmin } from '@/dev/MusicLicenseAdmin'

/** 开发环境的背景音乐版权后台；生产环境不存在（404），对应的 API 也只在 local profile 注册 */
export default function DevMusicPage() {
  if (!isDevelopment) notFound()
  return <MusicLicenseAdmin />
}
