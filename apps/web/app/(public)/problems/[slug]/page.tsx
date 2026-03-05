import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import remarkGfm from 'remark-gfm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SolutionReveal } from './solution-reveal'
import { createClient } from '@/lib/supabase/server'
import { FeedbackWidget } from './feedback-widget'
import { SolveButton } from './solve-button'

export const revalidate = 3600
export const dynamicParams = true

const ReactMarkdown = dynamic(() => import('react-markdown'))

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  Medium: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  Hard: 'bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('problems')
    .select('title, difficulty, topics')
    .eq('slug', slug)
    .single()

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

export default async function ProblemPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: problem } = await supabase
    .from('problems')
    .select(`
      id, leetcode_id, title, slug, difficulty, rating, topics,
      problem_content (
        explanation, solution_code, complexity_analysis,
        pseudocode, alternative_approaches, follow_up
      )
    `)
    .eq('slug', slug)
    .single()

  if (!problem) notFound()

  // PostgREST returns 1:1 FK as object, but guard for both shapes
  const content = Array.isArray(problem.problem_content)
    ? problem.problem_content[0]
    : problem.problem_content

  if (!content) notFound()

  // Check auth + fetch existing feedback for logged-in users
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()

  let existingFeedback: { content_score: number | null; difficulty: string | null } | null = null
  let historyEntry: { solved_at: string | null; sent_at: string } | null = null

  if (user) {
    const [{ data: feedbackData }, { data: histData }] = await Promise.all([
      userSupabase
        .from('feedback')
        .select('content_score, difficulty')
        .eq('user_id', user.id)
        .eq('problem_id', problem.id)
        .maybeSingle(),
      userSupabase
        .from('history')
        .select('solved_at, sent_at')
        .eq('user_id', user.id)
        .eq('problem_id', problem.id)
        .maybeSingle(),
    ])
    existingFeedback = feedbackData
    historyEntry = histData ?? null
  }

  const topics = problem.topics as string[]

  const VALID_DIFFICULTIES = ['too_easy', 'just_right', 'too_hard'] as const
  type ValidDifficulty = typeof VALID_DIFFICULTIES[number]
  const safeDifficulty = VALID_DIFFICULTIES.includes(existingFeedback?.difficulty as ValidDifficulty)
    ? (existingFeedback!.difficulty as ValidDifficulty)
    : undefined

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[problem.difficulty] ?? ''}`}
          >
            {problem.difficulty}
          </span>
          {problem.rating && (
            <span className="text-xs text-muted-foreground">Rating {problem.rating}</span>
          )}
        </div>
        <h1 className="text-3xl font-bold">
          {problem.leetcode_id}. {problem.title}
        </h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`https://leetcode.com/problems/${slug}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              在 LeetCode 上作答 ↗
            </Link>
          </Button>
        </div>
      </div>

      <hr className="my-6" />

      {/* Explanation */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">解題說明</h2>
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content.explanation}
          </ReactMarkdown>
        </div>
      </section>

      {/* Solution (collapsible) */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">C++ 解法</h2>
        <SolutionReveal code={content.solution_code} />
      </section>

      {/* Complexity */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">複雜度分析</h2>
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content.complexity_analysis}
          </ReactMarkdown>
        </div>
      </section>

      {/* Optional sections */}
      {content.pseudocode && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">虛擬碼</h2>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm font-mono leading-relaxed">
            {content.pseudocode}
          </pre>
        </section>
      )}

      {content.alternative_approaches && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">其他解法</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content.alternative_approaches}
            </ReactMarkdown>
          </div>
        </section>
      )}

      {content.follow_up && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">延伸思考</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content.follow_up}
            </ReactMarkdown>
          </div>
        </section>
      )}

      {/* Feedback */}
      {user && (
        <section className="mb-8">
          <FeedbackWidget
            problemId={problem.id}
            initialScore={existingFeedback?.content_score ?? undefined}
            initialDifficulty={safeDifficulty}
          />
        </section>
      )}

      {/* Solve button — only shown when this problem was pushed to the user */}
      {user && historyEntry && (
        <section className="mb-8">
          <SolveButton
            problemId={problem.id}
            initialSolvedAt={historyEntry.solved_at}
            sentAt={historyEntry.sent_at}
          />
        </section>
      )}
    </main>
  )
}
