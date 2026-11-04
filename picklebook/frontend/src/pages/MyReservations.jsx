import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, PlusCircle, Search } from 'lucide-react';
import { reservationsAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import PaymentModal from '../components/PaymentModal';
import ReceiptModal from '../components/ReceiptModal';
import { displayDate, formatMoney } from '../utils/booking';

export default function MyReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const { showError } = useNotification();
  const fetchReservations = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await reservationsAPI.getMy({ page, limit: 20, status: status || undefined });
      const data = response.data?.data;
      if (!Array.isArray(data?.reservations)) throw new Error('Your reservations could not be loaded.');
      setReservations(data.reservations); setPages(Math.max(1, Number(data.totalPages) || 1));
    } catch (err) { setError(err.message || 'Unable to load your reservations.'); }
    finally { setLoading(false); }
  }, [page, status]);
  useEffect(() => { fetchReservations(); }, [fetchReservations]);
  const openAction = async (reservationId, action) => {
    setOpeningId(reservationId);
    try {
      // Lists do not include payment details. Fetch the complete booking before
      // opening a receipt or allowing another payment submission.
      const response = await reservationsAPI.getById(reservationId);
      const data = response.data?.data?.reservation;
      if (!data?.id) throw new Error('Reservation details are unavailable.');
      if (action === 'payment') setSelectedPayment(data); else setSelectedReceipt(data);
    } catch (err) { showError(err.message); }
    finally { setOpeningId(null); }
  };
  const visible = reservations.filter((reservation) => `${reservation.reference_number} ${reservation.court_name}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-pickle-600 uppercase tracking-widest">Your time on court</p><h1 className="text-3xl font-black mt-2">My reservations</h1><p className="text-sm text-slate-500 mt-2">Manage your sessions, payment references and receipts.</p></div><Link to="/book" className="btn-primary text-sm gap-2"><PlusCircle className="w-4 h-4" /> Book a court</Link></header>
    <div className="card flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center"><div><label className="sr-only" htmlFor="reservation-status">Reservation status</label><select id="reservation-status" className="form-select text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>{[{ id: '', label: 'All reservations' }, { id: 'pending', label: 'Pending' }, { id: 'confirmed', label: 'Confirmed' }, { id: 'completed', label: 'Completed' }, { id: 'cancelled', label: 'Cancelled' }, { id: 'rejected', label: 'Rejected' }].map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div><div className="relative sm:max-w-xs w-full"><Search className="w-4 h-4 absolute top-3 left-3 text-slate-400" /><label className="sr-only" htmlFor="reservation-search">Search reservations on this page</label><input id="reservation-search" className="form-input pl-9" placeholder="Search this page by court or reference" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
    {loading ? <LoadingSpinner message="Loading reservations…" /> : error ? <div className="card text-center space-y-4" role="alert"><AlertCircle className="w-8 h-8 mx-auto text-rose-400" /><p className="text-sm text-slate-500">{error}</p><button className="btn-primary text-sm" onClick={fetchReservations}>Try again</button></div> : visible.length === 0 ? <div className="card py-14 text-center space-y-3"><CalendarDays className="w-10 h-10 text-slate-300 mx-auto" /><h2 className="font-bold text-xl">No reservations to show</h2><p className="text-sm text-slate-500">Try another filter or make time for your next game.</p><Link to="/book" className="btn-primary text-sm gap-2">Find your court <ArrowRight className="w-4 h-4" /></Link></div> : <div className="card p-0 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500 border-b"><tr><th className="text-left p-4">Reservation</th><th className="text-left p-4">Session</th><th className="text-right p-4">Total</th><th className="text-center p-4">Status</th><th className="text-right p-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((reservation) => <tr key={reservation.id} className="hover:bg-slate-50/70"><td className="p-4"><Link to={`/reservations/${reservation.id}`} className="font-mono font-semibold text-pickle-600 hover:underline">{reservation.reference_number}</Link><p className="font-semibold mt-1 text-navy-600">{reservation.court_name}</p><p className="text-xs capitalize text-slate-400 mt-1">{reservation.court_type}</p></td><td className="p-4 whitespace-nowrap"><p>{displayDate(reservation.reservation_date)}</p><p className="text-xs text-slate-400 mt-1">{reservation.start_time?.slice(0, 5)}–{reservation.end_time?.slice(0, 5)}</p></td><td className="p-4 text-right font-bold whitespace-nowrap">{formatMoney(reservation.total_price)}</td><td className="p-4 text-center"><span className={`badge badge-${reservation.status} capitalize`}>{reservation.status}</span></td><td className="p-4"><div className="flex justify-end gap-2 whitespace-nowrap"><Link className="btn-outline py-1.5 px-3 text-xs" to={`/reservations/${reservation.id}`}>Details</Link><button className="btn-outline py-1.5 px-3 text-xs" disabled={openingId !== null} onClick={() => openAction(reservation.id, 'receipt')}>Summary</button>{['pending', 'confirmed'].includes(reservation.status) && <button className="btn-primary py-1.5 px-3 text-xs" disabled={openingId !== null} onClick={() => openAction(reservation.id, 'payment')}>{openingId === reservation.id ? 'Loading…' : 'Payment'}</button>}</div></td></tr>)}</tbody></table></div></div>}
    {!loading && !error && pages > 1 && <div className="flex items-center justify-between text-sm"><button className="btn-outline text-xs gap-1" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="w-4 h-4" /> Previous</button><p className="text-slate-500">Page {page} of {pages}</p><button className="btn-outline text-xs gap-1" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight className="w-4 h-4" /></button></div>}
    <PaymentModal isOpen={Boolean(selectedPayment)} onClose={() => setSelectedPayment(null)} reservation={selectedPayment} onSuccess={fetchReservations} />
    <ReceiptModal isOpen={Boolean(selectedReceipt)} onClose={() => setSelectedReceipt(null)} reservation={selectedReceipt} />
  </div>;
}
