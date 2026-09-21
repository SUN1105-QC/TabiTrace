'use client'

import { useRouter } from 'next/navigation'
import { FormEvent,useMemo,useState } from 'react'
import { CalendarDays, Globe2, Sparkles, Users } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { tripApi } from '@/services/tabitrace-api'

function isoDate(d:Date){return d.toISOString().slice(0,10)}
function initialDates(){const start=new Date();const end=new Date(start);end.setDate(end.getDate()+5);return [isoDate(start),isoDate(end)] as const}

export default function NewTripPage(){
  const router=useRouter()
  const defaults=useMemo(()=>initialDates(),[])
  const[title,setTitle]=useState('我的东京旅行')
  const[destination,setDestination]=useState('东京')
  const[official,setOfficial]=useState(true)
  const[startDate,setStartDate]=useState(defaults[0])
  const[endDate,setEndDate]=useState(defaults[1])
  const[people,setPeople]=useState(2)
  const[busy,setBusy]=useState(false)
  const[error,setError]=useState('')
  const isTokyo=destination.trim()==='东京'||destination.toLowerCase().trim()==='tokyo'

  const submit=async(e:FormEvent)=>{
    e.preventDefault();setError('')
    const cleanTitle=title.trim(),cleanDestination=destination.trim()
    if(!cleanTitle||!cleanDestination){setError('请填写旅行名称和目的地');return}
    if(!startDate||!endDate||endDate<startDate){setError('结束日期不能早于开始日期');return}
    if(people<1||people>100){setError('同行人数请输入 1～100');return}
    setBusy(true)
    try{
      const trip=await tripApi.create({title:cleanTitle,destinationName:cleanDestination,countryCode:isTokyo?'JP':undefined,city:cleanDestination,startDate,endDate,peopleCount:people,coverImage:isTokyo?'/images/cover.jpg':undefined,joinOfficialExplore:isTokyo&&official})
      localStorage.setItem('tabitrace-live-trip-id',String(trip.id))
      router.push(`/trips/${trip.id}`)
    }catch(e:any){setError(e?.message||'创建旅行失败')}finally{setBusy(false)}
  }

  return <main><SiteHeader/><section className="mx-auto max-w-5xl px-5 pb-14 sm:px-8"><div className="grid gap-6 lg:grid-cols-[.86fr_1.14fr]"><aside className="relative min-h-[560px] overflow-hidden rounded-[30px] shadow-card"><img src="/images/cover.jpg" alt="东京旅行" className="absolute inset-0 h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"/><div className="absolute inset-x-0 bottom-0 p-7 text-white"><p className="text-xs font-bold tracking-[.18em] text-white/60">A NEW JOURNEY</p><h1 className="mt-3 font-serif text-4xl">从一个目的地开始，慢慢长成一段旅迹。</h1><p className="mt-3 text-sm leading-7 text-white/70">先创建旅行，之后再添加官方地点、自定义地点、行程、打卡、照片和记录。</p></div></aside><form onSubmit={submit} className="warm-card p-7 sm:p-9"><p className="text-xs font-bold tracking-[.18em] text-warm">CREATE A JOURNEY</p><h2 className="mt-2 font-serif text-4xl">创建旅行</h2><div className="mt-7 space-y-5"><label className="block"><span className="text-sm font-medium">旅行名称</span><input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} className="mt-2 w-full rounded-xl border border-black/10 bg-paper px-4 py-3.5 outline-none focus:border-warm"/></label><label className="block"><span className="text-sm font-medium">目的地</span><div className="relative mt-2"><Globe2 size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30"/><input required maxLength={200} value={destination} onChange={e=>setDestination(e.target.value)} className="w-full rounded-xl border border-black/10 bg-paper py-3.5 pl-11 pr-4 outline-none focus:border-warm"/></div></label>{isTokyo&&<div className="rounded-2xl bg-[#F5E8D8] p-4 text-sm"><div className="flex gap-3"><Sparkles size={18} className="shrink-0 text-warm"/><div className="flex-1"><b>东京拥有官方探索内容</b><p className="mt-1 text-black/50">可自动加入首套官方城市探索内容。</p></div></div><label className="mt-4 flex items-center gap-3"><input type="checkbox" checked={official} onChange={e=>setOfficial(e.target.checked)} className="h-4 w-4 accent-[#C56A3A]"/><span className="text-xs">加入东京官方探索</span></label></div>}<div className="grid gap-4 sm:grid-cols-2"><label><span className="inline-flex items-center gap-2 text-sm font-medium"><CalendarDays size={15}/>开始日期</span><input type="date" required value={startDate} onChange={e=>{setStartDate(e.target.value);if(endDate<e.target.value)setEndDate(e.target.value)}} className="mt-2 w-full rounded-xl border border-black/10 bg-paper px-4 py-3.5"/></label><label><span className="inline-flex items-center gap-2 text-sm font-medium"><CalendarDays size={15}/>结束日期</span><input type="date" required min={startDate} value={endDate} onChange={e=>setEndDate(e.target.value)} className="mt-2 w-full rounded-xl border border-black/10 bg-paper px-4 py-3.5"/></label></div><label className="block"><span className="inline-flex items-center gap-2 text-sm font-medium"><Users size={15}/>同行人数</span><input type="number" min="1" max="100" required value={people} onChange={e=>setPeople(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-black/10 bg-paper px-4 py-3.5"/></label></div>{error&&<div className="mt-4 rounded-xl bg-warm/10 px-4 py-3 text-xs text-warm">{error}</div>}<button disabled={busy} className="mt-7 w-full rounded-xl bg-ink px-4 py-4 text-sm font-bold text-white disabled:opacity-60">{busy?'正在创建…':'创建旅行'}</button></form></div></section></main>
}
