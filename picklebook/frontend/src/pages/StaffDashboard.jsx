import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Banknote, Calendar, CheckCircle, Clock, Printer, Search, User, UserCheck } from 'lucide-react';
import { staffAPI, reservationsAPI, paymentsAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { localDate } from '../utils/booking';
import LoadingSpinner from '../components/LoadingSpinner';
import ReceiptModal from '../components/ReceiptModal';
import PlayerBoard from '../components/PlayerBoard';
import FrontDeskBooking from '../components/FrontDeskBooking';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));

export default function StaffDashboard() {
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [dailySchedule, setDailySchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const requestId = useRef(0);
  const { showSuccess, showError } = useNotification();

  const fetchSchedule = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true); setError('');
    try {
      const response = await staffAPI.getDailySchedule(selectedDate);
      const courts = response.data?.data?.courts;
      if (!Array.isArray(courts)) throw new Error('The daily schedule could not be loaded.');
      const reservations = courts.flatMap((court) => (court.reservations || []).map((reservation) => ({
        ...reservation, court_name: court.name, court_type: court.court_type
      }))).sort((a, b) => a.start_time.localeCompare(b.start_time));
      if (currentRequest === requestId.current) setDailySchedule(reservations);
    } catch (err) {
      if (currentRequest === requestId.current) { setDailySchedule([]); setError(err.message || 'Unable to load the daily schedule.'); }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchSchedule(); return () => { requestId.current += 1; }; }, [fetchSchedule]);

  const handleCheckIn = async (reservationId) => {
    setBusyId(reservationId);
    try {
      await staffAPI.checkInReservation(reservationId);
      showSuccess('Player checked in successfully.');
      await fetchSchedule();
    } catch (err) { showError(err.message || 'Check-in could not be saved.'); }
    finally { setBusyId(null); }
  };

  const handleRecordCash = async (reservation) => {
    if (!window.confirm(`Have you collected ${money(reservation.total_price)} in cash from ${reservation.user_name}?`)) return;
    setBusyId(reservation.id);
    try {
      await staffAPI.recordCashPayment({ reservation_id: reservation.id });
      showSuccess(`Cash payment recorded for ${reservation.reference_number}.`);
      await fetchSchedule();
    } catch (err) { showError(err.message || 'The cash payment could not be recorded.'); }
    finally { setBusyId(null); }
  };

  const handleReview = async (reservation, action) => {
    if (action === 'verified' && !window.confirm(`Confirm that the full ${money(reservation.total_price)} GCash transfer for ${reservation.reference_number} has arrived in the merchant account?`)) return;
    const notes = action === 'rejected' ? window.prompt('Explain why this reference could not be verified:') : '';
    if (action === 'rejected' && !notes?.trim()) return;
    setBusyId(reservation.id);
    try {
      await paymentsAPI.verify(reservation.payment_id, action, notes || undefined);
      showSuccess(action === 'verified' ? 'GCash payment verified.' : 'Payment rejected. The customer can correct the reference.');
      await fetchSchedule();
    } catch (err) { showError(err.message || 'The payment review could not be saved.'); }
    finally { setBusyId(null); }
  };

  const handleReceipt = async (reservationId) => {
    setBusyId(reservationId);
    try {
      const response = await reservationsAPI.getById(reservationId);
      const reservation = response.data?.data?.reservation;
      if (!reservation) throw new Error('Receipt details are unavailable.');
      setSelectedReceipt(reservation);
    } catch (err) { showError(err.message || 'Unable to load the receipt.'); }
    finally { setBusyId(null); }
  };

  const query = searchQuery.trim().toLowerCase();
  const filtered = dailySchedule.filter((reservation) => [reservation.user_name, reservation.reference_number, reservation.court_name].some((value) => String(value || '').toLowerCase().includes(query)));

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-wider text-pickle-600">Front desk operations</p><h1 className="text-2xl sm:text-3xl font-black text-navy-500 mt-1">Court bookings &amp; check-in</h1><p className="text-sm text-slate-500 mt-2">Reserve courts, record payments, and manage up to four players per shared timer.</p></div>
      <div className="flex items-center gap-2"><label className="sr-only" htmlFor="staff-date">Schedule date</label><input id="staff-date" type="date" value={selectedDate} disabled={busyId !== null} onChange={(event) => { if (event.target.value) setSelectedDate(event.target.value); }} className="form-input text-sm" /><button type="button" onClick={fetchSchedule} disabled={loading || busyId !== null} className="btn-outline text-xs whitespace-nowrap">Refresh</button></div>
    </div>
    <FrontDeskBooking onBooked={reservation => { const bookingDate = String(reservation.reservation_date).slice(0, 10); if (bookingDate !== selectedDate) setSelectedDate(bookingDate); else return fetchSchedule(); }} />
    <PlayerBoard />
    <h2 className="text-lg font-bold text-navy-500">Scheduled bookings</h2>
    <div className="card p-4"><div className="relative max-w-md"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><label className="sr-only" htmlFor="staff-search">Search bookings</label><input id="staff-search" type="search" placeholder="Search player, court, or booking reference" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="form-input pl-9 text-sm" /></div></div>
    {loading ? <LoadingSpinner message="Loading daily schedule" /> : error ? <div role="alert" className="card p-6 border-rose-200 bg-rose-50"><p className="text-sm text-rose-800">{error}</p><button type="button" onClick={fetchSchedule} className="btn-outline text-xs mt-4">Try again</button></div> : filtered.length === 0 ? <div className="card py-16 text-center"><Calendar className="w-10 h-10 mx-auto text-slate-300 mb-3" /><p className="font-bold text-slate-700">{query ? 'No matching bookings' : 'No scheduled bookings for this date'}</p><p className="text-sm text-slate-500 mt-1">{query ? 'Try another player, court, or reference.' : 'Choose another date to see the schedule.'}</p></div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map((reservation) => {
      const checkedIn = reservation.status === 'completed';
      const paid = reservation.payment_status === 'verified';
      const submitted = reservation.payment_status === 'submitted';
      return <article key={reservation.id} className={`card p-5 flex flex-col ${checkedIn ? 'border-emerald-200' : ''}`}>
        <div className="flex justify-between gap-2"><div><p className="font-mono text-xs font-bold text-pickle-700">{reservation.reference_number}</p><h2 className="font-bold text-slate-900 mt-1">{reservation.court_name}</h2></div><span className={`badge self-start ${checkedIn ? 'badge-completed' : 'badge-pending'}`}>{checkedIn ? 'Checked in' : 'Awaiting arrival'}</span></div>
        <div className="border-y border-slate-100 my-4 py-4 space-y-2 text-sm"><p className="flex items-center gap-2 font-semibold"><User className="w-4 h-4 text-slate-400" />{reservation.user_name}</p>{reservation.user_phone && <p className="text-slate-500 pl-6">{reservation.user_phone}</p>}<p className="flex gap-2 items-center text-slate-600"><Clock className="w-4 h-4 text-pickle-600" />{reservation.start_time?.slice(0, 5)}–{reservation.end_time?.slice(0, 5)} <span className="text-xs">({reservation.duration_hours}h)</span></p></div>
        <div className="flex items-center justify-between gap-2 text-sm"><span className="font-bold">{money(reservation.total_price)}</span><span className={paid ? 'text-emerald-700' : 'text-amber-700'}>{paid ? 'Payment verified' : submitted ? 'Reference in review' : 'Payment due'}</span></div>
        {submitted && <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-900"><p>Check the merchant account before approving this transfer.</p><div className="flex gap-2 mt-3"><button type="button" disabled={busyId !== null} onClick={() => handleReview(reservation, 'verified')} className="font-bold underline">Verify transfer</button><button type="button" disabled={busyId !== null} onClick={() => handleReview(reservation, 'rejected')} className="text-rose-700 font-bold underline">Reject reference</button></div></div>}
        <div className="flex justify-between gap-2 mt-auto pt-5"><button type="button" disabled={busyId !== null} onClick={() => handleReceipt(reservation.id)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100" aria-label={`View receipt for ${reservation.reference_number}`}><Printer className="w-4 h-4" /></button><div className="flex gap-2 items-center">{!paid && !submitted && !checkedIn && <button type="button" disabled={busyId !== null} onClick={() => handleRecordCash(reservation)} className="btn-outline text-xs gap-1.5 px-3"><Banknote className="w-4 h-4" />Record cash</button>}{checkedIn ? <span className="text-xs text-emerald-700 font-bold flex gap-1 items-center"><CheckCircle className="w-4 h-4" />Checked in</span> : <button type="button" disabled={busyId !== null || !paid || reservation.status !== 'confirmed'} onClick={() => handleCheckIn(reservation.id)} className="btn-primary text-xs gap-1.5 px-3" title={!paid ? 'Verify the full payment before check-in' : undefined}><UserCheck className="w-4 h-4" />Check in</button>}</div></div>
      </article>;
    })}</div>}
    {selectedReceipt && <ReceiptModal isOpen onClose={() => setSelectedReceipt(null)} reservation={selectedReceipt} />}
  </div>;
}
