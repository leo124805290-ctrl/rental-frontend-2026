## 目前狀態（避免當機遺失）

目標：全站 UI 版型一致化（PageShell/PageHeader），並逐頁移除 `@ts-nocheck`，維持 `npm run type-check` / `npm run build` 通過。

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

### 未完成（待做）

#### A) 尚未套用統一版型的頁面（仍使用 `container mx-auto ...`）
- `app/meter-readings/page.tsx`
- `app/expenses/page.tsx`
- `app/incomes/page.tsx`
- `app/maintenance/page.tsx`
- `app/reports/page.tsx`
- `app/users/page.tsx`
- `app/properties/[id]/page.tsx`（此頁有多處 container/間距，需要一次性統一）

#### B) 仍存在 `// @ts-nocheck` 的頁面（技術債）
- `app/dashboard/page.tsx`
- `app/meter-readings/page.tsx`
- `app/expenses/page.tsx`
- `app/incomes/page.tsx`
- `app/maintenance/page.tsx`
- `app/reports/page.tsx`
- `app/users/page.tsx`

（原則：先做「版型統一」確保視覺一致，再逐頁拿掉 `@ts-nocheck`，每移除一頁就跑 `npm run type-check`。）

#### C) lint 指令目前會進入互動式流程
- `npm run lint` 目前跑 `next lint`，在 Next.js 15 會提示遷移並要求互動選項，會卡住自動化驗證。
- 待處理方向：改成 ESLint CLI（例如 `eslint .`），或加入可非互動執行的 lint 流程。

### 下一步執行順序（不需再問）

1. 先把 A 清單頁面全部改成 PageShell + PageHeader（僅調整版型/間距/標題 actions，不動業務邏輯）。
2. 逐頁移除 B 的 `@ts-nocheck`，修正 TS/未使用變數/不正確型別，並持續維持 `type-check` 與 `build` 通過。
3. 最後處理 C：讓 `npm run lint` 可在無互動情境下跑完。

