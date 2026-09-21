import { MapPinned } from 'lucide-react'

export function Brand({compact=false}:{compact?:boolean}) {
  return (
    <div className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-warm text-white shadow-card">
        <MapPinned size={19} strokeWidth={2.2} />
      </span>
      {!compact && <span className="leading-tight"><b className="block text-[18px]">旅迹</b><small className="block text-[10px] font-medium tracking-[.08em] text-black/45">TabiTrace</small></span>}
    </div>
  )
}
