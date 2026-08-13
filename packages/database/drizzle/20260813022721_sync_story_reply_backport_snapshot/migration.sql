-- Snapshot repair only: the real DDL already exists in earlier backport
-- migrations (`20260725130000`, `20260725140000`, `20260813021000`).
-- Keep this migration as a no-op so fresh DBs and upgraded DBs do not try to
-- recreate the same enum/table/column changes while still advancing the
-- snapshot chain tip for drift checking.
SELECT 1;
