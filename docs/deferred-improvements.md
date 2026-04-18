# Deferred Improvements

This document tracks review follow-ups that were investigated but intentionally
deferred, along with the reasoning and the minimum work required to pick them up
later. Complements the merged PRs from the 2026-04-17 full-project review
(PRs #38–#49).

## Branded channel-identifier types — decided to skip

**Status**: reviewed 2026-04-18, decided not to pursue unless conditions change.

**Goal**: prevent swapping a Telegram chat-id for a LINE user-id or an email
address at compile time by branding the `string` identifier type per channel.

**Why skipped**: threading branded types through every channel call site
across `packages/shared` and `apps/web` touches dozens of files for a narrow
compile-time gain. The push pipeline (PR #40) already fails loudly on
mismatched registry entries at runtime, and with only three channel types the
mental overhead of remembering which string is which is small.

**When to revisit**:

- A real mis-routing bug lands in production.
- The channel count grows beyond three (e.g. Slack, Discord, Matrix).
- An adjacent refactor already touches most channel call sites, making the
  type tightening nearly free.
