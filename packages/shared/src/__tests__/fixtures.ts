/**
 * Shared test fixtures for push-pipeline tests.
 *
 * Previously duplicated as local `makeUser` / `makeProblem` / `makeChannel`
 * functions in individual test files. Centralised here so a schema change
 * only needs to touch one place.
 */
import type { PushCandidate, VerifiedChannel } from '../push/push.repository.js'
import type { PushMessage, SelectedProblem } from '../types/push.js'

export function makeUser(overrides: Partial<PushCandidate> = {}): PushCandidate {
  return {
    id: 'user-1',
    timezone: 'Asia/Taipei',
    active_mode: 'list',
    difficulty_min: 0,
    difficulty_max: 3000,
    topic_filter: null,
    line_push_allowed: true,
    ...overrides,
  }
}

export function makeProblem(overrides: Partial<SelectedProblem> = {}): SelectedProblem {
  return {
    problem_id: 42,
    leetcode_id: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    explanation: 'Use a hash map.',
    ...overrides,
  }
}

export function makeChannel(overrides: Partial<VerifiedChannel> = {}): VerifiedChannel {
  return {
    id: 'ch-1',
    user_id: 'user-1',
    channel_type: 'telegram',
    channel_identifier: '123456',
    ...overrides,
  }
}

export function makePushMessage(overrides: Partial<PushMessage> = {}): PushMessage {
  return {
    title: 'Two Sum',
    difficulty: 'Easy',
    leetcodeId: 1,
    explanation: 'Use a hash map.',
    url: 'https://caffecode.net/problems/two-sum',
    problemSlug: 'two-sum',
    problemId: 42,
    ...overrides,
  }
}
