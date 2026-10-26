/**
 * 旅迹的国际化（不引入第二套库，只有字典 + 翻译函数）：
 * - 字典：zh-CN（基准）/ en-US / ja-JP，结构由 zh-CN 推导，缺键会在类型检查时报错
 * - translate(locale, key, vars)：按点分路径取文案并替换 {name}；找不到时回退到中文，再回退到键名
 * - React 组件请使用 components/common/PreferencesProvider 里的 useT()；非 React 代码用 tr()（读取运行时语言）
 */

import { zhCN } from './zh-CN'
import { enUS } from './en-US'
import { jaJP } from './ja-JP'
import { runtimePrefs, type Locale } from '@/lib/preferences'

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }
export type Messages = Widen<typeof zhCN>

type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string]
export type MessageKey = Paths<typeof zhCN>
export type Vars = Record<string, string | number>

const DICTS: Record<Locale, Messages> = { 'zh-CN': zhCN, 'en-US': enUS, 'ja-JP': jaJP }

/** 语言选择器里显示的名字：用各自的语言书写 */
export const LOCALE_NAMES: Record<Locale, string> = { 'zh-CN': '简体中文', 'en-US': 'English', 'ja-JP': '日本語' }

function lookup(dict: Messages, key: string): string | undefined {
  let node: unknown = dict
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as object)) node = (node as Record<string, unknown>)[part]
    else return undefined
  }
  return typeof node === 'string' ? node : undefined
}

export function translate(locale: Locale, key: MessageKey | string, vars?: Vars): string {
  const raw = lookup(DICTS[locale] ?? zhCN, key) ?? lookup(zhCN, key) ?? key
  return vars ? raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : raw
}

/** 非 React 代码使用：读取当前运行时语言 */
export const tr = (key: MessageKey, vars?: Vars) => translate(runtimePrefs().locale, key, vars)

export type TFunction = (key: MessageKey, vars?: Vars) => string
