'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/app/providers';
import { UserProfile, UserRole, CheckoutLog, isManagerOrOrganizer } from '@/types';
import { Button } from '@/components/ui/Button';

const INITIAL_USERS: UserProfile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    auth_id: null,
    full_name: 'Admin Organizer',
    register_number: 'REG-ADMIN-01',
    email: 'organizer@cameramanager.local',
    role: 'organizer',
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    auth_id: null,
    full_name: 'Desk Manager',
    register_number: 'REG-MGR-02',
    email: 'manager@cameramanager.local',
    role: 'manager',
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    auth_id: null,
    full_name: 'Priya Patel',
    register_number: 'REG-COORD-03',
    email: 'priya@cameramanager.local',
    role: 'coordinator',
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    auth_id: null,
    full_name: 'Rahul Sharma',
    register_number: 'REG-VOL-04',
    email: 'rahul@cameramanager.local',
    role: 'volunteer',
    created_at: new Date().toISOString(),
  },
];

const INITIAL_AUDIT_LOGS: CheckoutLog[] = [
  {
    id: 'log-1',
    equipment_id: 'eq-3',
    user_id: '00000000-0000-0000-0000-000000000004',
    checkout_time: new Date(Date.now() - 3600000 * 3).toISOString(),
    expected_return_time: null,
    actual_return_time: null,
    surrender_requested: false,
    status: 'active',
    notes: 'Main Stage coverage',
    created_at: new Date().toISOString(),
    equipment: {
      id: 'eq-3',
      name: 'DJI RS 3 Pro Gimbal',
      category: 'Stabilizer',
      serial_number: 'SN-DJI-5521',
      status: 'checked_out',
      entered_by: null,
      created_at: '',
    },
    user: INITIAL_USERS[3],
  },
  {
    id: 'log-2',
    equipment_id: 'eq-4',
    user_id: '00000000-0000-0000-0000-000000000003',
    checkout_time: new Date(Date.now() - 3600000 * 5).toISOString(),
    expected_return_time: null,
    actual_return_time: null,
    surrender_requested: true,
    status: 'pending_return',
    notes: 'Interviews in Media Room',
    created_at: new Date().toISOString(),
    equipment: {
      id: 'eq-4',
      name: 'Rode Wireless GO II Dual',
      category: 'Audio',
      serial_number: 'SN-ROD-8812',
      status: 'pending_return',
      entered_by: null,
      created_at: '',
    },
    user: INITIAL_USERS[2],
  },
];

export default function AdminPage() {
  const { role } = useAuth();
  const isManager = isManagerOrOrganizer(role);

  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const [auditLogs, setAuditLogs] = useState<CheckoutLog[]>(INITIAL_AUDIT_LOGS);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: uData } = await supabase.from('users').select('*').order('full_name');
      if (uData && uData.length > 0) {
        setUsers(uData as UserProfile[]);
      }

      const { data: lData } = await supabase
        .from('checkout_logs')
        .select('*, equipment:equipment_id(*), user:user_id(*)')
        .order('checkout_time', { ascending: false });

      if (lData && lData.length > 0) {
        setAuditLogs(lData as CheckoutLog[]);
      }
    } catch {
      // Local fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isManager) {
      loadAdminData();
    }
  }, [isManager, loadAdminData]);

  // Route-Level Role Guard Check
  if (!isManager) {
    return (
      <div className="bg-white border-2 border-neutral-400 rounded p-8 max-w-lg mx-auto text-center space-y-4 my-12">
        <div className="w-10 h-10 bg-neutral-900 text-white flex items-center justify-center mx-auto text-xs font-mono font-bold rounded">
          403
        </div>
        <h2 className="text-base font-bold uppercase tracking-wider text-neutral-900">
          Access Restricted
        </h2>
        <p className="text-xs text-neutral-600">
          This administration section requires <strong>Organizer</strong> or <strong>Manager</strong> privileges.
          Your current role is <span className="font-mono font-bold">{role}</span>.
        </p>
        <div className="pt-2">
          <p className="text-[11px] text-neutral-500">
            Tip: You can switch roles using the Role Selector in the top navigation bar to test administrative features.
          </p>
        </div>
      </div>
    );
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      showToast(`User role updated to ${newRole}`);
    } catch {
      // Local fallback
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      showToast(`User role updated to ${newRole}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3 text-xs font-semibold rounded border ${
            notification.type === 'error'
              ? 'bg-neutral-100 border-neutral-900 text-neutral-900'
              : 'bg-neutral-900 border-black text-white'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-black">
            System Administration
          </h1>
          <p className="text-xs text-neutral-600 mt-1">
            Role-Based Access Control (RBAC) and complete checkout audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadAdminData} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 border-b border-neutral-300 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded ${
            activeTab === 'users' ? 'bg-black text-white' : 'text-neutral-600 hover:text-black hover:bg-neutral-200'
          }`}
        >
          Users & RBAC ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded ${
            activeTab === 'audit' ? 'bg-black text-white' : 'text-neutral-600 hover:text-black hover:bg-neutral-200'
          }`}
        >
          Complete Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* Users & RBAC Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="border border-neutral-300 rounded overflow-x-auto bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-800 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Register Number</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Assigned Role</th>
                  <th className="py-2.5 px-3 text-right">Role Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-neutral-900">{u.full_name}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-neutral-800">
                      {u.register_number}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600">{u.email}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold border border-neutral-400 bg-neutral-100 text-neutral-900">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="text-xs px-2 py-1 bg-white border border-neutral-300 rounded focus:outline-none focus:border-black font-medium"
                      >
                        <option value="volunteer">Volunteer</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="manager">Manager</option>
                        <option value="organizer">Organizer</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="border border-neutral-300 rounded overflow-x-auto bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-800 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Equipment</th>
                  <th className="py-2.5 px-3">Serial Number</th>
                  <th className="py-2.5 px-3">Assigned User</th>
                  <th className="py-2.5 px-3">Checkout Time</th>
                  <th className="py-2.5 px-3">Return Time</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-neutral-500">
                      No audit logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-neutral-900">
                        {log.equipment?.name || 'Equipment'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-neutral-700">
                        {log.equipment?.serial_number || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-neutral-900">
                          {log.user?.full_name || 'User'}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-500">
                          {log.user?.register_number || ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 font-mono text-[11px]">
                        {new Date(log.checkout_time).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 font-mono text-[11px]">
                        {log.actual_return_time
                          ? new Date(log.actual_return_time).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            log.status === 'returned'
                              ? 'bg-emerald-700 text-white'
                              : log.status === 'pending_return'
                              ? 'bg-amber-600 text-white'
                              : 'bg-neutral-600 text-white'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 italic">
                        {log.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

