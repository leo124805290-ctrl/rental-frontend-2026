'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ALL_PAGES,
  CONFIGURABLE_PAGES,
  ROLE_DEFAULTS,
  type PagePermission,
} from '@/lib/permissions';

export interface PermissionEditorProps {
  value: PagePermission[];
  onChange: (permissions: PagePermission[]) => void;
}

function clonePerms(perms: PagePermission[]): PagePermission[] {
  return JSON.parse(JSON.stringify(perms));
}

function presetAllOpen(): PagePermission[] {
  return ALL_PAGES.map((p) => ({ page: p.page, visible: true, editable: true }));
}

function presetAllClosed(): PagePermission[] {
  return ALL_PAGES.map((p) => ({
    page: p.page,
    visible: p.page === 'dashboard',
    editable: false,
  }));
}

function ensureDashboardRow(list: PagePermission[]): PagePermission[] {
  return list.map((row) =>
    row.page === 'dashboard' ? { ...row, visible: true } : row,
  );
}

function mergeValueForPage(
  list: PagePermission[],
  page: string,
  patch: Partial<Pick<PagePermission, 'visible' | 'editable'>>,
): PagePermission[] {
  const map = new Map(list.map((p) => [p.page, { ...p }]));
  const cur = map.get(page) || { page, visible: false, editable: false };
  const next = { ...cur, ...patch };
  if (!next.visible) next.editable = false;
  map.set(page, next);
  if (page === 'payments') {
    const pd = map.get('payment-details') || { page: 'payment-details', visible: false, editable: false };
    map.set('payment-details', { ...pd, visible: next.visible, editable: next.editable });
  }
  return ALL_PAGES.map(
    (meta) => map.get(meta.page) || { page: meta.page, visible: false, editable: false },
  );
}

export function PermissionEditor({ value, onChange }: PermissionEditorProps) {
  const byPage = (page: string) => value.find((p) => p.page === page);

  const setVisible = (page: string, visible: boolean) => {
    if (page === 'dashboard' && !visible) return;
    onChange(
      ensureDashboardRow(
        mergeValueForPage(value, page, { visible, ...(visible ? {} : { editable: false }) }),
      ),
    );
  };

  const setEditable = (page: string, editable: boolean) => {
    onChange(mergeValueForPage(value, page, { editable }));
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="space-y-1">
        <Label className="text-base font-semibold">分頁權限設定</Label>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange(clonePerms(presetAllOpen()))}>
            全部開放
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange(clonePerms(ROLE_DEFAULTS.admin))}>
            管理員預設
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange(clonePerms(ROLE_DEFAULTS.viewer))}>
            查看者預設
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(clonePerms(presetAllClosed()))}>
            全部關閉
          </Button>
        </div>
      </div>

      <div className="max-h-[min(360px,50vh)] overflow-auto rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">分頁</TableHead>
              <TableHead className="w-[88px] text-center">可見</TableHead>
              <TableHead className="min-w-[140px] text-center">可操作（增/改/刪）</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CONFIGURABLE_PAGES.map((meta) => {
              const row = byPage(meta.page);
              const visible = row?.visible ?? false;
              const editable = row?.editable ?? false;
              const displayOnly = meta.displayOnly === true;

              return (
                <TableRow key={meta.page}>
                  <TableCell className="font-medium">{meta.label}</TableCell>
                  <TableCell className="text-center">
                    {meta.page === 'dashboard' ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-900"
                        checked
                        disabled
                        title="儀表板固定為可見"
                        aria-label={`${meta.label} 可見（固定）`}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-900"
                        checked={visible}
                        onChange={(e) => setVisible(meta.page, e.target.checked)}
                        aria-label={`${meta.label} 可見`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {displayOnly ? (
                      <span className="text-muted-foreground">─</span>
                    ) : (
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                        checked={editable}
                        disabled={!visible}
                        onChange={(e) => setEditable(meta.page, e.target.checked)}
                        aria-label={`${meta.label} 可操作`}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
        <p className="font-medium text-slate-700">說明：</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>可見：側邊欄顯示此分頁，可以點進去</li>
          <li>可操作：可以新增、編輯、刪除資料</li>
          <li>不勾可見 → 側邊欄不顯示，直接輸入網址也會被擋</li>
          <li>勾可見但不勾可操作 → 能看資料但按鈕隱藏（唯讀模式，後續任務）</li>
          <li>純顯示/純查詢的頁面沒有「可操作」選項（用 ─ 表示）</li>
        </ul>
        <p className="pt-1 text-amber-800">⚠ 權限設定為 UI 級別，僅控制畫面顯示。</p>
      </div>
    </div>
  );
}
