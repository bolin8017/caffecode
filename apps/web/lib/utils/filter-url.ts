export const PAGE_SIZE = 50

/**
 * Build a URL preserving current params while applying overrides.
 * - Removes params with null/undefined/empty values.
 * - Resets page to 1 when any non-page param changes.
 * - Omits page=1 to keep URLs clean.
 */
export function buildFilterUrl(
  basePath: string,
  currentParams: Record<string, string | undefined>,
  overrides: Record<string, string | null>,
): string {
  const merged: Record<string, string> = {}

  // Start with current params (skip undefined)
  for (const [k, v] of Object.entries(currentParams)) {
    if (v !== undefined && v !== '') merged[k] = v
  }

  // Check if any non-page param is changing
  const hasFilterChange = Object.entries(overrides).some(
    ([k, v]) => k !== 'page' && merged[k] !== (v ?? undefined),
  )

  // Apply overrides
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === '') {
      delete merged[k]
    } else {
      merged[k] = v
    }
  }

  // Reset page when filters change
  if (hasFilterChange) {
    delete merged.page
  }

  // Omit page=1
  if (merged.page === '1') {
    delete merged.page
  }

  const qs = new URLSearchParams(merged).toString()
  return qs ? `${basePath}?${qs}` : basePath
}
