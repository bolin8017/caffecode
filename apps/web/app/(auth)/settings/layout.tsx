import { SettingsNav } from '@/components/settings-nav'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Mobile: nav renders as tabs above content */}
      {/* Desktop: nav renders as sidebar beside content */}
      <div className="flex flex-col md:flex-row md:gap-10">
        <SettingsNav />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
