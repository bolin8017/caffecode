import Link from 'next/link'
import { buildFilterUrl } from '@/lib/utils/filter-url'

interface SearchInputProps {
  paramName?: string
  placeholder?: string
  basePath: string
  currentParams: Record<string, string | undefined>
}

export function SearchInput({
  paramName = 'q',
  placeholder = '搜尋...',
  basePath,
  currentParams,
}: SearchInputProps) {
  const value = currentParams[paramName] ?? ''

  // Hidden inputs to preserve other params on form submit
  const hiddenParams = Object.entries(currentParams).filter(
    ([k, v]) => k !== paramName && k !== 'page' && v !== undefined,
  )

  const clearHref = buildFilterUrl(basePath, currentParams, { [paramName]: null })

  return (
    <form className="flex items-center gap-2">
      {hiddenParams.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor={paramName} className="sr-only">
        {placeholder}
      </label>
      <input
        id={paramName}
        aria-label={placeholder}
        name={paramName}
        defaultValue={value}
        placeholder={placeholder}
        className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <button
        type="submit"
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
      >
        搜尋
      </button>
      {value && (
        <Link
          href={clearHref}
          className="h-9 rounded-md border border-input px-3 text-sm font-medium flex items-center hover:bg-muted"
        >
          清除
        </Link>
      )}
    </form>
  )
}
