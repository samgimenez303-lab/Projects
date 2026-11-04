import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Grid, AlertCircle, House, Sun } from 'lucide-react';
import { courtsAPI } from '../services/api';
import CourtCard from '../components/CourtCard';
import LoadingSpinner from '../components/LoadingSpinner';
import useCourtServices from '../hooks/useCourtServices';

const categories = [
  { value: 'all', label: 'All courts', Icon: Grid },
  { value: 'indoor', label: 'Indoor', Icon: House },
  { value: 'outdoor', label: 'Outdoor', Icon: Sun },
];

export default function Courts() {
  const [params, setParams] = useSearchParams();
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const services = useCourtServices();
  const type = ['indoor', 'outdoor'].includes(params.get('type')) ? params.get('type') : 'all';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    courtsAPI.getAll().then(({ data }) => {
      if (!Array.isArray(data.data?.courts)) throw new Error('Court information is unavailable.');
      if (active) setCourts(data.data.courts.filter(court =>
        ['indoor', 'outdoor'].includes(court.court_type) && court.is_active !== 0 && court.is_active !== false));
    }).catch(err => {
      if (active) { setCourts([]); setError(err.message); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const changeType = (value) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value === 'all') next.delete('type'); else next.set('type', value);
    return next;
  });
  const reset = () => changeType('all');
  const filtered = courts.filter(court => type === 'all' || court.court_type === type);
  const hasFilters = type !== 'all';

  return (
    <div className="pb-20">
      <section className="page-banner">
        <div className="page-container">
          <span className="eyebrow">COURTS & RESERVATIONS</span>
          <h1>Find your kind of court.</h1>
          <p>Explore indoor and outdoor courts, compare the details, and reserve your time to play.</p>
        </div>
      </section>

      <section className="page-container pt-8 space-y-7" aria-label="Find and reserve a court">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2" role="group" aria-label="Court category">
            {categories.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => changeType(value)}
                aria-pressed={type === value}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-2 sm:px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
                  type === value ? 'bg-navy-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={17} className="hidden sm:block" aria-hidden="true" />
                {label}
                {!loading && !error && <span className={`hidden sm:inline-block rounded-md px-1.5 py-0.5 text-xs ${type === value ? 'bg-white/15' : 'bg-white'}`}>
                  {value === 'all' ? courts.length : courts.filter(court => court.court_type === value).length}
                </span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 text-sm text-slate-500" aria-live="polite">
          <span>{loading ? 'Finding your courts...' : `${filtered.length} court${filtered.length === 1 ? '' : 's'} to explore`}</span>
          {hasFilters && <button type="button" onClick={reset} className="text-link">Show all courts</button>}
        </div>

        {loading ? <LoadingSpinner message="Loading courts..." /> : error ? (
          <div className="card py-12 text-center" role="alert">
            <AlertCircle className="mx-auto text-amber-600 mb-3" size={28} />
            <h2 className="font-bold text-lg">We couldn't load the courts</h2>
            <p className="text-sm text-slate-500 my-3">{error}</p>
            <button className="btn-outline text-sm" type="button" onClick={() => setReload(value => value + 1)}>Try again</button>
          </div>
        ) : !filtered.length ? (
          <div className="card py-16 text-center">
            <Grid className="mx-auto text-slate-400 mb-3" size={28} />
            <h2 className="font-bold text-lg">{hasFilters ? 'No courts in this category' : 'No courts listed yet'}</h2>
            <p className="text-sm text-slate-500 mt-2 mb-5">{hasFilters ? 'Try another category or view all courts.' : 'Check back soon for available indoor and outdoor courts.'}</p>
            {hasFilters && <button type="button" onClick={reset} className="btn-outline text-sm">Show all courts</button>}
          </div>
        ) : (
          <div className="space-y-12">
            {services.filter(service => type === 'all' || service.category === type).map(service => {
              const categoryCourts = filtered.filter(court => court.court_type === service.category);
              const Icon = service.category === 'indoor' ? House : Sun;
              return (
                <section key={service.category} aria-labelledby={`${service.category}-heading`} className="space-y-5">
                  <div className="flex items-start gap-4">
                    <span className={`rounded-xl p-3 ${service.category === 'indoor' ? 'bg-navy-50 text-navy-600' : 'bg-pickle-50 text-pickle-700'}`}>
                      <Icon size={24} aria-hidden="true" />
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 id={`${service.category}-heading`} className="text-2xl font-bold">{service.category === 'indoor' ? 'Indoor courts' : 'Outdoor courts'}</h2>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">{categoryCourts.length} court{categoryCourts.length === 1 ? '' : 's'}</span>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{service.description}</p>
                    </div>
                  </div>
                  {categoryCourts.length ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryCourts.map(court => <CourtCard court={court} key={court.id} />)}
                    </div>
                  ) : <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No {service.category} courts{hasFilters ? ' match these filters.' : ' are listed yet.'}</p>}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
