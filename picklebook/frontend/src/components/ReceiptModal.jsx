import React from 'react';
import { CheckCircle, Clock, Printer, X } from 'lucide-react';
import useDialog from '../hooks/useDialog';
import { displayDate, formatMoney, paymentSummary } from '../utils/booking';
import '../styles/receipt.css';

export default function ReceiptModal({ isOpen, onClose, reservation, payment }) {
  const dialogRef = useDialog(isOpen, onClose);
  if (!isOpen || !reservation) return null;
  const records = reservation.payments || (payment ? [payment] : []);
  const summary = paymentSummary(reservation, records);
  const currentPayment = payment || summary.latest;
  const status = currentPayment?.payment_status || reservation.payment_status || 'pending';
  const isPaid = summary.due === 0 && summary.paid > 0;
  return <div className="receipt-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-sm p-4 flex items-start justify-center">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="receipt-title" tabIndex={-1} className="receipt-dialog bg-white rounded-2xl max-w-xl w-full my-4 shadow-2xl overflow-hidden">
      <header className="no-print bg-slate-50 p-4 border-b flex flex-wrap items-center justify-between gap-3"><h2 id="receipt-title" className="text-sm font-bold">{isPaid ? 'Payment receipt' : 'Booking receipt'}</h2><div className="flex gap-2"><button type="button" className="btn-secondary py-2 px-3 text-xs gap-2" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print / PDF</button><button type="button" aria-label="Close receipt" className="p-2 rounded-lg hover:bg-slate-200" onClick={onClose}><X className="w-5 h-5" /></button></div></header>
      <div id="printable-receipt" className="p-6 sm:p-8 text-slate-800 bg-white">
        <div className="border-b-2 border-navy-600 pb-5"><p className="text-2xl font-black text-navy-600">Pickle<span className="text-pickle-600">Book</span></p><p className="text-xs text-slate-500 mt-1">Indoor & outdoor pickleball court reservations</p><h3 className="text-lg font-bold mt-5">{isPaid ? 'Payment receipt' : 'Booking receipt — payment not verified'}</h3><p className="font-mono text-sm mt-1">{reservation.reference_number}</p></div>
        <div className="grid grid-cols-2 gap-5 text-sm py-5"><div><p className="text-xs text-slate-400 uppercase">Player</p><p className="font-semibold mt-1">{reservation.user_name || 'Account holder'}</p><p className="text-xs text-slate-500 break-all">{reservation.user_email}</p></div><div><p className="text-xs text-slate-400 uppercase">Session</p><p className="font-semibold mt-1">{reservation.court_name}</p><p className="text-xs text-slate-500 mt-1">{displayDate(reservation.reservation_date)}</p><p className="text-xs text-slate-500">{reservation.start_time?.slice(0, 5)}–{reservation.end_time?.slice(0, 5)}</p></div></div>
        <table className="w-full text-xs"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="text-left py-2">Description</th><th className="text-right py-2">Amount</th></tr></thead><tbody><tr className="border-b border-slate-100"><td className="py-3">{reservation.court_name} · {reservation.duration_hours} hour(s)</td><td className="text-right font-semibold">{formatMoney(reservation.court_price)}</td></tr>{reservation.services?.map((service) => <tr key={service.id} className="border-b border-slate-100"><td className="py-3">{service.name || service.service_name} × {service.quantity}</td><td className="text-right">{formatMoney(service.total_price ?? Number(service.unit_price) * Number(service.quantity))}</td></tr>)}</tbody></table>
        <dl className="space-y-2 border-t-2 border-navy-600 mt-4 pt-4 text-sm"><div className="flex justify-between font-bold"><dt>Reservation total</dt><dd>{formatMoney(reservation.total_price)}</dd></div><div className="flex justify-between text-slate-600"><dt>Verified payment</dt><dd>{formatMoney(summary.paid)}</dd></div><div className="flex justify-between text-lg font-black pt-2"><dt>Balance due</dt><dd className="text-pickle-600">{formatMoney(summary.due)}</dd></div></dl>
        <div className="mt-6 rounded-lg border border-slate-200 p-4 text-xs space-y-2"><div className="flex justify-between gap-3"><span className="text-slate-500">Payment method</span><strong className="uppercase">{currentPayment?.payment_method || 'Not selected'}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-500">Payment status</span><strong className={`flex gap-1 items-center capitalize ${status === 'verified' ? 'text-emerald-700' : 'text-amber-700'}`}>{status === 'verified' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{status}</strong></div>{currentPayment?.transaction_reference && <div className="flex justify-between gap-3"><span className="text-slate-500">Transaction reference</span><span className="font-mono break-all">{currentPayment.transaction_reference}</span></div>}<div className="flex justify-between gap-3"><span className="text-slate-500">Reservation status</span><strong className="capitalize">{reservation.status}</strong></div></div>
        <p className="text-sm font-semibold text-center mt-6">Thank you for choosing PickleBook!</p>
        <p className="text-xs text-slate-500 text-center mt-2">{isPaid ? 'Your payment has been verified. Present your reservation reference at check-in.' : 'This booking receipt is not proof of payment. GCash transfers need staff verification; cash must be recorded at the counter.'}</p>
      </div>
    </section>
  </div>;
}
