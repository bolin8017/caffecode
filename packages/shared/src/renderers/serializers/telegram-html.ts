import type {
  Root,
  RootContent,
  PhrasingContent,
  Paragraph,
  Heading,
  Text,
  Strong,
  Emphasis,
  InlineCode,
  Code,
  List,
  ListItem,
  Link,
  Blockquote,
  Table,
  TableRow,
  TableCell,
} from 'mdast'

/**
 * Escape characters that Telegram HTML mode does not allow unescaped.
 * Must be applied to all text content (but NOT to the HTML tags themselves).
 */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function serializePhrasingContent(node: PhrasingContent): string {
  switch (node.type) {
    case 'text':
      return esc((node as Text).value)
    case 'strong':
      return `<b>${(node as Strong).children.map(serializePhrasingContent).join('')}</b>`
    case 'emphasis':
      return `<i>${(node as Emphasis).children.map(serializePhrasingContent).join('')}</i>`
    case 'inlineCode':
      return `<code>${esc((node as InlineCode).value)}</code>`
    case 'link': {
      const link = node as Link
      const label = link.children.map(serializePhrasingContent).join('')
      return `<a href="${link.url}">${label}</a>`
    }
    case 'break':
      return '\n'
    default: {
      // Fallback: recurse if it has children, otherwise empty
      const n = node as { children?: PhrasingContent[] }
      return n.children ? n.children.map(serializePhrasingContent).join('') : ''
    }
  }
}

function serializeListItem(item: ListItem, ordered: boolean, index: number): string {
  const prefix = ordered ? `${index + 1}. ` : '• '
  const content = item.children
    .map((child) => {
      if (child.type === 'list') {
        return '\n  ' + serializeBlock(child as RootContent).split('\n').join('\n  ')
      }
      return serializeBlock(child as RootContent)
    })
    .join('')
  return prefix + content
}

function serializeBlock(node: RootContent): string {
  switch (node.type) {
    case 'paragraph':
      return (node as Paragraph).children.map(serializePhrasingContent).join('')

    case 'heading':
      // Telegram has no heading tags — render as bold
      return `<b>${(node as Heading).children.map(serializePhrasingContent).join('')}</b>`

    case 'code':
      return `<pre><code>${esc((node as Code).value)}</code></pre>`

    case 'list': {
      const list = node as List
      return list.children
        .map((item, i) => serializeListItem(item as ListItem, !!list.ordered, i))
        .join('\n')
    }

    case 'blockquote':
      return (node as Blockquote).children
        .map((child) => serializeBlock(child as RootContent))
        .join('\n')

    case 'thematicBreak':
      return '─────────────────'

    // GFM table: flatten rows with pipe separators
    case 'table': {
      const table = node as Table
      return table.children
        .map((row) =>
          (row as TableRow).children
            .map((cell) =>
              (cell as TableCell).children.map(serializePhrasingContent).join('')
            )
            .join(' | ')
        )
        .join('\n')
    }

    default: {
      const n = node as { children?: RootContent[] }
      return n.children ? n.children.map(serializeBlock).join('') : ''
    }
  }
}

/**
 * Serializes a fully-transformed mdast Root into a Telegram HTML string.
 * Telegram HTML mode supports: <b> <i> <u> <s> <code> <pre> <a>
 */
export function serializeToTelegramHtml(tree: Root): string {
  return tree.children.map(serializeBlock).join('\n\n').trim()
}
