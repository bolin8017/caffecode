# SEO Enhancement Design — CaffeCode

**Date**: 2026-03-19
**Status**: Approved
**Scope**: Traditional SEO hardening for all public pages

## Context

CaffeCode is a coding-interview prep platform with 810 curated problems across 45 lists. The site is server-rendered (Next.js 16 App Router on Vercel) with public pages at `/problems`, `/lists`, and their dynamic slugs. Current SEO coverage is minimal: basic title metadata on some pages, a dynamic sitemap, and robots.txt. Missing: favicons, structured data, OG images, canonical URLs, and complete meta descriptions.

## Goals

1. Improve search result appearance (rich snippets, OG previews)
2. Ensure all public pages are correctly indexed with canonical URLs
3. Complete basic web infrastructure (favicon, manifest, icons)

## Non-Goals

- RSS feed (content is static, low ROI)
- Multi-language / hreflang (site is zh-Hant only)
- FAQ or Course structured data (doesn't match content model)
- PWA offline support (manifest is for icons/theme only)

---

## 1. Favicon / Manifest / Icons

### Existing Icons

The project already has:
- `app/icon.png` (64x64) — Next.js file-convention favicon (keep as-is)
- `app/apple-icon.png` (180x180) — iOS bookmark icon (keep as-is)

### Files to Create

| File | Purpose |
|------|---------|
| `app/manifest.ts` | Web app manifest (MetadataRoute.Manifest) |

### Manifest Content

```ts
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

No icon generation script needed — existing icons are sufficient.

---

## 2. Root Metadata Enhancement

### File: `app/layout.tsx`

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
// Note: canonical is NOT set at root level — each page sets its own
```

Key decisions:
- `metadataBase` enables relative URL resolution everywhere
- `title.template` auto-appends brand suffix to child page titles
- **IMPORTANT**: All existing child pages currently append ` — CaffeCode` manually in their title strings. These suffixes must ALL be stripped (e.g., `'題庫 — CaffeCode'` → `'題庫'`), because `title.template` now handles the suffix automatically. Failing to strip will produce double suffixes like `題庫 — CaffeCode — CaffeCode`.
- OG/Twitter inherit from root unless overridden
- Do NOT set `alternates.canonical` at root level (it would propagate `/` as canonical to all children). Each page sets its own canonical explicitly.

---

## 3. Per-Page Metadata Completion

### Static Pages

All existing ` — CaffeCode` suffixes must be stripped from title strings (template handles it).

| Route | title (after stripping suffix) | description | canonical |
|-------|-------------------------------|-------------|-----------|
| `/` | (default from root) | (from root) | `/` |
| `/login` | `登入` | `登入 CaffeCode，開始你的刷題之旅。` (new) | `/login` |
| `/problems` | `題庫` | (already exists) | `/problems` |
| `/lists` | `學習清單` | (already exists) | `/lists` |

### Dynamic Pages: `/problems/[slug]`

```ts
return {
  title: problem.title,
  description: `${difficulty} 難度 — ${topics.join('、')}。含 AI 解題說明、複雜度分析與替代解法。`,
  alternates: { canonical: `/problems/${slug}` },
}
```

### Dynamic Pages: `/lists/[slug]`

```ts
return {
  title: list.name,
  description: list.description || `${list.name} — 包含 ${problemCount} 道題目的精選刷題清單。`,
  alternates: { canonical: `/lists/${slug}` },
}
```

### Auth-Protected Pages

Pages behind authentication (`/dashboard`, `/settings`, `/settings/*`, `/onboarding`, `/garden`) are all disallowed by `robots.ts` — no SEO changes needed.

Note: `/login` is NOT disallowed by robots.ts (it is a public entry point) and IS covered above.

---

## 4. JSON-LD Structured Data

### Shared Component: `components/seo/json-ld.tsx`

Server Component rendering `<script type="application/ld+json">`. Zero client JS. The data is always server-generated schema.org JSON from trusted sources (database content), never user input.

### Schema Helpers: `lib/seo/schemas.ts`

#### Organization + WebSite (root layout)

- Organization: name, url, logo, sameAs (GitHub, Telegram)
- WebSite: name, url, SearchAction targeting `/problems?q={search_term_string}` (enables sitelinks search box)

#### BreadcrumbList (problem and list pages)

- Problem pages: Home > Problem Library > Problem Title
- List pages: Home > Curated Lists > List Name

#### LearningResource (problem pages)

- name, url, description, educationalLevel (Easy=Beginner, Medium=Intermediate, Hard=Advanced), keywords (topics), provider (Organization ref)

#### ItemList (list pages)

- name, numberOfItems, itemListElement (links to each problem page)

### Injection Points

| Page | Schemas |
|------|---------|
| Root layout | Organization, WebSite |
| `/problems/[slug]` | LearningResource, BreadcrumbList |
| `/lists/[slug]` | ItemList, BreadcrumbList |

---

## 5. OG Images

### Static OG Image

- File: `public/og-default.png` (1200x630)
- Content: Dark background (#1a1a1a) + CaffeCode logo + slogan text
- Generated once via script
- Used by root metadata for all pages without custom OG image

### Dynamic OG Images (Problem Pages)

- File: `app/(public)/problems/[slug]/opengraph-image.tsx`
- Uses Next.js `ImageResponse` (built-in Satori)
- Layout: CaffeCode logo (top) + problem title (center, Noto Sans TC) + difficulty badge (green/yellow/red) + topic tags (max 4) + `caffecode.net` (bottom)
- Background: Dark (#1a1a1a) with subtle gradient

### Font Files

- `public/fonts/NotoSansTC-Bold.subset.woff` — subsetted to ~2000 most common CJK characters + Latin glyphs (target: <1MB, vs 4-8MB for full font)
- Satori requires font files loaded at runtime (no CSS font-face)
- Subset generated once via `pyftsubset` or `fonttools` from the full Noto Sans TC Bold

### Runtime

- `opengraph-image.tsx` runs on **Node.js runtime** (not Edge) — CJK font files are too large for Edge Runtime cold starts
- Export `runtime = 'nodejs'` in the route segment

### Size and Export

- All OG images: 1200x630px
- `opengraph-image.tsx` exports `size`, `contentType`, `alt`, and `runtime`

---

## 6. Canonical URL Strategy

All public pages declare canonical URL via `alternates.canonical` in metadata.

- `metadataBase` resolves relative canonicals to absolute URLs
- Static pages: hardcoded relative path (e.g., `/problems`)
- Dynamic pages: computed in `generateMetadata` (e.g., `/problems/${slug}`)
- Auth pages: no canonical (disallowed by robots.ts)

Prevents Google from indexing `caffecode.vercel.app` or query-string variants as separate pages.

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `app/manifest.ts` | Web app manifest |
| `components/seo/json-ld.tsx` | Shared JSON-LD renderer component |
| `lib/seo/schemas.ts` | Schema.org helper functions |
| `app/(public)/problems/[slug]/opengraph-image.tsx` | Dynamic OG image for problems |
| `public/og-default.png` | Static brand OG image |
| `public/fonts/NotoSansTC-Bold.subset.woff` | Subsetted CJK font for OG image generation |

### Modified Files

| File | Changes |
|------|---------|
| `app/layout.tsx` | Enhanced metadata export + Organization/WebSite JSON-LD |
| `app/page.tsx` | Add canonical |
| `app/login/page.tsx` | Strip title suffix, add description + canonical |
| `app/(public)/problems/page.tsx` | Strip title suffix, add canonical |
| `app/(public)/lists/page.tsx` | Strip title suffix, add canonical |
| `app/(public)/problems/[slug]/page.tsx` | Strip title suffix, enhance generateMetadata + JSON-LD |
| `app/(public)/lists/[slug]/page.tsx` | Strip title suffix, enhance generateMetadata + JSON-LD |

### No Changes

- `app/icon.png` — existing favicon, keep as-is
- `app/apple-icon.png` — existing iOS icon, keep as-is
- `robots.ts` — already correct
- `sitemap.ts` — already comprehensive
- Auth-protected pages — not indexed
- `next.config.ts` — no SEO config needed

### Validation (post-deploy)

- Google Rich Results Test: validate JSON-LD on problem and list pages
- Facebook Sharing Debugger: verify OG images render correctly
- Schema.org Validator: confirm structured data is well-formed
- Check browser tab for favicon, iOS bookmark for apple icon
