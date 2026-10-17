"use client";

import { useState } from 'react';
import { Check, X, Ban, Plus } from 'lucide-react';
import { apiRequest, useStaffData } from '@/hooks/use-staff-data';
import type { PromotionDecision } from '@/lib/catalog-api';

interface Verification {
  id: string; attribute: string; value: string; status: 'pending' | 'verified' | 'rejected' | 'revoked';
  evidence_ref: string | null; verified_by: string | null; verified_at: string | null;
}

export function VerificationPanel({ quoteId, decisions }: { quoteId: string; decisions: PromotionDecision[] }) {
  const query = useStaffData<{ verifications: Verification[] }>(`verifications-${quoteId}`, `/api/quotes/${quoteId}/verifications`);
  const [attribute, setAttribute] = useState('vinclub_tier');
  const [value, setValue] = useState('');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mutate = async (path: string, method: string, body: unknown) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await query.refetch();
      setNotice('Đã lưu. Giá và snapshot cũ không đổi; khách cần tính lại và gửi báo giá mới để áp dụng xác minh.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Không lưu được xác minh.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border-t pt-4 text-xs">
    <h3 className="font-semibold">Xác minh điều kiện ưu đãi</h3>
    {decisions.map((d) => <div key={d.id} className="space-y-1">
      <p className="font-medium">{d.name}: {d.applied_to_price ? 'Đã trừ tiền' : d.state === 'eligible_pending_verification' ? 'Chờ xác minh' : d.state === 'ineligible' ? 'Không đủ điều kiện' : d.state === 'data_unavailable' ? 'Thiếu dữ liệu' : 'Không cộng dồn'}</p>
      {d.verification_requirements.map((r) => <p key={r.attribute}>{r.document} ({r.accepted_values.join(', ')})</p>)}
    </div>)}
    {(query.error || error) && <p role="alert" className="text-red-700">{error || query.error?.message}</p>}
    {notice && <p role="status" className="text-emerald-700">{notice}</p>}
    <label className="block">Tham chiếu chứng từ / lý do
      <input value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={500} className="mt-1 w-full rounded border p-2" />
    </label>
    {query.data?.verifications.map((v) => <div key={v.id} className="border-b py-2">
      <p className="break-words">{v.attribute}: {v.value} · {v.status}</p>
      {v.verified_at && <p className="mt-1 break-all text-gray-500">{v.verified_by} · {v.verified_at}</p>}
      {v.evidence_ref && <p className="break-words">{v.evidence_ref}</p>}
      <div className="mt-2 flex gap-2">
        {(v.status === 'pending' ? ['verified', 'rejected'] : v.status === 'verified' ? ['revoked'] : []).map((action) =>
          <button key={action} disabled={busy || !evidence.trim()} title={action === 'verified' ? 'Xác minh hợp lệ' : action === 'rejected' ? 'Từ chối hồ sơ' : 'Thu hồi xác minh'}
            className="rounded border p-2 disabled:opacity-40" onClick={() => void mutate(`/api/quotes/${quoteId}/verifications/${v.id}`, 'PATCH', { action, evidence_ref: evidence })}>
            {action === 'verified' ? <Check size={16} /> : action === 'rejected' ? <X size={16} /> : <Ban size={16} />}
          </button>)}
      </div>
    </div>)}
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void mutate(`/api/quotes/${quoteId}/verifications`, 'POST', { attribute, value }); }}>
      <label className="block">Thuộc tính
        <select value={attribute} onChange={(e) => setAttribute(e.target.value)} className="mt-1 w-full rounded border p-2">
          <option value="vinclub_tier">Hạng VinClub</option><option value="customer_group">Nhóm khách hàng</option>
          <option value="purchase_channel">Kênh mua</option><option value="legacy_battery_rental">Hợp đồng thuê pin cũ</option>
        </select>
      </label>
      <label className="block">Giá trị<input required value={value} onChange={(e) => setValue(e.target.value)} maxLength={255} className="mt-1 w-full rounded border p-2" /></label>
      <button disabled={busy} className="flex items-center gap-2 rounded border px-3 py-2 disabled:opacity-40"><Plus size={16} /> Tạo hồ sơ chờ xác minh</button>
    </form>
  </section>;
}
