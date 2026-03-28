# SEO Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add complete traditional SEO to all public CaffeCode pages: structured data, OG images, canonical URLs, manifest, and complete metadata.

**Architecture:** Pure metadata/Server Component additions. No client JS, no new runtime dependencies. JSON-LD via a shared JsonLd Server Component. Dynamic OG images via Next.js ImageResponse (built-in Satori). All changes scoped to apps/web/.

**Tech Stack:** Next.js 16 App Router metadata API, Satori/ImageResponse, schema.org JSON-LD

**Spec:** docs/superpowers/specs/2026-03-19-seo-enhancement-design.md

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `apps/web/app/manifest.ts` | Web app manifest (MetadataRoute) |
| `apps/web/components/seo/json-ld.tsx` | Shared JSON-LD script renderer (Server Component) |
| `apps/web/lib/seo/schemas.ts` | Schema.org object builders |
| `apps/web/app/(public)/problems/[slug]/opengraph-image.tsx` | Dynamic OG image for problem pages |
| `apps/web/public/og-default.png` | Static brand OG image (1200x630) |
| `apps/web/public/fonts/NotoSansTC-Bold.subset.woff` | Subsetted CJK font for Satori |
| `apps/web/__tests__/seo/schemas.test.ts` | Tests for schema helpers |
| `apps/web/__tests__/seo/json-ld.test.ts` | Tests for JsonLd component |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/app/layout.tsx` | Enhanced metadata + JsonLd (Organization, WebSite) |
| `apps/web/app/page.tsx` | Add canonical |
| `apps/web/app/login/page.tsx` | Strip suffix, add description + canonical |
| `apps/web/app/(public)/problems/page.tsx` | Strip suffix, add canonical |
| `apps/web/app/(public)/lists/page.tsx` | Strip suffix, add canonical |
| `apps/web/app/(public)/problems/[slug]/page.tsx` | Strip suffix, enhance metadata, add JsonLd |
| `apps/web/app/(public)/lists/[slug]/page.tsx` | Strip suffix, enhance metadata, add JsonLd |

---

### Task 1: JSON-LD Component + Schema Helpers

**Files:**
- Create: `apps/web/components/seo/json-ld.tsx`
- Create: `apps/web/lib/seo/schemas.ts`
- Create: `apps/web/__tests__/seo/schemas.test.ts`
- Create: `apps/web/__tests__/seo/json-ld.test.ts`

- [ ] **Step 1: Write tests for schema helpers**

Create `apps/web/__tests__/seo/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  organizationSchema,
  webSiteSchema,
  breadcrumbSchema,
  learningResourceSchema,
  itemListSchema,
} from '@/lib/seo/schemas'

describe('organizationSchema', () => {
  it('returns valid Organization schema', () => {
    const schema = organizationSchema()
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@type']).toBe('Organization')
    expect(schema.name).toBe('CaffeCode')
    expect(schema.url).toBe('https://caffecode.net')
    expect(schema.logo).toBe('https://caffecode.net/logo.png')
    expect(schema.sameAs).toContain('https://github.com/bolin8017/caffecode')
  })
})

describe('webSiteSchema', () => {
  it('returns valid WebSite schema with SearchAction', () => {
    const schema = webSiteSchema()
    expect(schema['@type']).toBe('WebSite')
    expect(schema.potentialAction['@type']).toBe('SearchAction')
    expect(schema.potentialAction.target).toContain('{search_term_string}')
  })
})

describe('breadcrumbSchema', () => {
  it('returns BreadcrumbList with correct positions', () => {
    const schema = breadcrumbSchema([
      { name: 'Home', url: 'https://caffecode.net' },
      { name: 'Problems', url: 'https://caffecode.net/problems' },
      { name: 'Two Sum', url: 'https://caffecode.net/problems/two-sum' },
    ])
    expect(schema['@type']).toBe('BreadcrumbList')
    expect(schema.itemListElement).toHaveLength(3)
    expect(schema.itemListElement[0].position).toBe(1)
    expect(schema.itemListElement[2].position).toBe(3)
    expect(schema.itemListElement[2].name).toBe('Two Sum')
  })
})

