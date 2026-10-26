#!/usr/bin/env node
/**
 * 把 MapLibre 的 Web Worker 文件复制到 public/vendor/maplibre-gl/<版本>/（由 predev / prebuild 自动执行）。
 *
 * 原因：maplibre-gl 6 默认按“当前脚本的目录”加载 ./maplibre-gl-worker.mjs，
 * 打包后脚本位于 /_next/static/chunks/，那里没有这个文件（404），Worker 起不来，
 * GeoJSON 路线和矢量底图都无法加载。复制后由 components/map/maplibreWorker.ts 用 setWorkerUrl 指向这里。
 * 目录按版本号区分，升级 maplibre-gl 后自动换新路径，旧版本目录会被清理。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const { version } = require('maplibre-gl/package.json')
const dist = path.join(path.dirname(require.resolve('maplibre-gl/package.json')), 'dist')
const baseDir = path.join(root, 'public', 'vendor', 'maplibre-gl')
const target = path.join(baseDir, version)

fs.mkdirSync(target, { recursive: true })
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) fs.copyFileSync(path.join(dist, file), path.join(target, file))
for (const old of fs.readdirSync(baseDir)) if (old !== version) fs.rmSync(path.join(baseDir, old), { recursive: true, force: true })
console.log(`[maplibre] worker ${version} → public/vendor/maplibre-gl/${version}/`)
