import type { Root } from 'mdast'
import { BaseRenderer } from './base-renderer.js'
import { serializeToPlainText } from './serializers/plain-text.js'

/**
 * Renders Markdown content as plain text, stripping all formatting.
 * Suitable for: email plain-text parts, LINE messages, SMS, logging.
 */
export class PlainTextRenderer extends BaseRenderer {
  protected serialize(tree: Root): string {
    return serializeToPlainText(tree)
  }

  /** Pseudocode is already plain text — return as-is. */
  renderPseudocode(plain: string): string {
    return plain ?? ''
  }
}
