'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useT } from '@/components/common/PreferencesProvider'

/** 页面渲染出错时的兜底界面：不白屏，可以重试或回首页 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT()
  useEffect(() => { console.error('[page-error]', error.digest ?? '', error.message) }, [error])
  return (
    <main className="app-fallback" role="alert">
      <TriangleAlert size={28} aria-hidden="true" />
      <h1>{t('errors.title')}</h1>
      <p>{t('errors.body')}</p>
      <div className="app-fallback-actions">
        <button type="button" className="warm-button" onClick={() => retry()}>{t('errors.retry')}</button>
        <Link href="/" className="app-fallback-link">{t('errors.home')}</Link>
      </div>
    </main>
  )
}
