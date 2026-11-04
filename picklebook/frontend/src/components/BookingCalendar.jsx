import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, Clock } from 'lucide-react';
import { courtsAPI } from '../services/api';
import { addCalendarDays, bookingDurations, buildBookingSlots, facilityClock, readBookingPolicy } from '../utils/booking';

export default function BookingCalendar({ courtId, selectedDate, onDateChange, selectedTime, onTimeChange, duration = 1, onDurationChange, onPolicyChange }) {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const callbacks = useRef({ onTimeChange, onDurationChange, onPolicyChange });
  callbacks.current = { onTimeChange, onDurationChange, onPolicyChange };
  const policy = useMemo(() => readBookingPolicy(availability), [availability]);
  const today = facilityClock(new Date(), policy?.timeZone).date;
  const maxDate = policy ? addCalendarDays(today, policy.advanceDays) : undefined;
  const durations = useMemo(() => bookingDurations(policy), [policy]);
  const quickDays = useMemo(() => policy ? Array.from({ length: Math.min(7, policy.advanceDays + 1) }, (_, index) => {
    const value = addCalendarDays(today, index);
    const day = new Date(`${value}T12:00:00Z`);
    return { value, weekday: day.toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'UTC' }), day: day.getUTCDate() };
  }) : [], [policy, today]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setAvailability(null);
    callbacks.current.onTimeChange('', '');
    callbacks.current.onPolicyChange?.(null);
    if (!courtId || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate || '')) {
      setError('Choose a valid booking date.'); setLoading(false); return undefined;
    }
    // The server supplies the active booking window, duration limits and timezone.
    // A closed date still returns that policy so the player can choose another day.
    courtsAPI.getAvailability(courtId, selectedDate).then((response) => {
      const data = response.data?.data;
      if (!data || !Array.isArray(data.slots)) throw new Error('Availability could not be checked.');
      const nextPolicy = readBookingPolicy(data);
      if (!nextPolicy || !bookingDurations(nextPolicy).length) throw new Error('Court booking settings are unavailable. Please contact the facility or try again.');
      if (active) { setAvailability(data); callbacks.current.onPolicyChange?.(nextPolicy); }
    }).catch((err) => { if (active) setError(err.message || 'Unable to check court availability.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courtId, selectedDate, reload]);

  useEffect(() => {
    if (durations.length && !durations.includes(Number(duration))) callbacks.current.onDurationChange(durations[0]);
  }, [duration, durations]);
  const inWindow = Boolean(policy && selectedDate >= today && selectedDate <= maxDate);
  const slots = policy && inWindow ? buildBookingSlots(availability, duration, selectedDate) : [];
  useEffect(() => {
    if (selectedTime && !slots.some((slot) => slot.time === selectedTime && slot.isAvailable)) callbacks.current.onTimeChange('', '');
  }, [selectedTime, availability, duration, selectedDate, inWindow]);

  return <div className="space-y-6">
    <div><label htmlFor="reservation-date" className="form-label flex items-center gap-2"><CalendarDays className="w-4 h-4 text-pickle-600" /> Date</label><input id="reservation-date" type="date" min={policy ? today : undefined} max={maxDate} value={selectedDate} onChange={(event) => onDateChange(event.target.value)} className="form-input mb-3" />{policy && <p className="text-xs text-slate-500 mb-3">Book up to {policy.advanceDays} {policy.advanceDays === 1 ? 'day' : 'days'} ahead. Times shown in {policy.timeZone}.</p>}<div className="grid grid-cols-7 gap-1 sm:gap-2">{quickDays.map((day) => <button type="button" key={day.value} aria-pressed={selectedDate === day.value} onClick={() => onDateChange(day.value)} className={`rounded-xl py-3 border text-xs ${selectedDate === day.value ? 'bg-pickle-600 border-pickle-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-pickle-500'}`}><span className="block text-[10px] sm:text-xs">{day.weekday}</span><strong className="block text-base mt-1">{day.day}</strong></button>)}</div></div>
    {policy && <fieldset><legend className="form-label flex items-center gap-2"><Clock className="w-4 h-4 text-pickle-600" /> Session length</legend><div className="grid grid-cols-4 gap-2">{durations.map((hours) => <button type="button" key={hours} aria-pressed={Number(duration) === hours} onClick={() => { callbacks.current.onTimeChange('', ''); onDurationChange(hours); }} className={`rounded-lg border py-2.5 text-xs font-semibold ${Number(duration) === hours ? 'bg-navy-600 border-navy-600 text-white' : 'border-slate-200 hover:border-pickle-500'}`}>{hours} {hours === 1 ? 'hour' : 'hours'}</button>)}</div></fieldset>}
    <div aria-live="polite"><h3 className="text-sm font-bold mb-3">Choose a start time</h3>{loading ? <p className="text-sm text-slate-500 py-6">Checking court availability…</p> : error ? <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800"><p className="flex gap-2 items-center"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</p><button type="button" className="underline font-semibold mt-3" onClick={() => setReload((value) => value + 1)}>Check again</button></div> : !inWindow ? <p className="rounded-xl p-4 bg-amber-50 text-amber-900 text-sm">Choose a date between {today} and {maxDate}.</p> : availability?.reason ? <p className="rounded-xl p-4 bg-amber-50 text-amber-900 text-sm">{availability.reason}</p> : <><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{slots.map((slot) => <button type="button" key={slot.time} disabled={!slot.isAvailable} aria-pressed={selectedTime === slot.time && slot.isAvailable} onClick={() => onTimeChange(slot.time, slot.endTime)} className={`rounded-xl border py-3 text-sm font-semibold ${selectedTime === slot.time && slot.isAvailable ? 'bg-pickle-600 border-pickle-600 text-white' : slot.isAvailable ? 'border-slate-200 hover:border-pickle-500' : 'bg-slate-50 border-slate-100 text-slate-300 line-through cursor-not-allowed'}`}>{slot.time}<span className="block font-normal text-[10px] mt-1">until {slot.endTime}</span></button>)}</div>{!slots.some((slot) => slot.isAvailable) && <p className="mt-4 text-sm text-slate-500">No available times for this session length. Try another date or a shorter session.</p>}<p className="text-xs text-slate-400 mt-4">Crossed-out times are unavailable.</p></>}</div>
  </div>;
}
