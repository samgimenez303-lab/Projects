import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  User,
  Mail,
  Phone,
  Lock,
  CheckCircle2,
  AlertCircle,
  Shield,
  Save,
  KeyRound
} from 'lucide-react';

const Profile = () => {
  const { user, updateUserProfile, changeUserPassword, refreshUser } = useAuth();
  const { showSuccess, showError } = useNotification();

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Email verification resend
  const [resendingEmail, setResendingEmail] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      await updateUserProfile({ name, phone });
      showSuccess('Profile information updated successfully.');
    } catch (err) {
      showError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      showError('New password must be at least 6 characters.');
      return;
    }

    setChangingPassword(true);
    try {
      await changeUserPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      showSuccess('Password successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showError(err.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResendingEmail(true);
    try {
      await authAPI.resendVerification(user.email);
      showSuccess(`Verification email sent to ${user.email}.`);
    } catch (err) {
      showError(err.message || 'Failed to resend verification.');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-pickle-600">
          Account Settings
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-navy-500 tracking-tight mt-0.5">
          User Profile & Security
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your personal information, contact numbers, and security credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Left Column: Account Overview Card */}
        <div className="card p-6 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-pickle-500 text-white flex items-center justify-center font-black text-3xl mx-auto shadow-md">
            {user?.name?.charAt(0) || 'U'}
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">{user?.name}</h3>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-navy-100 text-navy-800">
                {user?.role || 'Customer'}
              </span>
              {user?.email_verified ? (
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
            </div>
          </div>

          {!user?.email_verified && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <p>Your email address is not verified yet.</p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendingEmail}
                className="btn-outline text-[11px] py-1.5 px-3 w-full font-semibold"
              >
                {resendingEmail ? 'Sending...' : 'Resend Verification'}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Edit Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Edit Profile Information */}
          <div className="card p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-500 pb-2 border-b border-slate-100">
              Personal Information
            </h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="form-label" htmlFor="profile-name">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="profile-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="profile-email">
                  Email Address (Read-only)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="profile-email"
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="form-input pl-10 bg-slate-50 cursor-not-allowed text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="profile-phone">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="profile-phone"
                    type="tel"
                    placeholder="0917-123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-input pl-10"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn-primary text-xs py-2 px-5 font-bold gap-1.5"
                >
                  {savingProfile ? (
                    <>
                      <LoadingSpinner size="sm" color="white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="card p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-500 pb-2 border-b border-slate-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-pickle-600" />
              <span>Change Password</span>
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="form-label" htmlFor="curr-password">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="curr-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="form-input pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="new-pwd">
                    New Password (Min. 6 chars)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="new-pwd"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="form-input pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" htmlFor="confirm-pwd">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="confirm-pwd"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="form-input pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="btn-secondary text-xs py-2 px-5 font-bold gap-1.5"
                >
                  {changingPassword ? (
                    <>
                      <LoadingSpinner size="sm" color="white" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

