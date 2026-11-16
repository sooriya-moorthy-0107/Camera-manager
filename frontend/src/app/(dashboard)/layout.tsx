'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { isManagerOrOrganizer, UserRole } from '@/types';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, userProfile, role, signOut, switchMockRole } = useAuth();
  const isManager = isManagerOrOrganizer(role);

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/inventory', label: 'Inventory' },
    ...(isManager ? [{ href: '/admin', label: 'Admin & Roles' }] : []),
  ];

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
              {/* Role Indicator / Simulator */}
              <div className="flex items-center gap-1.5 text-xs bg-neutral-100 border border-neutral-300 rounded px-2.5 py-1">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Role:</span>
                <select
                  value={role}
                  onChange={(e) => switchMockRole(e.target.value as UserRole)}
                  className="bg-transparent font-semibold text-xs text-neutral-900 focus:outline-none cursor-pointer uppercase"
                >
                  <option value="organizer">Organizer</option>
                  <option value="manager">Manager</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="volunteer">Volunteer</option>
                </select>
              </div>

              {/* Current User Identity */}
              {userProfile ? (
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-neutral-900 leading-tight">
                    {userProfile.full_name}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {userProfile.register_number}
                  </span>
                </div>
              ) : user ? (
                <span className="text-xs font-mono text-neutral-700 hidden sm:inline">
                  {user.email}
                </span>
              ) : null}

              {/* Auth Button */}
              {user ? (
                <button
                  onClick={() => signOut()}
                  className="text-xs font-semibold px-2.5 py-1 text-neutral-700 hover:text-black border border-neutral-300 rounded hover:bg-neutral-50 transition-colors uppercase tracking-wider"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="text-xs font-semibold px-2.5 py-1 bg-black text-white rounded hover:bg-neutral-800 transition-colors uppercase tracking-wider"
                >
                  Sign In
                </Link>
              )}
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
        Equipment Checkout System • High-Accountability Gear Management
      </footer>
    </div>
  );
}

