/**
 * 分享九宫格「分别导出 9 张」：把每个方格单独导出为正方形 PNG（边长按分享图规格：Free 720，Trip Pro 1080），
 * 按从左到右、从上到下的顺序编号，方便直接发朋友圈 / 微博九宫格。
 * 旅行手帐没有方格：改为分别导出每张照片卡（宽度同上，摆正、不带拼贴里的位置），不会把整张拼贴错误裁成 9 块。
 * Free 旅行的每张图都加水印。
 */

import { getFontEmbedCSS, toBlob, toCanvas, toPng } from 'html-to-image'
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

/** iPhone / iPad 上的所有浏览器都是 WebKit 内核（iPadOS 默认伪装成 Mac，用触点数区分） */
export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** iOS 与桌面 Safari：成品图经 SVG foreignObject 绘制时，里面的照片常常还没解码就被画出，结果是空白 */
export function isWebKit() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return isIOS() || (/Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua))
}

/** iOS 单个画布最多约 1677 万像素，超过就整张画不出来；很长的每日长图在 iOS 上按面积降低倍率（其他平台不变） */
const IOS_CANVAS_AREA = 16_000_000
export function exportPixelRatio(node: HTMLElement, ratio: number) {
  const area = node.offsetWidth * node.offsetHeight
  if (!isIOS() || !area) return ratio
  return Math.min(ratio, Math.sqrt(IOS_CANVAS_AREA / area))
}

type ExportImageOptions = Parameters<typeof toBlob>[1]

/**
 * 成品图导出：WebKit 第一次绘制时常漏掉照片（照片在 SVG 里还没解码），先完整预绘一次让照片解码进缓存，第二次才取结果。
 * 其他浏览器只绘制一次。
 */
export async function renderPng(node: HTMLElement, options: ExportImageOptions) {
  if (isWebKit()) await toCanvas(node, options).then(c => { c.width = 0; c.height = 0 }, () => undefined)
  return toPng(node, options)
}
export async function renderBlob(node: HTMLElement, options: ExportImageOptions) {
  if (isWebKit()) await toCanvas(node, options).then(c => { c.width = 0; c.height = 0 }, () => undefined)
  return toBlob(node, options)
}

/** 读取图片并按需要的宽度缩小，返回 data URL；跨域照片按公开资源读取（不带 Cookie、不用可能缺 CORS 头的缓存） */
async function downscaledDataUrl(url: string, width: number) {
  const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  try {
    const w = Math.max(1, Math.min(bitmap.width, Math.ceil(width)))
    const h = Math.max(1, Math.round(bitmap.height * (w / bitmap.width)))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)
    // 照片用高质量 JPEG；PNG / WebP 等可能带透明的图片保持 PNG
    const data = canvas.toDataURL(blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92)
    canvas.width = 0; canvas.height = 0
    if (!data.startsWith('data:image/')) throw new Error('encode')
    return data
  } finally { bitmap.close() }
}

/**
 * 导出前把成品里的每张图片换成「刚好够导出倍率」的内嵌图片，导出后换回预览用的地址。
 * - 预览用中图；按导出倍率不够清晰的照片改读原图（例如竖拍照片放在 2 倍导出的长图封面里），但都缩到实际需要的像素，
 *   不会把 1200 万像素的原图整张塞进成品：原图过大是手机上导出的成品图「照片全空白」的主要原因。
 * - 图片已经是内嵌数据后，html-to-image 不必再逐张下载，也不受缓存里缺 CORS 头的影响。
 * photos：这份成品用到的照片（用中图 / 缩略图地址找到原图）；pixelRatio：成品里 1 个 CSS 像素对应的导出像素。
 * 单张处理失败时保留原地址，由 html-to-image 自己读取。返回恢复函数。
 */
export async function prepareImagesForExport(root: HTMLElement, pixelRatio: number, photos: PhotoSources[]) {
  const original = new Map<string, string>()
  for (const p of photos) for (const u of [p.thumbUrl, p.mediumUrl]) if (u && p.imageUrl && u !== p.imageUrl) original.set(u, p.imageUrl)
  const jobs = Array.from(root.querySelectorAll('img')).flatMap(img => {
    const src = img.getAttribute('src') ?? ''
    if (!/^(https?:)?\//.test(src) || !img.naturalWidth || !img.naturalHeight || !img.offsetWidth) return []
    // 按 cover 铺满计算需要的像素宽度
    const need = Math.max(img.offsetWidth, img.offsetHeight * (img.naturalWidth / img.naturalHeight)) * pixelRatio
    const full = original.get(src)
    return [{ img, src, srcset: img.getAttribute('srcset'), need, from: full && img.naturalWidth < need * 0.95 ? full : (img.currentSrc || img.src) }]
  })
  const swapped: typeof jobs = []
  let next = 0
  // 手机内存有限：同时最多处理 3 张
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++]
      try {
        const data = await downscaledDataUrl(job.from, job.need)
        job.img.removeAttribute('srcset')
        job.img.setAttribute('src', data)
        swapped.push(job)
      } catch { /* 保留原地址 */ }
    }
  }))
  if (swapped.length) await waitForImages(root)
  return () => {
    for (const { img, src, srcset } of swapped) {
      img.setAttribute('src', src)
      if (srcset) img.setAttribute('srcset', srcset)
    }
  }
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
    const blob = await renderBlob(tile, {
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
 * 交付导出文件：手机上优先用系统分享面板（图片可一次「存储 9 张图像」到相册），
 * 不支持或被拒绝时逐张下载。返回实际采用的方式。
 */
export async function deliverFiles(files: ExportFile[]): Promise<'shared' | 'cancelled' | 'downloaded'> {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (touch && typeof navigator.canShare === 'function') {
    const shareFiles = files.map(f => new File([f.blob], f.name, { type: f.blob.type || 'application/octet-stream' }))
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
