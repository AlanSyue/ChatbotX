# Production Release Snapshot Inventory

盤點時間：2026-08-13（Asia/Taipei）

本文件只記錄可安全公開於 repository 的 release 邊界資訊，不包含 `.env`、
workspace token、Meta token、Tunnel credential 或 webhook secret。

## 現行固定版

- Production tag：`production-2026-08-13.1`
- Tag object SHA：`754debe98d13dabb28f7fe7724ad7c28e311e6d2`
- Release commit：`6ff1edfbb7d19c0ef9baaa7ae9cc185bbf721786`

## Upstream 候選基線

- Candidate branch：`feat/production-upstream-v1.2.1`
- Base commit：`932eae567`
- Foundation checkpoint：`4535d6b00`
  （automation/token safeguards）
- Story checkpoint：`85938723404380cf9c84bccedbd0732bf7d273b5`
  (`feat(story): preserve legacy automation on upstream`)

> 此候選分支尚未代表 production cutover 完成。Threads port、full gate 與正式
> cutover 仍屬待完成項目，不應在 release 狀態中標記為完成。

## Production 已套用且 candidate 必須保留的 migrations

以下 migration SQL 仍屬於 production release 必要邊界：

| Migration | Release 必要性 |
| --- | --- |
| `20260716090000_add_comment_automation_reply_comment_id` | 必須納入 |
| `20260716091000_add_comment_automation_dispatch` | 必須納入 |
| `20260725130000_add_story_reply_automation` | 必須納入 |
| `20260725140000_add_private_reply_sent_at` | 必須納入 |
| `20260727090000_add_automated_response_texts` | 必須納入 |
| `20260812110000_add_integration_threads` | 必須納入 |
| `20260812110100_add_threads_comment_automation_type` | 必須納入 |

## Candidate-only pending migration

以下 migration 目前屬於 candidate 變更，不能描述成已上 production：

| Migration | 狀態 |
| --- | --- |
| `20260813021000_add_story_reply_folder_type` | candidate-only pending |

Production schema 已存在：

- `FBCommentAutomationDispatch`
- `StoryReplyAutomation`
- `StoryReplyAutomationDispatch`
- `IntegrationThreads`
- `FBCommentAutomationReply.commentId`
- `FBCommentAutomationDispatch.privateReplySentAt`
- `StoryReplyAutomationDispatch.privateReplySentAt`
- `AutomatedResponse.texts`
- Threads comment automation enum/type（`fbCommentAutomationType = 'threads'`）

## Production delta 功能群組

### A. FB／IG 留言自動化

範圍包含：

- 公開留言多文案等機率選擇。
- 穩定選文案，避免同一留言 retry 時改選另一則。
- IG/FB 貼文查詢與建立／更新表單。
- 公開回覆與私訊延遲排程。
- Comment dispatch ledger、atomic claim 與 deterministic job id。
- Meta webhook 重送與 worker retry 的重複發送防護。
- 對應 builder、business、database、worker、integration 與測試。

### B. 一般關鍵字自動回覆多文案

範圍包含：

- `AutomatedResponse.texts`
- 等機率文字選擇 helper
- Legacy `text` 欄位相容
- Builder create/edit schema 與表單
- Business service 寫入正規化
- 對應 migration 與測試

### C. Story Reply Automation

範圍包含：

- Builder 頁面、表單、API 與 workspace-token API
- Messenger／Instagram story 查詢
- Business service 與 database schema/relations
- Worker handler、排程、atomic claim 與測試

foundation 與 Story 共存已經進入 candidate checkpoints；這一組是 candidate
目前已保留的 production delta。

### D. Meta channel reliability 與聯絡人回填

範圍包含：

- Instagram／Messenger／Instagram-Facebook HTTP client 錯誤策略
- Facebook Graph 與 Instagram Graph routing
- 收件 webhook 後的 contact profile backfill
- 避免 comment 或 outgoing echo 誤觸發 DM consent 行為
- 對應 integration 與 worker 測試

### E. Threads channel 與留言自動化

範圍包含：

- Threads OAuth nonce 與 superAdmin callback 流程
- Threads webhook HMAC 驗證
- platform credential 的 `clientId` 管理
- Threads public text comment automation
- Threads token refresh
- `IntegrationThreads` schema、service、integration 與對應測試

此群組目前存在於 production release，但尚未完整 port 到 candidate。

### F. Public API／MCP surface

範圍包含：

- FB comment 與 story reply workspace-token API
- Builder router/tool 註冊
- MCP 使用說明 skill

### G. 本機隔離操作檔案

範圍包含：

- `docker-compose.isolated-dev.yml`
- `docker-compose.isolated-dev.env.example`
- `docs/plans/local-environment-isolation.md`
- `docs/plans/production-release-inventory.md`
- `scripts/local-isolated-dev.sh`

此群組不參與 production runtime，應與功能 release 分開 commit。

## Release Gate

建立最終 production release 前至少必須完成：

- Builder、worker、business、database、worker-config 與受影響 integrations
  的 typecheck
- Comment automation、story reply、automated response、received message、
  Meta integration 相關測試
- Builder、worker、MCP production build
- Database schema 與 migration journal 一致性檢查
- Workspace-token API tenant/workspace scoping security review
- 確認 release build 不含 production secrets

Realtime 目前仍不能因為這批 isolation 資產就視為已完成正式替代；在具備非
`partykit dev` 的正式啟動方式前，Threads port 與最終 cutover 也不應視為完成。

## 2026-08-13 備註

- `production-2026-08-13.1` 是目前固定版；文件中的 `754debe...` 是 tag object，
  對應 release commit 為 `6ff1edfbb7d19c0ef9baaa7ae9cc185bbf721786`。
- `feat/production-upstream-v1.2.1` 是上游移植候選，不代表已通過全量 release gate。
- foundation checkpoint 為 `4535d6b00`，Story checkpoint 為
  `85938723404380cf9c84bccedbd0732bf7d273b5`。
- Story 功能共存目前以 commit `85938723404380cf9c84bccedbd0732bf7d273b5`
  作為 checkpoint。
- 本文件不包含任何真實 secret、token、正式 host credential 或 `.env` 內容。
