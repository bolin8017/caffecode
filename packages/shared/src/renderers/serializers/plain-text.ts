import { toString } from 'mdast-util-to-string'
import type { Root } from 'mdast'

/**
 * Serializes a fully-transformed mdast Root into plain text.
 * Strips all Markdown formatting — suitable for email plain-text,
 * LINE messages, or any channel that does not support markup.
 *
 * Uses the official mdast-util-to-string which handles edge cases
 * (alt text for images, ordered list numbering, etc.).
 */
export function serializeToPlainText(tree: Root): string {
  return toString(tree, { includeImageAlt: false }).trim()
}