describe('learningResourceSchema', () => {
  it('maps Easy to Beginner', () => {
    const schema = learningResourceSchema({
      title: 'Two Sum', slug: 'two-sum',
      difficulty: 'Easy', topics: ['Array', 'Hash Table'],
    })
    expect(schema['@type']).toBe('LearningResource')
    expect(schema.educationalLevel).toBe('Beginner')
    expect(schema.keywords).toBe('Array, Hash Table')
  })

  it('maps Medium to Intermediate', () => {
    const schema = learningResourceSchema({
      title: 'LRU Cache', slug: 'lru-cache',
      difficulty: 'Medium', topics: ['Design'],
    })
    expect(schema.educationalLevel).toBe('Intermediate')
  })

  it('maps Hard to Advanced', () => {
    const schema = learningResourceSchema({
      title: 'Median', slug: 'median',
      difficulty: 'Hard', topics: ['Binary Search'],
    })
    expect(schema.educationalLevel).toBe('Advanced')
  })
})

describe('itemListSchema', () => {
  it('returns ItemList with numbered elements', () => {
    const schema = itemListSchema('Blind 75', [
      { title: 'Two Sum', slug: 'two-sum' },
      { title: 'Valid Parentheses', slug: 'valid-parentheses' },
    ])
    expect(schema['@type']).toBe('ItemList')
    expect(schema.name).toBe('Blind 75')
    expect(schema.numberOfItems).toBe(2)
    expect(schema.itemListElement[0].position).toBe(1)
    expect(schema.itemListElement[1].url).toBe(
      'https://caffecode.net/problems/valid-parentheses'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm exec vitest run __tests__/seo/schemas.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement schema helpers**

Create `apps/web/lib/seo/schemas.ts`:

```ts
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
```

- [ ] **Step 4: Run schema tests, verify pass**

Run: `cd apps/web && pnpm exec vitest run __tests__/seo/schemas.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Write tests for JsonLd component**

Create `apps/web/__tests__/seo/json-ld.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JsonLd } from '@/components/seo/json-ld'
import { createElement } from 'react'

describe('JsonLd', () => {
  it('renders script tag with application/ld+json type', () => {
    const data = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Test' }
    const html = renderToStaticMarkup(createElement(JsonLd, { data }))
    expect(html).toContain('type="application/ld+json"')
    expect(html).toContain('"@type":"Organization"')
    expect(html).toContain('"name":"Test"')
  })
})
```

- [ ] **Step 6: Implement JsonLd component**

Create `apps/web/components/seo/json-ld.tsx`:

```tsx
type JsonLdProps = { data: Record<string, unknown> }

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
```

Note: dangerouslySetInnerHTML is safe here. The data is always server-generated schema.org JSON from database content, never user input. This is the standard Next.js pattern for JSON-LD injection.

- [ ] **Step 7: Run JsonLd tests, verify pass**

Run: `cd apps/web && pnpm exec vitest run __tests__/seo/json-ld.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/seo/schemas.ts apps/web/components/seo/json-ld.tsx apps/web/__tests__/seo/
git commit -m "feat(web): add JSON-LD component and schema.org helpers"
```

---

### Task 2: Web App Manifest

**Files:**
- Create: `apps/web/app/manifest.ts`

- [ ] **Step 1: Create manifest.ts**

Create `apps/web/app/manifest.ts`:

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CaffeCode',
    short_name: 'CaffeCode',
    description: '每天一杯咖啡配一道題，把刷題變成習慣，輕鬆備好技術面試。',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a1a1a',
    icons: [
      { src: '/icon.png', sizes: '64x64', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && pnpm exec next build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/manifest.ts
git commit -m "feat(web): add web app manifest"
```

---

### Task 3: Root Metadata Enhancement + Global JSON-LD

**Files:**
- Modify: `apps/web/app/layout.tsx`

Current metadata (lines 24-27):
```ts
export const metadata: Metadata = {
  title: 'CaffeCode',
  description: '每天一杯咖啡配一道題，把刷題變成習慣，輕鬆備好技術面試。',
}
```

- [ ] **Step 1: Update root metadata**

Replace the metadata export with:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://caffecode.net'),
  title: {
    default: 'CaffeCode — 每天一杯咖啡配一道題',
    template: '%s — CaffeCode',
  },
  description: '每天一杯咖啡配一道題，把刷題變成習慣，輕鬆備好技術面試。瀏覽 810+ 道精選資料結構與演算法題目，含 AI 解題說明。',
  openGraph: {
    type: 'website',
    siteName: 'CaffeCode',
    locale: 'zh_TW',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'CaffeCode' }],
  },
  twitter: {
    card: 'summary_large_image',
  },
}
```

- [ ] **Step 2: Add JSON-LD imports**

Add at top of file:
```ts
import { JsonLd } from '@/components/seo/json-ld'
import { organizationSchema, webSiteSchema } from '@/lib/seo/schemas'
```

- [ ] **Step 3: Add JSON-LD to body**

Inside the `<body>` tag, before `<PostHogProvider>`, add:
```tsx
<JsonLd data={organizationSchema()} />
<JsonLd data={webSiteSchema()} />
```

Note: JSON-LD `<script>` tags in `<body>` is intentional and supported by Google. Next.js App Router renders `<head>` from metadata exports; manual `<script>` injection in `<head>` is not needed.

- [ ] **Step 4: Verify build**

Run: `cd apps/web && pnpm exec next build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): enhance root metadata with OG, Twitter Card, and JSON-LD"
```

---

### Task 4: Strip Title Suffixes + Add Canonical on Static Pages

**Files:**
- Modify: `apps/web/app/page.tsx` (add canonical only, uses root default title)
- Modify: `apps/web/app/login/page.tsx` (strip suffix, add description + canonical)
- Modify: `apps/web/app/(public)/problems/page.tsx` (strip suffix, add canonical)
- Modify: `apps/web/app/(public)/lists/page.tsx` (strip suffix, add canonical)

- [ ] **Step 1: Add canonical to home page**

In `apps/web/app/page.tsx`:
1. Add `import type { Metadata } from 'next'` with the other imports (after line 4)
2. Add the metadata export after the `revalidate` line:

```ts
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}
```

- [ ] **Step 2: Fix login page metadata**

In `apps/web/app/login/page.tsx`:
1. Add `import type { Metadata } from 'next'` with the other imports (after line 3)
2. Replace the metadata export (lines 5-7):

Old:
```ts
export const metadata = {
  title: '登入 — CaffeCode',
}
```

New:
```ts
export const metadata: Metadata = {
  title: '登入',
  description: '登入 CaffeCode，開始你的刷題之旅。',
  alternates: { canonical: '/login' },
}
```

- [ ] **Step 3: Fix problems list page metadata**

In `apps/web/app/(public)/problems/page.tsx`, replace lines 12-15:

Old:
```ts
export const metadata: Metadata = {
  title: '題庫 — CaffeCode',
  description: '瀏覽所有資料結構與演算法題目，含 AI 解題說明',
}
```

New:
```ts
export const metadata: Metadata = {
  title: '題庫',
  description: '瀏覽所有資料結構與演算法題目，含 AI 解題說明',
  alternates: { canonical: '/problems' },
}
```

- [ ] **Step 4: Fix lists page metadata**

In `apps/web/app/(public)/lists/page.tsx`, replace lines 10-13:

Old:
```ts
export const metadata: Metadata = {
  title: '學習清單 — CaffeCode',
  description: '45 份精選刷題清單，涵蓋演算法、資料結構與各大廠面試高頻題型',
}
```

New:
```ts
export const metadata: Metadata = {
  title: '學習清單',
  description: '45 份精選刷題清單，涵蓋演算法、資料結構與各大廠面試高頻題型',
  alternates: { canonical: '/lists' },
}
```

- [ ] **Step 5: Verify build**

Run: `cd apps/web && pnpm exec next build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/login/page.tsx \
  "apps/web/app/(public)/problems/page.tsx" \
  "apps/web/app/(public)/lists/page.tsx"
