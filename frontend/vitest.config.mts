import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// 前端单元测试：只测关键业务逻辑（纯函数 / 会话与令牌刷新），不做组件快照
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' }
})
