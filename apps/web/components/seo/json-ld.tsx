type JsonLdProps = { data: Record<string, unknown> }

// dangerouslySetInnerHTML is safe here — data is always server-generated
// schema.org JSON, never user input.
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
