"use client";

import { useState } from 'react';
import { apiRequest } from '@/hooks/use-staff-data';
import { formatVND } from '@/lib/format';
import type { useConfigurator } from '@/hooks/use-configurator';

interface Estimate {
  total_price: number;
  loan_amount: number; monthly_payment: number; total_interest: number; total_paid: number;
  disclaimer: string;
}

export function InstallmentEstimator({ configurator }: { configurator: ReturnType<typeof useConfigurator> }) {
  const [rate, setRate] = useState('');
  const [down, setDown] = useState(30);
  const [months, setMonths] = useState(60);
  const [result, setResult] = useState<{ key: string; data: Estimate } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const payload = { ...configurator.pricingRequest, down_payment_pct: down, annual_rate_pct: Number(rate), term_months: months };
  const key = JSON.stringify({ ...payload, price_version: configurator.pricing.priceVersion, final_price: configurator.pricing.finalPrice });
  const estimate = result?.key === key && configurator.canQuote ? result.data : null;
  return <form className="mt-6 rounded-2xl border p-4" onSubmit={async (e) => {
    e.preventDefault(); if (loading) return;
    setLoading(true); setError('');
    try {
      const data = await apiRequest<Estimate>('/api/installment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key });
      if (data.total_price !== configurator.pricing.finalPrice) {
        await configurator.refreshPricing();
        throw new Error('Giá cấu hình vừa thay đổi. Hãy tính lại dự toán.');
      }
      setResult({ key, data });
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Chưa tính được dự toán.'); }
    finally { setLoading(false); }
  }}>
    <h3 className="font-semibold">Dự toán trả góp</h3>
    <p className="mt-1 text-xs text-slate-500">Nhập lãi suất giả định hoặc mức bạn được ngân hàng cung cấp.</p>
    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
      <label>Trả trước (%)<input type="number" min={0} max={100} required value={down} onChange={(e) => setDown(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2" /></label>
      <label>Lãi suất (%/năm)<input type="number" min={0} max={100} step="0.01" required value={rate} onChange={(e) => setRate(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
      <label>Kỳ hạn (tháng)<input type="number" min={1} max={120} required value={months} onChange={(e) => setMonths(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2" /></label>
    </div>
    <button disabled={loading || !configurator.canQuote} className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">{loading ? 'Đang tính…' : 'Tính dự toán'}</button>
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    {estimate && <div className="mt-3 space-y-1 text-sm">
      <p>Khoản vay mô phỏng: <strong>{formatVND(estimate.loan_amount)}</strong></p>
      <p>Tháng đầu: <strong>{formatVND(estimate.monthly_payment)}</strong></p>
      <p>Tổng lãi: {formatVND(estimate.total_interest)}</p>
      <p>Tổng chi phí gồm lãi: {formatVND(estimate.total_paid)}</p>
      <p className="pt-2 text-xs text-slate-500">{estimate.disclaimer}</p>
    </div>}
  </form>;
}
