/**
 * Type declarations for @caffecode/worker subpath imports.
 *
 * The worker package is marked as a webpack external (serverExternalPackages)
 * so it's resolved by Node.js at runtime, not bundled. These declarations
 * satisfy TypeScript's type checker during the Next.js build.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module '@caffecode/worker/workers/push.logic' {
  export interface PushRunStats {
    totalCandidates: number
    succeeded: number
    failed: number
  }

  export function buildPushJobs(
    db: any,
    channelRegistry: Record<string, any>,
    dispatchLimit: any,
  ): Promise<PushRunStats>
}

declare module '@caffecode/worker/repositories/push.repository' {
  export function recordPushRun(
    db: any,
    data: {
      candidates: number
      succeeded: number
      failed: number
      durationMs: number
      errorMsg?: string
    },
  ): Promise<void>
}

declare module '@caffecode/worker/channels/telegram' {
  export class TelegramChannel {
    constructor(botToken: string)
    send(chatId: string, msg: any): Promise<any>
  }
}

declare module '@caffecode/worker/channels/line' {
  export class LineChannel {
    constructor(channelAccessToken: string)
    send(lineUserId: string, msg: any): Promise<any>
  }
}

declare module '@caffecode/worker/channels/email' {
  export class EmailChannel {
    constructor(apiKey: string, from: string)
    send(emailAddress: string, msg: any): Promise<any>
  }
}