git commit -m "feat(web): add canonical URLs and strip title suffixes on static pages"
```

---

### Task 5: Enhance Dynamic Page Metadata + JSON-LD (Problems)

**Files:**
- Modify: `apps/web/app/(public)/problems/[slug]/page.tsx`

- [ ] **Step 1: Add JSON-LD imports**

Add at top of file:
```ts
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbSchema, learningResourceSchema } from '@/lib/seo/schemas'
```

- [ ] **Step 2: Update generateMetadata**

Replace the generateMetadata function (lines 48-62):

Old:
```ts
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const data = await getProblemBySlug(slug)

  if (!data) return { title: '找不到題目 — CaffeCode' }

  return {
    title: `${data.title} — CaffeCode`,
    description: `${data.difficulty} | ${(data.topics as string[]).slice(0, 3).join(', ')}`,
    openGraph: {
      title: data.title,
      description: `${data.difficulty} — 含 AI 解題說明`,
    },
  }
}
```

New:
```ts
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const data = await getProblemBySlug(slug)

  if (!data) return { title: '找不到題目' }

  const topics = data.topics as string[]
  return {
    title: data.title,
    description: `${data.difficulty} 難度 — ${topics.slice(0, 5).join('、')}。含 AI 解題說明、複雜度分析與替代解法。`,
    alternates: { canonical: `/problems/${slug}` },
    openGraph: {
      title: data.title,
      description: `${data.difficulty} — ${topics.slice(0, 3).join(', ')}`,
    },
  }
}
```

- [ ] **Step 3: Add JSON-LD to page component**

In the ProblemPage component, inside `<main>` right after the opening tag (after line 115's closing `>`), before the `{/* Header */}` comment (line 116), add:

```tsx
<JsonLd data={learningResourceSchema({
  title: problem.title,
  slug: problem.slug,
  difficulty: problem.difficulty,
  topics: problem.topics as string[],
  description: `${problem.difficulty} 難度 — ${(problem.topics as string[]).slice(0, 5).join('、')}`,
})} />
<JsonLd data={breadcrumbSchema([
  { name: '首頁', url: 'https://caffecode.net' },
  { name: '題庫', url: 'https://caffecode.net/problems' },
  { name: problem.title, url: `https://caffecode.net/problems/${problem.slug}` },
])} />
```

- [ ] **Step 4: Run existing tests**

Run: `cd apps/web && pnpm exec vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(public)/problems/[slug]/page.tsx"
git commit -m "feat(web): add structured data and enhanced metadata to problem pages"
```

---

### Task 6: Enhance Dynamic Page Metadata + JSON-LD (Lists)

**Files:**
- Modify: `apps/web/app/(public)/lists/[slug]/page.tsx`

- [ ] **Step 1: Add JSON-LD imports**

Add at top of file:
```ts
import { JsonLd } from '@/components/seo/json-ld'
import { breadcrumbSchema, itemListSchema } from '@/lib/seo/schemas'
```

- [ ] **Step 2: Update generateMetadata**

Replace the generateMetadata function (lines 34-44):

Old:
```ts
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const list = await getListBySlug(slug)

  if (!list) return { title: '找不到清單 — CaffeCode' }

  return {
    title: `${list.name} — CaffeCode`,
    description: list.description ?? `${list.problem_count} 道精選題目`,
  }
}
```

New:
```ts
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const list = await getListBySlug(slug)

  if (!list) return { title: '找不到清單' }

  return {
    title: list.name,
    description: list.description ?? `${list.name} — 包含 ${list.problem_count} 道題目的精選刷題清單。`,
    alternates: { canonical: `/lists/${slug}` },
  }
}
```

- [ ] **Step 3: Add JSON-LD to page component**

In the ListDetailPage component, inside `<main>` right after the opening tag (line 96), before the `{/* Header */}` comment (line 97), add:

```tsx
<JsonLd data={itemListSchema(
  list.name,
  (listProblems ?? [])
    .map(lp => lp.problems as unknown as { title: string; slug: string } | null)
    .filter((p): p is { title: string; slug: string } => p != null)
)} />
<JsonLd data={breadcrumbSchema([
  { name: '首頁', url: 'https://caffecode.net' },
  { name: '學習清單', url: 'https://caffecode.net/lists' },
  { name: list.name, url: `https://caffecode.net/lists/${list.slug}` },
])} />
```

- [ ] **Step 4: Run existing tests**

Run: `cd apps/web && pnpm exec vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(public)/lists/[slug]/page.tsx"
git commit -m "feat(web): add structured data and enhanced metadata to list pages"
```

---

### Task 7: Static OG Image

**Files:**
- Create: `apps/web/public/og-default.png`

- [ ] **Step 1: Generate static OG image**

Use sharp to create a 1200x630 branded image:

```bash
cd apps/web && node -e "
const sharp = require('sharp');
const svgContent = \`
<svg width='1200' height='630' xmlns='http://www.w3.org/2000/svg'>
  <rect width='1200' height='630' fill='#1a1a1a'/>
  <text x='600' y='260' text-anchor='middle' fill='#ffffff'
    font-size='64' font-weight='bold' font-family='sans-serif'>
    CaffeCode
  </text>
  <text x='600' y='340' text-anchor='middle' fill='#a1a1aa'
    font-size='28' font-family='sans-serif'>
    每天一杯咖啡配一道題
  </text>
  <text x='600' y='400' text-anchor='middle' fill='#71717a'
    font-size='20' font-family='sans-serif'>
    caffecode.net
  </text>
</svg>\`;
sharp(Buffer.from(svgContent)).resize(1200, 630).png().toFile('public/og-default.png')
  .then(() => console.log('Generated og-default.png'));
"
```

