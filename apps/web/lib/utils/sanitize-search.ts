/** Strip PostgREST filter syntax and SQL LIKE wildcards to prevent injection */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,.()"'\\%_]/g, '')
}
