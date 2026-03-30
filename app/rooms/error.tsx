'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/app-shell/page-shell';

export default function RoomsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[rooms]', error);
  }, [error]);

  return (
    <PageShell>
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-lg text-red-800">房間管理載入異常</CardTitle>
          <CardDescription>
            畫面發生未預期錯誤。請試著重新整理，或返回上一頁。若重複發生，請將瀏覽器 Console 的錯誤訊息提供給管理員。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => reset()}>
            重試
          </Button>
          <Button type="button" variant="outline" onClick={() => (window.location.href = '/rooms')}>
            回到房間管理
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
