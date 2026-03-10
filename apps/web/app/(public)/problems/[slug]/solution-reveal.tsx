'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function SolutionReveal({ code }: { code: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setVisible(!visible)}
        aria-expanded={visible}
        aria-label={visible ? '隱藏解法' : '顯示完整解法'}
      >
        {visible ? '隱藏解法' : '顯示完整解法'}
      </Button>
      {visible && (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono leading-relaxed">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
