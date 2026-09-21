'use client'

import Link from 'next/link'
import { useEffect,useMemo,useState } from 'react'
import { ArrowRight, CalendarDays, Camera, CheckCircle2, Clock3, MapPinned, Plus, Sparkles, Trophy } from 'lucide-react'
import { SiteHeader } from '@/components/common/SiteHeader'
import { tripApi, type ItineraryView, type TripSummary, type TripView } from '@/services/tabitrace-api'
import { MobileTripsView } from '@/components/mobile/MobileTripsView'

function daysInMonth(year:number,month:number){return new Date(year,month+1,0).getDate()}
function sameDay(a:string,b:string){return a===b}

export default function TripsPage(){
  const[trips,setTrips]=useState<TripView[]>([])
  const[summaries,setSummaries]=useState<Record<number,TripSummary>>({})
  const[itinerary,setItinerary]=useState<ItineraryView[]>([])
  const[error,setError]=useState('')
  const[loading,setLoading]=useState(true)

  useEffect(()=>{tripApi.list().then(async rows=>{setTrips(rows);const preferred=rows.find(t=>t.status!=='ARCHIVED')||rows[0];if(preferred){localStorage.setItem('tabitrace-live-trip-id',String(preferred.id));tripApi.itinerary(preferred.id).then(setItinerary).catch(()=>setItinerary([]))}const pairs=await Promise.all(rows.map(async t=>{try{return [t.id,await tripApi.summary(t.id)] as const}catch{return [t.id,null] as const}}));setSummaries(Object.fromEntries(pairs.filter(([,s])=>s)) as Record<number,TripSummary>)}).catch((e:any)=>setError(e?.message||'加载旅行失败，请先登录并确认后端已启动')).finally(()=>setLoading(false))},[])

  const total=useMemo(()=>Object.values(summaries).reduce((a,s)=>({places:a.places+s.places,photos:a.photos+s.photos,achievements:a.achievements+s.achievements}),{places:0,photos:0,achievements:0}),[summaries])
  const current=trips.find(t=>t.status!=='ARCHIVED')||trips[0]
  const currentSummary=current?summaries[current.id]:undefined
  const greeting=(()=>{const h=new Date().getHours();return h<12?'上午好':h<18?'下午好':'晚上好'})()
  const calendar=useMemo(()=>{
    const base=current?.startDate?new Date(`${current.startDate}T00:00:00`):new Date()
    const year=base.getFullYear(),month=base.getMonth(),first=new Date(year,month,1).getDay(),count=daysInMonth(year,month)
    const cells=[...Array(first).fill(null),...Array.from({length:count},(_,i)=>i+1)]
    return {year,month,cells}
  },[current?.startDate])
  const inTrip=(day:number)=>{
    if(!current)return false
    const d=`${calendar.year}-${String(calendar.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return d>=current.startDate&&d<=current.endDate
  }
  const today=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})()

  return <main><SiteHeader/><section className="mx-auto max-w-[1320px] px-5 pb-14 sm:px-8 lg:px-10">
    {loading&&<div className="only-mobile warm-card m-trips-state">正在读取你的旅行…</div>}
    {error&&<div className="only-mobile warm-card m-trips-state">{error} · <Link className="underline" href="/login">去登录</Link></div>}
    {!loading&&!error&&<MobileTripsView trips={trips} summaries={summaries} current={current??null} itinerary={itinerary}/>}
    <div className="only-desktop dashboard-grid">
      <div className="min-w-0 space-y-5">
        <div className="dashboard-hero"><img src="/images/hero-scenery.jpg" alt="旅行风景"/><div className="dashboard-hero-content"><p className="text-xs font-bold tracking-[.16em] text-warm">MY JOURNEY WORKSPACE</p><h1 className="mt-3">{greeting}，旅行中的你 ☀</h1><p>忙碌的日子里，也别忘了记录旅途的温度。地点、时间、照片和一句话，都会成为以后值得回看的记忆。</p></div></div>
        <div className="quick-composer"><div className="quick-composer-input"><Sparkles size={17}/><input readOnly value={current?`继续记录「${current.title}」`:'从第一段旅行开始记录'} /></div><Link href={current?`/trips/${current.id}/map`:'/trips/new'} className="warm-button">{current?'继续记录':'创建旅行'} <ArrowRight size={15}/></Link></div>
        {error&&<div className="rounded-2xl border border-warm/15 bg-warm/5 p-4 text-sm text-warm">{error} · <Link className="underline" href="/login">去登录</Link></div>}
        {loading&&<div className="warm-card p-8 text-sm text-black/40">正在读取你的旅行…</div>}
        {!loading&&!error&&<>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<MapPinned size={20}/>} title="旅行地点" value={String(total.places)} note={currentSummary?`当前旅行 ${currentSummary.places} 个地点`:'等待第一段旅行'} tone="blue"/><Metric icon={<Camera size={20}/>} title="旅行照片" value={String(total.photos)} note="把照片放回真实发生的地点" tone="green"/><Metric icon={<Trophy size={20}/>} title="旅行成就" value={String(total.achievements)} note="随着打卡自动解锁" tone="gold"/><Metric icon={<CalendarDays size={20}/>} title="旅行数量" value={String(trips.length)} note="每段旅行独立保存与升级" tone="purple"/></div>
          <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><section className="warm-card p-5 sm:p-6"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.14em] text-warm">RECENT JOURNEYS</p><h2 className="mt-1 font-serif text-3xl">最近旅行</h2></div><Link href="/trips/new" className="inline-flex items-center gap-1 text-xs font-bold text-warm"><Plus size={14}/> 新旅行</Link></div><div className="mt-5 space-y-3">{trips.length===0?<Empty/>:trips.slice(0,4).map(t=><TripRow key={t.id} trip={t} summary={summaries[t.id]}/>)}</div></section><section className="warm-card p-5 sm:p-6"><div className="flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.14em] text-warm">CONTINUE</p><h2 className="mt-1 font-serif text-3xl">继续进行</h2></div></div>{current?<div className="mt-5 overflow-hidden rounded-[22px] border border-black/[0.06] bg-[#F9F3EA]"><img src={current.coverImage||'/images/cover.jpg'} alt={current.title} className="h-40 w-full object-cover"/><div className="p-5"><div className="flex items-center justify-between"><div><h3 className="text-lg font-bold">{current.title}</h3><p className="mt-1 text-xs text-black/45">{current.startDate} — {current.endDate}</p></div><span className="rounded-full bg-warm/10 px-3 py-1 text-[10px] font-bold text-warm">{current.status}</span></div><div className="mt-4 flex items-center justify-between text-xs text-black/45"><span>{currentSummary?.places??0} 地点 · {currentSummary?.photos??0} 照片</span><span className="font-bold text-warm">{currentSummary?.explorationRate??0}%</span></div><div className="mt-2 h-2 rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-warm" style={{width:`${Math.max(0,Math.min(100,currentSummary?.explorationRate??0))}%`}}/></div><div className="mt-5 flex gap-2"><Link href={`/trips/${current.id}/map`} className="warm-button flex-1">继续记录 <ArrowRight size={14}/></Link><Link href={`/trips/${current.id}/summary`} className="rounded-[13px] border border-black/10 bg-white px-4 py-3 text-xs font-bold">查看成果</Link></div></div></div>:<Empty/>}</section></div>
        </>}
      </div>
      <aside className="dashboard-right space-y-4">
        <div className="side-panel"><div className="flex items-center justify-between"><h3 className="font-serif text-xl font-bold">旅行日历</h3><CalendarDays size={17} className="text-warm"/></div><p className="mt-1 text-xs text-black/40">{calendar.year} 年 {calendar.month+1} 月{current?' · 当前旅行日期已标记':''}</p><div className="mini-calendar-grid mt-4">{['日','一','二','三','四','五','六'].map(d=><span key={d} className="font-bold text-black/35">{d}</span>)}{calendar.cells.map((d,i)=>d===null?<span key={`blank-${i}`}/>:<span key={d} className={`${inTrip(d)?'trip-day ':''}${sameDay(`${calendar.year}-${String(calendar.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,today)?'today':''}`}>{d}</span>)}</div><div className="mt-3 flex gap-3 text-[10px] text-black/40"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-warm"/>今天</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-gold/60"/>旅行日期</span></div></div>
        <div className="side-panel"><div className="flex items-center justify-between"><h3 className="font-serif text-xl font-bold">今天可以做</h3><Plus size={17}/></div><div className="mt-4 space-y-3">{[[CheckCircle2,'补记一处旅行地点','打卡'],[Camera,'挑选几张精选照片','照片'],[Sparkles,'生成一次旅行成果','分享'],[Clock3,'整理今天的行程时间轴','时间轴']].map(([Icon,label,tag]:any)=><div key={label} className="flex items-center gap-3 text-sm"><span className="grid h-8 w-8 place-items-center rounded-xl bg-orangeSoft text-warm"><Icon size={15}/></span><span className="flex-1">{label}</span><span className="rounded-full bg-[#F2ECE5] px-2 py-1 text-[10px] text-black/45">{tag}</span></div>)}</div></div>
        <div className="side-panel bg-gradient-to-br from-[#FFF4E7] to-[#F6E5D3]"><p className="font-serif text-2xl leading-relaxed">“持续记录的人，终会看见时间的复利。”</p><div className="mt-4 h-px w-8 bg-warm"/></div>
        <div className="overflow-hidden rounded-[22px] border border-black/[0.06]"><img src="/images/footer.jpg" alt="旅行夕阳" className="h-44 w-full object-cover"/></div>
      </aside>
    </div>
  </section></main>
}

