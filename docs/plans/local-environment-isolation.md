# 本機 Production／Development 隔離計畫

## 目標

確保 `/Users/alanhsueh/ChatbotX` 的日常開發、檔案儲存、測試與 dev worker
不會重新載入、讀取或寫入 production 的應用程序、資料庫、Redis queue、物件儲存
或外部整合帳號。

## 不可違反的邊界

- 正式流量切換、Tunnel、LaunchAgent、正式 token 與正式資料服務的異動，
  必須取得使用者明確確認。
- 建立隔離環境期間，現行 production 程序不得被停止或重新啟動。
- 開發環境不得載入 production Meta、workspace、OAuth 或 webhook 憑證。
- 第一輪切換不執行破壞性資料庫 migration。
- 現行 working tree 尚未整理成 release 前，不得以目前 Git HEAD 取代 production。

## Phase 0：建立可回復基線

- [x] 盤點現行 Tunnel、LaunchAgent、builder、worker、realtime、MCP 與資料服務拓撲。
- [x] 確認現行 production 直接使用開發 working tree 與 watch 程序。
- [x] 確認 PostgreSQL、Redis、RustFS 目前由單一 Compose project 共用。
- [x] 建立 PostgreSQL、Redis、RustFS 與 production 設定備份。
- [x] 盤點並整理 production 正在使用的未提交變更。
- [x] 建立可重現的 release commit/tag，並通過 lint、types、tests 與 build。

## Phase 1：建立不影響 Production 的 Dev 基礎設施

- [x] 新增獨立 `chatbotx-dev` Compose 設定。
- [x] 使用獨立 ports、volumes、database name 與 S3 bucket。
- [x] 所有 dev 資料服務只綁定 `127.0.0.1`。
- [x] 新增不含 production 憑證的 dev env 範本。
- [x] 通過 `docker compose config` 靜態解析與隔離邊界檢查。
- [x] 建立 dev 專用啟動／停止／狀態檢查指令。
- [x] 啟動 dev infrastructure 並執行 migrate/seed。
- [x] 驗證 dev DB、Redis、RustFS 與 production 完全分離。

> 啟動 dev app/worker 前，必須先完成 Phase 2 的 production 程式隔離。
> 目前 package scripts 仍會讀取 production 使用中的根目錄 `.env`。

## Phase 2：建立不可變的 Production 程式執行區

- [x] 建立獨立 production worktree 或使用固定 digest 的 Docker images。
- [x] Builder 改用 Next.js standalone production build。
- [x] Worker 改用 `dist/*.mjs`，不得使用 `tsx --watch`。
- [x] MCP 改用固定 build artifact 與獨立 production env。
- [ ] Realtime 補上非 `partykit dev` 的正式部署／啟動方式。
- [x] Production 啟動程序只能引用固定 release，不得引用開發 working tree。
- [x] 重新開機只自動啟動 production；dev 必須手動啟動。

## Phase 3：外部整合與 MCP 安全隔離

- [ ] Dev 使用 Meta Test App、測試粉專／帳號與獨立 webhook hostname。
- [x] Dev 沒有測試憑證時，預設禁止對外傳送訊息。
- [x] MCP 加入 Cloudflare Access 或等效的呼叫者驗證。
- [x] 外網 MCP 強制 request-level token，不使用伺服器 token 作為匿名 fallback。
- [x] MCP CORS 限制為明確 allowlist。
- [x] 移除 LaunchAgent 內的正式 token，改用權限 `600` 的秘密檔案。
- [x] 完成正式 workspace token 輪替。

## Phase 4：受控切換與 Rollback

- [x] 在替代 ports 啟動 production release。
- [x] 驗證 health、登入、queue、IG/FB webhook 與 MCP。
- [x] 取得使用者明確確認後，切換 Cloudflare Tunnel。
- [ ] 流量驗證成功後，優雅停止舊的 dev/watch production 程序（僅 realtime 暫留）。
- [x] 驗證可在五分鐘內切回上一個 release。

## 驗收條件

- 修改開發 working tree 不會改變 production PID 或重新載入 production worker。
- Production 程序不存在 `next dev`、`tsx --watch` 或 `partykit dev`（PartyKit
  OAuth 完成後達成；目前只剩 realtime 的既有 `partykit dev`）。
- Dev 與 production 的 PostgreSQL、Redis、S3 bucket/volume 完全不同。
- Dev worker 看不到 production queue，也無法使用正式 Meta token 發送訊息。
- Cloudflare 正式 Tunnel 不指向 dev port。
- Production secrets 不存在於 world-readable 檔案。
- 每日備份可還原，且 production release 可在五分鐘內 rollback。

## 2026-08-13 現況

- 現行固定版：`production-2026-08-13.1`
- Tag object SHA：`754debe98d13dabb28f7fe7724ad7c28e311e6d2`
- Release commit：`6ff1edfbb7d19c0ef9baaa7ae9cc185bbf721786`
- Foundation checkpoint：`4535d6b00`
  （automation/token safeguards）。
- Story 共存 checkpoint：`85938723404380cf9c84bccedbd0732bf7d273b5`
  (`feat(story): preserve legacy automation on upstream`)。
- 上游移植候選 branch：`feat/production-upstream-v1.2.1`。
- 候選 branch base：`932eae567`。
- 本文件記錄的是 isolation 資產與既有 production 隔離結果，不代表
  `feat/production-upstream-v1.2.1` 已完成 Threads port、全量 gate 或 cutover。
- Builder、11 個 worker、MCP 與 Cloudflare Tunnel 都由獨立 LaunchAgent
  啟動，來源為 `/Users/alanhsueh/.chatbotx/releases/`。
- 公開 MCP 已驗證 75 個工具，workspace 為 `Fenny Studio`；無 token 回 401、
  非 allowlist Host 回 403，workspace response 不包含 token。
- Dev PostgreSQL、Redis、RustFS 分別使用 `chatbotx_dev`、獨立 Redis run ID、
  `chatbotx-dev` bucket 與 `chatbotx-dev_*` volumes。
- 每日 03:30 備份已排程；既有 production rollback 演練可在數秒內完成。
- 唯一外部阻擋仍是 PartyKit GitHub 互動式 OAuth；完成登入前，最後的 realtime
  正式替代流程仍未完成。
