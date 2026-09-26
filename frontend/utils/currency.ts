/**
 * 金额格式化：后端金额以最小货币单位保存（CNY 为分），日元、韩元没有辅币。
 * 用 Intl 输出正确的货币符号（人民币为 ¥），整数金额不显示小数：12800 CNY → ¥128。
 */
export function formatCurrency(amountMinor?: number | null, currency?: string | null, locale = 'zh-CN') {
  if (amountMinor == null || !currency) return ''
  const code = currency.toUpperCase()
  const zeroDecimal = ['JPY', 'KRW'].includes(code)
  const value = zeroDecimal ? amountMinor : amountMinor / 100
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: zeroDecimal || Number.isInteger(value) ? 0 : 2, maximumFractionDigits: zeroDecimal ? 0 : 2 }).format(value)
  } catch {
    return `${value} ${code}`
  }
}
