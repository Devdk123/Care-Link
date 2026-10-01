import React, { useState, useEffect } from 'react';
import { Mail, ArrowLeft, CheckCircle2, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ResetPasswordViewProps {
  onBackToLogin: () => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;
      setSuccess('Check your email for a reset link');
    } catch (err: any) {
      setError(err.message || 'An error occurred while requesting reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      setSuccess('Password updated successfully! Redirecting...');
      setTimeout(() => {
        onBackToLogin();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center justify-center space-y-2 mb-8">
          <img
            src="/carelink.png"
            alt="CareLink Logo"
            className="w-14 h-14 rounded-2xl object-contain shadow-lg shadow-sky-500/20 border border-slate-200 bg-white p-1"
          />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">CareLink</h1>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Clinical IT Security</p>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200/50 sm:rounded-3xl sm:px-10 border border-gray-100">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {isRecovery ? 'Set New Password' : 'Reset Password'}
            </h2>
            <p className="text-gray-500 text-sm">
              {isRecovery 
                ? 'Please enter your new password below.'
                : 'Enter your hospital email address to receive an encrypted password reset link.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-[#ba1a1a]/10 border border-[#ba1a1a]/30 p-4 rounded-xl flex items-start">
              <p className="text-sm text-[#ba1a1a] font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-[#10b981]/10 border border-[#10b981]/30 p-4 rounded-xl flex items-center text-[#10b981]">
              <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}

          {!isRecovery ? (
            <form onSubmit={handleRequestReset} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Hospital Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#316bf3]/20 focus:border-[#316bf3] bg-gray-50/50 transition-colors text-gray-900 sm:text-sm"
                    placeholder="dr.smith@hospital.org"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-[#316bf3] hover:bg-[#2858cc] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#316bf3] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="new-password"
                    name="new-password"
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-11 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#316bf3]/20 focus:border-[#316bf3] bg-gray-50/50 transition-colors text-gray-900 sm:text-sm"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-11 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#316bf3]/20 focus:border-[#316bf3] bg-gray-50/50 transition-colors text-gray-900 sm:text-sm"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-[#316bf3] hover:bg-[#2858cc] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#316bf3] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <button
              onClick={onBackToLogin}
              className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-[#316bf3] transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
