-- Enable pg_cron and pg_net for scheduled HTTP triggers.
-- pg_cron: database-level cron scheduler (minute precision)
-- pg_net: async HTTP client for outbound requests from SQL

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
