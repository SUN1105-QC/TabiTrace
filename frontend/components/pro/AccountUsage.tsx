'use client'

import { useCallback, useEffect, useState } from 'react'
import { usageApi, type AccountUsageView } from '@/services/tabitrace-api'
import { registeredMediaEstimate, storageLabel } from '@/utils/usage'

export function AccountUsage(){
  const [usage,setUsage]=useState<AccountUsageView|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const load=useCallback(async(signal?:AbortSignal)=>{
    try { const result=await usageApi.current(signal); if(!signal?.aborted){setUsage(result);setError('')} }
    catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'用量读取失败')}
    finally{if(!signal?.aborted)setLoading(false)}
  },[])
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort()},[load])
  return <section className="pr-section" aria-labelledby="pr-usage-title">
    <header className="pr-section-head"><h2 id="pr-usage-title">账号用量</h2><p>用量统计不会额外扣费。视频次数包含失败后重新提交的生成请求。</p></header>
    <button type="button" className="pr-btn" disabled={loading} onClick={()=>{setLoading(true);setError('');void load()}}>{loading?'正在读取…':'刷新用量'}</button>
    {error&&<p role="alert">{error}</p>}
    {usage&&<div className="pr-usage-summary">
      <article><h3>视频生成</h3><p>{usage.day} · UTC 统计日</p><b>{usage.renderRequests} 次生成请求 · {usage.outputSeconds} 秒成片时长</b><p>{usage.activeRenders} 个任务排队或生成中</p>
        {usage.limits.enforced&&usage.limits.dailyRenders>0&&<p>每日生成次数上限：{usage.limits.dailyRenders}</p>}
        {usage.limits.enforced&&usage.limits.dailyOutputSeconds>0&&<p>每日累计成片时长上限：{usage.limits.dailyOutputSeconds} 秒</p>}
      </article>
      <article><h3>已登记媒体空间估算</h3><b>{storageLabel(registeredMediaEstimate(usage))}</b><p>包含照片原图、缩略图预估、音乐预留空间和已计量视频。</p>
        <p>不含未登记文件及未计量旧文件，不作为计费依据。</p>
        {(usage.media.unknownPhotos>0||usage.media.unknownVideos>0)&&<p>另有 {usage.media.unknownPhotos} 张照片、{usage.media.unknownVideos} 个旧视频尚未计量。</p>}
      </article>
    </div>}
  </section>
}
