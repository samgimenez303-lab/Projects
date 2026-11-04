import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Banknote, Copy, CreditCard, ShieldCheck, X } from 'lucide-react';
import { paymentsAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import useDialog from '../hooks/useDialog';
import { formatMoney, paymentSummary } from '../utils/booking';

export default function PaymentModal({ isOpen, onClose, reservation, onSuccess }) {
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [instructions, setInstructions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);
  const submittingRef = useRef(false);
  const dialogRef = useDialog(isOpen, onClose, submitting);
  const { showSuccess } = useNotification();
  const summary = paymentSummary(reservation);

  useEffect(() => {
    if (!isOpen || !reservation) return undefined;
    let active = true;
    setMethod(reservation.payments?.[0]?.payment_method === 'gcash' ? 'gcash' : 'cash');
    setReference(''); setError(''); setLoading(true); setInstructions(null);
    paymentsAPI.getInstructions().then((response) => {
      if (active) setInstructions(response.data?.data);
    }).catch((err) => { if (active) setError(err.message || 'Payment instructions could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, reservation?.id, reload]);

  if (!isOpen || !reservation) return null;
  const configured = instructions?.gcash?.configured === true;
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(instructions.gcash.number); setCopied(true); }
    catch { setError('Copy is unavailable. Please copy the displayed number manually.'); }
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current || !summary.canPay) return;
    const normalized = reference.trim().toUpperCase();
    if (method === 'gcash' && (!configured || !/^[A-Z0-9-]{6,100}$/.test(normalized))) {
      setError(configured ? 'Enter the transaction reference from your GCash receipt (6–100 letters, numbers or hyphens).' : 'GCash is not currently configured. Choose cash or contact the facility.');
      return;
    }
    submittingRef.current = true; setSubmitting(true); setError('');
    try {
      if (method === 'gcash') {
        await paymentsAPI.submitGCash({ reservation_id: reservation.id, transaction_reference: normalized });
        showSuccess('Reference submitted. Staff will verify your transfer before it is marked paid.');
      } else {
        await paymentsAPI.create({ reservation_id: reservation.id, payment_method: 'cash' });
        showSuccess('Cash selected. Pay at the counter before your session.');
      }
      onClose();
      if (onSuccess) await onSuccess();
    } catch (err) { setError(err.message || 'Payment could not be submitted. Your reservation is saved; you can retry here.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-sm flex items-start sm:items-center justify-center p-4">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="payment-title" tabIndex={-1} className="bg-white rounded-2xl max-w-lg w-full shadow-2xl my-4 overflow-hidden">
      <header className="bg-navy-600 p-5 flex justify-between items-start gap-3"><div><p className="text-xs text-white/60 font-mono">{reservation.reference_number}</p><h2 id="payment-title" className="text-xl font-bold text-white mt-1">Your court, your payment.</h2></div><button type="button" aria-label="Close payment" disabled={submitting} onClick={onClose} className="text-white p-1 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button></header>
      <div className="p-6 bg-slate-50 border-b"><p className="text-xs uppercase tracking-wider text-slate-500">Amount due</p><p className="text-3xl font-black text-pickle-600 mt-1">{formatMoney(summary.due)}</p><p className="text-xs text-slate-500 mt-2">{reservation.court_name}</p></div>
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {!summary.canPay ? <p className="rounded-xl p-4 bg-blue-50 text-blue-900 text-sm">{summary.latest?.payment_status === 'submitted' ? 'Your transfer is awaiting staff verification. Please do not send another payment.' : 'No payment can be submitted for this reservation.'}</p> : <>
          <fieldset><legend className="form-label">How would you like to pay?</legend><div className="grid grid-cols-2 gap-3">{[{ id: 'cash', label: 'At the counter', detail: 'Cash before you play', icon: Banknote }, { id: 'gcash', label: 'GCash', detail: 'Transfer & verification', icon: CreditCard }].map((option) => <label key={option.id} className={`border rounded-xl p-3 cursor-pointer ${method === option.id ? 'border-pickle-600 bg-pickle-50' : 'border-slate-200'}`}><span className="flex items-center justify-between"><option.icon className="w-5 h-5 text-pickle-600" /><input type="radio" name="modal-payment-method" value={option.id} checked={method === option.id} onChange={() => { setMethod(option.id); setError(''); }} className="accent-green-700" /></span><strong className="block text-sm mt-2">{option.label}</strong><span className="block text-[11px] text-slate-500 mt-1">{option.detail}</span></label>)}</div></fieldset>
          {method === 'gcash' ? loading ? <p className="text-sm text-slate-500" role="status">Loading payment details…</p> : configured ? <div className="space-y-4"><div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3"><p className="text-sm font-semibold text-blue-900">1. Send {formatMoney(summary.due)} using GCash</p><div className="p-3 bg-white rounded-lg flex justify-between items-center gap-2"><div><p className="text-xs text-slate-500">Account name</p><p className="font-semibold text-sm">{instructions.gcash.name}</p><p className="font-mono font-bold text-lg mt-1">{instructions.gcash.number}</p></div><button type="button" aria-label="Copy GCash account number" className="btn-outline px-3 py-2 text-xs gap-1" onClick={handleCopy}><Copy className="w-3 h-3" />{copied ? 'Copied' : 'Copy'}</button></div><p className="text-xs text-blue-900">Check the account name in GCash before sending. This page records your reference; the transfer happens in your GCash app.</p></div><div><label htmlFor="gcash-reference" className="form-label">2. Enter your transaction reference</label><input id="gcash-reference" className="form-input font-mono" value={reference} onChange={(event) => setReference(event.target.value)} minLength={6} maxLength={100} pattern="[A-Za-z0-9-]{6,100}" required autoComplete="off" spellCheck={false} placeholder="Reference from your GCash receipt" /><p className="text-xs text-slate-500 mt-2">Submit only after the transfer succeeds. Staff will check it before marking your payment verified.</p></div></div> : <div className="rounded-xl p-4 border border-amber-200 bg-amber-50 text-sm text-amber-900"><p>GCash payment details are currently unavailable. Choose cash at the counter or contact the facility before sending money.</p><button type="button" className="font-semibold underline mt-2" onClick={() => setReload((value) => value + 1)}>Refresh payment details</button></div> : <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900"><strong className="block mb-2">Pay before your session.</strong><p>Show your reservation reference at the front desk. Your payment remains pending until staff records the cash received.</p></div>}
        </>}
        {error && <div role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><p>{error}</p></div>}
        <div className="border-t pt-4 flex flex-wrap justify-end gap-3"><button type="button" className="btn-outline text-sm" disabled={submitting} onClick={onClose}>Close</button>{summary.canPay && <button type="submit" className="btn-primary text-sm" disabled={submitting || (method === 'gcash' && (!configured || loading))}>{submitting ? 'Saving…' : method === 'gcash' ? 'Submit for verification' : 'Confirm cash payment method'}</button>}</div><p className="text-xs text-slate-400 flex gap-2"><ShieldCheck className="w-4 h-4 flex-shrink-0" /> Your booking stays saved if you close this window.</p>
      </form>
    </section>
  </div>;
}
