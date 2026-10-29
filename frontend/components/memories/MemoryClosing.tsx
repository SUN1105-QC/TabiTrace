import Link from 'next/link'
import { Plus } from 'lucide-react'

export function MemoryClosing() {
  return (
    <section className="mm-closing" style={{ gridTemplateColumns: '1fr' }}>
      <div className="mm-card mm-closing-card is-warm">
        <p className="mm-eyebrow">NEXT JOURNEY</p>
        <h3>旅行回忆与下一次出发</h3>
        <p>把去过的地方，慢慢变成能反复回看的故事。<br />每一次回看，也是下一次出发的开始。</p>
        <Link href="/trips/new" className="mm-btn is-primary"><Plus size={15} /> 继续记录新的旅行</Link>
      </div>
    </section>
  )
}
