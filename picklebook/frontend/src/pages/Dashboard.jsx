import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Clock, CreditCard, FileText, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { reservationsAPI } from '../services/api';
import StatsCard from '../components/StatsCard';
import LoadingSpinner from '../components/LoadingSpinner';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import { displayDate, formatMoney, paymentSummary } from '../utils/booking';

const startsAt = (reservation) => new Date(`${String(reservation.reservation_date).slice(0, 10)}T${reservation.start_time?.slice(0, 8) || '00:00:00'}`);

export default function Dashboard() {
  const { user } = useAuth();
  const { showError } = useNotification();
  const [reservations, setReservations] = useState([]);
  const [nextDetails, setNextDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentReservation, setPaymentReservation] = useState(null);
  const [receiptReservation, setReceiptReservation] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const fetchReservations = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const first = (await reservationsAPI.getMy({ limit: 100, page: 1 })).data?.data;
      if (!Array.isArray(first?.reservations)) throw new Error('Your dashboard could not be loaded.');
      // Include all pages so account statistics and the nearest future session
      // do not silently change when a player has more than one page of bookings.
      const remainder = await Promise.all(Array.from({ length: Math.max(0, Number(first.totalPages || 1) - 1) }, (_, index) => reservationsAPI.getMy({ limit: 100, page: index + 2 })));
      const all = [...first.reservations, ...remainder.flatMap((response) => {
        if (!Array.isArray(response.data?.data?.reservations)) throw new Error('Some reservations could not be loaded. Please retry.');
        return response.data.data.reservations;
      })];
      setReservations(all);
      const next = all.filter((reservation) => ['pending', 'confirmed'].includes(reservation.status) && startsAt(reservation) > new Date())
        .sort((a, b) => startsAt(a) - startsAt(b))[0];
      setNextDetails(null);
      if (next) {
        try { setNextDetails((await reservationsAPI.getById(next.id)).data?.data?.reservation || null); }
        catch { /* The booking link still works; payment actions need full records. */ }
      }
    } catch (err) { setError(err.message || 'Unable to load the dashboard.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const openReceipt = async (id) => {
    setOpeningId(id);
    try {
      const data = (await reservationsAPI.getById(id)).data?.data?.reservation;
      if (!data?.id) throw new Error('Reservation details are unavailable.');
      setReceiptReservation(data);
    } catch (err) { showError(err.message); }
    finally { setOpeningId(null); }
  };

  if (loading) return <LoadingSpinner fullScreen message="Loading your court dashboard…" />;
  if (error) return <div className="card max-w-lg mx-auto text-center space-y-4" role="alert"><AlertCircle className="w-8 h-8 mx-auto text-rose-400" /><h1 className="text-xl font-bold">Your dashboard is unavailable</h1><p className="text-sm text-slate-500">{error}</p><button className="btn-primary" onClick={fetchReservations}>Try again</button></div>;
  const upcoming = reservations.filter((reservation) => ['pending', 'confirmed'].includes(reservation.status) && startsAt(reservation) > new Date())
    .sort((a, b) => startsAt(a) - startsAt(b));
  const next = upcoming[0];
  const hours = reservations.filter((reservation) => reservation.status === 'completed').reduce((sum, reservation) => sum + Number(reservation.duration_hours || 0), 0);
  const nextPayment = nextDetails ? paymentSummary(nextDetails) : null;
  const recent = [...reservations].sort((a, b) => new Date(b.created_at || b.reservation_date) - new Date(a.created_at || a.reservation_date)).slice(0, 5);

  return <div className="space-y-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-pickle-600">Your player dashboard</p><h1 className="text-3xl font-black mt-2">Good to see you, {user?.name?.split(' ')[0] || 'player'}.</h1><p className="text-sm text-slate-500 mt-2">Your indoor and outdoor sessions, payments and receipts in one place.</p></div><Link to="/book" className="btn-primary gap-2 text-sm"><PlusCircle className="w-4 h-4" /> Create session</Link></header>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4"><StatsCard title="Upcoming games" value={upcoming.length} icon={CalendarDays} color="pickle" subtitle="Future pending or confirmed sessions" /><StatsCard title="Hours on court" value={`${hours.toFixed(1)} hrs`} icon={Clock} color="navy" subtitle="Completed sessions" /><StatsCard title="Total bookings" value={reservations.length} icon={FileText} color="accent" subtitle="Your reservation history" /><StatsCard title="Email status" value={user?.email_verified ? 'Verified' : 'Pending'} icon={CheckCircle2} color={user?.email_verified ? 'pickle' : 'rose'} subtitle={user?.email_verified ? 'Email verified' : 'Check your verification email'} /></div>
    {next ? <section className="card bg-navy-900 text-white p-6 sm:p-8"><div className="flex flex-wrap justify-between gap-6"><div><p className="text-xs uppercase tracking-widest text-pickle-300 font-bold">Next on your calendar</p><h2 className="text-2xl font-black text-white mt-3">{next.court_name}</h2><p className="text-sm text-white/70 mt-3">{displayDate(next.reservation_date)}</p><p className="text-sm text-white/70 mt-1">{next.start_time?.slice(0, 5)}–{next.end_time?.slice(0, 5)} · {next.duration_hours} hour(s)</p><p className="text-xs font-mono text-pickle-300 mt-4">{next.reference_number}</p></div><div className="flex flex-col items-start gap-3"><span className={`badge badge-${next.status} capitalize`}>{next.status}</span>{nextPayment?.latest?.payment_status === 'submitted' ? <p className="text-xs text-white/70">Payment awaiting staff verification</p> : nextPayment && nextPayment.paid > 0 && nextPayment.due === 0 ? <p className="text-xs text-pickle-300">Payment verified</p> : nextPayment?.canPay ? <button className="btn-primary text-sm gap-2" onClick={() => setPaymentReservation(nextDetails)}><CreditCard className="w-4 h-4" /> Payment options</button> : null}<Link className="text-sm text-white underline underline-offset-4" to={`/reservations/${next.id}`}>View booking details</Link></div></div></section> : <section className="card text-center py-12 space-y-3"><CalendarDays className="w-10 h-10 text-pickle-500 mx-auto" /><h2 className="text-xl font-bold">Make room for your next rally.</h2><p className="text-sm text-slate-500">No upcoming sessions yet. Your next game starts with a court.</p><Link className="btn-primary text-sm gap-2" to="/book">Find your court <ArrowRight className="w-4 h-4" /></Link></section>}
    <section className="card"><div className="flex items-center justify-between gap-3 mb-5"><h2 className="text-lg font-bold">Recent reservations</h2><Link to="/my-reservations" className="text-sm text-pickle-600 font-semibold inline-flex gap-1 items-center">View all <ArrowRight className="w-4 h-4" /></Link></div>{recent.length === 0 ? <p className="text-sm text-slate-500 py-6 text-center">Your bookings will appear here after you reserve a court.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-slate-400 border-b"><tr><th className="text-left py-3 pr-3">Court / reference</th><th className="text-left py-3 px-3">Session</th><th className="text-right py-3 px-3">Total</th><th className="text-center py-3 px-3">Status</th><th className="text-right py-3 pl-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{recent.map((reservation) => <tr key={reservation.id}><td className="py-4 pr-3"><p className="font-semibold">{reservation.court_name}</p><p className="font-mono text-xs text-slate-400 mt-1">{reservation.reference_number}</p></td><td className="py-4 px-3 whitespace-nowrap"><p className="text-xs">{displayDate(reservation.reservation_date)}</p><p className="text-xs text-slate-400 mt-1">{reservation.start_time?.slice(0, 5)}–{reservation.end_time?.slice(0, 5)}</p></td><td className="py-4 px-3 text-right font-bold whitespace-nowrap">{formatMoney(reservation.total_price)}</td><td className="py-4 px-3 text-center"><span className={`badge badge-${reservation.status} capitalize`}>{reservation.status}</span></td><td className="py-4 pl-3"><div className="flex justify-end gap-3 whitespace-nowrap text-xs"><Link className="font-semibold text-pickle-600 hover:underline" to={`/reservations/${reservation.id}`}>Manage</Link><button className="font-semibold text-slate-500 hover:underline disabled:opacity-50" disabled={openingId !== null} onClick={() => openReceipt(reservation.id)}>{openingId === reservation.id ? 'Loading…' : 'Summary'}</button></div></td></tr>)}</tbody></table></div>}</section>
    <PaymentModal isOpen={Boolean(paymentReservation)} onClose={() => setPaymentReservation(null)} reservation={paymentReservation} onSuccess={fetchReservations} />
    <ReceiptModal isOpen={Boolean(receiptReservation)} onClose={() => setReceiptReservation(null)} reservation={receiptReservation} />
  </div>;
}