Note: CJK text may not render in SVG without system fonts. If the output lacks Chinese text, replace the Chinese line with English or use a pre-designed PNG. The key requirement is 1200x630 with dark branding.

- [ ] **Step 2: Verify file**

Run: `file apps/web/public/og-default.png && ls -lh apps/web/public/og-default.png`
Expected: PNG image data, 1200 x 630

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/og-default.png
git commit -m "feat(web): add static brand OG image"
```

---

### Task 8: Font File for Dynamic OG Images

**Files:**
- Create: `apps/web/public/fonts/NotoSansTC-Bold.subset.woff`

- [ ] **Step 1: Create fonts directory and download font**

```bash
mkdir -p apps/web/public/fonts
```

Option A (if pyftsubset available):
```bash
pip3 install fonttools brotli
curl -L -o /tmp/NotoSansTC-Bold.ttf \
  "https://github.com/google/fonts/raw/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf"
pyftsubset /tmp/NotoSansTC-Bold.ttf \
  --output-file=apps/web/public/fonts/NotoSansTC-Bold.subset.woff \
  --flavor=woff \
  --unicodes="U+0000-007F,U+2000-206F,U+3000-303F,U+4E00-9FFF,U+FF00-FFEF" \
  --layout-features="" --no-hinting
```

Option B (download pre-built subset from Google Fonts CDN):
```bash
curl -L -o apps/web/public/fonts/NotoSansTC-Bold.subset.woff \
  "https://fonts.gstatic.com/s/notosanstc/v36/-nFkOG829Oofr2wohFbTp9i9kwMvDQ.woff"
