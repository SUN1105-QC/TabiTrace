/** 品牌标志：原版 Logo（public/brand/），完整版为图标 + 「旅迹」字标，compact 只显示图标 */
export const BRAND_LOGO = { src: '/brand/logo.webp', ratio: 447 / 200 }
export const BRAND_MARK = '/brand/mark.webp'

export function BrandLogo({ height, className }: { height: number; className?: string }) {
  return <img src={BRAND_LOGO.src} alt="旅迹 TabiTrace" width={Math.round(height * BRAND_LOGO.ratio)} height={height} className={className} decoding="async" />
}

export function BrandMark({ size, className }: { size: number; className?: string }) {
  return <img src={BRAND_MARK} alt="" aria-hidden="true" width={size} height={size} className={className} decoding="async" />
}

export function Brand({compact=false}:{compact?:boolean}) {
  return compact ? <BrandMark size={40} className="block" /> : <BrandLogo height={50} className="block h-[50px] w-auto" />
}
