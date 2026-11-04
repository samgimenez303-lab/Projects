import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { Users, Search, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const { showSuccess, showError } = useNotification();

  const fetchUsers = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await adminAPI.getUsers();
      const records = res.data?.data?.users;
      if (!Array.isArray(records)) throw new Error('The user list could not be read.');
      setUsers(records);
    } catch (err) {
      setUsers([]);
      setLoadError(err.message || 'Could not load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminAPI.updateUserRole(userId, newRole);
      showSuccess(`User role updated to ${newRole}.`);
      await fetchUsers();
    } catch (err) {
      showError(err.message || 'Failed to update user role.');
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const newStatus = user.is_active ? 0 : 1;
      await adminAPI.toggleUserStatus(user.id, newStatus);
      showSuccess(`User account ${newStatus ? 'activated' : 'deactivated'}.`);
      await fetchUsers();
    } catch (err) {
      showError(err.message || 'Failed to toggle account status.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pickle-600">
          User Management
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-navy-500 tracking-tight mt-0.5">
          Players & Staff Accounts
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage member accounts, promote team members to staff or admin, and control access.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search users by name or email"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter Role:</span>
          <select
            aria-label="Filter users by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="form-select text-xs py-1.5"
          >
            <option value="all">All Roles</option>
            <option value="customer">Customers</option>
            <option value="staff">Staff</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <LoadingSpinner />
      ) : loadError ? (
        <div className="card border border-rose-200 bg-rose-50 p-6" role="alert">
          <p className="font-bold text-rose-900">User accounts could not be loaded</p>
          <p className="mt-2 text-sm text-rose-800">{loadError}</p>
          <button type="button" onClick={fetchUsers} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-rose-900"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-bold text-slate-700">{users.length ? 'No matching accounts' : 'No user accounts yet'}</p>
          <p className="mt-2 text-sm text-slate-500">{users.length ? 'Try another name, email or role filter.' : 'Registered players and staff will appear here.'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0 border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="text-left py-3.5 px-4">User</th>
                  <th className="text-left py-3.5 px-4">Contact Phone</th>
                  <th className="text-left py-3.5 px-4">Role</th>
                  <th className="text-center py-3.5 px-4">Email Status</th>
                  <th className="text-center py-3.5 px-4">Account Status</th>
                  <th className="text-right py-3.5 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {u.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 block">{u.name}</span>
                          <span className="text-[11px] text-slate-400">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {u.phone || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="form-select text-[11px] py-1 px-2 font-semibold bg-white rounded border border-slate-200"
                      >
                        <option value="customer">Customer</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.email_verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`badge ${u.is_active ? 'badge-confirmed' : 'badge-rejected'}`}
                      >
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        className="text-xs font-semibold text-slate-600 hover:text-navy-500 underline"
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;

