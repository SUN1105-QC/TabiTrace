import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#FBF7F1',
        paper: '#FFFCF8',
        ink: '#26221E',
        warm: '#E97A33',
        vermilion: '#E97A33',
        orangeSoft: '#F5E4D2',
        sand: '#E9DCCB',
        gold: '#C99A58',
        sage: '#6F8B78',
        mist: '#F4EFE8'
      },
      boxShadow: {
        soft: '0 18px 50px rgba(84, 61, 42, 0.10)',
        card: '0 10px 32px rgba(89, 67, 48, 0.08)'
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Noto Serif SC', 'Songti SC', 'serif']
      }
    }
  },
  plugins: []
}
export default config
