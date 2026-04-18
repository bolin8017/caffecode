---
paths:
  - "packages/shared/**"
---

# Shared Package Patterns

## Structure

- `src/channels/` — `sendTelegramMessage`, `sendLineMessage`, `sendEmailMessage` return `SendResult` with `shouldRetry`. Shared by the push pipeline (via `createChannelRegistry`) and admin `forceNotifyAll`.
- `src/push/` — Full push pipeline: `buildPushJobs()`, `dispatchJob()`, `recordPushRun()`, repository functions. `createChannelRegistry()` returns a `Record<string, NotificationChannel>` where each `NotificationChannel` is a function `(identifier, msg) => Promise<SendResult>` that wraps one of the raw channel senders. Invoked from `apps/web/app/api/cron/push/route.ts` (the hourly cron target).
- `src/services/problem-selector.ts` — `selectProblemForUser()` single source of truth for cron push and admin force-notify.
- `src/services/badge-checker.ts` — `evaluateBadgeCondition()` evaluates badge requirement JSONB against user context.
- `src/utils/notification-formatters.ts` — `formatTelegramMessage`, `buildFlexBubble`, `formatEmailSubject`, `buildTelegramReplyMarkup`.
- `src/types/push.ts` — `PushMessage`, `SendResult`, `SelectedProblem`, `Difficulty` — types used by the push pipeline and channel senders.
- `src/repositories/problem.repository.ts` — `getListProblemAtPosition`, `getProblemAtListPosition`, `getUnsentProblemIds`, `getProblemById`. Internal to `problem-selector.ts`; not part of the shared public API.
- `src/utils/topic-utils.ts` — `topicLabel()`, `topicToVariety()`, `normalizeTopics()`, `TOPIC_ALIASES`. Kebab-case topic slug utilities.
- `apps/web/lib/repositories/garden.repository.ts` — `computeLevel()`, `toStage()`, `getTopicProficiency()`, `getGardenSummary()`.

## Build Requirement

`main: "dist/index.js"` in package.json — runtime needs compiled output. Shared must build before `apps/web`.
