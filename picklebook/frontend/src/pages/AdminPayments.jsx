import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, CreditCard, Search, AlertCircle } from 'lucide-react';
import { paymentsAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import PaymentVerificationDialog from '../components/PaymentVerificationDialog';
import { formatMoney } from '../utils/booking';

const statuses = ['pending', 'submitted', 'verified', 'rejected', 'refunded'];

export default function AdminPayments() {
  const [params, setParams] = useSearchParams();
  const status = statuses.includes(params.get('status')) ? params.get('status') : '';
  const method = ['cash', 'gcash'].includes(params.get('method')) ? params.get('method') : '';
  const query = params.get('search') || '';
  const requestedPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(query);
  const [totalPages, setTotalPages] = useState(1);
  const [reload, setReload] = useState(0);
  const [selection, setSelection] = useState(null);
  const { showSuccess } = useNotification();

  const changeFilters = (changes, resetPage = true) => setParams(previous => {
    const next = new URLSearchParams(previous);
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, String(value)); else next.delete(key); });
    if (resetPage) next.delete('page');
    return next;
  });

  useEffect(() => { setSearch(query); }, [query]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    paymentsAPI.getAll({ page, limit: 20, status, method, search: query }).then(({ data }) => {
      if (!Array.isArray(data.data?.payments)) throw new Error('Unable to read payment records.');
      if (active) {
        setPayments(data.data.payments);
        setTotalPages(Math.max(1, Number(data.data.totalPages) || 1));
      }
    }).catch(err => {
      if (active) { setPayments([]); setError(err.message); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, status, method, query, reload]);

  return (
    <div className="space-y-6">
      <header><span className="eyebrow">PAYMENT MANAGEMENT</span><h1 className="text-2xl sm:text-3xl font-bold">Payments &amp; verification</h1><p className="text-sm text-slate-500 mt-2">Review GCash references and record cash once it is received.</p></header>
      <div className="card flex flex-col lg:flex-row gap-4">
        <div><label htmlFor="payment-status" className="form-label text-xs">Payment status</label><select id="payment-status" className="form-select" value={status} onChange={event => changeFilters({ status: event.target.value })}><option value="">All statuses</option><option value="pending">Awaiting payment</option><option value="submitted">Needs verification</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="refunded">Refunded</option></select></div>
        <div><label htmlFor="payment-method" className="form-label text-xs">Payment method</label><select id="payment-method" className="form-select" value={method} onChange={event => changeFilters({ method: event.target.value })}><option value="">All methods</option><option value="cash">Cash</option><option value="gcash">GCash</option></select></div>
        <form className="flex-1" onSubmit={event => { event.preventDefault(); changeFilters({ search: search.trim() }); }}><label className="form-label text-xs" htmlFor="payment-search">Find a payment</label><div className="flex gap-2"><input id="payment-search" type="search" className="form-input" placeholder="Player, booking or transaction reference" value={search} onChange={event => setSearch(event.target.value)} /><button type="submit" className="btn-outline" aria-label="Search payments"><Search size={18} /></button></div></form>
      </div>

      {loading ? <LoadingSpinner message="Loading payments..." /> : error ? (
        <div className="card text-center py-12" role="alert"><AlertCircle className="mx-auto text-amber-600 mb-3" /><p className="text-sm text-slate-600 mb-4">{error}</p><button type="button" className="btn-outline text-sm" onClick={() => setReload(value => value + 1)}>Try again</button></div>
      ) : !payments.length ? (
        <div className="card text-center py-16"><CreditCard className="mx-auto text-slate-400 mb-3" size={30} /><h2 className="font-bold">No matching payments</h2><p className="text-sm text-slate-500 mt-2">Payment records appear when players make reservations.</p>{page > 1 && <button type="button" className="btn-outline text-sm mt-4" onClick={() => changeFilters({ page: 1 }, false)}>Back to first page</button>}</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500 text-left"><tr>{['Booking', 'Player', 'Payment details', 'Amount', 'Status', 'Action'].map(label => <th key={label} scope="col" className="p-4 whitespace-nowrap">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{payments.map(payment => {
                const openBooking = !payment.reservation_status || ['pending', 'confirmed'].includes(payment.reservation_status);
                const canVerify = openBooking && ((payment.payment_status === 'submitted' && payment.payment_method === 'gcash') || (payment.payment_status === 'pending' && payment.payment_method === 'cash'));
                return <tr key={payment.id}><td className="p-4"><Link className="text-pickle-700 font-semibold underline" to={`/reservations/${payment.reservation_id}`}>{payment.reference_number}</Link></td><td className="p-4">{payment.user_name}</td><td className="p-4"><span className="uppercase text-xs font-bold">{payment.payment_method}</span><span className="block text-xs font-mono text-slate-500 mt-1 break-all">{payment.transaction_reference || (payment.payment_method === 'cash' ? 'Cash at counter' : 'Reference not submitted')}</span></td><td className="p-4 font-semibold whitespace-nowrap">{formatMoney(payment.amount)}</td><td className="p-4"><span className={`badge ${payment.payment_status === 'verified' ? 'badge-confirmed' : ['pending', 'submitted'].includes(payment.payment_status) ? 'badge-pending' : 'badge-rejected'}`}>{payment.payment_status}</span></td><td className="p-4">{canVerify ? <div className="flex gap-2"><button type="button" onClick={() => setSelection({ payment, action: 'verified' })} className="btn-primary gap-1.5 py-2 px-3 text-xs whitespace-nowrap"><Check size={14} />{payment.payment_method === 'cash' ? 'Record cash' : 'Verify'}</button>{payment.payment_status === 'submitted' && <button type="button" onClick={() => setSelection({ payment, action: 'rejected' })} className="btn-outline text-rose-600 text-xs py-2 px-3">Reject</button>}</div> : <span className="text-xs text-slate-500">{!openBooking ? 'Booking closed' : payment.payment_status === 'pending' ? 'Awaiting reference' : 'No action needed'}</span>}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 text-sm"><button type="button" className="btn-outline py-2 text-xs" disabled={page <= 1} onClick={() => changeFilters({ page: page - 1 }, false)}>Previous</button><span className="text-slate-500">Page {page} of {totalPages}</span><button type="button" className="btn-outline py-2 text-xs" disabled={page >= totalPages} onClick={() => changeFilters({ page: page + 1 }, false)}>Next</button></div>
        </div>
      )}
      {selection && <PaymentVerificationDialog {...selection} onClose={() => setSelection(null)} onDone={() => { setSelection(null); setReload(value => value + 1); showSuccess('Payment status updated.'); }} />}
    </div>
  );
}
