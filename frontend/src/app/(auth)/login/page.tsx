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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
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
    } else {
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
        router.push('/');
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
            {mode === 'signin'
              ? 'Sign in with your email credentials'
              : 'Create an account with role and register number'}
          </p>
        </div>

        {/* Tab Toggle */}
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

        {/* Form Error Banner */}
        {authError && (
          <div className="p-3 bg-neutral-100 border border-neutral-400 text-xs text-neutral-900 rounded font-medium">
            {authError}
          </div>
        )}

        {/* Auth Form */}
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
                  System Role
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
            <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
              Password
            </label>
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
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="pt-4 border-t border-neutral-200 text-center">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-xs text-neutral-600 hover:text-black underline underline-offset-2"
          >
            Continue as Guest / View Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

