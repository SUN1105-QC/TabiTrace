/**
 * 分享九宫格「分别导出 9 张」：把每个方格单独导出为正方形 PNG（边长按分享图规格：Free 720，Trip Pro 1080），
 * 按从左到右、从上到下的顺序编号，方便直接发朋友圈 / 微博九宫格。
 * 旅行手帐没有方格：改为分别导出每张照片卡（宽度同上，摆正、不带拼贴里的位置），不会把整张拼贴错误裁成 9 块。
 * Free 旅行的每张图都加水印。
 */

import { getFontEmbedCSS, toBlob } from 'html-to-image'
import { watermarkBlob } from '@/utils/share-tier'
import type { PhotoSources } from '@/utils/photo-variants'

export type ExportFile = { name: string; blob: Blob }

/** 等待节点里的图片全部加载（失败的图片已由组件换成占位），导出时不会截到空白图 */
export async function waitForImages(root: HTMLElement) {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(img => (img.complete ? img.decode().catch(() => undefined) : new Promise<void>(resolve => {
    img.addEventListener('load', () => resolve(), { once: true })
    img.addEventListener('error', () => resolve(), { once: true })
  }))))
}

/**
 * 预览与导出分开：成品预览用中图（省流量），导出前把「按导出倍率不够清晰」的照片临时换成原图，导出后换回。
 * photos：这份成品用到的照片（用中图 / 缩略图地址找到原图）；pixelRatio：成品里 1 个 CSS 像素对应的导出像素。
 * 只换确实不够的（例如竖拍照片的中图只有 1200 宽，放在 2 倍导出的长图封面里），其余保持中图，导出不会多下载很多。
 * 返回恢复函数。
 */
export async function upgradeImagesForExport(root: HTMLElement, pixelRatio: number, photos: PhotoSources[]) {
  const original = new Map<string, string>()
  for (const p of photos) for (const u of [p.thumbUrl, p.mediumUrl]) if (u && p.imageUrl && u !== p.imageUrl) original.set(u, p.imageUrl)
  const swapped: [HTMLImageElement, string][] = []
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? ''
    const full = original.get(src)
    if (!full || !img.naturalWidth || !img.naturalHeight) continue
    // 按 cover 铺满计算需要的像素宽度
    const need = Math.max(img.offsetWidth, img.offsetHeight * (img.naturalWidth / img.naturalHeight)) * pixelRatio
    if (img.naturalWidth >= need * 0.95) continue
    swapped.push([img, src])
    img.setAttribute('src', full)
  }
  if (swapped.length) await waitForImages(root)
  return () => { for (const [img, src] of swapped) img.setAttribute('src', src) }
}

/**
 * 手帐照片卡单独导出时去掉拼贴里的定位与旋转。
 * 必须是 static + inset: auto：克隆节点带着计算出的 inset（四个方向都有值），保留定位时卡片会画到画布外，导出整张透明。
 */
const CARD_RESET = { position: 'static', inset: 'auto', margin: '0', transform: 'none', boxShadow: 'none' }

export async function exportGridTiles(card: HTMLElement, baseName: string, spec: { tileSize: number; watermark: boolean }, onProgress?: (done: number, total: number) => void) {
  const scrapbook = card.classList.contains('sb-canvas')
  const tiles = Array.from(card.querySelectorAll<HTMLElement>(scrapbook ? '.sb-card' : '.sg-tile'))
    // 手帐按卡片上的编号（用户的选择顺序）导出
    .sort((a, b) => (scrapbook ? Number(a.dataset.no) - Number(b.dataset.no) : 0))
  // 字体只内嵌一次，9 张图共用，避免重复下载字体
  const fontEmbedCSS = await getFontEmbedCSS(card)
  const files: ExportFile[] = []
  for (const [i, tile] of tiles.entries()) {
    const blob = await toBlob(tile, {
      cacheBust: true,
      // 图片地址形如 /local-storage/file?key=…，只有参数不同；不带参数做缓存键会让所有照片变成同一张
      includeQueryParams: true,
      fontEmbedCSS,
      pixelRatio: spec.tileSize / tile.offsetWidth,
      // 单张图不需要圆角，发到社交平台时由平台自己排版；手帐照片卡保留相纸圆角并摆正
      style: scrapbook ? CARD_RESET : { borderRadius: '0' }
    })
    if (!blob) throw new Error(`第 ${i + 1} 张图片生成失败`)
    files.push({ name: `${baseName}-${i + 1}.png`, blob: spec.watermark ? await watermarkBlob(blob) : blob })
    onProgress?.(i + 1, tiles.length)
  }
  return files
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 交付多张图片：手机上优先用系统分享面板（可一次「存储 9 张图像」到相册），
 * 不支持或被拒绝时逐张下载。返回实际采用的方式。
 */
export async function deliverFiles(files: ExportFile[]): Promise<'shared' | 'cancelled' | 'downloaded'> {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (touch && typeof navigator.canShare === 'function') {
    const shareFiles = files.map(f => new File([f.blob], f.name, { type: 'image/png' }))
    if (navigator.canShare({ files: shareFiles })) {
      try {
        await navigator.share({ files: shareFiles })
        return 'shared'
      } catch (e) {
        if ((e as Error).name === 'AbortError') return 'cancelled'
        // 其他错误（如生成耗时过长、浏览器不再视为用户操作）改为逐张下载
      }
    }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f.blob)
    const a = document.createElement('a')
    a.download = f.name
    a.href = url
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    // 连续触发下载时稍作间隔，避免浏览器合并或丢弃
    await wait(300)
  }
  return 'downloaded'
}
