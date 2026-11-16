'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { Button } from '@/components/ui/Button';
import { loginSchema, signUpSchema } from '@/lib/validations';
import { UserRole } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, sendPasswordResetOtp, verifyOtpAndResetPassword } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [role, setRole] = useState<UserRole>('volunteer');

  // Reset Password State
  const [resetStep, setResetStep] = useState<'request_otp' | 'verify_otp'>('request_otp');
  const [resetEmail, setResetEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoNotice(null);
    setErrors({});

    if (mode === 'signin') {
      const result = loginSchema.safeParse({ email, password });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          fieldErrors[issue.path[0]?.toString() || 'form'] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setIsSubmitting(true);
      const res = await signIn(email, password);
      setIsSubmitting(false);

      if (res.error) {
        setAuthError(res.error);
      } else {
        router.push('/');
      }
    } else if (mode === 'signup') {
      const result = signUpSchema.safeParse({
        email,
        password,
        full_name: fullName,
        register_number: registerNumber,
        role,
      });

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          fieldErrors[issue.path[0]?.toString() || 'form'] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setIsSubmitting(true);
      const res = await signUp(email, password, fullName, result.data.register_number, role);
      setIsSubmitting(false);

      if (res.error) {
        setAuthError(res.error);
      } else {
        setInfoNotice(
          'Registration successful! Your account is in PENDING APPROVAL status. An Organizer or Manager will review and accept your profile before equipment checkouts are enabled.'
        );
        setMode('signin');
      }
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoNotice(null);

    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    const res = await sendPasswordResetOtp(resetEmail);
    setIsSubmitting(false);

    if (res.error) {
      setAuthError(res.error);
    } else {
      setInfoNotice(res.message || 'OTP sent to your email.');
      setResetStep('verify_otp');
    }
  };

  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoNotice(null);

    if (!otpToken.trim()) {
      setAuthError('Please enter the OTP sent to your email.');
      return;
    }

    if (newPassword.length < 6) {
      setAuthError('New password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    const res = await verifyOtpAndResetPassword(resetEmail, otpToken, newPassword);
    setIsSubmitting(false);

    if (res.error) {
      setAuthError(res.error);
    } else {
      setInfoNotice(res.message || 'Password reset successful. Please sign in with your new password.');
      setMode('signin');
      setResetStep('request_otp');
      setOtpToken('');
      setNewPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-100">
      <div className="w-full max-w-md bg-white border border-neutral-300 rounded shadow-sm p-6 space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-200 pb-4">
          <h1 className="text-base font-bold uppercase tracking-wider text-neutral-900">
            Equipment Checkout System
          </h1>
          <p className="text-xs text-neutral-600 mt-1">
            {mode === 'signin' && 'Sign in to access equipment and records'}
            {mode === 'signup' && 'Create an account (subject to Organizer / Manager approval)'}
            {mode === 'reset' && 'Reset your password with an Email OTP code'}
          </p>
        </div>

        {/* Tab Toggle (Only for Sign In / Sign Up) */}
        {mode !== 'reset' ? (
          <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 border border-neutral-300 rounded text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setAuthError(null);
                setErrors({});
              }}
              className={`py-1.5 font-medium rounded transition-colors ${
                mode === 'signin' ? 'bg-black text-white' : 'text-neutral-700 hover:text-black'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setAuthError(null);
                setErrors({});
              }}
              className={`py-1.5 font-medium rounded transition-colors ${
                mode === 'signup' ? 'bg-black text-white' : 'text-neutral-700 hover:text-black'
              }`}
            >
              Sign Up
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
              Reset Password
            </span>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setAuthError(null);
                setInfoNotice(null);
              }}
              className="text-xs text-neutral-600 hover:text-black underline"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* Info Banner */}
        {infoNotice && (
          <div className="p-3 bg-neutral-100 border-2 border-black text-xs text-neutral-900 rounded font-medium space-y-1">
            <div className="font-bold uppercase tracking-wider">Notice</div>
            <div>{infoNotice}</div>
          </div>
        )}

        {/* Error Banner */}
        {authError && (
          <div className="p-3 bg-neutral-100 border border-neutral-400 text-xs text-neutral-900 rounded font-medium">
            {authError}
          </div>
        )}

        {/* ---------------- RESET PASSWORD FLOW ---------------- */}
        {mode === 'reset' && (
          <div className="space-y-4">
            {resetStep === 'request_otp' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                    Your Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    An OTP code will be sent to this email address.
                  </p>
                </div>

                <Button type="submit" variant="primary" size="md" className="w-full" loading={isSubmitting}>
                  Send Reset OTP
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                    6-Digit OTP Token
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                    placeholder="e.g. 123456"
                    className="w-full px-3 py-2 text-sm font-mono tracking-widest text-center bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                  />
                </div>

                <Button type="submit" variant="primary" size="md" className="w-full" loading={isSubmitting}>
                  Confirm & Reset Password
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setResetStep('request_otp')}
                    className="text-xs text-neutral-500 hover:text-black underline"
                  >
                    Resend OTP or Change Email
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ---------------- SIGN IN / SIGN UP FLOW ---------------- */}
        {mode !== 'reset' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-xs text-neutral-900 font-medium">{errors.full_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                    Register Number
                  </label>
                  <input
                    type="text"
                    value={registerNumber}
                    onChange={(e) => setRegisterNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. REG-2026-001"
                    className="w-full px-3 py-2 text-xs uppercase font-mono bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                  />
                  {errors.register_number && (
                    <p className="mt-1 text-xs text-neutral-900 font-medium">
                      {errors.register_number}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                    Requested Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                  >
                    <option value="volunteer">Volunteer</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="manager">Manager</option>
                    <option value="organizer">Organizer</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-neutral-900 font-medium">{errors.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setResetEmail(email);
                      setAuthError(null);
                      setInfoNotice(null);
                    }}
                    className="text-[11px] text-neutral-600 hover:text-black underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-neutral-900 font-medium">{errors.password}</p>
              )}
            </div>

            <Button type="submit" variant="primary" size="md" className="w-full" loading={isSubmitting}>
              {mode === 'signin' ? 'Sign In' : 'Submit Registration for Approval'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
