---
paths:
  - "packages/shared/**"
---

# Shared Package Patterns

## Structure

- `src/channels/` — `sendTelegramMessage`, `sendLineMessage`, `sendEmailMessage` return `SendResult` with `shouldRetry`. Push channel classes delegate here; admin `forceNotifyAll` calls directly.
- `src/push/` — Full push pipeline: `buildPushJobs()`, `dispatchJob()`, `recordPushRun()`, repository functions, channel classes (`TelegramChannel`, `LineChannel`, `EmailChannel`), `createChannelRegistry()` factory. Used by both `apps/web/app/api/cron/push/route.ts` and `apps/worker/src/index.ts`.
- `src/services/problem-selector.ts` — `selectProblemForUser()` single source of truth for both worker and admin.
- `src/services/badge-checker.ts` — `evaluateBadgeCondition()` evaluates badge requirement JSONB against user context.
- `src/utils/notification-formatters.ts` — `formatTelegramMessage`, `buildFlexBubble`, `formatEmailSubject`, `buildTelegramReplyMarkup`.
- `src/types/push.ts` — `PushMessage`, `SendResult`, `SelectedProblem`, `Difficulty` type used by worker and shared channels.
- `src/repositories/problem.repository.ts` — `getListProblemAtPosition`, `getProblemAtListPosition`, `getUnsentProblemIds`, `getProblemById`. Internal to `problem-selector.ts`; not part of the shared public API.
- `src/utils/topic-utils.ts` — `topicLabel()`, `topicToVariety()`, `normalizeTopics()`, `TOPIC_ALIASES`. Kebab-case topic slug utilities.
- `apps/web/lib/repositories/garden.repository.ts` — `computeLevel()`, `toStage()`, `getTopicProficiency()`, `getGardenSummary()`.

## Build Requirement

`main: "dist/index.js"` in package.json — runtime needs compiled output. Shared must build before worker and web.
