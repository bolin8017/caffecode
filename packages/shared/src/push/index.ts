export { buildPushJobs, dispatchJob } from './push.logic.js'
export type { PushJobData, PushRunStats } from './push.logic.js'

export {
  getAllCandidates,
  stampLastPushDate,
  getVerifiedChannelsBulk,
  upsertHistoryBatch,
  advanceListPositions,
  incrementChannelFailures,
  resetChannelFailuresForUsers,
  recordPushRun,
} from './push.repository.js'
export type { PushCandidate, VerifiedChannel } from './push.repository.js'

export {
  TelegramChannel,
  LineChannel,
  EmailChannel,
  DailyProblemEmail,
  createChannelRegistry,
} from './channels/index.js'
export type { NotificationChannel, ChannelRegistryConfig } from './channels/index.js'