function Metric({icon,title,value,note,tone}:{icon:React.ReactNode;title:string;value:string;note:string;tone:string}){return <article className={`metric-card ${tone}`}><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/70 text-warm">{icon}</span><ArrowRight size={14} className="text-black/25"/></div><div className="mt-4 flex items-end gap-2"><b>{value}</b><span className="mb-1 text-xs font-bold text-black/55">{title}</span></div><span>{note}</span></article>}
function TripRow({trip,summary}:{trip:TripView;summary?:TripSummary}){return <Link href={`/trips/${trip.id}`} className="flex items-center gap-4 rounded-2xl border border-black/[0.05] bg-[#FFFEFC] p-3 transition hover:-translate-y-0.5 hover:shadow-card"><img src={trip.coverImage||'/images/cover.jpg'} alt={trip.title} className="h-16 w-20 rounded-xl object-cover"/><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{trip.title}</h3><p className="mt-1 truncate text-xs text-black/40">{trip.destinationName} · {trip.startDate}</p></div><div className="text-right"><b className="font-serif text-xl text-warm">{summary?.places??0}</b><p className="text-[10px] text-black/35">地点</p></div><ArrowRight size={15} className="text-black/25"/></Link>}
function Empty(){return <div className="mt-5 rounded-2xl border border-dashed border-black/10 p-9 text-center"><p className="font-serif text-2xl">还没有旅行</p><p className="mt-2 text-xs text-black/40">创建第一段旅行后，地图、时间轴和成果都会从这里开始。</p><Link href="/trips/new" className="mt-5 inline-flex warm-button">创建旅行</Link></div>}
