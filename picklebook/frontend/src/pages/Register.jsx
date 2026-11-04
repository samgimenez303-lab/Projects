import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { User, Mail, Phone, Lock, UserPlus, Eye, EyeOff } from 'lucide-react';

const Register = () => {
  const { register } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }

    if (!formData.agreeTerms) {
      showError('Please accept the PickleBook terms and cancellation policy.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        password: formData.password,
      });

      showSuccess('Registration successful! Please check your email to verify your account.');
      navigate('/dashboard');
    } catch (err) {
      showError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="card max-w-md w-full p-8 shadow-xl border-t-4 border-t-pickle-500 space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="text-4xl">🏓</span>
            <span className="text-2xl font-black text-navy-500 font-display">
              Pickle<span className="text-pickle-600">Book</span>
            </span>
          </Link>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            Create Player Account
          </h2>
          <p className="text-xs text-slate-500">
            Join the pickleball community and reserve courts anytime.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label" htmlFor="register-name">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="register-name"
                name="name"
                type="text"
                required
                placeholder="Juan Dela Cruz"
                value={formData.name}
                onChange={handleChange}
                className="form-input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="register-email">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="register-email"
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                className="form-input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="register-phone">
              Mobile Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="register-phone"
                name="phone"
                type="tel"
                placeholder="0917-123-4567"
                value={formData.phone}
                onChange={handleChange}
                className="form-input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="register-password">
              Password (Min. 6 chars) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="form-input pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="register-confirmPassword">
              Confirm Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="register-confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="form-input pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="agreeTerms"
              name="agreeTerms"
              type="checkbox"
              checked={formData.agreeTerms}
              onChange={handleChange}
              className="h-4 w-4 rounded text-pickle-600 focus:ring-pickle-500 border-slate-300"
            />
            <label htmlFor="agreeTerms" className="text-xs text-slate-600">
              I accept the{' '}
              <Link to="/about" className="text-pickle-600 hover:underline">
                Terms of Service
              </Link>{' '}
              & cancellation policy.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-sm font-bold shadow-md shadow-pickle-600/20 gap-2 mt-2"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
          <span>Already registered? </span>
          <Link to="/login" className="font-bold text-pickle-600 hover:text-pickle-700">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;

