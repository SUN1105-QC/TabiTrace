// 最小必要的 ESLint 配置（Next.js 官方规则集，flat config），重点：未使用变量、Hooks 误用、Promise 误用、明显错误。
// 不引入格式化规则（项目没有 Prettier，也不在这里统一代码风格）。
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Promise 误用：没有处理的 Promise、把 async 函数传给只接受同步回调的地方
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      // 未使用变量：以 _ 开头的参数 / 变量视为有意忽略
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // 既有代码里 API 数据类型仍有 any：先提示，不阻断
      '@typescript-eslint/no-explicit-any': 'warn',
      // React Compiler 取向的新规则（effect 内 setState、渲染期读 ref 等）：现有数据加载写法大量命中，先作为提示，逐步治理
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      // 用户照片来自对象存储（域名随部署变化），缩略图由上传流程生成，不使用 next/image
      '@next/next/no-img-element': 'off'
    }
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'public/vendor/**', 'scripts/**', '*.config.*', 'next.config.ts'])
])
