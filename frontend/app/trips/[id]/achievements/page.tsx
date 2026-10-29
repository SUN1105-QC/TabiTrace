import { redirect } from 'next/navigation'

/** Compatibility for saved links after the feature was retired. */
export default async function RetiredPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/trips/${encodeURIComponent(id)}`)
}