```

- [ ] **Step 2: Verify font file**

Run: `ls -lh apps/web/public/fonts/NotoSansTC-Bold.subset.woff`
Expected: File exists (ideally under 2MB)

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/fonts/
git commit -m "feat(web): add subsetted Noto Sans TC font for OG image generation"
```

---

### Task 9: Dynamic OG Image for Problem Pages

**Files:**
- Create: `apps/web/app/(public)/problems/[slug]/opengraph-image.tsx`

- [ ] **Step 1: Create opengraph-image.tsx**

Create `apps/web/app/(public)/problems/[slug]/opengraph-image.tsx`:

```tsx
import { ImageResponse } from 'next/og'
import { createServiceClient } from '@/lib/supabase/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'
export const alt = 'CaffeCode Problem'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#10b981',
  Medium: '#f59e0b',
  Hard: '#ef4444',
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('problems')
    .select('title, difficulty, topics')
    .eq('slug', slug)
    .single()

  // Fallback for missing problem
  if (!data) {
    return new ImageResponse(
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%',
        backgroundColor: '#1a1a1a', color: '#fff', fontSize: 48,
      }}>
        CaffeCode
      </div>,
      { ...size }
    )
  }

  const topics = (data.topics as string[]).slice(0, 4)
  const diffColor = DIFFICULTY_COLORS[data.difficulty] ?? '#a1a1aa'

  // Load font from filesystem (Node.js runtime)
  let fontData: ArrayBuffer | null = null
  try {
    const fontPath = join(process.cwd(), 'public/fonts/NotoSansTC-Bold.subset.woff')
    const buffer = await readFile(fontPath)
    fontData = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  } catch {
    // Font load failed; Satori will use fallback
  }

  const fonts = fontData
    ? [{ name: 'NotoSansTC', data: fontData, style: 'normal' as const, weight: 700 as const }]
    : []

  return new ImageResponse(
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%',
      backgroundColor: '#1a1a1a', padding: '60px 80px',
      fontFamily: 'NotoSansTC, sans-serif',
    }}>
      {/* Top: Logo text */}
      <div style={{ display: 'flex', color: '#a1a1aa', fontSize: 24 }}>
        CaffeCode
      </div>

      {/* Center: Title */}
      <div style={{
        display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex', fontSize: 52, fontWeight: 700,
          color: '#ffffff', lineHeight: 1.3, maxWidth: '900px',
        }}>
          {data.title}
        </div>

        {/* Difficulty + Topics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
          <div style={{
            display: 'flex', padding: '6px 16px', borderRadius: '9999px',
            backgroundColor: diffColor, color: '#fff', fontSize: 20, fontWeight: 700,
          }}>
            {data.difficulty}
          </div>
          {topics.map((t) => (
            <div key={t} style={{
              display: 'flex', padding: '6px 16px', borderRadius: '9999px',
              backgroundColor: '#27272a', color: '#d4d4d8', fontSize: 18,
            }}>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: URL */}
      <div style={{ display: 'flex', color: '#71717a', fontSize: 20 }}>
        caffecode.net
      </div>
    </div>,
    { ...size, fonts },
  )
}
```

