import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { contactAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import useDialog from '../hooks/useDialog';
import {
  MessageSquare,
  Search,
  Mail,
  X,
  Phone,
  RefreshCw
} from 'lucide-react';

const inquiryStatuses = ['new', 'read', 'replied', 'closed'];

const AdminContacts = () => {
  const [params, setParams] = useSearchParams();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const statusFilter = inquiryStatuses.includes(params.get('status')) ? params.get('status') : 'all';
  const searchQuery = params.get('search') || '';
  const rawPage = params.get('page') || '1';
  const page = /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) ? Number(rawPage) : 1;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const requestId = useRef(0);
  const latestFetchRef = useRef(null);
  const dialogRef = useDialog(Boolean(selectedInquiry), () => setSelectedInquiry(null));
  const { showSuccess, showError } = useNotification();

  const limit = 20;

  const fetchInquiries = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setLoadError('');
    try {
      const res = await contactAPI.getAll({ page, limit, status: statusFilter === 'all' ? '' : statusFilter, search: searchQuery.trim() });
      const data = res.data?.data;
      const records = data?.inquiries;
      if (!Array.isArray(records)) throw new Error('The inquiry list could not be read.');
      if (currentRequest !== requestId.current) return;
      const nextTotal = Math.max(0, Number(data.total) || 0);
      const nextTotalPages = Math.max(1, Number(data.totalPages) || Math.ceil(nextTotal / limit));
      setInquiries(records);
      setTotal(nextTotal);
      setTotalPages(nextTotalPages);
      if (page > nextTotalPages) setParams(previous => {
        const next = new URLSearchParams(previous);
        if (nextTotalPages > 1) next.set('page', String(nextTotalPages)); else next.delete('page');
        return next;
      }, { replace: true });
    } catch (err) {
      if (currentRequest === requestId.current) {
        setInquiries([]);
        setLoadError(err.message || 'Could not load contact inquiries.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page, statusFilter, searchQuery, setParams]);
  latestFetchRef.current = fetchInquiries;

  useEffect(() => {
    fetchInquiries();
    return () => { requestId.current += 1; };
  }, [fetchInquiries]);

  const filterChange = (key, value, replace = false) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value && (key !== 'status' || value !== 'all')) next.set(key, value); else next.delete(key);
    next.delete('page');
    return next;
  }, { replace });

  const changePage = (nextPage) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (nextPage > 1) next.set('page', String(nextPage)); else next.delete('page');
    return next;
  });

  const handleUpdateStatus = async (id, status) => {
    try {
      await contactAPI.updateStatus(id, status);
      showSuccess(`Inquiry marked as ${status}.`);
      await latestFetchRef.current();
      setSelectedInquiry(previous => previous?.id === id ? { ...previous, status } : previous);
    } catch (err) {
      showError(err.message || 'Status update failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pickle-600">
          Customer Inquiries
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-navy-500 tracking-tight mt-0.5">
          Messages & Support Tickets
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review court inquiries, reply using your email app and track each message status.
        </p>
      </div>

      {/* Filter and Search */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'All Inquiries' },
            { id: 'new', label: 'New' },
            { id: 'read', label: 'Read' },
            { id: 'replied', label: 'Replied' },
            { id: 'closed', label: 'Closed' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => filterChange('status', tab.id)}
              aria-pressed={statusFilter === tab.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-navy-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search inquiries"
            placeholder="Search inquiries..."
            value={searchQuery}
            onChange={(e) => filterChange('search', e.target.value, true)}
            className="form-input pl-9 text-xs"
          />
        </div>
      </div>

      {/* Inquiries Table */}
      {loading ? (
        <LoadingSpinner />
      ) : loadError ? (
        <div className="card border border-rose-200 bg-rose-50 p-6" role="alert">
          <p className="font-bold text-rose-900">Contact inquiries could not be loaded</p>
          <p className="mt-2 text-sm text-rose-800">{loadError}</p>
          <button type="button" onClick={fetchInquiries} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-rose-900"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      ) : inquiries.length === 0 ? (
        <div className="card py-16 text-center text-slate-400">
          <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-slate-600">No inquiries found</p>
          <p className="text-xs">{searchQuery || statusFilter !== 'all' ? 'Try a different search or status filter.' : 'New contact form submissions will appear here.'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0 border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="text-left py-3.5 px-4">Sender</th>
                  <th className="text-left py-3.5 px-4">Subject</th>
                  <th className="text-left py-3.5 px-4">Received</th>
                  <th className="text-center py-3.5 px-4">Status</th>
                  <th className="text-right py-3.5 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 block">{inq.name}</span>
                      <span className="text-[11px] text-slate-400">{inq.email}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 block">{inq.subject}</span>
                      <span className="text-slate-400 line-clamp-1 text-[11px]">{inq.message}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {inq.created_at?.slice(0, 10)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`badge ${
                          inq.status === 'new'
                            ? 'badge-pending'
                            : inq.status === 'replied'
                            ? 'badge-confirmed'
                            : 'badge-rejected'
                        }`}
                      >
                        {inq.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedInquiry(inq)}
                        className="btn-outline text-xs py-1 px-3 font-semibold"
                      >
                        View & Reply
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !loadError && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <p>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} inquiries</p>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-outline text-xs py-2" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="btn-outline text-xs py-2" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Inquiry Detail & Reply Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="inquiry-title" tabIndex={-1} className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="bg-navy-500 text-white p-5 flex items-center justify-between">
              <div>
                <h3 id="inquiry-title" className="text-base font-bold text-white">Inquiry from {selectedInquiry.name}</h3>
                <p className="text-xs text-navy-200">{selectedInquiry.email}</p>
              </div>
              <button
                type="button"
                aria-label="Close inquiry"
                onClick={() => setSelectedInquiry(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Subject
                </span>
                <p className="text-sm font-bold text-slate-800">{selectedInquiry.subject}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Customer Message
                </span>
                <div className="mt-1 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedInquiry.message}
                </div>
              </div>

              {selectedInquiry.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedInquiry.phone}</span>
                </div>
              )}

              <div className="space-y-4 border-t border-slate-100 pt-4">
                <p className="text-sm leading-7 text-slate-500">Open this conversation in your email app. After sending your reply, mark the inquiry as replied here.</p>
                <a href={`mailto:${encodeURIComponent(selectedInquiry.email)}?subject=${encodeURIComponent(`Re: ${selectedInquiry.subject}`)}`} className="btn-primary gap-2"><Mail className="h-4 w-4" /> Reply in email app</a>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'closed')}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
                    >
                      Close Ticket
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedInquiry(null)}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Dismiss
                    </button>
                    <button type="button" onClick={() => handleUpdateStatus(selectedInquiry.id, 'replied')} className="btn-secondary text-xs">Mark as replied</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminContacts;

