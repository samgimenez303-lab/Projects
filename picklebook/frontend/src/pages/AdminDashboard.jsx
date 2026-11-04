import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, CalendarDays,
  CheckCircle2, ChevronRight, Clock3, CreditCard, FileBarChart2, Grid2X2,
  Mail, RefreshCw, Settings2, ShieldCheck, Users, Wallet,
} from 'lucide-react';
import { adminAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatMoney, localDate } from '../utils/booking';
import '../styles/admin-dashboard.css';

const attentionItems = [
  { key: 'payment_verifications', title: 'Transfers to verify', description: 'Review submitted GCash references', to: '/admin/payments?status=submitted', Icon: CreditCard, tone: 'green' },
  { key: 'cash_collections', title: 'Cash to collect', description: 'Record cash after it is received', to: '/admin/payments?status=pending&method=cash', Icon: Banknote, tone: 'amber' },
  { key: 'pending_reservations', title: 'Bookings to approve', description: 'Review pending reservations', to: '/admin/reservations?status=pending', Icon: CalendarDays, tone: 'blue' },
  { key: 'new_inquiries', title: 'New inquiries', description: 'Help your next player get started', to: '/admin/contacts?status=new', Icon: Mail, tone: 'rose' },
];

const controls = [
  { title: 'Reservations', detail: 'Bookings & check-in', to: '/admin/reservations', Icon: CalendarDays },
  { title: 'Payments', detail: 'Receipts & verification', to: '/admin/payments', Icon: CreditCard },
  { title: 'Court management', detail: 'Court details & rates', to: '/admin/courts', Icon: Grid2X2 },
  { title: 'Court services', detail: 'Rates & extras', to: '/admin/services', Icon: Wallet },
  { title: 'Users & roles', detail: 'Your people & access', to: '/admin/users', Icon: Users },
  { title: 'Inquiries', detail: 'Player conversations', to: '/admin/contacts', Icon: Mail },
  { title: 'Reports', detail: 'Records & exports', to: '/admin/reports', Icon: FileBarChart2 },
  { title: 'Settings', detail: 'Facility preferences', to: '/admin/settings', Icon: Settings2 },
];

