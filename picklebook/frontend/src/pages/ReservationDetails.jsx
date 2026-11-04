import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle, Clock, CreditCard, FileText, Mail, Printer, RefreshCw } from 'lucide-react';
import { reservationsAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import { displayDate, formatMoney, paymentSummary } from '../utils/booking';
import { bookingEmailNotice, savedBookingForRoute } from '../utils/bookingConfirmation';

export default function ReservationDetails() {
  const { id } = useParams();
  const location = useLocation();
  const { showSuccess, showError } = useNotification();
  const savedReservation = savedBookingForRoute(id, location.state);
  const [reservation, setReservation] = useState(savedReservation);
  const [loading, setLoading] = useState(!savedReservation);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeModal, setActiveModal] = useState(location.state?.openPayment && !savedReservation ? 'payment' : null);
  const [cancelling, setCancelling] = useState(false);
  const fetchDetails = useCallback(async () => {
    setRefreshing(true); setError('');
    try {
      const response = await reservationsAPI.getById(id);
      const data = response.data?.data?.reservation;
      if (!data?.id) throw new Error('Reservation information is unavailable.');
      setReservation(data);
    } catch (err) { setError(err.message || 'Unable to load this reservation.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);
  useEffect(() => {
    setLoading(!savedReservation);
    setReservation(savedReservation);
    setActiveModal(location.state?.openPayment && !savedReservation ? 'payment' : null);
    fetchDetails();
  }, [fetchDetails, savedReservation, location.state?.openPayment]);
  const handleCancel = async () => {
    if (!window.confirm('Cancel this reservation? Eligibility and any refund will follow the facility’s cancellation policy.')) return;
    setCancelling(true);
    try { await reservationsAPI.cancel(id, 'Player requested cancellation'); showSuccess('Reservation cancelled.'); await fetchDetails(); }
    catch (err) { showError(err.message || 'Unable to cancel this reservation.'); }
    finally { setCancelling(false); }
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading your reservation…" />;
  if (!reservation) return <div className="card max-w-lg mx-auto my-12 text-center space-y-4"><AlertCircle className="w-8 h-8 text-slate-400 mx-auto" /><h1 className="text-xl font-bold">Unable to load reservation</h1><p className="text-sm text-slate-500" role="alert">{error}</p><button className="btn-primary" onClick={fetchDetails}>Try again</button><Link to="/my-reservations" className="block text-sm text-pickle-600">Back to reservations</Link></div>;
  const payments = [...new Map((reservation.payments || []).map((payment) => [payment.id, payment])).values()];
  const summary = paymentSummary(reservation, payments);
  const pendingReview = summary.latest?.payment_status === 'submitted';
  const verified = summary.paid > 0 && summary.due === 0;
  const active = ['pending', 'confirmed'].includes(reservation.status);
  return <div className="max-w-5xl mx-auto py-5 space-y-6">
    <Link to="/my-reservations" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-pickle-600"><ArrowLeft className="w-4 h-4" /> My reservations</Link>
    <header className="flex flex-wrap justify-between items-start gap-4"><div><p className="text-xs text-pickle-600 uppercase font-bold tracking-widest">Your next good game</p><h1 className="text-3xl font-black mt-2">Reservation details</h1><p className="font-mono text-sm text-slate-400 mt-2">{reservation.reference_number}</p></div><span className={`badge badge-${reservation.status} capitalize`}>{reservation.status}</span></header>
    {savedReservation && (
      <section className="card border-pickle-200 bg-pickle-50 space-y-4" aria-labelledby="booking-thanks-title">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-7 h-7 text-pickle-600 flex-shrink-0" aria-hidden="true" />
          <div>
            <h2 id="booking-thanks-title" className="text-xl font-bold">Thank you for choosing PickleBook!</h2>
            <p className="text-sm text-slate-600 mt-2">Your reservation is saved. Keep your reference <strong className="font-mono">{reservation.reference_number}</strong> handy for your visit.</p>
          </div>
        </div>
        <p className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed" role="status"><Mail className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />{bookingEmailNotice(location.state?.emailDelivery)}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary text-sm gap-2" onClick={() => setActiveModal('receipt')}><Printer className="w-4 h-4" aria-hidden="true" />View &amp; print booking receipt</button>
          {summary.canPay && <button type="button" className="btn-outline text-sm gap-2" onClick={() => setActiveModal('payment')}><CreditCard className="w-4 h-4" aria-hidden="true" />Continue to payment</button>}
        </div>
      </section>
    )}
    {error && <p role="alert" className="rounded-xl p-4 bg-rose-50 text-rose-700 text-sm">{error}</p>}
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${verified ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>{verified ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <Clock className="w-5 h-5 flex-shrink-0" />}<div><strong className="text-sm">{verified ? 'Payment verified' : pendingReview ? 'Transfer awaiting verification' : active ? 'Payment still due' : 'Reservation closed'}</strong><p className="text-xs mt-1 leading-relaxed">{verified ? 'Your payment is recorded. Check the reservation status above before your session.' : pendingReview ? 'Staff will check your reference. Please do not make another transfer while it is under review.' : active ? 'Submit a GCash transfer reference or settle your balance with staff at the counter before playing.' : 'Review your payment records below. Contact the facility about any refund or adjustment.'}</p></div></div>
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start"><div className="space-y-6"><section className="card space-y-5"><div><p className="text-xs text-pickle-600 uppercase font-bold">{reservation.court_type} court</p><h2 className="text-xl font-bold mt-1">{reservation.court_name}</h2></div><div className="flex gap-3 items-start text-sm"><CalendarDays className="w-5 h-5 text-pickle-600" /><div><p className="font-semibold">{displayDate(reservation.reservation_date)}</p><p className="text-slate-500 mt-1">{reservation.start_time?.slice(0, 5)}–{reservation.end_time?.slice(0, 5)} · {reservation.duration_hours} hour(s)</p></div></div>{reservation.notes && <div className="border-t pt-4"><p className="text-xs font-bold text-slate-400 uppercase">Your notes</p><p className="text-sm text-slate-600 whitespace-pre-wrap mt-2">{reservation.notes}</p></div>}</section>
      <section className="card"><div className="flex justify-between items-center gap-2 mb-4"><h2 className="text-lg font-bold">Payment records</h2><button className="text-xs text-pickle-600 font-semibold inline-flex items-center gap-1 disabled:opacity-50" onClick={fetchDetails} disabled={refreshing}><RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button></div>{payments.length ? <div className="divide-y">{payments.map((payment) => <div key={payment.id} className="py-4 flex justify-between items-start gap-3 text-sm"><div><p className="font-semibold uppercase">{payment.payment_method}</p>{payment.transaction_reference && <p className="text-xs font-mono text-slate-500 mt-1 break-all">{payment.transaction_reference}</p>}{payment.verification_notes && <p className="text-xs text-slate-500 mt-2">Staff note: {payment.verification_notes}</p>}</div><div className="text-right flex-shrink-0"><p className="font-bold">{formatMoney(payment.amount)}</p><p className={`text-xs capitalize mt-1 ${payment.payment_status === 'verified' ? 'text-emerald-700' : payment.payment_status === 'rejected' ? 'text-rose-600' : 'text-amber-700'}`}>{payment.payment_status === 'submitted' ? 'Awaiting verification' : payment.payment_status}</p></div></div>)}</div> : <p className="text-sm text-slate-500">No payment has been recorded yet.</p>}</section>
    </div>
      <aside className="card space-y-4">
        <h2 className="text-lg font-bold">Booking total</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-2"><dt className="text-slate-500">Court session</dt><dd>{formatMoney(reservation.court_price)}</dd></div>
          {Number(reservation.services_price) > 0 && <div className="flex justify-between gap-2"><dt className="text-slate-500">Historical services</dt><dd>{formatMoney(reservation.services_price)}</dd></div>}
          <div className="flex justify-between border-t pt-3 font-semibold"><dt>Total</dt><dd>{formatMoney(reservation.total_price)}</dd></div>
          <div className="flex justify-between text-slate-500"><dt>Verified payments</dt><dd>{formatMoney(summary.paid)}</dd></div>
          <div className="flex justify-between border-t pt-3 font-black text-lg"><dt>Balance due</dt><dd className="text-pickle-600">{formatMoney(summary.due)}</dd></div>
        </dl>
        {summary.canPay && <button type="button" className="btn-primary w-full text-sm gap-2" onClick={() => setActiveModal('payment')}><CreditCard className="w-4 h-4" />{summary.latest?.payment_status === 'rejected' ? 'Retry payment' : 'Payment options'}</button>}
        <button type="button" className="btn-outline w-full text-sm gap-2" onClick={() => setActiveModal('receipt')}><FileText className="w-4 h-4" />{verified ? 'View receipt' : 'View booking receipt'}</button>
        {active && <div className="border-t pt-4"><p className="text-xs text-slate-400 leading-relaxed">Cancellation eligibility is checked when you cancel. Contact the facility for refund assistance.</p><button type="button" className="text-xs text-rose-600 font-semibold mt-3 disabled:opacity-50" disabled={cancelling} onClick={handleCancel}>{cancelling ? 'Cancelling…' : 'Cancel reservation'}</button></div>}
      </aside>
    </div>
    <PaymentModal isOpen={activeModal === 'payment'} onClose={() => setActiveModal(null)} reservation={reservation} onSuccess={fetchDetails} />
    <ReceiptModal isOpen={activeModal === 'receipt'} onClose={() => setActiveModal(null)} reservation={reservation} />
  </div>;
}
