/**
 * Extract the first paragraph (block separated by blank lines) from a rendered string.
 * Used by Telegram and Email channels to create a push preview.
 */
export function firstParagraph(rendered: string, maxLength?: number): string {
  const first = rendered.split(/\n\n+/)[0]?.trim() ?? ''
  if (maxLength && first.length > maxLength) {
    return first.slice(0, maxLength) + '…'
  }
  return first
}
