const FRENCH_MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
]

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function formatParts(year: number, month: number, day: number): string {
  if (!isValidDateParts(year, month, day)) return "—"
  return `${day} ${FRENCH_MONTHS[month - 1]} ${year}`
}

export function formatFrenchLongDate(date?: string | Date | null): string {
  if (!date) return "—"

  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return "—"
    return formatParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
  }

  const value = date.trim()
  if (!value) return "—"

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/)
  if (isoDate) {
    return formatParts(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]))
  }

  const frenchNumericDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (frenchNumericDate) {
    return formatParts(Number(frenchNumericDate[3]), Number(frenchNumericDate[2]), Number(frenchNumericDate[1]))
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return formatParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
}
