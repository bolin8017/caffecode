/** Convert kebab-case topic slug to display label. e.g. 'dynamic-programming' -> 'Dynamic Programming' */
export function topicLabel(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Alias map: short/duplicate topic slugs -> canonical slug */
export const TOPIC_ALIASES: Record<string, string> = {
  'bfs': 'breadth-first-search',
  'dfs': 'depth-first-search',
  'heap': 'heap-priority-queue',
}

/** Kebab-case topic slug -> coffee variety name */
const VARIETY_MAP: Record<string, string> = {
  'array': 'Brazil Sundried',
  'string': 'Colombia Washed',
  'binary-search': 'Yirgacheffe',
  'tree': 'Kenya AA',
  'stack': 'Guatemala',
  'queue': 'Guatemala',
  'sliding-window': 'Panama',
  'dynamic-programming': 'Jamaica Blue Mountain',
  'graph': 'Geisha',
  'two-pointers': 'Guatemala Antigua',
  'hash-table': 'Sumatra',
  'heap-priority-queue': 'Ethiopia',
  'backtracking': 'Costa Rica',
  'greedy': 'Panama Honey',
  'linked-list': 'Rwanda',
  'depth-first-search': 'Tanzania',
  'breadth-first-search': 'Indonesia Mandheling',
  'math': 'Mexico',
  'bit-manipulation': 'Peru',
  'sorting': 'Hawaii Kona',
  'union-find': 'India Monsooned',
  'trie': 'Vietnam Robusta',
  'design': 'Espresso',
  'simulation': 'Cold Drip',
  'recursion': 'Turkish Coffee',
  'matrix': 'Mocha',
  'monotonic-stack': 'Cold Brew',
  'divide-and-conquer': 'Siphon',
  'prefix-sum': 'Flat White',
  'binary-tree': 'Kenya Peaberry',
  'binary-search-tree': 'Ethiopian Sidamo',
  'memoization': 'Lungo',
  'counting': 'Cortado',
  'topological-sort': 'Ristretto',
  'segment-tree': 'Macchiato',
  'shortest-path': 'Affogato',
  'monotonic-queue': 'Doppio',
  'ordered-set': 'Piccolo',
  'string-matching': 'Cappuccino',
  'combinatorics': 'Latte',
  'geometry': 'Americano',
  'game-theory': 'Irish Coffee',
  'interactive': 'Pour Over',
  'data-stream': 'Nitro Cold Brew',
  'bucket-sort': 'Vienna Coffee',
  'merge-sort': 'Frappe',
  'quickselect': 'Marocchino',
  'randomized': 'Cafe Bombon',
  'line-sweep': 'Galao',
  'doubly-linked-list': 'Cafe au Lait',
  'minimum-spanning-tree': 'Breve',
  'eulerian-circuit': 'Cafe Cubano',
  'hash-function': 'Mazagran',
  'counting-sort': 'Bicerin',
  'sieve-of-eratosthenes': 'Einspanner',
  'iterator': 'Wiener Melange',
  'binary-indexed-tree': 'Cafe de Olla',
}

const FALLBACK_VARIETY = 'Specialty'

export function topicToVariety(slug: string): string {
  return VARIETY_MAP[slug] ?? FALLBACK_VARIETY
}

interface TopicRow {
  topic: string
  solved_count: number
  total_received: number
}

/** Merge alias topics into canonical forms, summing counts. */
export function normalizeTopics(rows: TopicRow[]): TopicRow[] {
  const merged = new Map<string, TopicRow>()

  for (const row of rows) {
    const canonical = TOPIC_ALIASES[row.topic] ?? row.topic
    const existing = merged.get(canonical)
    if (existing) {
      existing.solved_count += row.solved_count
      existing.total_received += row.total_received
    } else {
      merged.set(canonical, { topic: canonical, solved_count: row.solved_count, total_received: row.total_received })
    }
  }

  return [...merged.values()].sort((a, b) => b.solved_count - a.solved_count || b.total_received - a.total_received)
}
