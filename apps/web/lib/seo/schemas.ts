const BASE_URL = 'https://caffecode.net'

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CaffeCode',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    sameAs: [
      'https://github.com/bolin8017/caffecode',
      'https://t.me/CaffeCodeBot',
    ],
  }
}

export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CaffeCode',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/problems?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function learningResourceSchema(problem: {
  title: string
  slug: string
  difficulty: string
  topics: string[]
  description?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: problem.title,
    url: `${BASE_URL}/problems/${problem.slug}`,
    description: problem.description,
    educationalLevel: difficultyToLevel(problem.difficulty),
    keywords: problem.topics.join(', '),
    provider: {
      '@type': 'Organization',
      name: 'CaffeCode',
      url: BASE_URL,
    },
  }
}

function difficultyToLevel(d: string): string {
  switch (d) {
    case 'Easy': return 'Beginner'
    case 'Medium': return 'Intermediate'
    case 'Hard': return 'Advanced'
    default: return 'Intermediate'
  }
}

export function itemListSchema(
  listName: string,
  problems: { title: string; slug: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: problems.length,
    itemListElement: problems.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.title,
      url: `${BASE_URL}/problems/${p.slug}`,
    })),
  }
}
