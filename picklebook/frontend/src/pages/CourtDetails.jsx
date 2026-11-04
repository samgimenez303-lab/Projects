import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courtsAPI } from '../services/api';
import BookingCalendar from '../components/BookingCalendar';
import LoadingSpinner from '../components/LoadingSpinner';
import useCourtServices from '../hooks/useCourtServices';
import { getCourtImage } from '../utils/courtImages';
import {
  ArrowLeft,
  Users,
  Zap,
  Armchair,
  Clock,
  House,
  Sun,
  Check,
  ArrowRight
} from 'lucide-react';

const CourtDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const services = useCourtServices();
  const [court, setCourt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  // Calendar states
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setCourt(null);
    const fetchCourt = async () => {
      try {
        const res = await courtsAPI.getById(id);
        if (active) setCourt(res.data?.data?.court || null);
      } catch (err) {
        if (active) setError(err.message || 'Unable to load court details.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchCourt();
    return () => { active = false; };
  }, [id, reload]);

  const handleProceedToBooking = () => {
    if (!selectedTime) return;
    navigate(`/book?courtId=${court.id}&date=${selectedDate}&time=${selectedTime}&duration=${duration}`);
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading court details..." />;
  }

  if (!court) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-800">{error ? 'Unable to load court' : 'Court not found'}</h2>
        {error && <p role="alert" className="text-sm text-slate-500 mt-3">{error}</p>}
        {error && <button type="button" className="btn-outline mt-4 mr-3 text-xs" onClick={() => setReload(value => value + 1)}>Try again</button>}
        <Link to="/courts" className="btn-primary mt-4 text-xs">
          Back to all courts
        </Link>
      </div>
    );
  }

  const { imageUrl, defaultImage } = getCourtImage(court);
  const service = services.find(item => item.category === court.court_type);
  const ServiceIcon = court.court_type === 'indoor' ? House : Sun;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Back button */}
      <div>
        <Link
          to="/courts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Courts</span>
        </Link>
      </div>

      {/* Main Grid: Court Information & Inline Availability Booking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Photos, specs, description */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Photo */}
          <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-100 relative h-72 sm:h-96 bg-slate-100">
            <img
              src={imageUrl}
              alt={court.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                if (e.currentTarget.getAttribute('src') !== defaultImage) {
                  e.currentTarget.src = defaultImage;
                }
              }}
            />
            <div className="absolute top-4 left-4 flex gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  court.court_type === 'indoor'
                    ? 'bg-navy-600 text-white'
                    : 'bg-pickle-600 text-white'
                }`}
              >
                {court.court_type}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 text-slate-800 backdrop-blur-sm capitalize">
                {court.surface_type?.replace('_', ' ')} Surface
              </span>
            </div>
          </div>

          {/* Details Card */}
          <div className="card p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-navy-500 tracking-tight">
                  {court.name}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {court.court_type === 'indoor' ? 'Indoor' : 'Outdoor'} pickleball court
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-3xl font-black text-pickle-600 font-display">
                  ₱{Number(court.price_per_hour || 0).toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 block font-medium">per hour</span>
              </div>
            </div>

            {service && (
              <section className="rounded-xl border border-pickle-100 bg-pickle-50/60 p-5" aria-labelledby="court-services-heading">
                <div className="flex items-start gap-3">
                  <ServiceIcon className="mt-1 h-5 w-5 shrink-0 text-pickle-700" aria-hidden="true" />
                  <div>
                    <h2 id="court-services-heading" className="text-xs font-bold uppercase tracking-wider text-pickle-700">Court services</h2>
                    <h3 className="mt-2 text-lg font-bold">{service.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{service.description}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {service.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-pickle-700" aria-hidden="true" />{feature}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-pickle-100 pt-3 text-xs leading-5 text-slate-500">Reserve this court using the schedule. Your total is based on its hourly rate and your selected duration.</p>
              </section>
            )}

            {/* Amenities Grid */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Features & Amenities
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Users className="w-5 h-5 text-navy-500 mb-1" />
                  <span className="text-[11px] text-slate-500 block font-medium">Capacity</span>
                  <span className="text-xs font-bold text-slate-800">
                    Up to {court.max_players || 4} Players
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Zap className="w-5 h-5 text-amber-500 mb-1" />
                  <span className="text-[11px] text-slate-500 block font-medium">Lighting</span>
                  <span className="text-xs font-bold text-slate-800">
                    {court.has_lighting ? 'LED Glare-Free' : 'Daylight Only'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Armchair className="w-5 h-5 text-pickle-600 mb-1" />
                  <span className="text-[11px] text-slate-500 block font-medium">Seating</span>
                  <span className="text-xs font-bold text-slate-800">
                    {court.has_seating ? 'Available' : 'Not listed'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <Clock className="w-5 h-5 text-purple-600 mb-1" />
                  <span className="text-[11px] text-slate-500 block font-medium">Hours</span>
                  <span className="text-xs font-bold text-slate-800">See available schedule</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Court Description
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {court.description ||
                  'Constructed according to professional pickleball specifications, featuring cushioned multi-layer acrylic surfacing to ensure peak traction and minimize fatigue.'}
              </p>
            </div>

            {/* Rules */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <span className="font-bold text-slate-800 block">Court Etiquette & Rules:</span>
              <p>• Non-marking athletic court shoes are required at all times.</p>
              <p>• Please vacate the court promptly when your reserved slot concludes.</p>
              <p>• Only water and sports beverages are permitted on court side.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Check Live Availability & Book */}
        <div className="space-y-6">
          <div className="card p-6 shadow-md border-t-4 border-t-pickle-500 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-pickle-600">
                Check Schedule
              </span>
              <h3 className="text-lg font-bold text-navy-500 mt-0.5">
                Reserve {court.name}
              </h3>
            </div>

            <BookingCalendar
              courtId={court.id}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              selectedTime={selectedTime}
              onTimeChange={(start) => setSelectedTime(start)}
              duration={duration}
              onDurationChange={setDuration}
            />

            {/* Summary Box */}
            <div className="p-4 rounded-xl bg-navy-50 border border-navy-100 text-xs space-y-1.5">
              <div className="flex justify-between text-navy-900 font-semibold">
                <span>Date:</span>
                <span>{selectedDate}</span>
              </div>
              <div className="flex justify-between text-navy-900 font-semibold">
                <span>Time Slot:</span>
                <span>{selectedTime ? `${selectedTime} (${duration} hr${duration > 1 ? 's' : ''})` : 'Select a time'}</span>
              </div>
              <div className="flex justify-between text-pickle-700 font-bold text-sm pt-2 border-t border-navy-200">
                <span>Court Rate:</span>
                <span>₱{Number(court.price_per_hour * duration).toLocaleString()}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleProceedToBooking}
              disabled={!selectedTime}
              className="btn-primary w-full py-3.5 text-sm gap-2 font-bold shadow-md shadow-pickle-600/20"
            >
              <span>Continue reservation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourtDetails;

