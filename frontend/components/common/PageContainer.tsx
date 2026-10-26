/**
 * 统一的页面内容容器（桌面布局规范，样式见 globals.css「Desktop Layout System」）：
 * - wide   宽工作区（首页、地图、照片、分享、Travel Story、推荐探索、旅行回忆、我的旅行）：最大 2100px，超宽屏 2300px
 * - medium 中等内容（旅行详情、成就、总结、Trip Pro、探索首页）：最大 1700px
 * - narrow 表单 / 阅读（创建旅行、个人设置、公开分享页）：最大 1200px
 * 容器在 Sidebar 右侧的工作区里水平居中，左右内边距统一为 --page-gutter；
 * 页面自己的类名（vs-page、gl-page…）只负责颜色变量、上下间距和内部排版，不再各自写死最大宽度。
 */

import type { HTMLAttributes } from 'react'

export type PageWidth = 'wide' | 'medium' | 'narrow'

export function PageContainer({ variant = 'wide', className, children, ...rest }: HTMLAttributes<HTMLElement> & { variant?: PageWidth }) {
  return (
    <section {...rest} className={`page-container is-${variant}${className ? ` ${className}` : ''}`}>
      {children}
    </section>
  )
}
