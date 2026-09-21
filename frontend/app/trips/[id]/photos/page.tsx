import { redirect } from 'next/navigation'
export default async function LegacyPhotosPage({params}:{params:Promise<{id:string}>}){const {id}=await params;redirect(`/trips/${id}/gallery`)}
