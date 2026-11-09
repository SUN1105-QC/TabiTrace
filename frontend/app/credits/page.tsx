/**
 * 图片来源与授权：站内使用的官方景点照片全部来自 Wikimedia Commons，逐张列出作者、许可证与来源页。
 * 数据由 scripts/optimize-place-images.mjs 生成（constants/place-images.generated.json），来源记录见 assets-src/places/SOURCES.json。
 */

import Link from 'next/link'
import { PageContainer } from '@/components/common/PageContainer'
import { SiteHeader } from '@/components/common/SiteHeader'
import { publicPage } from '@/lib/site'
import { ALL_IMAGE_CREDITS, hdImage } from '@/utils/place-images'

export const metadata = publicPage('/credits', '图片来源与授权｜旅迹 TabiTrace', '旅迹 TabiTrace 使用的东京、首尔、香港与台北景点照片来源、作者与许可证。')

export default function CreditsPage() {
  return (
    <main>
      <SiteHeader />
      <PageContainer variant="narrow" className="cr-page px-5 pb-16 sm:px-8">
        <header className="cr-head">
          <p className="xp-eyebrow">IMAGE CREDITS</p>
          <h1>图片来源与授权</h1>
          <p>
            推荐探索、地点详情等处使用的东京、首尔、香港与台北实景照片整理自 <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>，
            按各自的许可证使用：CC BY / CC BY-SA 需要署名并注明许可证，CC BY-SA 的照片在站内被缩放、转为 WebP 后仍以同一许可证提供；
            CC0及公有领域同样注明来源。KOGL第1类和政府开放资料按对应条件注明机构与出处；图片不表示相关机构为旅迹背书。本站仅进行尺寸调整、WebP转换和展示裁切。你上传的照片归你本人所有，不在此列。
          </p>
        </header>
        <ul className="cr-list">
          {ALL_IMAGE_CREDITS.map(c => (
            <li key={c.slug}>
              <span className="cr-thumb"><img src={hdImage(c.slug).replace('/1280/', '/640/')} alt={c.subject} loading="lazy" decoding="async" width={160} height={100} /></span>
              <div>
                <b>{c.subject}</b>
                <small>
                  作者：{c.author ?? 'Wikimedia Commons 贡献者'} · 许可证：{c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer license">{c.license}</a> : c.license}
                </small>
                {c.attribution && <small>指定署名：{c.attribution}</small>}
                {c.originalTitle && <small>原作品：{c.originalTitle}{c.createdAt ? ` · ${c.createdAt}` : ''}</small>}
                {c.credit && <small className="break-words">原始出处：{c.credit}</small>}
                <a href={c.sourcePage} target="_blank" rel="noopener noreferrer">查看原图与来源页</a>
              </div>
            </li>
          ))}
        </ul>
        <p className="cr-note">
          首页的产品截图来自旅迹自己的界面，画面里的照片同样是上面列出的 Commons 照片（上野动物园熊猫照片裁成了 4:3）；
          地图截图的底图来自 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>（ODbL）。
        </p>
        <p className="cr-back"><Link href="/explore" className="xp-link">返回推荐探索</Link></p>
      </PageContainer>
    </main>
  )
}
