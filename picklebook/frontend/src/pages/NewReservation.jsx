import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Banknote, CalendarDays, Check, CreditCard, Info, ShieldCheck } from 'lucide-react';
import { courtsAPI, paymentsAPI, reservationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import CourtCard from '../components/CourtCard';
import BookingCalendar from '../components/BookingCalendar';
import LoadingSpinner from '../components/LoadingSpinner';
import { addCalendarDays, bookingDurations, displayDate, facilityClock, formatMoney, localDate } from '../utils/booking';

const steps = ['Choose your court', 'Find your time', 'Review & payment'];

export default function NewReservation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [step, setStep] = useState(1);
  const [courts, setCourts] = useState([]);
  const [court, setCourt] = useState(null);
  const [date, setDate] = useState(() => params.get('date') || localDate());
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(1);
  const [method, setMethod] = useState('cash');
  const [policy, setPolicy] = useState(null);
  const [gcashAvailable, setGcashAvailable] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    courtsAPI.getAll().then((response) => {
      const data = response.data?.data?.courts;
      if (!Array.isArray(data)) throw new Error('Court information could not be loaded.');
      if (!active) return;
      const available = data.filter((item) => ['indoor', 'outdoor'].includes(item.court_type) && item.is_active !== 0);
      setCourts(available);
      const match = available.find((item) => String(item.id) === params.get('courtId'));
      if (match) { setCourt(match); setStep(2); }
    }).catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params, reload]);

  useEffect(() => {
    if (step !== 3) return undefined;
    let active = true;
    setPaymentLoading(true); setGcashAvailable(false);
    paymentsAPI.getInstructions().then((response) => {
      if (!active) return;
      const configured = response.data?.data?.gcash?.configured === true;
      setGcashAvailable(configured);
      if (!configured) setMethod('cash');
    }).catch(() => { if (active) { setGcashAvailable(false); setMethod('cash'); } })
      .finally(() => { if (active) setPaymentLoading(false); });
    return () => { active = false; };
  }, [step]);

  const clearTime = () => { setTime(''); setEndTime(''); };
  const handleCreate = async () => {
    if (submitted.current || submitting) return;
    if (!isAuthenticated) {
      showError('Sign in to save your reservation.');
      navigate('/login', { state: { from: { pathname: `/book?courtId=${court.id}&date=${date}` } } });
      return;
    }
    if (!court || !date || !time || !endTime) { setStep(2); return; }
    const today = facilityClock(new Date(), policy?.timeZone).date;
    if (!policy || date < today || date > addCalendarDays(today, policy.advanceDays) || !bookingDurations(policy).includes(Number(duration))) {
      showError('Please check the current court schedule before confirming.'); setStep(2); return;
    }
    if (method === 'gcash' && (!gcashAvailable || paymentLoading)) {
      showError('GCash is currently unavailable. Please choose cash at the counter.'); setMethod('cash'); return;
    }
    setSubmitting(true);
    submitted.current = true;
    try {
      const response = await reservationsAPI.create({
        court_id: court.id, reservation_date: date, start_time: time, end_time: endTime,
        payment_method: method, services: [], notes: notes.trim() || undefined,
      });
      const reservation = response.data?.data?.reservation;
      if (!reservation?.id) throw new Error('The booking response was incomplete. Check My Reservations before trying again.');
      showSuccess('Thank you for choosing PickleBook! Your reservation is saved.');
      // The saved booking stays available if the later payment submission fails.
      navigate(`/reservations/${reservation.id}`, {
        replace: true,
        state: { booked: true, savedReservation: reservation, emailDelivery: response.data?.data?.email_delivery },
      });
    } catch (err) {
      submitted.current = false;
      showError(err.message || 'Unable to reserve this time. Please check availability and try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-pickle-600">Make time for a good game</p><h1 className="text-3xl sm:text-4xl font-black mt-2">Book your next rally.</h1><p className="text-sm text-slate-500 mt-3">Indoor comfort or outdoor energy. Choose your court and we’ll take care of the schedule.</p></div>
      <ol className="grid grid-cols-3 gap-2 sm:gap-6" aria-label="Booking progress">
        {steps.map((label, index) => <li key={label} className={`flex items-center gap-2 sm:gap-3 border-t-2 pt-3 ${step >= index + 1 ? 'border-pickle-600 text-navy-600' : 'border-slate-200 text-slate-400'}`} aria-current={step === index + 1 ? 'step' : undefined}>
          <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${step > index + 1 ? 'bg-pickle-600 text-white' : 'bg-slate-100'}`}>{step > index + 1 ? <Check className="w-4 h-4" /> : index + 1}</span><span className="text-xs sm:text-sm font-semibold">{label}</span>
        </li>)}
      </ol>
      {loading ? <LoadingSpinner message="Loading available courts…" /> : error ? <div className="card text-center space-y-4" role="alert"><p>{error}</p><button className="btn-primary" onClick={() => setReload((value) => value + 1)}>Try again</button></div> : courts.length === 0 ? <div className="card text-center space-y-4"><h2 className="text-xl font-bold">No courts available yet</h2><p className="text-slate-500 text-sm">Please contact the facility for its next available opening.</p><Link to="/contact" className="btn-primary">Contact us</Link></div> : <>
        {step === 1 && <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{courts.map((item) => <CourtCard key={item.id} court={item} isSelected={court?.id === item.id} onSelect={(chosen) => { setCourt(chosen); clearTime(); setStep(2); }} />)}</div>}
        {step === 2 && <div className="card max-w-3xl mx-auto space-y-6"><div><p className="text-pickle-600 uppercase font-bold text-xs">{court?.court_type} court</p><h2 className="text-2xl font-bold mt-1">{court?.name}</h2><p className="text-sm text-slate-500 mt-2">{formatMoney(court?.price_per_hour)} per hour · availability checked before booking</p></div>
          <BookingCalendar courtId={court?.id} selectedDate={date} onDateChange={(value) => { setDate(value); clearTime(); }} selectedTime={time} onTimeChange={(start, end) => { setTime(start); setEndTime(end); }} duration={duration} onDurationChange={(value) => { setDuration(value); clearTime(); }} onPolicyChange={setPolicy} />
          <div className="flex justify-between border-t pt-5 gap-3"><button className="btn-outline gap-2" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4" /> Courts</button><button className="btn-primary gap-2" disabled={!time || !endTime} onClick={() => setStep(3)}>Review booking <ArrowRight className="w-4 h-4" /></button></div>
        </div>}
        {step === 3 && <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start"><div className="card space-y-6"><div><h2 className="text-2xl font-bold">One last check.</h2><p className="text-sm text-slate-500 mt-2">Review your session and choose how you would like to pay.</p></div>
          <fieldset className="space-y-3"><legend className="form-label mb-3">Payment method</legend>{[{ id: 'cash', title: 'Cash at the counter', detail: 'Pay the staff before your session. Your payment stays pending until recorded.', icon: Banknote }, { id: 'gcash', title: 'GCash transfer', detail: paymentLoading ? 'Checking GCash availability…' : gcashAvailable ? 'Transfer after booking, then submit the transaction reference for staff verification.' : 'GCash is currently unavailable. You can pay cash at the counter.', icon: CreditCard }].map((option) => <label key={option.id} className={`flex items-start gap-3 p-4 rounded-xl border ${option.id === 'gcash' && !gcashAvailable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${method === option.id ? 'border-pickle-600 bg-pickle-50' : 'border-slate-200'}`}><input type="radio" name="payment-method" value={option.id} checked={method === option.id} disabled={option.id === 'gcash' && (!gcashAvailable || paymentLoading)} onChange={() => setMethod(option.id)} className="mt-1 accent-green-700" /><option.icon className="w-5 h-5 text-pickle-600 mt-0.5 flex-shrink-0" /><span><strong className="block text-sm">{option.title}</strong><span className="block text-xs text-slate-500 mt-1 leading-relaxed">{option.detail}</span></span></label>)}</fieldset>
          <div><label htmlFor="booking-notes" className="form-label">Notes for the team <span className="font-normal text-slate-400">(optional)</span></label><textarea id="booking-notes" rows={3} maxLength={500} className="form-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything we should know before you arrive?" /></div>
          <div className="flex gap-2 text-xs text-slate-500 bg-slate-50 p-4 rounded-xl"><Info className="w-4 h-4 flex-shrink-0" /><p>Review your court’s equipment details, reservation status, and cancellation policy before playing.</p></div>
          <button className="btn-outline gap-2" disabled={submitting} onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4" /> Edit schedule</button>
        </div><aside className="card space-y-5 lg:sticky lg:top-24"><CalendarDays className="w-7 h-7 text-pickle-600" /><h2 className="text-lg font-bold">Your session</h2><dl className="space-y-3 text-sm"><div><dt className="text-xs text-slate-400">Court</dt><dd className="font-semibold mt-1">{court?.name}</dd></div><div><dt className="text-xs text-slate-400">Date & time</dt><dd className="font-semibold mt-1">{displayDate(date)}</dd><dd className="text-slate-500 mt-1">{time}–{endTime} · {duration} {duration === 1 ? 'hour' : 'hours'}</dd></div></dl><div className="border-t pt-4 flex justify-between items-center"><span className="text-sm font-semibold">Estimated total</span><strong className="text-xl text-pickle-600">{formatMoney(Number(court?.price_per_hour) * duration)}</strong></div><p className="text-xs text-slate-500">Final pricing and availability are confirmed when you reserve.</p><button className="btn-primary w-full gap-2" disabled={submitting} onClick={handleCreate}>{submitting ? 'Saving reservation…' : isAuthenticated ? 'Confirm reservation' : 'Sign in to reserve'}<ArrowRight className="w-4 h-4" /></button><p className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="w-4 h-4" /> No payment is collected by this button.</p></aside></div>}
      </>}
    </div>
  );
}
