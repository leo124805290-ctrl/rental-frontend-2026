'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { generateContract } from '@/lib/contract-template';
import { getLandlordName } from '@/lib/settings';

type Step = 1 | 2;

export interface ContractSignModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  roomId: string;
  tenantName: string;
  roomNumber: string;
  propertyAddress: string;
  startDateYmd: string;
  endDateYmd: string;
  monthlyRentYuan: number;
  depositYuan: number;
  electricityYuanPerDeg: number;
  onSigned?: () => void;
}

function formatYmdSlash(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${y}/${m}/${d}`;
}

export function ContractSignModal({
  open,
  onClose,
  tenantId,
  roomId,
  tenantName,
  roomNumber,
  propertyAddress,
  startDateYmd,
  endDateYmd,
  monthlyRentYuan,
  depositYuan,
  electricityYuanPerDeg,
  onSigned,
}: ContractSignModalProps) {
  const [step, setStep] = useState<Step>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [busy, setBusy] = useState(false);

  const html = generateContract({
    landlordName: getLandlordName(),
    tenantName,
    roomNumber,
    propertyAddress,
    startDate: formatYmdSlash(startDateYmd),
    endDate: formatYmdSlash(endDateYmd),
    monthlyRent: monthlyRentYuan,
    deposit: depositYuan,
    electricityRate: electricityYuanPerDeg,
  });

  useEffect(() => {
    if (!open) {
      setStep(1);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [open, step]);

  const pos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ('touches' in e && e.touches[0]) {
        return {
          x: (e.touches[0].clientX - rect.left) * scaleX,
          y: (e.touches[0].clientY - rect.top) * scaleY,
        };
      }
      const me = e as React.MouseEvent;
      return {
        x: (me.clientX - rect.left) * scaleX,
        y: (me.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const confirmSign = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const contractHtml = html;
      const contractData = {
        tenantId,
        roomId,
        contractHtml,
        signatureBase64: dataUrl,
        signedAt: new Date().toISOString(),
      };
      localStorage.setItem(`contract_${tenantId}`, JSON.stringify(contractData));
      onSigned?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <h2 className="text-lg font-semibold">合約簽名</h2>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          關閉
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-3xl mx-auto w-full">
        {step === 1 && (
          <>
            <div
              className="prose prose-sm max-w-none border rounded-lg p-6 bg-white"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <div className="mt-6 flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={() => setStep(2)}>
                下一步：簽名
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">乙方請於下方區域手寫簽名（支援觸控與滑鼠）</p>
            <p className="text-sm">
              甲方簽名：{getLandlordName()}（系統設定）
            </p>
            <div className="border-2 border-slate-300 rounded-lg overflow-hidden touch-none">
              <canvas
                ref={canvasRef}
                width={800}
                height={240}
                className="w-full h-[200px] cursor-crosshair bg-white"
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
              />
            </div>
            <p className="text-sm text-slate-600">日期：{formatYmdSlash(startDateYmd)}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                上一步
              </Button>
              <Button type="button" variant="outline" onClick={clearCanvas}>
                清除簽名
              </Button>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                列印
              </Button>
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={busy}
                onClick={confirmSign}
              >
                確認簽署合約
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
