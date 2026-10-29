import { describe,expect,it } from 'vitest'
import { registeredMediaEstimate,storageLabel } from '@/utils/usage'
import type { AccountUsageView } from '@/services/tabitrace-api'
describe('usage presentation',()=>{
  it('adds measured and estimated components without pretending unknown videos are measured',()=>{
    const usage={media:{photoBytes:100,musicReservedBytes:20,videoBytes:300,variantEstimateBytes:40,unknownPhotos:1,unknownVideos:2}} as AccountUsageView
    expect(registeredMediaEstimate(usage)).toBe(460);expect(usage.media.unknownVideos).toBe(2)
  })
  it('labels binary storage units and clamps invalid negative sizes',()=>{
    expect(storageLabel(0)).toBe('0 B');expect(storageLabel(-1)).toBe('0 B');expect(storageLabel(1024)).toBe('1.0 KiB');expect(storageLabel(1024**3)).toBe('1.0 GiB')
  })
})
