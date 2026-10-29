import type { AccountUsageView } from '@/services/tabitrace-api'

export function registeredMediaEstimate(usage: AccountUsageView) {
  const m=usage.media
  return [m.photoBytes,m.musicReservedBytes,m.videoBytes,m.variantEstimateBytes].reduce((sum,n)=>sum+Math.max(0,n),0)
}
export function storageLabel(bytes:number) {
  const n=Math.max(0,bytes)
  if(n<1024)return `${n} B`
  const units=['KiB','MiB','GiB','TiB'];const tier=Math.min(3,Math.floor(Math.log(n)/Math.log(1024))-1)
  return `${(n/(1024**(tier+1))).toFixed(1)} ${units[tier]}`
}
