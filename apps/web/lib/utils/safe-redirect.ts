export function sanitizeRedirect(value: string | null | undefined): string {
  if (!value) return '/dashboard'
  // Must start with / followed by a letter or digit — blocks //, /\, empty
  if (/^\/[a-zA-Z0-9]/.test(value) && !value.includes('\\')) return value
  return '/dashboard'
}
