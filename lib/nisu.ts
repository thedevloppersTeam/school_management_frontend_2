export const NISU_REGEX = /^[A-Z0-9]{20}$/
export const NISU_RULE_LABEL = "20 caractères alphanumériques exactement"

export function normalizeNisu(nisu: string | null | undefined) {
  return nisu?.trim().toUpperCase() ?? ""
}

export function isNisuValid(nisu: string | null | undefined, optional = true) {
  const value = normalizeNisu(nisu)
  if (!value) return optional
  return NISU_REGEX.test(value)
}
