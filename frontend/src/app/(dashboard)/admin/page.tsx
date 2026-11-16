'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/app/providers';
import { UserProfile, UserRole, ActivityLog, isManagerOrOrganizer, canDeleteRecords } from '@/types';
import { Button } from '@/components/ui/Button';

// Main Super Admin user (all sample mock users removed)
const INITIAL_USERS: UserProfile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    auth_id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Sooriya Moorthy',
    register_number: 'REG-ORG-001',
    email: 'sooriyamoorthy0107@gmail.com',
    role: 'organizer',
    status: 'approved',
    created_at: new Date('2026-01-01').toISOString(),
  },
];

const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'act-1',
    actor_name: 'Sooriya Moorthy',
    actor_regnum: 'REG-ORG-001',
    actor_role: 'organizer',
    action: 'SYSTEM_INIT',
    details: 'Super Admin Sooriya Moorthy (REG-ORG-001) initialized the Equipment Checkout System.',
    created_at: new Date().toISOString(),
  },
];

export default function AdminPage() {
  const { userProfile, role } = useAuth();
  const isManager = isManagerOrOrganizer(role);
  const isOrg = canDeleteRecords(role); // ONLY organizer has delete permissions

  const [activeTab, setActiveTab] = useState<'users_role' | 'log'>('users_role');
  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(INITIAL_LOGS);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Add User Modal State (Admin level)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserReg, setNewUserReg] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('volunteer');

  // Reset Password Modal State
  const [resetModalUser, setResetModalUser] = useState<UserProfile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch from Supabase
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Fetch from LocalStorage fallback
      let localList: UserProfile[] = [];
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('cm_registered_users');
          if (stored) localList = JSON.parse(stored);
        } catch {
          // ignore
        }
      }

      // Merge records uniquely by register_number / email
      const mergedMap = new Map<string, UserProfile>();

      // Put seed admin first
      INITIAL_USERS.forEach((u) => mergedMap.set(u.register_number, u));

      // Merge local storage signups
      localList.forEach((u) => mergedMap.set(u.register_number, u));

      // Merge Supabase data (authoritative when present)
      if (uData && uData.length > 0) {
        (uData as UserProfile[]).forEach((u) => mergedMap.set(u.register_number, u));
      }

      const mergedUsers = Array.from(mergedMap.values());
      setUsers(mergedUsers);

      const { data: aData } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (aData && aData.length > 0) {
        setActivityLogs(aData as ActivityLog[]);
      }
    } catch {
      // Local fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isManager) {
      loadData();
      const interval = setInterval(loadData, 5000);
      const onUserRegistered = () => loadData();
      window.addEventListener('cm_user_registered', onUserRegistered);
      return () => {
        clearInterval(interval);
        window.removeEventListener('cm_user_registered', onUserRegistered);
      };
    }
  }, [isManager, loadData]);

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
      </div>
    );
  }

  // --- Handlers ---
  const handleApproveUser = async (user: UserProfile) => {
    const actorName = userProfile?.full_name || 'Sooriya Moorthy';
    const actorReg = userProfile?.register_number || 'REG-ORG-001';
    const logSentence = `${actorName} (${actorReg}) approved account registration for ${user.full_name} (${user.register_number}) as ${user.role}`;

    // Update in Supabase via RPC if available
    try {
      await supabase.rpc('approve_user', { p_user_id: user.id });
    } catch {
      // Fallback
    }

    // Direct table update
    try {
      await supabase
        .from('users')
        .update({ status: 'approved' })
        .or(`id.eq.${user.id},register_number.eq.${user.register_number},email.eq.${user.email}`);

      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'APPROVE_USER',
        details: logSentence,
      });
    } catch {
      // Fallback
    }

    // Update in LocalStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cm_registered_users');
        if (stored) {
          const list: UserProfile[] = JSON.parse(stored);
          const updated = list.map((u) =>
            u.id === user.id || u.register_number === user.register_number || u.email === user.email
              ? { ...u, status: 'approved' as const }
              : u
          );
          localStorage.setItem('cm_registered_users', JSON.stringify(updated));
        }
      } catch {
        // ignore
      }
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id || u.register_number === user.register_number ? { ...u, status: 'approved' } : u
      )
    );
    setActivityLogs((prev) => [
      {
        id: `act-${Date.now()}`,
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'APPROVE_USER',
        details: logSentence,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);

    showToast(`User ${user.full_name} approved! They can now sign in immediately with their credentials.`);
  };

  const handleRejectUser = async (user: UserProfile) => {
    const actorName = userProfile?.full_name || 'Sooriya Moorthy';
    const actorReg = userProfile?.register_number || 'REG-ORG-001';
    const logSentence = `${actorName} (${actorReg}) rejected account registration for ${user.full_name} (${user.register_number})`;

    // Update in Supabase via RPC if available
    try {
      await supabase.rpc('reject_user', { p_user_id: user.id });
    } catch {
      // Fallback
    }

    // Direct table update
    try {
      await supabase
        .from('users')
        .update({ status: 'rejected' })
        .or(`id.eq.${user.id},register_number.eq.${user.register_number},email.eq.${user.email}`);

      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'REJECT_USER',
        details: logSentence,
      });
    } catch {
      // Fallback
    }

    // Update in LocalStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cm_registered_users');
        if (stored) {
          const list: UserProfile[] = JSON.parse(stored);
          const updated = list.map((u) =>
            u.id === user.id || u.register_number === user.register_number || u.email === user.email
              ? { ...u, status: 'rejected' as const }
              : u
          );
          localStorage.setItem('cm_registered_users', JSON.stringify(updated));
        }
      } catch {
        // ignore
      }
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id || u.register_number === user.register_number ? { ...u, status: 'rejected' } : u
      )
    );
    showToast(`User registration rejected.`);
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (newPasswordInput.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    setIsResettingPassword(true);
    const actorName = userProfile?.full_name || 'Sooriya Moorthy';
    const actorReg = userProfile?.register_number || 'REG-ORG-001';

    try {
      const { data, error } = await supabase.rpc('admin_set_password', {
        p_email: resetModalUser.email,
        p_new_password: newPasswordInput,
      });

      if (error) {
        showToast(`Failed to reset password: ${error.message}`, 'error');
      } else {
        const res = data as { success?: boolean; error?: string };
        if (res && !res.success) {
          showToast(res.error || 'Failed to update password.', 'error');
        } else {
          await supabase.from('activity_logs').insert({
            actor_name: actorName,
            actor_regnum: actorReg,
            actor_role: role,
            action: 'RESET_PASSWORD',
            details: `${actorName} (${actorReg}) reset password for user ${resetModalUser.full_name} (${resetModalUser.register_number})`,
          });
          showToast(`Password for ${resetModalUser.full_name} has been updated successfully.`);
          setResetModalUser(null);
          setNewPasswordInput('');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating password';
      showToast(msg, 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleRoleChange = async (userId: string, targetUser: UserProfile, newRole: UserRole) => {
    const actorName = userProfile?.full_name || 'Sooriya Moorthy';
    const actorReg = userProfile?.register_number || 'REG-ORG-001';
    const logSentence = `${actorName} (${actorReg}) changed role of ${targetUser.full_name} (${targetUser.register_number}) to ${newRole}`;

    try {
      await supabase.from('users').update({ role: newRole }).eq('id', userId);
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'ROLE_CHANGE',
        details: logSentence,
      });

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      setActivityLogs((prev) => [
        {
          id: `act-${Date.now()}`,
          actor_name: actorName,
          actor_regnum: actorReg,
          actor_role: role,
          action: 'ROLE_CHANGE',
          details: logSentence,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      showToast(`User role updated to ${newRole}`);
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      showToast(`User role updated to ${newRole}`);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (!isOrg) {
      showToast('Permission Denied: Managers cannot delete users. Only Organizers hold deletion authority.', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete user "${user.full_name}" (${user.register_number})?`)) {
      return;
    }

    const actorName = userProfile?.full_name || 'Sooriya Moorthy';
    const actorReg = userProfile?.register_number || 'REG-ORG-001';
    const logSentence = `${actorName} (${actorReg}) deleted user account ${user.full_name} (${user.register_number})`;

    try {
      await supabase.from('users').delete().eq('id', user.id);
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'DELETE_USER',
        details: logSentence,
      });
    } catch {
      // Fallback
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cm_registered_users');
        if (stored) {
          const list: UserProfile[] = JSON.parse(stored);
          const updated = list.filter(
            (u) => u.id !== user.id && u.register_number !== user.register_number
          );
          localStorage.setItem('cm_registered_users', JSON.stringify(updated));
        }
      } catch {
        // ignore
      }
    }

    setUsers((prev) => prev.filter((u) => u.id !== user.id && u.register_number !== user.register_number));
    setActivityLogs((prev) => [
      {
        id: `act-${Date.now()}`,
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'DELETE_USER',
        details: logSentence,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    showToast(`User ${user.full_name} deleted.`);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserReg.trim() || !newUserEmail.trim()) {
      showToast('Please fill all required user fields', 'error');
      return;
    }

    const actorName = userProfile?.full_name || 'Sooriya Moorthy';
    const actorReg = userProfile?.register_number || 'REG-ORG-001';
    const logSentence = `${actorName} (${actorReg}) created new user account for ${newUserName} (${newUserReg}) as ${newUserRole}`;

    const newUserId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0');

    const newUser: UserProfile = {
      id: newUserId,
      auth_id: newUserId,
      full_name: newUserName.trim(),
      register_number: newUserReg.trim().toUpperCase(),
      email: newUserEmail.trim(),
      role: newUserRole,
      status: 'approved',
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from('users').insert({
        id: newUser.id,
        auth_id: newUser.auth_id,
        full_name: newUser.full_name,
        register_number: newUser.register_number,
        email: newUser.email,
        role: newUser.role,
        status: 'approved',
      });

      await supabase.from('activity_logs').insert({
        actor_id: userProfile?.id,
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'ADD_USER',
        details: logSentence,
      });
    } catch {
      // Fallback
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cm_registered_users');
        const list: UserProfile[] = stored ? JSON.parse(stored) : [];
        list.push(newUser);
        localStorage.setItem('cm_registered_users', JSON.stringify(list));
      } catch {
        // ignore
      }
    }

    setUsers((prev) => [newUser, ...prev]);
    setActivityLogs((prev) => [
      {
        id: `act-${Date.now()}`,
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'ADD_USER',
        details: logSentence,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);

    setIsAddUserModalOpen(false);
    setNewUserName('');
    setNewUserReg('');
    setNewUserEmail('');
    showToast(`User ${newUser.full_name} created successfully.`);
  };

  const handleClearLogs = async () => {
    if (!isOrg) {
      showToast('Permission Denied: Managers cannot delete logs. Only Organizers hold deletion authority.', 'error');
      return;
    }

    if (!confirm('Are you sure you want to clear system logs?')) return;

    try {
      await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setActivityLogs([]);
      showToast('Activity logs cleared.');
    } catch {
      setActivityLogs([]);
      showToast('Activity logs cleared.');
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeUsers = users.filter((u) => u.status !== 'pending');

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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold uppercase tracking-wider text-black">
              System Administration
            </h1>
            <span
              className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                isOrg
                  ? 'bg-black text-white border-black'
                  : 'bg-neutral-200 text-neutral-800 border-neutral-400'
              }`}
            >
              {isOrg ? 'Admin Access (Organizer)' : 'Operations Access (Manager)'}
            </span>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            {isOrg
              ? 'Organizer holds full authority: add, modify, and delete users, equipment, and audit logs.'
              : 'Manager holds operational authority: add users & equipment, assign roles and approve gear. Deletion is restricted to Organizer.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadData} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Selector: Users and Role | Log */}
      <div className="flex gap-2 border-b border-neutral-300 pb-2">
        <button
          onClick={() => setActiveTab('users_role')}
          className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded ${
            activeTab === 'users_role'
              ? 'bg-black text-white'
              : 'text-neutral-600 hover:text-black hover:bg-neutral-200'
          }`}
        >
          Users and Role ({users.length})
          {pendingUsers.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 bg-amber-600 text-white rounded-full text-[10px]">
              {pendingUsers.length} Pending
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded ${
            activeTab === 'log'
              ? 'bg-black text-white'
              : 'text-neutral-600 hover:text-black hover:bg-neutral-200'
          }`}
        >
          Log ({activityLogs.length})
        </button>
      </div>

      {/* ----------------- USERS AND ROLE TAB ----------------- */}
      {activeTab === 'users_role' && (
        <div className="space-y-6">
          {/* Pending Signups Approval Section */}
          {pendingUsers.length > 0 && (
            <div className="bg-white border-2 border-amber-600 rounded p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Pending User Signups ({pendingUsers.length})
                  </h3>
                  <p className="text-xs text-neutral-600">
                    Review and accept newly registered users. Until approved, users cannot checkout gear.
                  </p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-amber-600 text-white px-2 py-0.5 rounded uppercase">
                  Action Required
                </span>
              </div>

              <div className="divide-y divide-neutral-200">
                {pendingUsers.map((pUser) => (
                  <div
                    key={pUser.id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-neutral-900 flex items-center gap-2">
                        <span>{pUser.full_name}</span>
                        <span className="font-mono text-[11px] text-neutral-500">
                          ({pUser.register_number})
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-600">
                        {pUser.email} • Requested Role:{' '}
                        <span className="font-mono font-bold uppercase">{pUser.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleApproveUser(pUser)}
                      >
                        Accept User
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectUser(pUser)}
                      >
                        Reject
                      </Button>
                      {isOrg && (
                        <button
                          onClick={() => handleDeleteUser(pUser)}
                          className="text-xs text-neutral-600 hover:text-black font-semibold px-2 py-1 border border-neutral-300 rounded hover:bg-neutral-100"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Users Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                Active Users & Permissions
              </h3>
              <Button size="sm" variant="primary" onClick={() => setIsAddUserModalOpen(true)}>
                + Add User
              </Button>
            </div>

            <div className="border border-neutral-300 rounded overflow-x-auto bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-800 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Name - Register Number</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Assigned Role</th>
                    <th className="py-2.5 px-3 text-right">Role Management</th>
                    <th className="py-2.5 px-3 text-right">User Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {activeUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-neutral-900">
                        {u.full_name} <span className="font-mono text-neutral-500 font-normal">({u.register_number})</span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            u.status === 'approved'
                              ? 'bg-emerald-700 text-white'
                              : u.status === 'rejected'
                              ? 'bg-neutral-800 text-white'
                              : 'bg-amber-600 text-white'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold border border-neutral-400 bg-neutral-100 text-neutral-900">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, u, e.target.value as UserRole)}
                          className="text-xs px-2 py-1 bg-white border border-neutral-300 rounded focus:outline-none focus:border-black font-medium"
                        >
                          <option value="volunteer">Volunteer</option>
                          <option value="coordinator">Coordinator</option>
                          <option value="manager">Manager</option>
                          <option value="organizer">Organizer</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setResetModalUser(u);
                              setNewPasswordInput('');
                            }}
                            className="text-xs text-neutral-800 hover:text-black font-semibold border border-neutral-300 hover:border-black px-2 py-1 rounded"
                            title="Reset user password in database without sending email"
                          >
                            Reset Password
                          </button>
                          {isOrg && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="text-xs text-neutral-700 hover:text-black font-semibold border border-neutral-300 hover:border-black px-2 py-1 rounded"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- LOG TAB (Human-Readable Transactions) ----------------- */}
      {activeTab === 'log' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                Transaction & Activity Log
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Every equipment assignment, return, user signup approval, and administrative action is recorded.
              </p>
            </div>
            {isOrg && activityLogs.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleClearLogs}>
                Clear Logs
              </Button>
            )}
          </div>

          <div className="border border-neutral-300 rounded overflow-x-auto bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-800 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3 w-40">Timestamp</th>
                  <th className="py-2.5 px-3 w-48">Actor (Name - RegNum)</th>
                  <th className="py-2.5 px-3">Transaction Description</th>
                  <th className="py-2.5 px-3 text-right w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-500">
                      No transaction logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-neutral-900">{log.actor_name}</div>
                        <div className="text-[10px] font-mono text-neutral-500">
                          {log.actor_regnum} • <span className="uppercase">{log.actor_role}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-neutral-900 leading-relaxed">
                        {log.details}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-neutral-100 border border-neutral-300 text-neutral-800">
                          {log.action}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-neutral-400 rounded-md w-full max-w-md p-5 shadow-lg space-y-4">
            <div className="border-b border-neutral-200 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                Create User Account
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Users added directly by Organizer/Manager are pre-approved.
              </p>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                  Register Number
                </label>
                <input
                  type="text"
                  required
                  value={newUserReg}
                  onChange={(e) => setNewUserReg(e.target.value.toUpperCase())}
                  placeholder="e.g. REG-VOL-01"
                  className="w-full px-3 py-1.5 text-xs uppercase font-mono bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                  Assigned Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                >
                  <option value="volunteer">Volunteer</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="manager">Manager</option>
                  <option value="organizer">Organizer</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddUserModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Create User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal (Direct Database Reset, No Email Needed) */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                Reset User Password
              </h3>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-neutral-500 hover:text-black font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-neutral-700">
              Setting new password directly for:
              <div className="font-semibold text-neutral-900 mt-1">
                {resetModalUser.full_name} ({resetModalUser.register_number})
              </div>
              <div className="text-[11px] text-neutral-500 font-mono">{resetModalUser.email}</div>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResetModalUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isResettingPassword}
                >
                  Save Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
