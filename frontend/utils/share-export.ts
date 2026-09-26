/**
 * 分享九宫格「分别导出 9 张」：把每个方格单独导出为 1080 × 1080 的正方形 PNG，
 * 按从左到右、从上到下的顺序编号，方便直接发朋友圈 / 微博九宫格。
 */

import { getFontEmbedCSS, toBlob } from 'html-to-image'

export type ExportFile = { name: string; blob: Blob }

const TILE_SIZE = 1080

export async function exportGridTiles(card: HTMLElement, baseName: string, onProgress?: (done: number, total: number) => void) {
  const tiles = Array.from(card.querySelectorAll<HTMLElement>('.sg-tile'))
  // 字体只内嵌一次，9 张图共用，避免重复下载字体
  const fontEmbedCSS = await getFontEmbedCSS(card)
  const files: ExportFile[] = []
  for (const [i, tile] of tiles.entries()) {
    const blob = await toBlob(tile, {
      cacheBust: true,
      // 图片地址形如 /local-storage/file?key=…，只有参数不同；不带参数做缓存键会让所有照片变成同一张
      includeQueryParams: true,
      fontEmbedCSS,
      pixelRatio: TILE_SIZE / tile.offsetWidth,
      // 单张图不需要圆角，发到社交平台时由平台自己排版
      style: { borderRadius: '0' }
    })
    if (!blob) throw new Error(`第 ${i + 1} 张图片生成失败`)
    files.push({ name: `${baseName}-${i + 1}.png`, blob })
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
