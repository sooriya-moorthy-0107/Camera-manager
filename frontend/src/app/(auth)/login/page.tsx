'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { Button } from '@/components/ui/Button';
import { loginSchema, signUpSchema } from '@/lib/validations';
import { UserRole } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [role, setRole] = useState<UserRole>('volunteer');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [showForgotNotice, setShowForgotNotice] = useState(false);
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
          'Registration submitted successfully! Your account is currently in PENDING APPROVAL status. An Organizer or Manager will review and accept your profile. Once approved, you can sign in directly with your email and password.'
        );
        setMode('signin');
        setPassword('');
      }
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
            {mode === 'signin' && 'Sign in to access equipment inventory and records'}
            {mode === 'signup' && 'Register a new account (subject to Organizer / Manager approval)'}
          </p>
        </div>

        {/* Tab Toggle: Sign In / Sign Up */}
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

        {/* Info Banner */}
        {infoNotice && (
          <div className="p-3 bg-neutral-100 border-2 border-black text-xs text-neutral-900 rounded font-medium space-y-1">
            <div className="font-bold uppercase tracking-wider">Account Status Notice</div>
            <div className="leading-relaxed">{infoNotice}</div>
          </div>
        )}

        {/* Error Banner */}
        {authError && (
          <div className="p-3 bg-neutral-100 border border-neutral-800 text-xs text-neutral-900 rounded font-medium leading-relaxed">
            {authError}
          </div>
        )}

        {/* Forgot Password Notice */}
        {showForgotNotice && mode === 'signin' && (
          <div className="p-3 bg-neutral-50 border border-neutral-300 rounded text-xs text-neutral-800 space-y-1">
            <div className="flex items-center justify-between font-bold uppercase tracking-wider text-[11px]">
              <span>Password Recovery</span>
              <button
                type="button"
                onClick={() => setShowForgotNotice(false)}
                className="text-neutral-400 hover:text-black font-mono text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Email delivery is disabled. To reset your password, please contact an Organizer or Manager (e.g.{' '}
              <span className="font-mono font-semibold">sooriyamoorthy0107@gmail.com</span>). They can reset your password directly from the Admin console.
            </p>
          </div>
        )}

        {/* Sign In / Sign Up Form */}
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
                <p className="text-[11px] text-neutral-500 mt-1">
                  Role assignments are verified and authorized by an Organizer or Manager.
                </p>
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
                  onClick={() => setShowForgotNotice((prev) => !prev)}
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
      </div>
    </div>
  );
}
