---
paths:
  - "supabase/**"
  - "docs/supabase-schema.sql"
  - "**/repositories/**"
---

# Database Details

## DB Functions

- `get_push_candidates()` — Users eligible for push in current UTC hour (no-param only)
- `get_unsent_problem_ids_for_user(UUID, diff_min, diff_max, topic[])` — Filter mode selection
- `advance_list_positions(jsonb)` — Batch UPDATE of current_position via `jsonb_to_recordset()`
- `stamp_last_push_date(UUID[])` — Mark batch of users as delivered today
- `get_topic_proficiency(UUID)` — Per-topic solve stats for coffee garden (unnest topics aggregation); includes `auth.uid()` defense-in-depth check

## Table Details

- `curated_lists.type`: classic/official/company/topic/algorithm/difficulty/challenge
- `notification_channels`: link_token_expires_at for 30-min token expiry
- `user_list_progress`: exactly one active list per user (is_active constraint)
- `history`: UNIQUE on user_id x problem_id

## Supabase Config

- Auth Site URL: `https://caffecode.net`
- Redirect URLs: `https://caffecode.net/**`, `http://localhost:3000/**`
- OAuth: GitHub + Google (`caffecode-oauth` GCP project)
- New migrations: create in `supabase/migrations/` and apply via Supabase MCP `apply_migration`
- Schema reference: `docs/supabase-schema.sql`
