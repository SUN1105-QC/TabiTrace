/**
 * 圆形邮戳（SVG 生成，不用图片素材）：外圈环形小字 + 中间城市 / 日期，右侧几道波浪消印线。
 * 文字样式直接写成 SVG 属性：导出 PNG 时 html-to-image 不会带上 SVG 文字的 CSS 类样式。
 */

const SANS = 'Inter, "Noto Sans SC", sans-serif'
const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif'

export function PosterStamp({ id, ring, main, sub, size = 128, waves = true, className = '' }: {
  /** 页面内唯一，用于环形文字路径 */
  id: string
  ring: string
  main: string
  sub?: string
  size?: number
  waves?: boolean
  className?: string
}) {
  const mainSize = Array.from(main).length <= 2 ? 22 : Array.from(main).length <= 5 ? 15 : 11
  return (
    <svg className={`cp-stamp ${className}`} width={waves ? size * 1.75 : size} height={size} viewBox={`0 0 ${waves ? 168 : 96} 96`} aria-hidden>
      <defs><path id={id} d="M48 48 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" /></defs>
      {waves && [30, 42, 54, 66].map(y => (
        <path key={y} d={`M92 ${y} q9 -5 18 0 t18 0 t18 0 t18 0`} fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".75" />
      ))}
      <circle cx="48" cy="48" r="45" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="48" cy="48" r="26" fill="none" stroke="currentColor" strokeWidth="0.9" />
      <text fontFamily={SANS} fontSize="7.6" fontWeight="600" letterSpacing="0.6" fill="currentColor">
        <textPath href={`#${id}`} textLength="214" lengthAdjust="spacing">{ring}</textPath>
      </text>
      <text x="48" y={sub ? 50 : 54} textAnchor="middle" fontFamily={SERIF} fontSize={mainSize} fontWeight="600" fill="currentColor">{main}</text>
      {sub && <text x="48" y="62" textAnchor="middle" fontFamily={SANS} fontSize="6.8" letterSpacing="1.2" fill="currentColor">{sub}</text>}
    </svg>
  )
}
