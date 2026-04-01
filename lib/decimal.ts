// lib/decimal.ts
export function parseDecimal(value: any): number | null {
  if (value == null) return null

  if (typeof value === 'number') return value

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? null : parsed
  }

  if (typeof value === 'object' && 'd' in value) {
    const digits = value.d

    if (Array.isArray(digits) && digits.length > 0) {
      return digits[0] // 🎯 juste la valeur brute
    }
  }

  return null
}

export function formatGrade(value: any, decimals: number = 2): string {
  const num = parseDecimal(value)
  if (num === null) return '—'
  return num.toFixed(decimals)
}

export function formatDate(dateString: string): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR')
}