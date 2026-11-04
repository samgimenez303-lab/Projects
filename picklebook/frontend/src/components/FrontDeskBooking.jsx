import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, Banknote, CheckCircle, Clock, Printer, Search, X } from 'lucide-react';
import { courtsAPI, paymentsAPI, staffAPI } from '../services/api';
import { bookingDurations, displayDate, facilityClock, formatMoney, localDate, readBookingPolicy } from '../utils/booking';
import BookingCalendar from './BookingCalendar';
import ReceiptModal from './ReceiptModal';

const minutes = time => Number(String(time || '').slice(0, 2)) * 60 + Number(String(time || '').slice(3, 5));

function CounterForm({ onCancel, onSaved }) {
  const id = useId();
  const [courts, setCourts] = useState([]);
  const [courtId, setCourtId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [gcashConfigured, setGcashConfigured] = useState(false);
  const [customerMode, setCustomerMode] = useState('walk-in');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [startNow, setStartNow] = useState(true);
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(1);
  const [policy, setPolicy] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const searchRequest = useRef(0);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    const tick = window.setInterval(() => setClock(Date.now()), 30000);
    return () => { active.current = false; searchRequest.current += 1; window.clearInterval(tick); };
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true); setLoadError('');
    courtsAPI.getAll().then(response => {
      const rows = response.data?.data?.courts;
      if (!Array.isArray(rows)) throw new Error('Courts could not be loaded.');
      const availableCourts = rows.filter(court => court.is_active !== false && Number(court.is_active) !== 0);
      if (current) { setCourts(availableCourts); setCourtId(previous => availableCourts.some(court => String(court.id) === previous) ? previous : String(availableCourts[0]?.id || '')); }
    }).catch(err => { if (current) setLoadError(err.message || 'Unable to load courts.'); })
      .finally(() => { if (current) setLoading(false); });
    paymentsAPI.getInstructions().then(response => { if (current) setGcashConfigured(response.data?.data?.gcash?.configured === true); })
      .catch(() => { if (current) setGcashConfigured(false); });
    return () => { current = false; };
  }, [reload]);

  const currentClock = facilityClock(new Date(clock), policy?.timeZone);
  useEffect(() => {
    if (!courtId || !startNow) return undefined;
    let current = true;
    setAvailabilityLoading(true); setAvailabilityError(''); setAvailability(null);
    courtsAPI.getAvailability(courtId, currentClock.date).then(response => {
      const data = response.data?.data;
      const nextPolicy = readBookingPolicy(data);
      if (!nextPolicy || !bookingDurations(nextPolicy).length) throw new Error('Court booking settings could not be loaded.');
      if (current) { setAvailability(data); setPolicy(nextPolicy); }
    }).catch(err => { if (current) setAvailabilityError(err.message || 'Unable to check this court.'); })
      .finally(() => { if (current) setAvailabilityLoading(false); });
    return () => { current = false; };
  }, [courtId, startNow, currentClock.date, reload]);

  const durations = useMemo(() => bookingDurations(policy), [policy]);
  useEffect(() => { if (durations.length && !durations.includes(Number(duration))) setDuration(durations[0]); }, [durations, duration]);
  const court = courts.find(value => String(value.id) === courtId);
  const total = court && duration > 0 ? Math.round(Number(court.price_per_hour) * duration * 100) / 100 : 0;
  useEffect(() => { setAmount(total > 0 ? total.toFixed(2) : ''); }, [total]);
  useEffect(() => { setReceived(false); }, [courtId, duration, method, reference, amount, customerMode, customer?.id, name, phone, startNow, date, time]);

  const immediateReason = useMemo(() => {
    if (!availability) return '';
    if (availability.reason) return availability.reason;
    const start = minutes(currentClock.time), end = start + Number(duration) * 60;
    if (end >= 1440) return 'Choose a shorter session that finishes before midnight.';
    if (availability.open_time && start < minutes(availability.open_time)) return 'This court has not opened yet. Choose a scheduled time.';
    if (availability.close_time && end > minutes(availability.close_time)) return 'This session would finish after closing. Choose a shorter duration or another court.';
    if ((availability.booked_reservations || []).some(booking => minutes(booking.start_time) < end && minutes(booking.end_time) > start)) return 'This court is booked during this session. Choose another court or a scheduled time.';
    return '';
  }, [availability, currentClock.time, duration]);

  const findCustomers = async () => {
    const query = search.trim();
    if (query.length < 2) { setSearchError('Enter at least two characters to search.'); return; }
    const request = ++searchRequest.current;
    setSearching(true); setSearchError(''); setCustomers([]);
    try {
      const response = await staffAPI.searchCustomers(query);
      if (!Array.isArray(response.data?.data?.customers)) throw new Error('Customer search could not be read.');
      if (active.current && request === searchRequest.current) setCustomers(response.data.data.customers);
    } catch (err) { if (active.current && request === searchRequest.current) setSearchError(err.message || 'Customer search failed. You can enter a walk-in name instead.'); }
    finally { if (active.current && request === searchRequest.current) setSearching(false); }
  };

  const validAmount = total > 0 && /^\d+(\.\d{1,2})?$/.test(amount) && Math.round(Number(amount) * 100) === Math.round(total * 100);
  const canSubmit = !loading && !saving && Boolean(court) && Boolean(policy) && validAmount && received &&
    (customerMode === 'walk-in' ? Boolean(name.trim()) : Boolean(customer)) &&
    (method !== 'gcash' || gcashConfigured && Boolean(reference.trim())) &&
    (startNow ? !availabilityLoading && !availabilityError && !immediateReason && Boolean(availability) : Boolean(date && time && endTime));

  const submit = async event => {
    event.preventDefault();
    if (submitting.current || !canSubmit) return;
    submitting.current = true; setSaving(true); setError('');
    const payload = {
      court_id: Number(courtId),
      ...(customerMode === 'existing' ? { customer_id: customer.id } : { customer_name: name.trim(), customer_phone: phone.trim() || null }),
      payment_method: method, amount_received: amount, payment_received: true,
      ...(method === 'gcash' ? { transaction_reference: reference.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(startNow ? { start_now: true, duration_hours: Number(duration) } : { start_now: false, reservation_date: date, start_time: time, end_time: endTime }),
    };
    let saved;
    try {
      const response = await staffAPI.createWalkInReservation(payload);
      saved = response.data?.data;
      if (!saved?.reservation?.id || !saved?.payment?.id) throw new Error('The save response could not be read. Check the daily schedule and payment history before retrying.');
    } catch (err) {
      if (active.current) { setError(err.message || 'The booking could not be saved. Check the schedule and payment history before retrying.'); setSaving(false); }
      submitting.current = false;
      return;
    }
    // The payment is committed. Refreshing other screens must never turn it into a failed save.
    if (active.current) onSaved(saved);
  };

  return <form aria-label="Front desk court booking" onSubmit={submit} className="mt-5 space-y-6 border-t border-slate-200 pt-5">
    <fieldset disabled={saving} className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Reserve a court and record the payment already received at reception.</p><button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-500 inline-flex items-center gap-1"><X size={16} />Close form</button></div>
      {loading ? <p role="status" className="text-sm text-slate-500">Loading courts…</p> : loadError ? <div role="alert" className="text-sm text-rose-700"><p>{loadError}</p><button type="button" onClick={() => setReload(value => value + 1)} className="underline mt-2">Try again</button></div> : !courts.length ? <p role="alert" className="text-sm text-amber-700">No active courts are available.</p> : <>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 min-w-0">
            <fieldset><legend className="form-label">Customer</legend><div className="flex flex-wrap gap-4 text-sm"><label className="inline-flex items-center gap-2"><input type="radio" name="customer_mode" value="walk-in" checked={customerMode === 'walk-in'} onChange={() => setCustomerMode('walk-in')} />Walk-in customer</label><label className="inline-flex items-center gap-2"><input type="radio" name="customer_mode" value="existing" checked={customerMode === 'existing'} onChange={() => setCustomerMode('existing')} />Existing customer</label></div></fieldset>
            {customerMode === 'walk-in' ? <><div><label htmlFor={`${id}-customer-name`} className="form-label">Customer name</label><input id={`${id}-customer-name`} name="customer_name" className="form-input" maxLength={100} required value={name} onChange={event => setName(event.target.value)} autoComplete="off" /></div><div><label htmlFor={`${id}-phone`} className="form-label">Phone <span className="text-slate-400 font-normal">(optional)</span></label><input id={`${id}-phone`} name="customer_phone" type="tel" maxLength={20} className="form-input" value={phone} onChange={event => setPhone(event.target.value)} /></div></> : <div className="space-y-3"><label htmlFor={`${id}-search`} className="form-label">Find a customer account</label><div className="flex flex-col sm:flex-row gap-2"><input id={`${id}-search`} name="customer_search" type="search" className="form-input min-w-0" placeholder="Name, email, or phone" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setCustomer(null); setCustomers([]); searchRequest.current += 1; setSearching(false); }} /><button type="button" onClick={findCustomers} disabled={searching || search.trim().length < 2} className="btn-outline text-xs whitespace-nowrap gap-1.5"><Search size={15} />{searching ? 'Searching…' : 'Search customers'}</button></div>{searchError && <p role="alert" className="text-sm text-rose-700">{searchError}</p>}{customers.length > 0 && <ul className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100">{customers.map(value => <li key={value.id}><button type="button" aria-label={`Select customer ${value.name}`} className={`w-full text-left p-3 text-sm ${customer?.id === value.id ? 'bg-pickle-50' : 'hover:bg-slate-50'}`} onClick={() => setCustomer(value)}><strong className="block">{value.name}{customer?.id === value.id ? ' · Selected' : ''}</strong><span className="text-xs text-slate-500 break-all">{value.email}{value.phone ? ` · ${value.phone}` : ''}</span></button></li>)}</ul>}{customer && <p className="text-sm font-semibold text-pickle-700">Selected: {customer.name}</p>}</div>}
          </div>
          <div className="space-y-4 min-w-0"><div><label htmlFor={`${id}-court`} className="form-label">Court</label><select id={`${id}-court`} name="court_id" className="form-input" value={courtId} required onChange={event => { setCourtId(event.target.value); setTime(''); setEndTime(''); }}><option value="" disabled>Choose a court</option>{courts.map(value => <option key={value.id} value={value.id}>{value.name} · {formatMoney(value.price_per_hour)} / hour</option>)}</select></div>
            <fieldset><legend className="form-label">When does play begin?</legend><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={startNow} onClick={() => setStartNow(true)} className={startNow ? 'btn-primary text-xs gap-1.5' : 'btn-outline text-xs gap-1.5'}><Clock size={15} />Pay &amp; play now</button><button type="button" aria-pressed={!startNow} onClick={() => { setStartNow(false); setTime(''); setEndTime(''); }} className={!startNow ? 'btn-primary text-xs' : 'btn-outline text-xs'}>Choose a time</button></div></fieldset>
            {startNow && <><div><label htmlFor={`${id}-duration`} className="form-label">Session length</label><select id={`${id}-duration`} name="duration_hours" className="form-input" value={duration} onChange={event => setDuration(Number(event.target.value))} disabled={availabilityLoading || !durations.length}>{durations.map(value => <option key={value} value={value}>{value} {value === 1 ? 'hour' : 'hours'}</option>)}</select></div><p className="text-xs text-slate-500">Starts at the current facility time ({currentClock.time.slice(0, 5)}{policy ? `, ${policy.timeZone}` : ''}). The exact start is saved by the server.</p>{availabilityLoading && <p role="status" className="text-sm text-slate-500">Checking court hours…</p>}{(availabilityError || immediateReason) && <div role="alert" className="text-sm text-amber-700"><p>{availabilityError || immediateReason}</p><button type="button" onClick={() => setReload(value => value + 1)} className="underline mt-2">Check again</button></div>}</>}
          </div>
        </div>
        {!startNow && courtId && <div className="border border-slate-200 rounded-xl p-4"><BookingCalendar courtId={courtId} selectedDate={date} onDateChange={setDate} selectedTime={time} onTimeChange={(start, end) => { setTime(start); setEndTime(end); }} duration={duration} onDurationChange={setDuration} onPolicyChange={setPolicy} /></div>}
        <div className="grid gap-6 lg:grid-cols-2 border-t border-slate-200 pt-5">
          <div className="space-y-4"><div><label htmlFor={`${id}-method`} className="form-label">Payment received by</label><select id={`${id}-method`} name="payment_method" className="form-input" value={method} onChange={event => setMethod(event.target.value)}><option value="cash">Cash</option><option value="gcash" disabled={!gcashConfigured}>GCash{gcashConfigured ? '' : ' · Merchant not configured'}</option></select></div>{method === 'gcash' && <div><label htmlFor={`${id}-reference`} className="form-label">GCash transaction reference</label><input id={`${id}-reference`} name="transaction_reference" className="form-input" required maxLength={100} value={reference} onChange={event => setReference(event.target.value)} autoComplete="off" /></div>}<div><label htmlFor={`${id}-amount`} className="form-label">Amount recorded</label><input id={`${id}-amount`} name="amount_received" type="number" min="0.01" step="0.01" required className="form-input" value={amount} onChange={event => setAmount(event.target.value)} />{amount && !validAmount && <p className="text-xs text-rose-700 mt-2">Record the full court total of {formatMoney(total)}.</p>}</div></div>
          <div className="rounded-xl border border-pickle-100 bg-pickle-50 p-4"><p className="text-xs font-bold uppercase text-pickle-700">Court total</p><p className="text-3xl font-black text-navy-500 mt-2" data-testid="counter-total">{formatMoney(total)}</p><p className="text-sm text-slate-500 mt-2">{formatMoney(court?.price_per_hour)} × {duration} hour(s)</p><p className="text-xs text-slate-500 mt-3">The server checks availability and the court rate again when saving. The recorded payment will appear in payment history and on the receipt.</p></div>
        </div>
        <div><label htmlFor={`${id}-notes`} className="form-label">Notes <span className="text-slate-400 font-normal">(optional)</span></label><textarea id={`${id}-notes`} name="notes" rows={2} maxLength={2000} className="form-input" value={notes} onChange={event => setNotes(event.target.value)} /></div>
        <label className="flex items-start gap-3 text-sm font-semibold text-slate-700"><input name="payment_received" type="checkbox" required checked={received} onChange={event => setReceived(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />{method === 'cash' ? 'I have received the full cash payment.' : 'I checked this GCash transfer in the merchant account and received the full amount.'}</label>
        <p className="text-xs text-slate-500">This records a payment you have already received. It does not send money or charge the customer.</p>
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex gap-2"><AlertCircle size={18} className="shrink-0" /><span>{error}</span></div>}
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={!canSubmit} className="btn-primary text-sm gap-2"><Banknote size={17} />{saving ? 'Saving booking & payment…' : 'Save booking & payment'}</button><button type="button" onClick={onCancel} className="btn-outline text-sm">Cancel</button></div>
      </>}
    </fieldset>
  </form>;
}

export default function FrontDeskBooking({ onBooked }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState('');
  const begin = () => { setSaved(null); setRefreshWarning(''); setOpen(true); };
  const handleSaved = payload => {
    const payment = payload.payment;
    const reservation = { ...payload.reservation, payments: payload.reservation.payments?.length ? payload.reservation.payments : [payment] };
    setSaved({ reservation, payment }); setOpen(false); setRefreshWarning('');
    Promise.resolve().then(() => onBooked?.(reservation)).catch(() => setRefreshWarning('The booking and payment are saved. Refresh the daily schedule to see this booking.'));
  };
  return <section className="card p-4 sm:p-6" data-testid="frontdesk-booking" aria-labelledby="frontdesk-booking-heading">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-pickle-600">Counter booking</p><h2 id="frontdesk-booking-heading" className="text-lg font-bold text-navy-500 mt-1">Pay, reserve, and play</h2><p className="text-sm text-slate-500 mt-1">Book for a customer and keep their payment on record.</p></div>{!open && <button type="button" onClick={begin} className="btn-primary text-xs sm:text-sm gap-2 max-w-full whitespace-normal"><Banknote size={17} className="shrink-0" />Reserve court &amp; record payment</button>}</div>
    {open && <CounterForm onCancel={() => setOpen(false)} onSaved={handleSaved} />}
    {saved && <div className="mt-5 rounded-xl border border-emerald-200 p-4 space-y-3" role="status"><div className="flex items-start gap-2"><CheckCircle size={20} className="text-emerald-700 shrink-0" /><div><p className="font-bold text-slate-900">Booking saved and payment recorded</p><p className="text-sm text-slate-500 mt-1">{saved.reservation.status === 'completed' ? 'The customer is checked in and ready to play.' : 'The reservation is confirmed for the selected time.'}</p></div></div><p className="font-mono text-sm font-bold text-pickle-700">{saved.reservation.reference_number}</p><p className="text-sm text-slate-600">{saved.reservation.user_name || saved.reservation.walk_in_name} · {saved.reservation.court_name} · {displayDate(saved.reservation.reservation_date)} · {saved.reservation.start_time?.slice(0, 5)}–{saved.reservation.end_time?.slice(0, 5)}</p><p className="text-sm font-bold">{formatMoney(saved.payment.amount)} recorded by {saved.payment.payment_method.toUpperCase()}</p>{refreshWarning && <p className="text-sm text-amber-700">{refreshWarning}</p>}<div className="flex flex-wrap gap-2"><button type="button" onClick={() => setReceiptOpen(true)} className="btn-outline text-xs gap-2"><Printer size={15} />View payment receipt</button><button type="button" onClick={begin} className="btn-outline text-xs">New counter booking</button></div></div>}
    {saved && receiptOpen && <ReceiptModal isOpen onClose={() => setReceiptOpen(false)} reservation={saved.reservation} payment={saved.payment} />}
  </section>;
}
