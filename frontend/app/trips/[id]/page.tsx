import { permanentRedirect } from 'next/navigation'

/** 旧页面链接统一进入地图与打卡。 */
export default async function RetiredTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  permanentRedirect(`/trips/${encodeURIComponent(id)}/map`)
}
