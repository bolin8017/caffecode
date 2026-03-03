import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root } from 'mdast'
import type { ContentFields, RenderedContent } from './types.js'

type MdastProcessor = ReturnType<typeof buildDefaultParser>

function buildDefaultParser() {
  return unified().use(remarkParse).use(remarkGfm)
}

/**
 * Abstract base renderer using the Template Method Pattern.
 *
 * renderMarkdown() is the template method: it defines the fixed algorithm
 *   parse (Markdown → mdast Root) → runSync (apply GFM transforms) → serialize
 *
 * Subclasses override the primitive operation serialize(tree) to produce
 * platform-specific output (Telegram HTML, plain text, etc.).
 *
 * To add a new platform: extend BaseRenderer and implement serialize().
 */
export abstract class BaseRenderer {
  private _parser?: MdastProcessor

  /** Hook: override to customise the unified parser pipeline. */
  protected buildParser(): MdastProcessor {
    return buildDefaultParser()
  }

  private get parser(): MdastProcessor {
    this._parser ??= this.buildParser()
    return this._parser
  }

  /**
   * Template Method — fixed algorithm:
   *   1. Parse Markdown → mdast Root
   *   2. runSync → apply transformer plugins (e.g. remark-gfm for tables/strikethrough)
   *   3. serialize (abstract, platform-specific)
   */
  renderMarkdown(md: string): string {
    if (!md?.trim()) return ''
    const parsed = this.parser.parse(md)
    const tree = this.parser.runSync(parsed) as Root
    return this.serialize(tree)
  }

  /**
   * Primitive Operation — subclasses must implement.
   * Receives a fully-transformed mdast Root and returns a platform string.
   */
  protected abstract serialize(tree: Root): string

  /**
   * Pseudocode is stored as plain text (no Markdown syntax).
   * Subclasses decide how to wrap it for their platform.
   */
  abstract renderPseudocode(plain: string): string

  /** Convenience: render all problem content fields at once. */
  renderContent(fields: ContentFields): RenderedContent {
    return {
      explanation: this.renderMarkdown(fields.explanation),
      complexity_analysis: this.renderMarkdown(fields.complexity_analysis),
      pseudocode: this.renderPseudocode(fields.pseudocode),
      alternative_approaches: this.renderMarkdown(fields.alternative_approaches),
      follow_up: this.renderMarkdown(fields.follow_up),
    }
  }
}
