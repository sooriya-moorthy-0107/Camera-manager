'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { isManagerOrOrganizer } from '@/types';
import { supabase } from '@/lib/supabase/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, role, loading, signOut } = useAuth();
  const isManager = isManagerOrOrganizer(role);

  // Alert Menu State
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [pendingReturnsCount, setPendingReturnsCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [pendingCheckoutsCount, setPendingCheckoutsCount] = useState(0);

  // Fetch pending alerts
  useEffect(() => {
    let mounted = true;

    async function fetchAlerts() {
      try {
        // Pending equipment returns
        const { count: returnsCount } = await supabase
          .from('equipment')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_return');

        // Pending user signups from Supabase
        let pendingUsers = 0;
        const { count: usersCount, error: userErr } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (!userErr && typeof usersCount === 'number') {
          pendingUsers = usersCount;
        }

        // Also check LocalStorage for immediate UI sync
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem('cm_registered_users');
            if (stored) {
              const list = JSON.parse(stored);
              const localPending = list.filter((u: { status: string }) => u.status === 'pending').length;
              pendingUsers = Math.max(pendingUsers, localPending);
            }
          } catch {
            // ignore
          }
        }

        // Pending checkout requests
        const { data: coData } = await supabase
          .from('checkout_logs')
          .select('id, status, notes, actual_return_time')
          .is('actual_return_time', null);

        let pendingCo = 0;
        if (coData) {
          pendingCo = coData.filter(
            (c) =>
              c.status === 'pending' ||
              c.status === 'pending_checkout' ||
              (Boolean(c.notes?.includes('[CHECKOUT_REQUEST]')) &&
                c.status !== 'returned' &&
                c.status !== 'rejected')
          ).length;
        }

        if (mounted) {
          setPendingReturnsCount(returnsCount || 0);
          setPendingUsersCount(pendingUsers);
          setPendingCheckoutsCount(pendingCo);
        }
      } catch {
        // Fallback
      }
    }

    if (user && isManager) {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 4000);
      const onUserRegistered = () => fetchAlerts();
      const onCheckoutUpdated = () => fetchAlerts();
      window.addEventListener('cm_user_registered', onUserRegistered);
      window.addEventListener('cm_checkout_updated', onCheckoutUpdated);
      return () => {
        mounted = false;
        clearInterval(interval);
        window.removeEventListener('cm_user_registered', onUserRegistered);
        window.removeEventListener('cm_checkout_updated', onCheckoutUpdated);
      };
    }
  }, [user, isManager]);

  // Auth Guard: No Guest Access
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  const totalAlerts = pendingReturnsCount + pendingUsersCount + pendingCheckoutsCount;

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/inventory', label: 'Inventory' },
    ...(isManager ? [{ href: '/admin', label: 'Admin & Roles' }] : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 text-xs font-mono">
        Loading Equipment System...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-100 text-neutral-900">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-neutral-300 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo / Brand */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-bold uppercase tracking-wider text-black flex items-center gap-2"
              >
                <span className="w-2.5 h-2.5 bg-black rounded-none"></span>
                <span>Equipment Checkout System</span>
              </Link>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors ${
                        isActive
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* User Info & Actions */}
            <div className="flex items-center gap-3">
              {/* Alert Menu (Micro-feature) */}
              {isManager && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAlertOpen(!isAlertOpen)}
                    className="relative p-1.5 text-neutral-700 hover:text-black hover:bg-neutral-100 rounded border border-neutral-300"
                    title="System Alerts"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    {totalAlerts > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-[9px] font-bold text-white">
                        {totalAlerts}
                      </span>
                    )}
                  </button>

                  {/* Alert Menu Dropdown */}
                  {isAlertOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white border-2 border-black rounded shadow-lg p-3 z-50 space-y-2">
                      <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-black">
                          System Alerts
                        </span>
                        <button
                          onClick={() => setIsAlertOpen(false)}
                          className="text-xs text-neutral-400 hover:text-black font-mono"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {pendingCheckoutsCount > 0 ? (
                          <Link
                            href="/admin"
                            onClick={() => setIsAlertOpen(false)}
                            className="block p-2 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 transition-colors"
                          >
                            <div className="font-semibold">
                              {pendingCheckoutsCount} Checkout Request{pendingCheckoutsCount > 1 ? 's' : ''} Pending
                            </div>
                            <div className="text-[10px] text-amber-800">
                              Volunteers requested equipment checkout
                            </div>
                          </Link>
                        ) : null}

                        {pendingUsersCount > 0 ? (
                          <Link
                            href="/admin"
                            onClick={() => setIsAlertOpen(false)}
                            className="block p-2 rounded bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 transition-colors"
                          >
                            <div className="font-semibold">
                              {pendingUsersCount} User Signup{pendingUsersCount > 1 ? 's' : ''} Pending
                            </div>
                            <div className="text-[10px] text-amber-800">
                              Requires Organizer or Manager approval
                            </div>
                          </Link>
                        ) : null}

                        {pendingReturnsCount > 0 ? (
                          <Link
                            href="/"
                            onClick={() => setIsAlertOpen(false)}
                            className="block p-2 rounded bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-900 transition-colors"
                          >
                            <div className="font-semibold">
                              {pendingReturnsCount} Equipment Return{pendingReturnsCount > 1 ? 's' : ''} Pending
                            </div>
                            <div className="text-[10px] text-neutral-600">
                              Volunteers surrendered gear for review
                            </div>
                          </Link>
                        ) : null}

                        {totalAlerts === 0 && (
                          <div className="py-3 text-center text-neutral-500 text-xs">
                            No active alerts. All items up to date.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Static Role Badge */}
              <div className="flex items-center gap-1.5 text-xs bg-neutral-100 border border-neutral-300 rounded px-2.5 py-1">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Role:</span>
                <span className="font-bold text-xs text-neutral-900 uppercase font-mono tracking-wider">
                  {role}
                </span>
              </div>

              {/* User Identity */}
              {userProfile ? (
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-neutral-900 leading-tight">
                    {userProfile.full_name}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {userProfile.register_number}
                  </span>
                </div>
              ) : (
                <span className="text-xs font-mono text-neutral-700 hidden sm:inline">
                  {user.email}
                </span>
              )}

              {/* Sign Out */}
              <button
                onClick={() => signOut()}
                className="text-xs font-semibold px-2.5 py-1 text-neutral-700 hover:text-black border border-neutral-300 rounded hover:bg-neutral-50 transition-colors uppercase tracking-wider"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-neutral-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded whitespace-nowrap ${
                  isActive
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-300 py-3 text-center text-xs text-neutral-500">
        Equipment Checkout System • Super Admin: sooriyamoorthy0107@gmail.com
      </footer>
    </div>
  );
}
