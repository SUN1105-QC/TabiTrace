'use client'

import Link from 'next/link'
import { MapPinOff } from 'lucide-react'
import { useT } from '@/components/common/PreferencesProvider'

export default function NotFound() {
  const t = useT()
  return (
    <main className="app-fallback">
      <MapPinOff size={28} aria-hidden="true" />
      <h1>{t('errors.notFoundTitle')}</h1>
      <p>{t('errors.notFoundBody')}</p>
      <div className="app-fallback-actions">
        <Link href="/" className="warm-button">{t('errors.home')}</Link>
      </div>
    </main>
  )
}
