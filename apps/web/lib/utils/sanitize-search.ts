/** Strip PostgREST filter syntax characters to prevent .or() injection */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,.()"'\\]/g, '')
}
