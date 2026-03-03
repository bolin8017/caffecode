import type { Root } from 'mdast'
import { BaseRenderer } from './base-renderer.js'
import { serializeToTelegramHtml } from './serializers/telegram-html.js'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Renders Markdown content as Telegram-compatible HTML.
 *
 * Telegram HTML mode supports a strict subset of HTML:
 *   <b>, <i>, <u>, <s>, <code>, <pre>, <a>, <tg-spoiler>
 * All other tags and bare < > & must be escaped.
 */
export class TelegramHtmlRenderer extends BaseRenderer {
  protected serialize(tree: Root): string {
    return serializeToTelegramHtml(tree)
  }

  /** Wraps plain pseudocode in <pre> with HTML-escaped content. */
  renderPseudocode(plain: string): string {
    if (!plain?.trim()) return ''
    return `<pre>${escapeHtml(plain)}</pre>`
  }
}
