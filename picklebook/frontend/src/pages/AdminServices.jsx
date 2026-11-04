import React, { useEffect, useState } from 'react';
import { Edit, Save, X, House, Sun, RefreshCw } from 'lucide-react';
import { servicesAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import useDialog from '../hooks/useDialog';
import { COURT_SERVICES } from '../data/courtServices';

const AdminServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialog(Boolean(editing), () => setEditing(null), saving);
  const { showSuccess, showError } = useNotification();

  const loadServices = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await servicesAPI.getAll();
      const records = response.data?.data?.services;
      if (!Array.isArray(records)) throw new Error('The service list could not be read.');
      setServices(records);
    } catch (err) {
      setError(err.message || 'Could not load services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadServices(); }, []);

  const openEditor = (type) => {
    const record = services.find((service) => service.category === type.category);
    setEditing({ type, record });
    setForm({
      name: record?.name || type.name,
      description: record?.description || type.description,
      is_active: record ? Boolean(record.is_active) : true,
    });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: editing.type.category,
        is_active: form.is_active ? 1 : 0,
        image_url: editing.type.image_url,
      };
      if (editing.record) await servicesAPI.update(editing.record.id, payload);
      else await servicesAPI.create(payload);
      showSuccess('Court service saved.');
      setEditing(null);
      await loadServices();
    } catch (err) {
      showError(err.message || 'Could not save this service.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!editing) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape' && !saving) setEditing(null); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editing, saving]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-pickle-700">Catalog management</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy-700">Court services</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">Manage the indoor and outdoor service descriptions. Set hourly rates, operating hours and bookable availability in Court Management.</p>
      </div>

      {loading ? <LoadingSpinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6" role="alert"><p className="text-sm text-rose-800">{error}</p><button type="button" onClick={loadServices} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-rose-900"><RefreshCw className="h-4 w-4" /> Try again</button></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {COURT_SERVICES.map((type) => {
            const record = services.find((service) => service.category === type.category);
            const Icon = type.category === 'indoor' ? House : Sun;
            return (
              <article key={type.category} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-pickle-50 text-pickle-700"><Icon className="h-6 w-6" /></span><span className={`badge ${!record ? 'badge-pending' : record.is_active ? 'badge-confirmed' : 'badge-cancelled'}`}>{!record ? 'Not configured' : record.is_active ? 'Active listing' : 'Disabled listing'}</span></div>
                <p className="mt-5 text-xs font-bold uppercase tracking-widest text-pickle-700">{type.category}</p>
                <h2 className="mt-2 text-xl font-bold text-navy-700">{record?.name || type.name}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">{record?.description || type.description}</p>
                <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-5"><p className="text-xs text-slate-500">Pricing comes from each court.</p><button type="button" onClick={() => openEditor(type)} className="inline-flex items-center gap-2 text-sm font-bold text-pickle-700"><Edit className="h-4 w-4" />{record ? 'Edit listing' : 'Create listing'}</button></div>
              </article>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">The two service types guide customers to matching courts. Bookings do not add a separate service fee. Historical add-on records remain attached to previous reservations.</div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="service-editor-title" tabIndex={-1} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-navy-700 p-5 text-white"><h2 id="service-editor-title" className="font-bold capitalize text-white">Edit {editing.type.category} service</h2><button type="button" onClick={() => setEditing(null)} disabled={saving} aria-label="Close editor"><X className="h-5 w-5" /></button></div>
            <form onSubmit={save} className="space-y-5 p-6">
              <div><label htmlFor="service-name" className="form-label">Service name</label><input id="service-name" className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={100} required autoFocus /></div>
              <div><label htmlFor="service-description" className="form-label">Description</label><textarea id="service-description" className="form-input" rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={2000} /></div>
              <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Use this description on the services page</label>
              <p className="text-xs leading-6 text-slate-500">Court availability is managed separately. Disabling this listing restores the standard court type description.</p>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" className="btn-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button><button type="submit" className="btn-primary gap-2" disabled={saving}>{saving ? <LoadingSpinner size="sm" color="white" /> : <Save className="h-4 w-4" />} {saving ? 'Saving...' : 'Save service'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminServices;
