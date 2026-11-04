import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { Save, Shield, Smartphone, Building, RefreshCw } from 'lucide-react';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    business_name: '',
    business_email: '',
    business_phone: '',
    business_address: '',
    gcash_number: '',
    gcash_name: '',
    booking_advance_days: '',
    min_booking_duration: '',
    max_booking_duration: '',
    cancellation_deadline_hours: '',
    cancellation_refund_percentage: '',
    require_admin_approval: '',
    booking_slot_interval: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const { showSuccess, showError } = useNotification();

  const fetchSettings = async () => {
      setLoading(true);
      setLoadError('');
      setLoaded(false);
      try {
        const res = await adminAPI.getSettings();
        const map = res.data?.data?.map;
        if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('The settings response could not be read.');
        setSettings((current) => Object.fromEntries(Object.keys(current).map((key) => [key, map[key] === undefined ? '' : String(map[key])])));
        setLoaded(true);
      } catch (err) {
        setLoadError(err.message || 'Could not load settings.');
      } finally {
        setLoading(false);
      }
    };
  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!loaded) return;
    const number = settings.gcash_number.replace(/[\s()-]/g, '');
    if ((number || settings.gcash_name.trim()) && (!/^(09\d{9}|\+?639\d{9})$/.test(number) || settings.gcash_name.trim().length < 2)) {
      showError('Enter a valid GCash mobile number and account name, or clear both fields to disable GCash.');
      return;
    }
    if (Number(settings.min_booking_duration) > Number(settings.max_booking_duration)) {
      showError('Minimum booking duration cannot exceed the maximum.');
      return;
    }
    setSaving(true);
    try {
      await adminAPI.updateSettings({ ...settings, gcash_number: number, gcash_name: settings.gcash_name.trim() });
      showSuccess('System settings saved successfully.');
    } catch (err) {
      showError(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading settings..." />;
  }
  if (loadError) {
    return <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-rose-50 p-6" role="alert"><h1 className="text-lg font-bold text-rose-900">Settings could not be loaded</h1><p className="mt-2 text-sm text-rose-800">{loadError}</p><button type="button" onClick={fetchSettings} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-rose-900"><RefreshCw className="h-4 w-4" /> Try again</button></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pickle-600">
          Configuration
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-navy-500 tracking-tight mt-0.5">
          System & Facility Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure reservation policies, GCash recipient accounts, and facility contact details.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Profile */}
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-navy-500 tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-pickle-600" />
            <span>Facility & Business Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="business_name">
                Business Display Name
              </label>
              <input
                id="business_name"
                name="business_name"
                type="text"
                value={settings.business_name}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="business_email">
                Support Email
              </label>
              <input
                id="business_email"
                name="business_email"
                type="email"
                value={settings.business_email}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="business_phone">
                Contact Phone
              </label>
              <input
                id="business_phone"
                name="business_phone"
                type="text"
                value={settings.business_phone}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="business_address">
                Physical Address
              </label>
              <input
                id="business_address"
                name="business_address"
                type="text"
                value={settings.business_address}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* GCash Settings */}
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-navy-500 tracking-wider flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <span>GCash Payment Settings</span>
          </h3>
          <p className="text-sm leading-6 text-slate-500">Enter the verified facility account customers should pay. Leave both fields blank to disable GCash. Staff must verify each submitted reference before it is marked paid.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="gcash_number">
                GCash Recipient Number
              </label>
              <input
                id="gcash_number"
                name="gcash_number"
                type="tel"
                maxLength={20}
                value={settings.gcash_number}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="gcash_name">
                GCash Account Name
              </label>
              <input
                id="gcash_name"
                name="gcash_name"
                type="text"
                maxLength={100}
                value={settings.gcash_name}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Booking Rules */}
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-navy-500 tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-pickle-600" />
            <span>Reservation Policies & Rules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label" htmlFor="booking_advance_days">
                Max Days in Advance
              </label>
              <input
                id="booking_advance_days"
                name="booking_advance_days"
                type="number"
                required
                min="1"
                max="90"
                value={settings.booking_advance_days}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="min_booking_duration">
                Min Duration (Hours)
              </label>
              <input
                id="min_booking_duration"
                name="min_booking_duration"
                type="number"
                required
                min="1"
                value={settings.min_booking_duration}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="max_booking_duration">
                Max Duration (Hours)
              </label>
              <input
                id="max_booking_duration"
                name="max_booking_duration"
                type="number"
                required
                min="1"
                max="8"
                value={settings.max_booking_duration}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label" htmlFor="cancellation_deadline_hours">
                Cancellation Deadline (Hours before start)
              </label>
              <input
                id="cancellation_deadline_hours"
                name="cancellation_deadline_hours"
                type="number"
                min="0"
                required
                value={settings.cancellation_deadline_hours}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="cancellation_refund_percentage">
                Cancellation Refund (%)
              </label>
              <input
                id="cancellation_refund_percentage"
                name="cancellation_refund_percentage"
                type="number"
                required
                min="0"
                max="100"
                value={settings.cancellation_refund_percentage}
                onChange={handleChange}
                className="form-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || !loaded}
            className="btn-primary py-2.5 px-8 text-xs font-bold gap-2 shadow"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span>Saving settings...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All System Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;

