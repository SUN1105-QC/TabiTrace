/**
 * 运行环境判断的唯一入口，业务代码不要自己读 process.env.NODE_ENV。
 *
 * NODE_ENV 在构建时被替换成字面量：生产构建里 isDevelopment 恒为 false，
 * 下面的动态 import 所在分支是死代码，开发数据工具（Mock 数据、切换器）不会被打进生产包。
 */
export const isDevelopment = process.env.NODE_ENV === 'development'

/** 开发数据适配层（Local / Mock / Empty）。生产环境返回 null，且不产生对应的代码分块 */
export const loadDevDataAdapter = () => (process.env.NODE_ENV === 'development' ? import('@/dev/data/adapter') : null)

/** 开发数据切换器界面。生产环境返回 null */
export const loadDevDataSwitcher = () => (process.env.NODE_ENV === 'development' ? import('@/dev/DevDataSwitcher') : null)

/** API 默认地址：开发直连本机后端；生产走同源 /api/v1（生产构建里只剩 '/api/v1'，不会包含本机地址） */
export const defaultApiBase = () => (process.env.NODE_ENV === 'development' ? 'http://localhost:8080/api/v1' : '/api/v1')
