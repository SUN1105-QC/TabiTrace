/**
 * 九宫格的「格式 / 风格」选择：小型模板卡（示意缩略图 + 名称 + 一句说明），手机上横向滑动。
 * 只切换排版，素材选择保持不变。
 */

import { GRID_FORMATS, type GridFormat } from '@/utils/share-grid'

/** 示意缩略图：标准为规整的 3×3，旅行手帐为错落的照片卡 */
function Thumb({ format }: { format: GridFormat }) {
  if (format === 'classic') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden>
        {[0, 1, 2].flatMap(r => [0, 1, 2].map(c => (
          <rect key={`${r}${c}`} x={2 + c * 11.3} y={2 + r * 11.3} width="9.6" height="9.6" rx="1.6" className={r === 1 && c === 1 ? 'is-accent' : (r + c) % 2 ? 'is-soft' : ''} />
        )))}
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 36 36" aria-hidden>
      <rect x="3" y="5" width="9" height="8" rx="1.2" transform="rotate(-6 7.5 9)" className="is-soft" />
      <rect x="24" y="4" width="9" height="8" rx="1.2" transform="rotate(5 28.5 8)" className="is-soft" />
      <rect x="10.5" y="8" width="15" height="15" rx="1.4" transform="rotate(-2 18 15.5)" className="is-accent" />
      <rect x="2.5" y="24" width="9" height="8" rx="1.2" transform="rotate(4 7 28)" />
      <rect x="13.5" y="25.5" width="9" height="8" rx="1.2" transform="rotate(-3 18 29.5)" className="is-soft" />
      <rect x="24.5" y="24" width="9" height="8" rx="1.2" transform="rotate(6 29 28)" />
    </svg>
  )
}

export function NineGridTemplateSelector({ value, onChange }: { value: GridFormat; onChange: (f: GridFormat) => void }) {
  return (
    <div className="ss-formats" role="radiogroup" aria-label="九宫格格式">
      <span className="ss-formats-label">格式</span>
      {GRID_FORMATS.map(f => (
        <button key={f.key} type="button" role="radio" aria-checked={value === f.key} className={`ss-format${value === f.key ? ' is-active' : ''}`} onClick={() => onChange(f.key)}>
          <Thumb format={f.key} />
          <span><b>{f.name}</b><small>{f.desc}</small></span>
        </button>
      ))}
    </div>
  )
}
