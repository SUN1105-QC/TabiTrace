'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { hasSession } from '@/services/api'

export function useRequireSession(enabled = true) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(!enabled)

  useEffect(() => {
    if (!enabled) { setReady(true); return }
    if (hasSession()) { setReady(true); return }
    const next = pathname || '/trips'
    router.replace(`/login?next=${encodeURIComponent(next)}`)
  }, [enabled, pathname, router])

  return ready
}
