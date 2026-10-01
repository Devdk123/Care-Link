import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, CheckCircle2, Building2, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface LoginViewProps {
  onLoginSuccess: () => void;
  onNavigateToReset: () => void;
  onBackToHome?: () => void;
}

const STEP_LABELS = ['Institution', 'Credentials', 'Verification'];

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onNavigateToReset, onBackToHome }) => {
  const { verifyHospital, verifyCredentials, verifyOtp } = useAuth();

  // Step state
  const [step, setStep] = useState(1);
  const [hospitalCode, setHospitalCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  
  // CAPTCHA Challenge state
  const [captchaExpected, setCaptchaExpected] = useState<number | null>(null);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaPrompt, setCaptchaPrompt] = useState('');

  React.useEffect(() => {
    const storedLockout = localStorage.getItem('carelink_auth_lockout');
    if (storedLockout) {
      const lockUntil = parseInt(storedLockout, 10);
      if (Date.now() < lockUntil) {
        setLockoutTime(lockUntil);
      } else {
        localStorage.removeItem('carelink_auth_lockout');
      }
    }
  }, []);

  const handleFailure = () => {
    const attempts = failedAttempts + 1;
    setFailedAttempts(attempts);
    
    if (attempts >= 3) {
      const lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
      localStorage.setItem('carelink_auth_lockout', lockUntil.toString());
      setLockoutTime(lockUntil);
      setError('Too many failed attempts. Security lockout initiated for 15 minutes.');
    } else if (attempts === 2) {
      generateCaptcha();
      setError('Suspicious activity detected. Please solve the challenge below.');
    } else {
      setError('Invalid credentials. Please try again.');
    }
  };

  const generateCaptcha = () => {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    setCaptchaExpected(a + b);
    setCaptchaPrompt(`What is ${a} + ${b}?`);
    setCaptchaInput('');
  };

  // ── Step 1: Hospital Verification ──
  const handleVerifyHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime && Date.now() < lockoutTime) return;
    setError(null);
    setIsLoading(true);
    try {
      const ok = await verifyHospital(hospitalCode);
      if (ok) {
        setStep(2);
      } else {
        handleFailure();
      }
    } catch {
      handleFailure();
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: Credentials ──
  const handleVerifyCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime && Date.now() < lockoutTime) return;
    
    if (captchaExpected !== null && parseInt(captchaInput, 10) !== captchaExpected) {
      setError('Incorrect security challenge answer.');
      generateCaptcha();
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const ok = await verifyCredentials(email, password);
      if (ok) {
        setFailedAttempts(0);
        setCaptchaExpected(null);
        setStep(3);
      } else {
        handleFailure();
      }
    } catch {
      handleFailure();
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3: OTP ──
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutTime && Date.now() < lockoutTime) return;
    setError(null);
    setIsLoading(true);
    try {
      const ok = await verifyOtp(otp);
      if (ok) {
        onLoginSuccess();
      } else {
        handleFailure();
      }
    } catch {
      handleFailure();
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (val: string) => {
    const sanitized = val.replace(/\D/g, '').slice(0, 6);
    setOtp(sanitized);
    if (sanitized.length === 6) {
      // Auto-submit after setting state
      setTimeout(() => {
        setError(null);
        setIsLoading(true);
        verifyOtp(sanitized)
          .then((ok) => {
            if (ok) onLoginSuccess();
            else setError('Invalid verification code. Please try again.');
          })
          .catch(() => setError('Verification failed.'))
          .finally(() => setIsLoading(false));
      }, 100);
    }
  };

  // ── Google OAuth ──
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-in failed.');
    }
  };

  // ── Step Indicator ──
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const isCompleted = step > num;
        const isCurrent = step === num;
        return (
          <React.Fragment key={num}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#10b981] text-white'
                    : isCurrent
                    ? 'bg-[#316bf3] text-white shadow-lg shadow-[#316bf3]/30'
                    : 'bg-[#f2f4f6] text-[#74777f] border border-[#c4c6cf]'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : num}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isCurrent ? 'text-[#316bf3]' : isCompleted ? 'text-[#10b981]' : 'text-[#74777f]'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`w-12 h-0.5 rounded-full mb-5 transition-colors ${
                  step > num ? 'bg-[#10b981]' : 'bg-[#e0e3e5]'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#e0e3e5] shadow-2xl max-w-4xl w-full overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        {/* ── Left Branding Panel ── */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#022448] via-[#1e3a5f] to-[#022448] text-white p-8 flex flex-col justify-between relative overflow-hidden">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#316bf3_1px,transparent_1px)] [background-size:16px_16px]" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <img
                src="/carelink.png"
                alt="CareLink Logo"
                className="w-11 h-11 rounded-xl object-contain bg-white/10 p-1 shadow-lg shadow-black/20 border border-white/20"
              />
              <h1 className="text-xl font-bold tracking-tight">CareLink</h1>
            </div>

            <div className="mt-12 space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-[#adc8f5]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
                HIPAA &amp; ISO 27001 Secure Portal
              </span>
              <h2 className="text-2xl font-extrabold leading-tight">
                Multi-Factor Clinical Authentication
              </h2>
              <p className="text-xs text-[#adc8f5] leading-relaxed">
                Three-step verification ensures only authorized clinicians access protected health information.
              </p>
            </div>

            {/* Step descriptions */}
            <div className="mt-8 space-y-3">
              {[
                { num: 1, label: 'Verify hospital institution code' },
                { num: 2, label: 'Authenticate clinician credentials' },
                { num: 3, label: 'Confirm MFA verification code' },
              ].map((s) => (
                <div
                  key={s.num}
                  className={`flex items-center gap-3 text-xs transition-all ${
                    step >= s.num ? 'text-white' : 'text-[#adc8f5]/50'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step > s.num
                        ? 'bg-[#10b981] text-white'
                        : step === s.num
                        ? 'bg-[#316bf3] text-white'
                        : 'bg-white/10 text-[#adc8f5]'
                    }`}
                  >
                    {step > s.num ? <CheckCircle2 className="w-3 h-3" /> : s.num}
                  </div>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-white/10 text-[11px] text-[#adc8f5] flex items-center justify-between">
            <span>Hospital Network v2.4</span>
            <span>24/7 Clinical Support</span>
          </div>
        </div>

        {/* ── Right Form Panel ── */}
        <div className="md:col-span-7 p-8 md:p-10 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#74777f] hover:text-[#191c1e] transition-colors"
              >
                ← Return to Overview
              </button>
            )}
            <StepIndicator />

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-[#ba1a1a]/10 border border-[#ba1a1a]/30 rounded-xl text-xs text-[#ba1a1a] font-medium">
                {error}
              </div>
            )}

            {/* ════════ STEP 1: Hospital Code ════════ */}
            {step === 1 && (
              <form onSubmit={handleVerifyHospital} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#191c1e] tracking-tight">Hospital Verification</h2>
                  <p className="text-xs text-[#74777f] mt-1">
                    Enter your institution's access code to begin authentication.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#43474e] uppercase tracking-wider mb-1.5">
                    Hospital Access Code *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777f]" />
                    <input
                      type="text"
                      required
                      value={hospitalCode}
                      onChange={(e) => setHospitalCode(e.target.value)}
                      placeholder="HX-XXXX"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3] uppercase tracking-wider font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#316bf3] hover:bg-[#0051d5] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#316bf3]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                  ) : (
                    <><span>Verify Institution</span> <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}

            {/* ════════ STEP 2: Credentials ════════ */}
            {step === 2 && (
              <form onSubmit={handleVerifyCredentials} className="space-y-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#191c1e] tracking-tight">Clinician Sign In</h2>
                    <p className="text-xs text-[#74777f] mt-1">
                      Enter your hospital credentials to verify your identity.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                    className="text-xs font-semibold text-[#316bf3] hover:underline whitespace-nowrap mt-1"
                  >
                    ← Change Hospital
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#43474e] uppercase tracking-wider mb-1.5">
                    Hospital Email / ID *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777f]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="clinician@hospital.org"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#43474e] uppercase tracking-wider">
                      Password *
                    </label>
                    <button
                      type="button"
                      onClick={onNavigateToReset}
                      className="text-xs font-semibold text-[#316bf3] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777f]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password..."
                      className="w-full pl-10 pr-10 py-2.5 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-sm text-[#191c1e] focus:outline-none focus:bg-white focus:border-[#316bf3]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#74777f] hover:text-[#191c1e]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {captchaExpected !== null && (
                  <div className="p-4 bg-[#fef3c7] border border-[#fde68a] rounded-xl">
                    <label className="block text-xs font-bold text-[#d97706] uppercase tracking-wider mb-2">
                      Security Challenge *
                    </label>
                    <p className="text-sm font-semibold text-[#92400e] mb-3">{captchaPrompt}</p>
                    <input
                      type="text"
                      required
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value)}
                      placeholder="Enter answer"
                      className="w-full px-4 py-2 bg-white border border-[#fcd34d] rounded-lg text-sm text-[#92400e] focus:outline-none focus:border-[#d97706]"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#316bf3] hover:bg-[#0051d5] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#316bf3]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                  ) : (
                    <><span>Continue to Verification</span> <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            )}

            {/* ════════ STEP 3: OTP/MFA ════════ */}
            {step === 3 && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#191c1e] tracking-tight">Verification Code</h2>
                    <p className="text-xs text-[#74777f] mt-1">
                      Enter the 6-digit MFA code to complete sign-in.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep(2);
                    }}
                    className="text-xs font-semibold text-[#316bf3] hover:underline whitespace-nowrap mt-1"
                  >
                    ← Change Account
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#43474e] uppercase tracking-wider mb-1.5">
                    6-Digit Code *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74777f]" />
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      placeholder="••••••"
                      className="w-full pl-10 pr-4 py-3 bg-[#f2f4f6] border border-[#c4c6cf] rounded-xl text-lg text-center text-[#191c1e] font-mono tracking-[0.5em] focus:outline-none focus:bg-white focus:border-[#316bf3]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.length < 6}
                  className="w-full py-3 bg-[#316bf3] hover:bg-[#0051d5] text-white text-sm font-bold rounded-xl shadow-lg shadow-[#316bf3]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" /> Complete Sign-In</>
                  )}
                </button>

                {/* Demo hint */}
                <div className="p-3 bg-[#316bf3]/5 border border-[#316bf3]/15 rounded-xl text-xs text-[#43474e]">
                  <span className="font-semibold text-[#316bf3]">Demo:</span>{' '}
                  Use code <code className="px-1.5 py-0.5 bg-[#316bf3]/10 rounded font-mono text-[#316bf3] font-bold">424242</code>
                </div>
              </form>
            )}

            {/* ── Divider + Google OAuth ── */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e0e3e5]"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-[#74777f]">OR</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 bg-white border border-[#c4c6cf] hover:bg-[#f2f4f6] text-[#191c1e] text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </button>

            <div className="pt-4 border-t border-[#e0e3e5] text-center mt-4">
              <p className="text-xs text-[#74777f]">
                Need technical assistance?{' '}
                <a href="#support" className="text-[#316bf3] font-semibold hover:underline">
                  Contact IT Operations
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
