/**
 * 城市海报导出：只截取海报组件节点（.cp-poster），设计尺寸 1080 × 1440，
 * 按分享图规格导出（Free 1080 × 1440，Trip Pro 1440 × 1920）。
 * 导出前等所有图片加载完（失败的图片已由组件换成占位），字体由 html-to-image 内嵌，
 * SVG 路线与邮戳是矢量，放大后依然清晰。
 */

import { toPng } from 'html-to-image'
import { waitForImages } from '@/utils/share-export'

export async function exportPosterPng(node: HTMLElement, width: number) {
  await waitForImages(node)
  return toPng(node, {
    cacheBust: true,
    // 图片地址形如 /local-storage/file?key=…，只有参数不同；不带参数做缓存键会让所有照片变成同一张
    includeQueryParams: true,
    pixelRatio: width / node.offsetWidth
  })
}
