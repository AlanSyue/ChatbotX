-- Snapshot repair only.
-- The actual DDL for this snapshot delta already exists in earlier backport migrations:
-- - 20260716090000_add_comment_automation_reply_comment_id
-- - 20260716091000_add_comment_automation_dispatch
-- - 20260727090000_add_automated_response_texts
-- Keep this chain-tip migration as a SQL no-op so fresh DBs apply the real DDL once,
-- while Drizzle's migration chain still advances to a snapshot that matches the
-- current TypeScript schema and passes drift checks.
SELECT 1;
