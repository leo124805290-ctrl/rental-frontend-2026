'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCents, formatDate } from '@/lib/utils';

/** 金額皆為「分」 */
export interface CheckoutSignatureSettlement {
  rentDue: number;
  electricityFee: number;
  unpaidBalance: number;
  otherDeductions: number;
  totalDue: number;
  depositAmount: number;
  refundAmount: number;
}

export interface CheckoutSignatureProps {
  tenantId: string;
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  checkoutDate: string;
  settlement: CheckoutSignatureSettlement;
  onComplete: () => void;
  onCancel: () => void;
}

function getCanvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * sx,
    y: (clientY - rect.top) * sy,
  };
}

export function CheckoutSignature({
  tenantId,
  tenantName,
  propertyName,
  roomNumber,
  checkoutDate,
  settlement,
  onComplete,
  onCancel,
}: CheckoutSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = 560;
    const h = 200;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeCanvas]);

  const startStroke = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasInk(true);
  };

  const moveStroke = (x: number, y: number) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endStroke = () => {
    drawing.current = false;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = getCanvasPoint(e.currentTarget, e.clientX, e.clientY);
    startStroke(p.x, p.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = getCanvasPoint(e.currentTarget, e.clientX, e.clientY);
    moveStroke(p.x, p.y);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    endStroke();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    resizeCanvas();
    setHasInk(false);
  };

  const persistContract = (payload: Record<string, unknown>) => {
    try {
      localStorage.setItem(`contract_checkout_${tenantId}`, JSON.stringify(payload));
    } catch {
      alert('無法寫入本機儲存，請檢查瀏覽器設定');
      return false;
    }
    return true;
  };

  const confirmSign = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) {
      alert('請先於簽名區簽名');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const contract = {
      tenantId,
      checkoutSettlement: settlement,
      signatureBase64: dataUrl,
      signedAt: new Date().toISOString(),
      type: 'checkout' as const,
      skipped: false,
    };
    if (!persistContract(contract)) return;
    onComplete();
  };

  const skipSign = () => {
    const contract = {
      tenantId,
      checkoutSettlement: settlement,
      skipped: true,
      signedAt: new Date().toISOString(),
      type: 'checkout' as const,
    };
    if (!persistContract(contract)) return;
    onComplete();
  };

  const handlePrint = () => {
    window.print();
  };

  const dateLabel = checkoutDate ? formatDate(checkoutDate, 'medium') : '—';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 print:static print:inset-auto print:bg-white print:p-0">
      <div
        id="checkout-signature-print-area"
        className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-white shadow-xl print:max-h-none print:rounded-none print:border-0 print:shadow-none"
      >
        <div className="p-6 space-y-4">
          <h2 className="text-center text-lg font-semibold">
            退租確認書 / Xác nhận trả phòng
          </h2>

          <p className="text-sm leading-relaxed">
            本人 <strong>{tenantName || '—'}</strong> 確認已於 {dateLabel} 自{' '}
            <strong>{propertyName || '—'}</strong> <strong>{roomNumber || '—'}</strong> 退租。
          </p>
          <p className="text-sm leading-relaxed text-slate-700">
            Tôi <strong>{tenantName || '—'}</strong> xác nhận đã trả phòng{' '}
            <strong>{roomNumber || '—'}</strong> tại <strong>{propertyName || '—'}</strong> vào
            ngày {dateLabel}.
          </p>

          <h3 className="text-base font-medium pt-2">結算明細 / Chi tiết thanh toán</h3>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-1.5 pr-2">當月租金</td>
                <td className="py-1.5 text-right">{formatCents(settlement.rentDue)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5 pr-2">電費</td>
                <td className="py-1.5 text-right">{formatCents(settlement.electricityFee)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5 pr-2">未繳餘額</td>
                <td className="py-1.5 text-right">{formatCents(settlement.unpaidBalance)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5 pr-2">其他扣款</td>
                <td className="py-1.5 text-right">{formatCents(settlement.otherDeductions)}</td>
              </tr>
              <tr className="border-b font-semibold">
                <td className="py-1.5 pr-2">應收合計</td>
                <td className="py-1.5 text-right">{formatCents(settlement.totalDue)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5 pr-2">押金</td>
                <td className="py-1.5 text-right">{formatCents(settlement.depositAmount)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-1.5 pr-2">退還金額</td>
                <td className="py-1.5 text-right">{formatCents(settlement.refundAmount)}</td>
              </tr>
            </tbody>
          </table>

          <p className="text-sm pt-2">雙方確認無其他爭議。</p>
          <p className="text-sm text-slate-700">Hai bên xác nhận không có tranh chấp.</p>

          <p className="text-sm">甲方：________________</p>

          <div className="space-y-2">
            <p className="text-sm font-medium">乙方簽名：</p>
            <div className="rounded border-2 border-slate-300 bg-slate-50 touch-none">
              <canvas
                ref={canvasRef}
                className="block w-full cursor-crosshair"
                style={{ maxWidth: '560px', height: '200px' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>
            <p className="text-xs text-muted-foreground">支援滑鼠與觸控簽名（線寬 2px）。</p>
          </div>

          <p className="text-sm">日期：{dateLabel}</p>

          <p className="text-xs text-amber-900 border-t pt-3 mt-2">
            ⚠ 僅儲存於本機瀏覽器，建議下載備份
          </p>

          <div className="flex flex-wrap gap-2 justify-end pt-2 print:hidden">
            <Button type="button" variant="ghost" onClick={onCancel}>
              取消
            </Button>
            <Button type="button" variant="outline" onClick={handlePrint}>
              列印
            </Button>
            <Button type="button" variant="outline" onClick={clearCanvas}>
              清除簽名
            </Button>
            <Button type="button" variant="outline" onClick={skipSign}>
              略過簽名
            </Button>
            <Button type="button" onClick={confirmSign}>
              確認簽署
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