const number = value => value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const money = value => number(value) === null ? '—' : formatMoney(value);
const count = value => number(value) === null ? '—' : Number(value).toLocaleString('en-PH');
const monthLabel = value => {
  if (!/^\d{4}-\d{2}$/.test(value || '')) return 'Selected month';
  return new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`));
};

export default function AdminDashboard() {
  const [month, setMonth] = useState('');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setOverviewLoading(true);
    setOverviewError('');
    setOverview(null);
    adminAPI.getDashboardOverview(month ? { month } : {}).then(({ data }) => {
      const value = data?.data;
      if (!value?.finance || !value?.attention) {
        throw new Error('Facility activity could not be read. Please refresh to try again.');
      }
      if (active) setOverview(value);
    }).catch(error => { if (active) setOverviewError(error.message || 'Facility activity could not be loaded.'); })
      .finally(() => { if (active) setOverviewLoading(false); });
    return () => { active = false; };
  }, [month, refreshKey]);

  const selectedMonth = month || overview?.month || localDate().slice(0, 7);
  const selectedMonthLabel = monthLabel(overview?.month || selectedMonth);
  const finance = overview?.finance;
  const busy = overviewLoading;
  const refresh = () => setRefreshKey(value => value + 1);

  return (
    <div className="admin-overview" aria-busy={overviewLoading}>
      <header className="admin-overview-header">
        <div><span className="admin-overview-eyebrow">YOUR FACILITY. IN FOCUS.</span><h1>Facility overview<span>.</span></h1><p>A clear view of your bookings, your income, and what needs a hand.</p></div>
        <div className="admin-overview-header-actions"><div className="admin-overview-month"><label htmlFor="overview-month">BOOKING MONTH</label><div><CalendarDays size={16} aria-hidden="true" /><input id="overview-month" aria-label="Booking month" type="month" value={selectedMonth} onChange={event => { if (event.target.value) setMonth(event.target.value); }} /></div></div><button type="button" onClick={refresh} disabled={busy} className="admin-overview-refresh" aria-label="Refresh facility overview" title="Refresh facility overview"><RefreshCw size={18} className={busy ? 'animate-spin' : ''} aria-hidden="true" /></button></div>
      </header>

      {overviewError && <div className="admin-overview-alert" role="alert"><AlertCircle size={19} aria-hidden="true" /><div><strong>We couldn’t load your facility overview.</strong><p>{overviewError}</p></div><button type="button" onClick={refresh} disabled={busy}>Try again <ArrowRight size={14} aria-hidden="true" /></button></div>}

      {overviewLoading && <LoadingSpinner message="Loading facility activity..." />}

      <section aria-labelledby="finance-heading">
        <div className="admin-overview-section-label"><h2 id="finance-heading">The month in numbers</h2><span>{selectedMonthLabel} <span aria-hidden="true">·</span> Scheduled bookings</span></div>
        <div className="admin-overview-finance">
          <article className="admin-finance-card admin-finance-primary"><div className="admin-finance-card-top"><span>Expected booked income</span><span className="admin-finance-icon"><Wallet size={19} strokeWidth={1.7} aria-hidden="true" /></span></div><strong>{money(finance?.expected_income)}</strong><p>Confirmed and completed bookings scheduled this month.</p><div className="admin-finance-card-foot"><span><CalendarDays size={13} aria-hidden="true" /> {count(finance?.confirmed_bookings)} bookings</span><ArrowUpRight size={16} aria-hidden="true" /></div></article>
          <article className="admin-finance-card"><div className="admin-finance-card-top"><span>Verified against bookings</span><span className="admin-finance-icon"><ShieldCheck size={19} strokeWidth={1.7} aria-hidden="true" /></span></div><strong>{money(finance?.verified_income)}</strong><p>Verified payments for those bookings, regardless of payment date.</p><div className="admin-finance-card-foot"><span><CheckCircle2 size={13} aria-hidden="true" /> Received &amp; verified</span><ArrowDownLeft size={16} aria-hidden="true" /></div></article>
          <article className="admin-finance-card"><div className="admin-finance-card-top"><span>Outstanding income</span><span className="admin-finance-icon"><Clock3 size={19} strokeWidth={1.7} aria-hidden="true" /></span></div><strong>{money(finance?.outstanding_income)}</strong><p>The amount still unpaid on this month’s confirmed and completed bookings.</p><div className="admin-finance-card-foot"><span>Expected less verified</span><Clock3 size={15} aria-hidden="true" /></div></article>
          <article className="admin-finance-card admin-finance-pending"><div className="admin-finance-card-top"><span>Pending approval value</span><span className="admin-finance-icon"><CalendarDays size={19} strokeWidth={1.7} aria-hidden="true" /></span></div><strong>{money(finance?.pending_approval_value)}</strong><p>Pending reservations. Kept separate from expected booked income.</p><div className="admin-finance-card-foot"><span>{count(finance?.pending_approval_bookings)} awaiting approval</span><Clock3 size={15} aria-hidden="true" /></div></article>
        </div>
        <p className="admin-overview-finance-note"><ShieldCheck size={13} aria-hidden="true" /> Expected income excludes cancelled, rejected, and pending reservations. Only staff-verified payments count as received.</p>
      </section>

      <section aria-labelledby="attention-heading"><div className="admin-overview-section-label"><h2 id="attention-heading">A little attention. A smoother day.</h2><span>Items waiting for your team</span></div><div className="admin-overview-attention">{attentionItems.map(({ key, title, description, to, Icon, tone }) => <Link key={key} to={to} className={`admin-attention-card admin-attention-${tone}`}><span className="admin-attention-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span><div><strong>{count(overview?.attention?.[key])}<span>{title}</span></strong><p>{description}</p></div><ChevronRight size={16} aria-hidden="true" /></Link>)}</div></section>

      <section className="admin-overview-controls" aria-labelledby="controls-heading"><div className="admin-overview-section-label"><div><span className="admin-overview-eyebrow">EVERYTHING IN ITS PLACE</span><h2 id="controls-heading">Your management toolkit</h2></div><Link to="/staff" className="admin-overview-link">Open front desk <ArrowUpRight size={15} aria-hidden="true" /></Link></div><div className="admin-control-grid">{controls.map(({ title, detail, to, Icon }) => <Link key={to} to={to} className="admin-control-link"><span className="admin-control-icon"><Icon size={19} strokeWidth={1.6} aria-hidden="true" /></span><div><strong>{title}</strong><span>{detail}</span></div><ArrowUpRight size={15} aria-hidden="true" /></Link>)}</div></section>

    </div>
  );
}
