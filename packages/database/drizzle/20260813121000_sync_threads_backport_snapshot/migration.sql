-- Snapshot repair only: the real DDL already exists in earlier backport
-- migrations (`20260812110000`, `20260812110100`, `20260813120000`).
-- Keep this migration as a no-op so fresh DBs and upgraded DBs do not try to
-- recreate the same enum/table changes while still advancing the
-- snapshot chain tip for drift checking.
SELECT 1;
