import Image from 'next/image'

/** 用户提供的插画仅作装饰；四格素材用容器定位展示，动态文案始终由页面渲染。 */
export function HomeArt({ scene }: { scene: 'welcome' | 'japan' | 'next' | 'memories' }) {
  return <span className={`hw-art hw-art-${scene}`} aria-hidden="true">
    <Image src={`/images/home/${scene === 'japan' ? 'japan-travel' : 'travel-watercolors'}.png`} width={scene === 'japan' ? 1000 : 1254} height={scene === 'japan' ? 666 : 1254} sizes="(max-width: 767px) 800px, 1px" alt="" />
  </span>
}
