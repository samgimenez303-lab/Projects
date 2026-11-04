import React, { useState } from 'react';
import { Download, FileSpreadsheet, CalendarDays, CreditCard, Users } from 'lucide-react';
import { adminAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { localDate } from '../utils/booking';

const types = [
  { id: 'reservations', name: 'Court reservations', Icon: CalendarDays, description: 'Court, player, schedule, price, and booking status.' },
  { id: 'payments', name: 'Payment records', Icon: CreditCard, description: 'Cash and GCash amounts, references, and verification status.' },
  { id: 'users', name: 'Registered players', Icon: Users, description: 'Registered accounts and contact information for administration.' },
];

export default function AdminReports() {
  const [type, setType] = useState('reservations');
  const [startDate, setStartDate] = useState(() => { const day = new Date(); day.setDate(day.getDate() - 30); return localDate(day); });
  const [endDate, setEndDate] = useState(localDate());
  const [busy, setBusy] = useState(false);
  const { showSuccess, showError } = useNotification();
  const exportReport = async event => {
    event.preventDefault();
    if (type !== 'users' && startDate > endDate) { showError('The end date must be on or after the start date.'); return; }
    setBusy(true);
    try {
      const response = await adminAPI.getReportsCsv({ type, ...(type !== 'users' && { startDate, endDate }) });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url; link.download = `picklebook-${type}-${localDate()}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showSuccess('Report exported.');
    } catch (error) { showError(error.message || 'The report could not be exported. Please try again.'); }
    finally { setBusy(false); }
  };
  return <div className="max-w-5xl space-y-7"><div><span className="eyebrow">YOUR FACILITY, IN FOCUS</span><h1 className="text-2xl sm:text-3xl font-bold">Reports &amp; exports</h1><p className="text-sm text-slate-500 mt-2">Download current facility records for reconciliation and planning.</p></div><form onSubmit={exportReport} className="space-y-6"><fieldset disabled={busy}><legend className="form-label mb-3">Choose a report</legend><div className="grid sm:grid-cols-3 gap-4">{types.map(({ id, name, Icon, description }) => <label key={id} className={`card cursor-pointer transition-colors ${type === id ? 'border-pickle-600 ring-1 ring-pickle-600 bg-pickle-50/30' : 'hover:border-slate-300'}`}><div className="flex justify-between items-center"><Icon size={24} className="text-pickle-700" /><input type="radio" name="report-type" value={id} checked={type === id} onChange={() => setType(id)} className="accent-green-700" /></div><span className="block text-sm font-bold text-navy-500 mt-5">{name}</span><span className="block text-xs leading-relaxed text-slate-500 mt-2">{description}</span></label>)}</div></fieldset><div className="card space-y-5"><div className="flex items-center gap-3"><FileSpreadsheet size={22} className="text-pickle-700" /><h2 className="font-bold">Prepare your export</h2></div>{type !== 'users' ? <div className="grid sm:grid-cols-2 gap-4"><div><label htmlFor="report-start" className="form-label">From</label><input id="report-start" type="date" className="form-input" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} required disabled={busy} /></div><div><label htmlFor="report-end" className="form-label">To</label><input id="report-end" type="date" className="form-input" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} required disabled={busy} /></div></div> : <p className="text-sm text-slate-600">The player report includes all registered accounts.</p>}<p className="text-xs text-slate-500 leading-relaxed">CSV files open in your spreadsheet application. Payment reports include each record’s verification status; verified payments represent received payments.</p><button type="submit" disabled={busy} className="btn-primary gap-2 text-sm"><Download size={17} />{busy ? 'Preparing export...' : 'Download CSV'}</button></div></form></div>;
}