Key implementation notes:
- Uses `readFile` from `node:fs/promises` to load font from filesystem (Node.js runtime only)
- Gracefully degrades if font file is missing (Satori uses system fallback)
- Each problem page auto-generates a unique OG image with title, difficulty badge, and topic tags

- [ ] **Step 2: Verify build**

Run: `cd apps/web && pnpm exec next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(public)/problems/[slug]/opengraph-image.tsx"
git commit -m "feat(web): add dynamic OG image generation for problem pages"
```

---

### Task 10: Full Verification

- [ ] **Step 1: Run all vitest tests**

Run: `cd apps/web && pnpm exec vitest run`
Expected: All tests pass (existing + new SEO tests)

- [ ] **Step 2: Run full build**

Run: `cd apps/web && pnpm exec next build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run lint**

Run: `cd apps/web && pnpm exec next lint`
Expected: No new lint errors

- [ ] **Step 4: Fix any issues and commit if needed**

---

### Task 11: Update Documentation

- [ ] **Step 1: Update .claude/rules/web-patterns.md**

In the Key Files section of `.claude/rules/web-patterns.md`, add under the existing sections:
```
**SEO**:
- `components/seo/json-ld.tsx` — Shared JSON-LD script renderer (Server Component)
- `lib/seo/schemas.ts` — Schema.org helpers (Organization, WebSite, BreadcrumbList, LearningResource, ItemList)
- `app/(public)/problems/[slug]/opengraph-image.tsx` — Dynamic OG image (Node.js runtime, Satori)
```

- [ ] **Step 2: Update CLAUDE.md test counts**

Update the test count in CLAUDE.md to reflect the new SEO tests (add ~8 to the web total).

- [ ] **Step 3: Update README.md if needed**

If README describes features, add a line about SEO / structured data.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .claude/rules/web-patterns.md README.md
git commit -m "docs: update project notes for SEO infrastructure"
```
