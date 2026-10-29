/** Trip Pro 页面内容：全部由方案配置推导，不写死价格与规格，也不承诺已经下线的功能 */
import { describe, expect, it } from 'vitest'
import { isOneTimePerTrip, planBenefits, planComparison, planFaq, planPrice, videoUsageTerms, type TripProPlan } from '@/utils/plan'

const plan: TripProPlan = {
  price: { amount: 400, currency: 'CNY' }, billing: 'ONE_TIME_PER_TRIP', renews: false, expires: false,
  realPayments: false, paymentsAvailable: true,
  lifetime: { price: { amount: 100000, currency: 'CNY' }, billing: 'ONE_TIME_LIFETIME', paymentsAvailable: true },
  freeLimits: { activeFreeTrips: 1, checkinsPerTrip: 10, photosPerTrip: 10 },
  storyFree: { maxPhotos: 10, durations: [15, 30], quality: '720p', watermark: true },
  storyPro: { maxPhotos: 30, durations: [15, 30, 60], quality: '1080p', watermark: false },
  shareFree: { quality: 'STANDARD', posterWidth: 1080, scale: 1, tileSize: 720, watermark: true },
  sharePro: { quality: 'HD', posterWidth: 1440, scale: 2, tileSize: 1080, watermark: false },
  storyTemplates: [{ name: '旅行日记', plan: 'FREE' }, { name: '极简杂志', plan: 'PRO' }, { name: '城市节奏', plan: 'PRO' }],
  storyMusic: [{ name: 'A', plan: 'FREE' }, { name: 'B', plan: 'PRO' }]
}

describe('Trip Pro 方案内容', () => {
  it('购买前展示服务端启用的视频额度，监控模式和旧接口不展示硬限额',()=>{
    expect(videoUsageTerms(plan)).toBeNull()
    const updated={...plan,videoUsageLimits:{enforced:true,dailyRenders:20,dailyOutputSeconds:6000}}
    expect(videoUsageTerms(updated)).toContain('20 次')
    expect(videoUsageTerms(updated)).toContain('6000 秒')
    expect(videoUsageTerms({...updated,videoUsageLimits:{...updated.videoUsageLimits,enforced:false}})).toBeNull()
  })
  it('价格与一次性承诺来自方案配置', () => {
    expect(planPrice(plan)).toBe('¥4')
    expect(isOneTimePerTrip(plan)).toBe(true)
    expect(isOneTimePerTrip({ ...plan, renews: true })).toBe(false)
  })
  it('对比表只保留 10 项核心差异，不再出现已下线的路线动画', () => {
    const rows = planComparison(plan)
    expect(rows).toHaveLength(10)
    expect(rows.some(r => /路线/.test(r.label))).toBe(false)
    expect(rows.find(r => r.label === '分享图清晰度')).toMatchObject({ free: '标准清晰度 · 海报宽 1080px', pro: '高清 · 海报宽 1440px' })
    expect(rows.find(r => r.label === '分享图水印')).toMatchObject({ free: '带「旅迹」水印', pro: '无水印' })
    expect(rows.find(r => r.label === '视频模板')).toMatchObject({ free: '旅行日记', pro: '全部 3 款' })
  })
  it('没有买断方案时，不提上传自己的音乐', () => {
    const noLifetime = { ...plan, lifetime: undefined }
    expect(planComparison(noLifetime).find(r => r.label === '背景音乐')?.pro).toBe('全部 2 首')
    expect(planFaq(noLifetime).some(f => /上传/.test(f.q))).toBe(false)
  })
  it('4 项权益的具体数字来自方案配置', () => {
    const b = planBenefits(plan)
    expect(b.map(x => x.key)).toEqual(['record', 'share', 'story', 'style'])
    expect(b.find(x => x.key === 'share')?.fact).toBe('海报宽 1440px · 无水印')
    expect(b.find(x => x.key === 'story')?.fact).toBe('1080P 无水印 · 最长 60 秒 · 30 张照片')
  })
  it('FAQ 不超过 6 个，答案里的价格来自配置', () => {
    const faq = planFaq(plan)
    expect(faq.length).toBeLessThanOrEqual(6)
    expect(faq[0].a).toContain('¥4')
    expect(faq.find(f => /区别/.test(f.q))?.a).toContain('¥1,000')
  })
})
