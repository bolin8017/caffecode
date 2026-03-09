import type { SupabaseClient } from '@supabase/supabase-js'
import { evaluateBadgeCondition } from '@caffecode/shared'
import type { BadgeRequirement, UserBadgeContext } from '@caffecode/shared'
import { logger } from '@/lib/logger'

export interface Badge {
  id: number
  slug: string
  name: string
  icon: string
  category: string
}

export async function checkAndAwardBadges(
  supabase: SupabaseClient,
  userId: string,
  ctx: UserBadgeContext
): Promise<Badge[]> {
  // 1. Get all badges the user does NOT yet have
  const { data: allBadges, error: badgeErr } = await supabase
    .from('badges')
    .select('id, slug, name, icon, category, requirement')

  if (badgeErr || !allBadges) return []

  const { data: earned, error: earnedErr } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId)

  if (earnedErr) return []

  const earnedIds = new Set((earned ?? []).map(e => e.badge_id))
  const unearned = allBadges.filter(b => !earnedIds.has(b.id))

  // 2. Check each unearned badge and batch-insert all that qualify
  const toAward = unearned
    .filter(badge => evaluateBadgeCondition(badge.requirement as BadgeRequirement, ctx))
    .map(badge => ({ user_id: userId, badge_id: badge.id, earned_at: new Date().toISOString() }))

  if (toAward.length > 0) {
    const { error: insertError } = await supabase
      .from('user_badges')
      .insert(toAward)
    if (insertError) {
      logger.error({ error: insertError, userId }, 'checkAndAwardBadges: batch insert failed')
      return []
    }
  }

  const newlyEarned: Badge[] = unearned
    .filter(badge => toAward.some(a => a.badge_id === badge.id))
    .map(badge => ({ id: badge.id, slug: badge.slug, name: badge.name, icon: badge.icon, category: badge.category }))

  return newlyEarned
}

export async function getUserBadges(
  supabase: SupabaseClient,
  userId: string
): Promise<(Badge & { earned_at: string })[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('earned_at, badges(id, slug, name, icon, category)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false })

  if (error || !data) return []

  return data.map(row => {
    const b = row.badges as unknown as Badge
    return { ...b, earned_at: row.earned_at }
  })
}
