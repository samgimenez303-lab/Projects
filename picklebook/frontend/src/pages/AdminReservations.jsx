import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, FileText, Search, XCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { reservationsAPI, courtsAPI, staffAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ReceiptModal from '../components/ReceiptModal';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));
const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'];
const validDate = (value) => {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : '';
};

export default function AdminReservations() {
  const [params, setParams] = useSearchParams();
  const [reservations, setReservations] = useState([]);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const statusFilter = statuses.includes(params.get('status')) ? params.get('status') : '';
  const courtFilter = /^[1-9]\d*$/.test(params.get('courtId') || '') ? params.get('courtId') : '';
  const dateFilter = validDate(params.get('date'));
  const searchQuery = params.get('search') || '';
  const rawPage = params.get('page') || '1';
  const page = /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) ? Number(rawPage) : 1;
  const [total, setTotal] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const requestId = useRef(0);
  const latestFetchRef = useRef(null);
  const { showSuccess, showError } = useNotification();
  const limit = 20;

  const fetchReservations = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true); setError('');
    try {
      const response = await reservationsAPI.getAll({ page, limit, search: searchQuery.trim(), status: statusFilter, courtId: courtFilter, date: dateFilter });
      const data = response.data?.data;
      if (!Array.isArray(data?.reservations)) throw new Error('Reservation records could not be loaded.');
      if (currentRequest === requestId.current) {
        const nextTotal = Math.max(0, Number(data.total) || 0);
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / limit));
        setReservations(data.reservations);
        setTotal(nextTotal);
        if (page > nextTotalPages) setParams(previous => {
          const next = new URLSearchParams(previous);
          if (nextTotalPages > 1) next.set('page', String(nextTotalPages)); else next.delete('page');
          return next;
        }, { replace: true });
      }
    } catch (err) {
      if (currentRequest === requestId.current) { setReservations([]); setError(err.message || 'Unable to load reservations.'); }
    } finally { if (currentRequest === requestId.current) setLoading(false); }
  }, [page, searchQuery, statusFilter, courtFilter, dateFilter, setParams]);
  latestFetchRef.current = fetchReservations;

  useEffect(() => { fetchReservations(); return () => { requestId.current += 1; }; }, [fetchReservations]);
  useEffect(() => {
    let active = true;
    courtsAPI.getAll().then((response) => {
      const data = response.data?.data?.courts;
      if (active && Array.isArray(data)) setCourts(data);
    }).catch((err) => { if (active) showError(err.message || 'Court filters could not be loaded.'); });
    return () => { active = false; };
  }, []);

  const filterChange = (key, value, replace = false) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value); else next.delete(key);
      next.delete('page');
      return next;
    }, { replace });
  };
  const setPage = (value) => {
    const nextPage = typeof value === 'function' ? value(page) : value;
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (nextPage > 1) next.set('page', String(nextPage)); else next.delete('page');
      return next;
    });
  };
  const resetFilters = () => setParams(previous => {
    const next = new URLSearchParams(previous);
    ['search', 'status', 'courtId', 'date', 'page'].forEach(key => next.delete(key));
    return next;
  });
  const handleAction = async (reservation, action) => {
    if (action === 'cancelled' && !window.confirm(`Cancel reservation ${reservation.reference_number}?`)) return;
    setBusyId(reservation.id);
    try {
      if (action === 'cancelled') await reservationsAPI.cancel(reservation.id, 'Cancelled by administrator');
      else if (action === 'completed') await staffAPI.checkInReservation(reservation.id);
      else await reservationsAPI.updateStatus(reservation.id, action);
      showSuccess(action === 'completed' ? 'Player checked in. Payment has been verified.' : `Reservation ${action}.`);
      await latestFetchRef.current();
    } catch (err) { showError(err.message || 'The reservation could not be updated.'); }
    finally { setBusyId(null); }
  };

  const handleReceipt = async (id) => {
    setBusyId(id);
    try {
      const response = await reservationsAPI.getById(id);
      const reservation = response.data?.data?.reservation;
      if (!reservation) throw new Error('Receipt details are unavailable.');
      setSelectedReceipt(reservation);
    } catch (err) { showError(err.message || 'Unable to load the receipt.'); }
    finally { setBusyId(null); }
  };

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-pickle-600">Booking management</p><h1 className="text-2xl sm:text-3xl font-black text-navy-500 mt-1">Court reservations</h1><p className="text-sm text-slate-500 mt-2">Manage indoor and outdoor court bookings, arrival, and booking records.</p></div><button type="button" disabled={loading || busyId !== null} onClick={fetchReservations} className="btn-outline text-xs">Refresh</button></div>
    <div className="card p-4"><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <div className="relative"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><label className="sr-only" htmlFor="reservation-search">Search reservations</label><input id="reservation-search" type="search" placeholder="Reference, player, or court" value={searchQuery} onChange={(event) => filterChange('search', event.target.value, true)} className="form-input pl-9 text-sm" /></div>
      <div><label className="sr-only" htmlFor="reservation-status">Reservation status</label><select id="reservation-status" value={statusFilter} onChange={(event) => filterChange('status', event.target.value)} className="form-select text-sm"><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select></div>
      <div><label className="sr-only" htmlFor="reservation-court">Court</label><select id="reservation-court" value={courtFilter} onChange={(event) => filterChange('courtId', event.target.value)} className="form-select text-sm"><option value="">All courts</option>{courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}</select></div>
      <div><label className="sr-only" htmlFor="reservation-filter-date">Booking date</label><input id="reservation-filter-date" type="date" value={dateFilter} onChange={(event) => filterChange('date', event.target.value)} className="form-input text-sm" /></div>
    </div>{(searchQuery || statusFilter || courtFilter || dateFilter) && <button type="button" onClick={resetFilters} className="text-xs font-semibold text-pickle-700 mt-3 underline">Reset filters</button>}</div>
    {loading ? <LoadingSpinner message="Loading reservations" /> : error ? <div role="alert" className="card p-6 border-rose-200 bg-rose-50"><p className="text-sm text-rose-800">{error}</p><button type="button" onClick={fetchReservations} className="btn-outline text-xs mt-4">Try again</button></div> : reservations.length === 0 ? <div className="card py-16 text-center"><Calendar className="w-10 h-10 mx-auto text-slate-300 mb-3" /><p className="font-bold text-slate-700">No reservations found</p><p className="text-sm text-slate-500 mt-1">Adjust the filters or check again after a player books.</p></div> : <div className="card overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Reference', 'Customer', 'Court', 'Schedule', 'Total', 'Status', 'Actions'].map((label) => <th key={label} scope="col" className="text-left px-4 py-4 whitespace-nowrap">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{reservations.map((reservation) => <tr key={reservation.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-mono text-xs font-bold text-pickle-700">{reservation.reference_number}</td><td className="px-4 py-4"><strong className="block text-sm">{reservation.user_name}</strong><span className="text-xs text-slate-500">{reservation.user_email}</span></td><td className="px-4 py-4 whitespace-nowrap">{reservation.court_name}</td><td className="px-4 py-4 whitespace-nowrap"><p>{reservation.reservation_date}</p><p className="text-xs text-slate-500">{reservation.start_time?.slice(0, 5)}–{reservation.end_time?.slice(0, 5)}</p></td><td className="px-4 py-4 font-bold whitespace-nowrap">{money(reservation.total_price)}</td><td className="px-4 py-4"><span className={`badge badge-${reservation.status}`}>{reservation.status}</span></td><td className="px-4 py-4"><div className="flex gap-2 items-center"><button type="button" disabled={busyId !== null} onClick={() => handleReceipt(reservation.id)} className="p-2 rounded-lg hover:bg-slate-100" aria-label={`View receipt for ${reservation.reference_number}`}><FileText className="w-4 h-4" /></button>{reservation.status === 'pending' && <button type="button" disabled={busyId !== null} onClick={() => handleAction(reservation, 'confirmed')} className="text-xs font-semibold text-emerald-700 underline">Approve</button>}{reservation.status === 'confirmed' && <button type="button" disabled={busyId !== null} onClick={() => handleAction(reservation, 'completed')} className="text-xs font-semibold text-navy-600 underline whitespace-nowrap">Check in</button>}{['pending', 'confirmed'].includes(reservation.status) && <button type="button" disabled={busyId !== null} onClick={() => handleAction(reservation, 'cancelled')} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600" aria-label={`Cancel ${reservation.reference_number}`}><XCircle className="w-4 h-4" /></button>}</div></td></tr>)}</tbody></table></div><div className="flex justify-between items-center gap-3 border-t border-slate-100 p-4 text-xs text-slate-500"><p>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} reservations</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || busyId !== null} onClick={() => setPage((value) => value - 1)} className="btn-outline text-xs py-2">Previous</button><button type="button" disabled={page * limit >= total || busyId !== null} onClick={() => setPage((value) => value + 1)} className="btn-outline text-xs py-2">Next</button></div></div></div>}
    {selectedReceipt && <ReceiptModal isOpen onClose={() => setSelectedReceipt(null)} reservation={selectedReceipt} />}
  </div>;
}
