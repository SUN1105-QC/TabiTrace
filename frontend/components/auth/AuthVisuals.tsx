/**
 * Auth 页面左侧（≥1024px）的装饰视觉。只使用项目自带、不含文字的旅行照片与静态示意，不读取任何用户数据。
 * 图片懒加载：手机端容器 display:none，不会下载。
 */

import { Camera, Check, MapPin, MapPinned, Share2 } from 'lucide-react'
import { HERO_DEMO, LANDING_IMAGES, PRODUCT_SHOTS } from '@/components/landing/landingDemo'

/** 登录 / 找回密码：“回到自己的旅程”——一组旅行照片 + 一条打卡记录 */
export function MemoriesVisual() {
  return (
    <div className="au-memories" aria-hidden="true">
      <figure className="au-mem-main">
        <img src={LANDING_IMAGES.heroPhotoA.src} alt="" width={426} height={286} loading="lazy" decoding="async" />
      </figure>
      <figure className="au-mem-polaroid">
        <img src={LANDING_IMAGES.heroPhotoB.src} alt="" width={380} height={244} loading="lazy" decoding="async" />
      </figure>
      <div className="au-mem-chip">
        <span><MapPin size={14} /></span>
        <div>
          <b>{HERO_DEMO.place.name}<small> · {HERO_DEMO.place.area}</small></b>
          <em><Check size={12} /> {HERO_DEMO.place.status}</em>
        </div>
      </div>
    </div>
  )
}

/** 注册：“从这里开始一段新的旅迹”——真实产品界面截图 + 注册后能得到什么 */
export function ProductVisual() {
  return (
    <>
      <div className="au-reg-preview" aria-hidden="true">
        <img src={PRODUCT_SHOTS.map.src} alt="" width={PRODUCT_SHOTS.map.width} height={PRODUCT_SHOTS.map.height} className="au-reg-shot" loading="lazy" decoding="async" />
        <div className="au-reg-place">
          <span><MapPin size={14} /></span>
          <div><b>{HERO_DEMO.place.name}<small> · {HERO_DEMO.place.area}</small></b><em><Check size={12} /> {HERO_DEMO.place.status}</em></div>
        </div>
        <figure className="au-reg-poster"><img src={PRODUCT_SHOTS.poster.src} alt="" width={PRODUCT_SHOTS.poster.width} height={PRODUCT_SHOTS.poster.height} loading="lazy" decoding="async" /></figure>
      </div>
      <ul className="au-reg-benefits" aria-label="注册后你可以">
        <li><MapPinned size={18} aria-hidden="true" /><div><b>旅行地图与打卡</b><span>去过的和计划中的地点，落在同一张地图上</span></div></li>
        <li><Camera size={18} aria-hidden="true" /><div><b>照片与时间轴</b><span>照片按拍摄时间回到旅行的每一天</span></div></li>
        <li><Share2 size={18} aria-hidden="true" /><div><b>分享成果</b><span>海报、九宫格、每日长图与 Travel Story</span></div></li>
      </ul>
    </>
  )
}
