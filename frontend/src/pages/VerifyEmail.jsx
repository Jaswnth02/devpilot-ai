import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft, ShieldCheck, Clock } from 'lucide-react';

const VerifyEmail = () => {
  const { verifyEmail, resendOtp } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Extract email from navigation state or URL param
  const initialEmail = location.state?.email || searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);

  // 6-digit OTP array
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Expiry Timer (5 minutes = 300 seconds)
  const [expirySeconds, setExpirySeconds] = useState(300);
  const [isExpired, setIsExpired] = useState(false);

  // Resend Cooldown Timer (60 seconds)
  const [resendCooldown, setResendCooldown] = useState(60);

  // UI status messages
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 5-minute Expiry Countdown Effect
  useEffect(() => {
    if (expirySeconds <= 0) {
      setIsExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setExpirySeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [expirySeconds]);

  // 60-second Resend Cooldown Timer Effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus first OTP input box on mount
  useEffect(() => {
    if (inputRefs[0]?.current) {
      inputRefs[0].current.focus();
    }
  }, []);

  // Format seconds to MM:SS
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Handle single digit input & auto-tab
  const handleDigitChange = (index, value) => {
    if (/[^0-9]/.test(value)) return; // Digits only

    const newOtp = [...otpDigits];
    newOtp[index] = value.slice(-1); // Single character
    setOtpDigits(newOtp);
    setErrorMessage('');

    // Auto-advance to next input
    if (value && index < 5 && inputRefs[index + 1]?.current) {
      inputRefs[index + 1].current.focus();
    }
  };

  // Handle backspace key navigating left
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && inputRefs[index - 1]?.current) {
      inputRefs[index - 1].current.focus();
    }
  };

  // Handle paste 6-digit code
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtpDigits(digits);
      setErrorMessage('');
      inputRefs[5]?.current?.focus();
    }
  };

  // Submit OTP Verification
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    if (isExpired) {
      setErrorMessage('Verification code has expired. Please click "Resend Code" to get a new OTP.');
      return;
    }

    setLoading(true);

    try {
      const res = await verifyEmail({ email, otp: fullOtp });
      setSuccessMessage(res.message || 'Email verified successfully!');
      
      // Auto-redirect to sign in after 1.5s
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP Code
  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;

    setErrorMessage('');
    setSuccessMessage('');
    setResending(true);

    try {
      const res = await resendOtp(email);
      setSuccessMessage(res.message || 'A new verification code has been sent!');
      setOtpDigits(['', '', '', '', '', '']);
      setExpirySeconds(300); // Reset 5-minute timer
      setIsExpired(false);
      setResendCooldown(60); // Reset 60-second cooldown
      inputRefs[0]?.current?.focus();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend verification code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      {/* Soft Ambient Accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-200 relative z-10">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-600/20 mb-4">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Verify Your Email</h2>
          <p className="text-slate-500 text-xs mt-2">
            We've sent a 6-digit verification code to:
          </p>
          <div className="inline-flex items-center space-x-1.5 mt-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
            <Mail className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-700">{email || 'your-email@example.com'}</span>
          </div>
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2.5 animate-fadeIn">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2.5 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Missing Email Input if opened directly */}
        {!initialEmail && (
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 6-Digit OTP Boxes */}
          <div>
            <div className="flex justify-between items-center gap-2" onPaste={handlePaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  disabled={loading || isExpired}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl bg-slate-50 border transition-all ${
                    digit
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                      : 'border-slate-300 text-slate-900 focus:border-indigo-600 focus:bg-white'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Expiry Countdown Display */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center space-x-1.5 text-slate-500">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {isExpired ? (
                  <strong className="text-rose-600">Verification code expired</strong>
                ) : (
                  <>Code expires in <strong className="text-indigo-600 font-mono">{formatTime(expirySeconds)}</strong></>
                )}
              </span>
            </div>

            {/* Resend OTP Button */}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${resending ? 'animate-spin' : ''}`} />
              <span>
                {resending
                  ? 'Sending...'
                  : resendCooldown > 0
                  ? `Resend (${resendCooldown}s)`
                  : 'Resend Code'}
              </span>
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || isExpired || otpDigits.join('').length < 6}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-semibold text-sm text-white shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Verifying...</span>
              </>
            ) : (
              <span>Verify Email</span>
            )}
          </button>
        </form>

        {/* Navigation Links */}
        <div className="mt-8 text-center border-t border-slate-100 pt-5">
          <Link
            to="/login"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
