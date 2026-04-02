## 目前狀態（避免當機遺失）

目標（舊輪）：全站 UI 版型一致化（PageShell/PageHeader），並逐頁移除 `@ts-nocheck`，維持 `npm run type-check` / `npm run build` 通過。

### 已完成

- 新增共用版型元件
  - `components/app-shell/page-shell.tsx`
  - `components/app-shell/page-header.tsx`
- 已套用統一版型的頁面（PageShell + PageHeader）
  - `app/dashboard/page.tsx`
  - `app/properties/page.tsx`
  - `app/tenants/page.tsx`
  - `app/payments/page.tsx`
  - `app/checkout/page.tsx`
  - `app/rooms/page.tsx`
- `app/layout.tsx` 已移除 `<main>` padding，避免與各頁容器重複 padding
- 驗證
  - `npm run type-check`：✅
  - `npm run build`：✅

### 本輪續作已完成

- 補齊剩餘頁面的統一版型（PageShell + PageHeader）
  - `app/users/page.tsx`
  - `app/incomes/page.tsx`
  - `app/expenses/page.tsx`
  - `app/maintenance/page.tsx`
  - `app/reports/page.tsx`
  - `app/meter-readings/page.tsx`
  - `app/properties/[id]/page.tsx`
- `app/properties/[id]/page.tsx`
  - 右側「房間管理」區塊改為與全站一致的 section header 樣式
  - 保留原有房間操作邏輯，只整理骨架與間距
- `npm run lint`
  - 已改為可非互動執行的 `eslint .`

### 下一步執行順序（不需再問）

1. 確認 `reports / users` 是否需要比照其它操作頁，避免顯示或操作 `archived` 物業關聯資料。
2. 補齊物業封存後其它入口的禁用策略，不只限於 `/properties/[id]`。
3. 若需再往下做，再檢查是否仍有局部頁面需要細部 spacing / section header 對齊。

---

### 新一輪目標：物業封存/刪除策略

#### 已完成（本輪）
- 後端（`taiwan-landlord-backend`）
  - `properties` 新增 `status`：`active | archived | demo`
  - `GET /api/properties`
    - 預設只回傳 `active/demo`
    - `include_archived=true` 可回傳 `archived`
  - 物業刪除/封存/恢復端點
    - `DELETE /api/properties/:id`：僅允許 `demo` 硬刪
    - `PATCH /api/properties/:id/archive`：封存 `active/demo -> archived`
    - `PATCH /api/properties/:id/restore`：恢復 `archived -> active`
  - `/api/rooms`：加入 `properties` join，強制只回傳 `properties.status IN ('active','demo')` 的房間
- 前端（`rental-frontend-2026`）
  - `/properties` 清單
    - 非 demo：刪除按鈕改為「封存」
    - demo：顯示「刪除」（呼叫 backend `DELETE /api/properties/:id`）
    - `archived`：顯示「恢復使用中」（呼叫 `/restore`）
    - 物業狀態 badge：使用中/測試用/已封存
    - 列表切換：`只看使用中` / `顯示已封存`
  - `PropertyForm`
    - 新增「此物業為測試用（demo）」勾選
    - 送出時帶 `is_demo` 給後端
  - `/properties/[id]`：若物業 `archived`，改為只讀提示並提供「恢復使用中」
  - `/rooms`：前端再做一次防呆過濾（只顯示屬於管理清單 active/demo 的房間）
  - `/tenants`：載入時以 `/api/rooms` 的可操作清單過濾 archived 物業的租客
  - `/maintenance`：載入維修紀錄時以 `/api/properties`（active/demo）過濾 archived 物業紀錄
  - `/payments`：載入 `/api/properties` 後過濾 `archived` 物業，避免在 property 下拉選單中操作封存物業
  - `/meter-readings`：載入 `/api/properties` 後過濾 archived 物業，並讓房間列表只顯示可操作清單

#### 驗證
- `rental-frontend-2026`
  - `npm run type-check`：✅
  - `npm run build`：✅

#### 尚未完成（下一輪要接）
- `reports / users` 等頁面：需要確認它們是否仍會顯示/允許操作 `archived` 物業關聯資料（後續要統一「只可操作 active；必要時僅在報表/歷史顯示」）
- 新增物業封存後的「操作入口禁用」：目前只先做了物業詳情頁（`/properties/[id]`）的封存只讀；其它入口仍需逐頁補齊
- 預留後端管理入口：一鍵清除所有 `demo` 物業及其關聯資料（尚未做）

