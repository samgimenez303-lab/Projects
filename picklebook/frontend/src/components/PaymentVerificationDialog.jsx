import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { paymentsAPI } from '../services/api';
import useDialog from '../hooks/useDialog';
import { formatMoney } from '../utils/booking';

export default function PaymentVerificationDialog({ payment, action, onClose, onDone }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitted = useRef(false);
  const dialogRef = useDialog(true, onClose, busy);
  const verify = action === 'verified';

  const submit = async event => {
    event.preventDefault();
    if (submitted.current) return;
    if (!['verified', 'rejected'].includes(action)) {
      setError('Choose a valid payment action.');
      return;
    }
    if (!verify && !notes.trim()) {
      setError('Please explain why this payment reference is being rejected.');
      return;
    }
    submitted.current = true;
    setBusy(true);
    setError('');
    try {
      await paymentsAPI.verify(payment.id, action, notes.trim());
    } catch (err) {
      submitted.current = false;
      setBusy(false);
      setError(err.message || 'The payment could not be updated. Refresh and try again.');
      return;
    }
    setBusy(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-navy-900/70 z-50 flex items-center justify-center overflow-y-auto p-4" onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="verify-title" tabIndex={-1} className="card w-full max-w-lg shadow-xl my-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="verify-title" className="text-xl font-bold">{verify ? payment.payment_method === 'cash' ? 'Record collected cash' : 'Verify GCash payment' : 'Reject payment reference'}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close verification" className="p-2 rounded-lg hover:bg-slate-100"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-600 mt-4 break-words">{payment.user_name} · {payment.reference_number}</p>
        {payment.court_name && <p className="text-xs text-slate-500 mt-1">{payment.court_name}</p>}
        <p className="text-3xl font-bold my-4 text-pickle-700">{formatMoney(payment.amount)}</p>
        <p className="text-sm text-slate-600 leading-relaxed mb-5">{verify ? payment.payment_method === 'cash' ? 'Confirm only after you have received the full amount in cash.' : 'Check your merchant account and match this reference and amount before confirming.' : 'Explain the issue so the player can correct their payment reference.'}</p>
        {payment.transaction_reference && <p className="text-sm font-mono break-all rounded-lg bg-slate-50 border border-slate-200 p-3 mb-5">{payment.transaction_reference}</p>}
        <form onSubmit={submit}>
          <label className="form-label" htmlFor="verification-note">{verify ? 'Verification note (optional)' : 'Reason for rejection'}</label>
          <textarea id="verification-note" className="form-input" rows={3} maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} required={!verify} disabled={busy} />
          {error && <p role="alert" className="text-sm text-rose-600 mt-3">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3 mt-5">
            <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className={`${verify ? 'btn-primary' : 'btn-danger'} text-sm`} disabled={busy}>{busy ? 'Saving...' : verify ? 'Confirm payment received' : 'Reject reference'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
