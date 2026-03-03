import Link from 'next/link'
import { buildFilterUrl } from '@/lib/utils/filter-url'

interface FilterChipsProps {
  options: { value: string; label: string }[]
  paramName: string
  basePath: string
  currentParams: Record<string, string | undefined>
  /** Which value means "no filter". Defaults to first option's value. */
  defaultValue?: string
}

export function FilterChips({
  options,
  paramName,
  basePath,
  currentParams,
  defaultValue,
}: FilterChipsProps) {
  const noFilterValue = defaultValue ?? options[0]?.value ?? ''
  const activeValue = currentParams[paramName] ?? noFilterValue

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(({ value, label }) => {
        const isActive = activeValue === value
        // When selecting the "no filter" value, remove the param entirely
        const override = value === noFilterValue ? null : value
        const href = buildFilterUrl(basePath, currentParams, { [paramName]: override })

        return (
          <Link
            key={value}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-accent'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
