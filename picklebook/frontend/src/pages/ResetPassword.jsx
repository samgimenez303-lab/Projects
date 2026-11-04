import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { Lock, CheckCircle2, ArrowRight } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      showError('Invalid or missing password reset token. Please request a new link.');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await authAPI.resetPassword({ token, new_password: password });
      showSuccess('Your password has been reset successfully! You can now sign in.');
      setSuccess(true);
    } catch (err) {
      showError(err.message || 'Password reset failed. Link may be expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="card max-w-md w-full p-8 shadow-xl border-t-4 border-t-pickle-500 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            Set New Password
          </h2>
          <p className="text-xs text-slate-500">
            Please enter and confirm your brand new account password.
          </p>
        </div>

        {success ? (
          <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div>
              <h4 className="font-bold text-emerald-900 text-base">Password Updated</h4>
              <p className="text-xs text-emerald-700 mt-1">
                Your credentials have been securely updated. You can now log into your account.
              </p>
            </div>
            <Link
              to="/login"
              className="btn-primary w-full py-2.5 text-xs font-bold gap-1.5 inline-flex items-center justify-center"
            >
              <span>Go to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label" htmlFor="new-password">
                New Password (Min. 6 chars)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="new-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="confirm-new-password">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="confirm-new-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 text-sm font-bold shadow-md shadow-pickle-600/20"
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" color="white" />
                  <span>Saving new password...</span>
                </div>
              ) : (
                <span>Reset Password</span>
              )}
            </button>
          </form>
        )}

        <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
          <Link to="/login" className="font-bold text-pickle-600 hover:text-pickle-700">
            Cancel and Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

