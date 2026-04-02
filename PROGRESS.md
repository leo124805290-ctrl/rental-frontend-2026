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

### 本輪再續作已完成：封存物業規則統一

- 新增共用規則檔
  - `lib/property-status.ts`
- 規則正式定稿
  - `active / demo`：可營運操作
  - `archived`：可看歷史、可編輯物業主檔、不可營運操作
- 物業主檔頁
  - `/properties`
    - 保留新增物業
    - `demo` 可硬刪
    - 非 demo 改為封存／恢復語意
    - archived 仍可編輯主檔
  - `/properties/[id]`
    - archived 不再整頁封鎖
    - 可查看主檔與歷史房間資料
    - 房間新增／入住／刪除／退租等營運按鈕停用
- 營運可寫頁面（僅 active/demo 可操作）
  - `app/payment-details/page.tsx`
  - `app/meter-readings/page.tsx`
  - `app/checkout/page.tsx`
  - `app/maintenance/page.tsx`
  - `app/expenses/page.tsx`
  - `app/incomes/page.tsx`
  - `app/finance/page.tsx`
- 歷史／報表頁面（保留 archived 可見）
  - `app/reports/page.tsx`
  - `app/meter-history/page.tsx`
  - `app/deposits/page.tsx`
- Dashboard 規則
  - `/dashboard` 改為只看 active/demo，作為營運看板

### 下一步執行順序（不需再問）

1. 若要再往下做，先補 archived 狀態提示文案／badge 的視覺一致性。
2. 檢查 `users` 是否需要補充封存物業規則說明（目前無直接物業營運操作）。
3. 若要長期維護，考慮抽共用 PropertySelect 元件與補小型規則測試。

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
- `users` 等非物業營運頁：若需顯示封存規則說明，可補 UI 提示
- archived badge / 說明文案：目前規則已到位，但各頁提示文案仍可再一致化
- 預留後端管理入口：一鍵清除所有 `demo` 物業及其關聯資料（尚未做）

