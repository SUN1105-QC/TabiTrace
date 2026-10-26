/**
 * 开发数据源模式（只在开发环境存在）：
 * - local：原样请求本地后端与数据库
 * - mock：统一的内存 Mock 数据（同一个虚拟用户、同一批旅行，写操作只改当前标签页的内存）
 * - empty：所有业务数据为合法的空结构，写操作被拦截，不会写入本地数据库
 */
export type DataSourceMode = 'local' | 'mock' | 'empty'

export const DATA_SOURCE_KEY = 'tabitrace.dev.dataSource'
export const DATA_SOURCE_MODES: DataSourceMode[] = ['local', 'mock', 'empty']
/** 模式切换后广播：数据层清缓存，应用外壳重新挂载并重新取数 */
export const DATA_SOURCE_CHANGED = 'tabitrace:dev-data-source-changed'
/** 数据层拦截了写操作（Empty 模式）或遇到 Mock 尚未支持的接口，开发工具条据此提示 */
export const DEV_DATA_NOTICE = 'tabitrace:dev-data-notice'

export function readMode(): DataSourceMode {
  if (typeof window === 'undefined') return 'local'
  try {
    const v = window.localStorage.getItem(DATA_SOURCE_KEY)
    return v === 'mock' || v === 'empty' ? v : 'local'
  } catch { return 'local' }
}

export function writeMode(mode: DataSourceMode) {
  try { window.localStorage.setItem(DATA_SOURCE_KEY, mode) } catch { /* 隐私模式下无法保存：本次会话仍然生效 */ }
}

export function notice(message: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<string>(DEV_DATA_NOTICE, { detail: message }))
}
