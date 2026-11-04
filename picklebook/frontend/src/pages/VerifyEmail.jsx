import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { MailCheck, AlertCircle, ArrowRight, RefreshCw, Send } from 'lucide-react';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, refreshUser } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState(token ? 'verifying' : 'idle'); // 'verifying', 'success', 'error', 'idle'
  const [errorMessage, setErrorMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const verifyToken = async () => {
      setVerifying(true);
      try {
        await authAPI.verifyEmail(token);
        if (isMounted) {
          setStatus('success');
          showSuccess('Your email has been verified successfully!');
          await refreshUser();
        }
      } catch (err) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Verification link is invalid or has expired.');
        }
      } finally {
        if (isMounted) setVerifying(false);
      }
    };

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, [token, refreshUser, showSuccess]);

  const handleResend = async () => {
    if (!user?.email) {
      showError('Please sign in first to resend your verification email.');
      return;
    }

    setResending(true);
    try {
      await authAPI.resendVerification(user.email);
      showSuccess(`Verification link re-sent to ${user.email}!`);
    } catch (err) {
      showError(err.message || 'Could not resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="card max-w-md w-full p-8 shadow-xl text-center space-y-6">
        {status === 'verifying' && (
          <div className="space-y-4">
            <LoadingSpinner size="lg" message="Verifying your email token..." />
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <MailCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">Email Verified!</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your account has been confirmed. You now have full access to book courts, manage reservations, and participate in tournaments.
            </p>
            <div className="pt-2">
              <Link
                to="/dashboard"
                className="btn-primary w-full py-2.5 text-xs font-bold gap-2 inline-flex items-center justify-center"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">Verification Failed</h2>
            <p className="text-xs text-rose-600 leading-relaxed font-medium">
              {errorMessage}
            </p>
            {user?.email && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="btn-primary w-full py-2.5 text-xs font-bold gap-2 inline-flex items-center justify-center"
              >
                {resending ? <LoadingSpinner size="sm" color="white" /> : <Send className="w-4 h-4" />}
                <span>Resend Verification Email</span>
              </button>
            )}
            <div className="pt-2">
              <Link to="/login" className="text-xs text-slate-500 hover:text-navy-500 font-semibold">
                Return to Sign In
              </Link>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div className="space-y-4">
            <div className="w-14 h-14 bg-pickle-100 text-pickle-600 rounded-full flex items-center justify-center mx-auto">
              <MailCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">Verify Your Email</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              We have sent a verification link to your registered email address{' '}
              {user?.email && <strong className="text-slate-800">({user.email})</strong>}. Please click the link inside to activate your account.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="btn-outline w-full py-2.5 text-xs font-bold gap-2 inline-flex items-center justify-center"
            >
              {resending ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
              <span>Resend Email</span>
            </button>
            <div className="pt-2">
              <Link to="/dashboard" className="btn-primary w-full py-2.5 text-xs font-bold inline-block">
                Continue to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;

