/** 首页旅行横幅右侧的线描插画：巴黎用埃菲尔铁塔，其他目的地用通用的山与城市剪影。纯装饰，不读屏。 */
export function TripLandmark({ trip }: { trip: { destinationName: string; city?: string; countryCode?: string } }) {
  const name = `${trip.city ?? ''} ${trip.destinationName}`.toLowerCase()
  const paris = trip.countryCode === 'FR' || /paris|巴黎|パリ/.test(name)
  return <div className="hw-landmark" aria-hidden="true">{paris ? <EiffelTower /> : <Skyline />}</div>
}

function EiffelTower() {
  return <svg viewBox="0 0 160 240" fill="none" stroke="#9A5A3C" strokeWidth="1.6" strokeLinejoin="round">
    <ellipse cx="80" cy="234" rx="58" ry="4" fill="#E7C6AE" stroke="none" opacity=".55" />
    {/* 塔尖与顶层 */}
    <path d="M80 4v14M76 18h8l-1 10h-6z" fill="#C98A68" />
    <path d="M77 28h6l3 46H74z" fill="#D49A78" />
    <path d="M75 40l10 12M85 40L75 52M74.5 56l11 12M85.5 56l-11 12" strokeWidth="1.1" />
    <rect x="68" y="74" width="24" height="6" rx="1" fill="#B9714F" />
    {/* 中层 */}
    <path d="M71 80h18l7 46H64z" fill="#D49A78" />
    <path d="M70 84l22 18M90 84L68 102M67 104l26 20M93 104L67 124" strokeWidth="1.1" />
    <rect x="56" y="126" width="48" height="7" rx="1.5" fill="#B9714F" />
    {/* 底层与拱门 */}
    <path d="M62 133h36l20 95h-18c-3-26-10-40-20-40s-17 14-20 40H42z" fill="#C98A68" />
    <path d="M62 140l38 30M98 140L60 170M58 172c8 2 14 8 22 8s14-6 22-8" strokeWidth="1.1" />
    <rect x="48" y="166" width="64" height="6" rx="1.5" fill="#B9714F" />
  </svg>
}

function Skyline() {
  return <svg viewBox="0 0 260 200" fill="none" stroke="#9A5A3C" strokeWidth="1.5" strokeLinejoin="round">
    <circle cx="190" cy="52" r="22" fill="#F1C9A6" stroke="none" opacity=".8" />
    <path d="M0 170l60-74 34 38 40-56 58 92z" fill="#E4B394" stroke="none" opacity=".6" />
    <path d="M30 196v-58h22v58M62 196V116h26v80M98 196v-44h20v44M128 196V98l14-14 14 14v98M166 196v-66h24v66M200 196v-40h22v40" fill="#D49A78" />
    <path d="M70 128h10M70 142h10M70 156h10M136 112h12M136 128h12M136 144h12M172 144h12M172 160h12" strokeWidth="1.2" />
    <path d="M10 196h240" />
  </svg>
}
