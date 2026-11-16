'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/app/providers';
import { UserProfile, UserRole, UserStatus, ActivityLog, isManagerOrOrganizer, canDeleteRecords } from '@/types';
import { Button } from '@/components/ui/Button';

const INITIAL_USERS: UserProfile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    auth_id: null,
    full_name: 'Admin Organizer',
    register_number: 'REG-ADMIN-01',
    email: 'organizer@cameramanager.local',
    role: 'organizer',
    status: 'approved',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    auth_id: null,
    full_name: 'Desk Manager',
    register_number: 'REG-MGR-02',
    email: 'manager@cameramanager.local',
    role: 'manager',
    status: 'approved',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    auth_id: null,
    full_name: 'Priya Patel',
    register_number: 'REG-COORD-03',
    email: 'priya@cameramanager.local',
    role: 'coordinator',
    status: 'approved',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    auth_id: null,
    full_name: 'Rahul Sharma',
    register_number: 'REG-VOL-04',
    email: 'rahul@cameramanager.local',
    role: 'volunteer',
    status: 'approved',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    auth_id: null,
    full_name: 'Sneha Reddy',
    register_number: 'REG-VOL-05',
    email: 'sneha@cameramanager.local',
    role: 'volunteer',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
];

const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'act-1',
    actor_name: 'Admin Organizer',
    actor_regnum: 'REG-ADMIN-01',
    actor_role: 'organizer',
    action: 'ASSIGN_EQUIPMENT',
    details: 'Admin Organizer (REG-ADMIN-01) assigned DJI RS 3 Pro Gimbal (SN-DJI-5521) to Rahul Sharma (REG-VOL-04)',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'act-2',
    actor_name: 'Rahul Sharma',
    actor_regnum: 'REG-VOL-04',
    actor_role: 'volunteer',
    action: 'REQUEST_RETURN',
    details: 'Rahul Sharma (REG-VOL-04) requested equipment return for Rode Wireless GO II (SN-ROD-8812)',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'act-3',
    actor_name: 'Desk Manager',
    actor_regnum: 'REG-MGR-02',
    actor_role: 'manager',
    action: 'APPROVE_RETURN',
    details: 'Desk Manager (REG-MGR-02) approved return of Rode Wireless GO II (SN-ROD-8812) from Priya Patel (REG-COORD-03)',
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: uData } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (uData && uData.length > 0) {
        setUsers(uData as UserProfile[]);
      }

      const { data: aData } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false });
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
    const actorName = userProfile?.full_name || (role === 'organizer' ? 'Admin Organizer' : 'Desk Manager');
    const actorReg = userProfile?.register_number || (role === 'organizer' ? 'REG-ADMIN-01' : 'REG-MGR-02');
    const logSentence = `${actorName} (${actorReg}) approved account registration for ${user.full_name} (${user.register_number}) as ${user.role}`;

    try {
      await supabase.from('users').update({ status: 'approved' }).eq('id', user.id);
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'APPROVE_USER',
        details: logSentence,
      });

      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 'approved' } : u)));
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

      showToast(`User ${user.full_name} has been approved.`);
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 'approved' } : u)));
      showToast(`User ${user.full_name} has been approved.`);
    }
  };

  const handleRejectUser = async (user: UserProfile) => {
    const actorName = userProfile?.full_name || (role === 'organizer' ? 'Admin Organizer' : 'Desk Manager');
    const actorReg = userProfile?.register_number || (role === 'organizer' ? 'REG-ADMIN-01' : 'REG-MGR-02');
    const logSentence = `${actorName} (${actorReg}) rejected account registration for ${user.full_name} (${user.register_number})`;

    try {
      await supabase.from('users').update({ status: 'rejected' }).eq('id', user.id);
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'REJECT_USER',
        details: logSentence,
      });

      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 'rejected' } : u)));
      showToast(`User registration rejected.`);
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 'rejected' } : u)));
      showToast(`User registration rejected.`);
    }
  };

  const handleRoleChange = async (userId: string, targetUser: UserProfile, newRole: UserRole) => {
    const actorName = userProfile?.full_name || (role === 'organizer' ? 'Admin Organizer' : 'Desk Manager');
    const actorReg = userProfile?.register_number || (role === 'organizer' ? 'REG-ADMIN-01' : 'REG-MGR-02');
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

    const actorName = userProfile?.full_name || 'Admin Organizer';
    const actorReg = userProfile?.register_number || 'REG-ADMIN-01';
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

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
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
    } catch {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      showToast(`User ${user.full_name} deleted.`);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserReg.trim() || !newUserEmail.trim()) {
      showToast('Please fill all required user fields', 'error');
      return;
    }

    const actorName = userProfile?.full_name || (role === 'organizer' ? 'Admin Organizer' : 'Desk Manager');
    const actorReg = userProfile?.register_number || (role === 'organizer' ? 'REG-ADMIN-01' : 'REG-MGR-02');
    const logSentence = `${actorName} (${actorReg}) created new user account for ${newUserName} (${newUserReg}) as ${newUserRole}`;

    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      auth_id: null,
      full_name: newUserName.trim(),
      register_number: newUserReg.trim().toUpperCase(),
      email: newUserEmail.trim(),
      role: newUserRole,
      status: 'approved', // Directly approved by manager/organizer
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from('users').insert({
        full_name: newUser.full_name,
        register_number: newUser.register_number,
        email: newUser.email,
        role: newUser.role,
        status: 'approved',
      });

      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: role,
        action: 'ADD_USER',
        details: logSentence,
      });

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
    } catch {
      setUsers((prev) => [newUser, ...prev]);
      setIsAddUserModalOpen(false);
      showToast(`User ${newUser.full_name} created successfully.`);
    }
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
                    {isOrg && <th className="py-2.5 px-3 text-right">Admin Actions</th>}
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
                      {isOrg && (
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="text-xs text-neutral-700 hover:text-black font-semibold border border-neutral-300 hover:border-black px-2 py-1 rounded"
                          >
                            Delete
                          </button>
                        </td>
                      )}
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
                  placeholder="e.g. Aakash Verma"
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
                  placeholder="e.g. REG-VOL-06"
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
                  placeholder="user@cameramanager.local"
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
    </div>
  );
}
