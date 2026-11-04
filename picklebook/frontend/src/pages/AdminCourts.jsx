import React, { useState, useEffect } from 'react';
import { courtsAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import useDialog from '../hooks/useDialog';
import {
  Grid,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Save,
  AlertTriangle
} from 'lucide-react';

const AdminCourts = () => {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { showSuccess, showError } = useNotification();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    court_type: 'indoor',
    surface_type: 'sport_court',
    price_per_hour: 800,
    max_players: 4,
    has_lighting: 1,
    has_seating: 1,
    is_active: 1,
  });
  const [saving, setSaving] = useState(false);
  const dialogRef = useDialog(isModalOpen, () => setIsModalOpen(false), saving);

  const fetchCourts = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await courtsAPI.getAll();
      if (Array.isArray(res.data?.data?.courts)) {
        setCourts(res.data.data.courts);
      } else throw new Error('Court information could not be read.');
    } catch (err) {
      setLoadError(err.message || 'Unable to load courts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourts();
  }, []);

  const handleOpenCreate = () => {
    setEditingCourt(null);
    setFormData({
      name: '',
      description: '',
      court_type: 'indoor',
      surface_type: 'sport_court',
      price_per_hour: 800,
      max_players: 4,
      has_lighting: 1,
      has_seating: 1,
      is_active: 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (court) => {
    setEditingCourt(court);
    setFormData({
      name: court.name,
      description: court.description || '',
      court_type: court.court_type,
      surface_type: court.surface_type || 'sport_court',
      price_per_hour: court.price_per_hour,
      max_players: court.max_players || 4,
      has_lighting: court.has_lighting ? 1 : 0,
      has_seating: court.has_seating ? 1 : 0,
      is_active: court.is_active ? 1 : 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingCourt) {
        await courtsAPI.update(editingCourt.id, formData);
        showSuccess(`Court "${formData.name}" updated successfully.`);
      } else {
        await courtsAPI.create(formData);
        showSuccess(`Court "${formData.name}" created successfully.`);
      }
      setIsModalOpen(false);
      await fetchCourts();
    } catch (err) {
      showError(err.message || 'Operation failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (courtId) => {
    if (!window.confirm('Are you sure you want to delete this court? This action cannot be undone.')) return;
    try {
      await courtsAPI.delete(courtId);
      showSuccess('Court deleted successfully.');
      await fetchCourts();
    } catch (err) {
      showError(err.message || 'Could not delete court.');
    }
  };

  const handleToggleStatus = async (court) => {
    try {
      const newStatus = court.is_active ? 0 : 1;
      await courtsAPI.update(court.id, { ...court, is_active: newStatus });
      showSuccess(`Court ${newStatus ? 'activated' : 'deactivated'}.`);
      await fetchCourts();
    } catch (err) {
      showError(err.message || 'Failed to update court status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-pickle-600">
            Facility Setup
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-500 tracking-tight mt-0.5">
            Courts Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure court arenas, hourly pricing, lighting features, and operational availability.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn-primary py-2 px-4 text-xs font-bold gap-1.5 self-start sm:self-auto shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Court</span>
        </button>
      </div>

      {/* Courts Table */}
      {loading ? (
        <LoadingSpinner />
      ) : loadError ? null : (
        <div className="card overflow-hidden p-0 border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="text-left py-3.5 px-4">Court Name</th>
                  <th className="text-left py-3.5 px-4">Type & Surface</th>
                  <th className="text-left py-3.5 px-4">Hourly Price</th>
                  <th className="text-center py-3.5 px-4">Capacity</th>
                  <th className="text-center py-3.5 px-4">Lighting</th>
                  <th className="text-center py-3.5 px-4">Status</th>
                  <th className="text-right py-3.5 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courts.map((court) => (
                  <tr key={court.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-navy-500">
                      {court.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="capitalize font-medium text-slate-800">{court.court_type}</span>
                      <span className="text-slate-400 block text-[11px] capitalize">
                        {court.surface_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-pickle-600">
                      ₱{Number(court.price_per_hour || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-600">
                      {court.max_players || 4} Players
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {court.has_lighting ? (
                        <span className="text-amber-600 font-semibold text-[11px]">Yes (LED)</span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(court)}
                        className={`badge cursor-pointer ${
                          court.is_active ? 'badge-confirmed' : 'badge-rejected'
                        }`}
                      >
                        {court.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(court)}
                        className="p-1 text-slate-600 hover:text-navy-500 rounded"
                        title="Edit Court"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(court.id)}
                        className="p-1 text-rose-500 hover:text-rose-700 rounded"
                        title="Delete Court"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loadError && <div className="card border-rose-200 bg-rose-50 text-sm text-rose-800" role="alert"><p>{loadError}</p><button type="button" className="font-semibold underline mt-3" onClick={fetchCourts}>Try loading courts again</button></div>}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="court-editor-title" tabIndex={-1} className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="bg-navy-500 text-white p-5 flex items-center justify-between">
              <h3 id="court-editor-title" className="text-base font-bold text-white">
                {editingCourt ? 'Edit Court Arena' : 'Add New Pickleball Court'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
                aria-label="Close court editor"
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="form-label" htmlFor="court-name">
                  Court Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="court-name"
                  type="text"
                  required
                  placeholder="e.g. Court 7 - West Stadium"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Court Type</label>
                  <select
                    value={formData.court_type}
                    onChange={(e) => setFormData({ ...formData, court_type: e.target.value })}
                    className="form-select"
                  >
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Surface Material</label>
                  <select
                    value={formData.surface_type}
                    onChange={(e) => setFormData({ ...formData, surface_type: e.target.value })}
                    className="form-select"
                  >
                    <option value="sport_court">Sport Court</option>
                    <option value="concrete">Concrete</option>
                    <option value="cushioned">Cushioned Acrylic</option>
                    <option value="asphalt">Asphalt</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="price-per-hour">
                    Hourly Price (₱) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="price-per-hour"
                    type="number"
                    min="1"
                    required
                    value={formData.price_per_hour}
                    onChange={(e) => setFormData({ ...formData, price_per_hour: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="max-players">
                    Max Capacity (Players)
                  </label>
                  <input
                    id="max-players"
                    type="number"
                    min="2"
                    max="10"
                    value={formData.max_players}
                    onChange={(e) => setFormData({ ...formData, max_players: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="court-desc">
                  Description
                </label>
                <textarea
                  id="court-desc"
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input text-xs"
                  placeholder="Facility features, dimensions, special surface details..."
                />
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.has_lighting)}
                    onChange={(e) => setFormData({ ...formData, has_lighting: e.target.checked ? 1 : 0 })}
                    className="rounded text-pickle-600 focus:ring-pickle-500"
                  />
                  <span>Night Lighting</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.has_seating)}
                    onChange={(e) => setFormData({ ...formData, has_seating: e.target.checked ? 1 : 0 })}
                    className="rounded text-pickle-600 focus:ring-pickle-500"
                  />
                  <span>Spectator Seating</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.is_active)}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                    className="rounded text-pickle-600 focus:ring-pickle-500"
                  />
                  <span>Is Active</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs py-2 px-5 font-bold gap-1.5"
                >
                  {saving ? (
                    <>
                      <LoadingSpinner size="sm" color="white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingCourt ? 'Update Court' : 'Create Court'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCourts;

