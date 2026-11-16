'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/app/providers';
import { Equipment, CheckoutLog, UserProfile, isManagerOrOrganizer } from '@/types';
import { DashboardTable } from '@/components/DashboardTable';
import { Button } from '@/components/ui/Button';

// Main Super Admin user (all sample mock users removed)
const DEFAULT_USERS: UserProfile[] = [
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

// Preserved Real Camera Inventory
const DEFAULT_EQUIPMENT: Equipment[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    name: 'Sony Alpha A7 IV (Body)',
    category: 'Camera',
    serial_number: 'SN-SNY-9481',
    status: 'available',
    entered_by: '00000000-0000-0000-0000-000000000001',
    entered_by_name: 'Sooriya Moorthy',
    entered_by_regnum: 'REG-ORG-001',
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    name: 'Canon EOS R6 Mark II',
    category: 'Camera',
    serial_number: 'SN-CAN-1024',
    status: 'available',
    entered_by: '00000000-0000-0000-0000-000000000001',
    entered_by_name: 'Sooriya Moorthy',
    entered_by_regnum: 'REG-ORG-001',
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000103',
    name: 'DJI RS 3 Pro Gimbal',
    category: 'Stabilizer',
    serial_number: 'SN-DJI-5521',
    status: 'available',
    entered_by: '00000000-0000-0000-0000-000000000001',
    entered_by_name: 'Sooriya Moorthy',
    entered_by_regnum: 'REG-ORG-001',
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000104',
    name: 'Rode Wireless GO II Dual',
    category: 'Audio',
    serial_number: 'SN-ROD-8812',
    status: 'available',
    entered_by: '00000000-0000-0000-0000-000000000001',
    entered_by_name: 'Sooriya Moorthy',
    entered_by_regnum: 'REG-ORG-001',
    created_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000105',
    name: 'Sony FE 24-70mm f/2.8 GM II',
    category: 'Lens',
    serial_number: 'SN-SNY-4491',
    status: 'available',
    entered_by: '00000000-0000-0000-0000-000000000001',
    entered_by_name: 'Sooriya Moorthy',
    entered_by_regnum: 'REG-ORG-001',
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_CHECKOUTS: CheckoutLog[] = [];

export default function DashboardPage() {
  const { userProfile, role, status } = useAuth();
  const isManager = isManagerOrOrganizer(role);

  const [equipment, setEquipment] = useState<Equipment[]>(DEFAULT_EQUIPMENT);
  const [checkouts, setCheckouts] = useState<CheckoutLog[]>(DEFAULT_CHECKOUTS);
  const [users, setUsers] = useState<UserProfile[]>(DEFAULT_USERS);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Volunteer Checkout Request Modal State
  const [requestModalGear, setRequestModalGear] = useState<Equipment | null>(null);
  const [requestNotes, setRequestNotes] = useState('');
  const [requestExpectedReturn, setRequestExpectedReturn] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: eqData } = await supabase.from('equipment').select('*').order('name');
      if (eqData && eqData.length > 0) {
        setEquipment(eqData as Equipment[]);
      }

      const { data: uData } = await supabase.from('users').select('*').order('full_name');
      
      let localUsers: UserProfile[] = [];
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('cm_registered_users');
          if (stored) localUsers = JSON.parse(stored);
        } catch {
          // ignore
        }
      }

      const mergedUsersMap = new Map<string, UserProfile>();
      DEFAULT_USERS.forEach((u) => mergedUsersMap.set(u.register_number, u));
      localUsers.forEach((u) => mergedUsersMap.set(u.register_number, u));
      if (uData && uData.length > 0) {
        (uData as UserProfile[]).forEach((u) => mergedUsersMap.set(u.register_number, u));
      }
      setUsers(Array.from(mergedUsersMap.values()));

      const { data: coData } = await supabase
        .from('checkout_logs')
        .select('*, equipment:equipment_id(*), user:user_id(*)')
        .order('created_at', { ascending: false });

      if (coData) {
        setCheckouts(coData as CheckoutLog[]);
      }
    } catch (err) {
      console.warn('Using local state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    const onCheckoutUpdated = () => loadData();
    window.addEventListener('cm_checkout_updated', onCheckoutUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('cm_checkout_updated', onCheckoutUpdated);
    };
  }, [loadData]);

  // Statistics
  const totalCount = equipment.length;
  const availableCount = equipment.filter((e) => e.status === 'available').length;
  const checkedOutCount = equipment.filter((e) => e.status === 'checked_out').length;
  const pendingReturnCount = equipment.filter((e) => e.status === 'pending_return').length;

  const currentActorName = userProfile?.full_name || 'Sooriya Moorthy';
  const currentActorReg = userProfile?.register_number || 'REG-ORG-001';

  const handleAssignCheckout = async (equipmentId: string, targetUserId: string, notes?: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_id: equipmentId,
          user_id: targetUserId,
          notes,
          actor_name: currentActorName,
          actor_regnum: currentActorReg,
          actor_role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign equipment');
      }

      showNotification(data.message || 'Equipment successfully assigned and checked out');
      await loadData();
    } catch (err: unknown) {
      const targetUser = users.find((u) => u.id === targetUserId);
      const targetItem = equipment.find((e) => e.id === equipmentId);

      if (targetItem && targetUser) {
        setEquipment((prev) =>
          prev.map((e) => (e.id === equipmentId ? { ...e, status: 'checked_out' } : e))
        );
        const newLog: CheckoutLog = {
          id: `log-${Date.now()}`,
          equipment_id: equipmentId,
          user_id: targetUserId,
          checkout_time: new Date().toISOString(),
          expected_return_time: null,
          actual_return_time: null,
          surrender_requested: false,
          status: 'active',
          notes: notes || null,
          created_at: new Date().toISOString(),
          equipment: { ...targetItem, status: 'checked_out' },
          user: targetUser,
        };
        setCheckouts((prev) => [newLog, ...prev]);
        showNotification(`${currentActorName} assigned ${targetItem.name} to ${targetUser.full_name}`);
      } else {
        const msg = err instanceof Error ? err.message : 'Error assigning equipment';
        showNotification(msg, 'error');
      }
    }
  };

  const handleRequestReturn = async (checkoutId: string, equipmentId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkout_id: checkoutId,
          equipment_id: equipmentId,
          action: 'request_return',
          actor_name: currentActorName,
          actor_regnum: currentActorReg,
          actor_role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request return');

      showNotification(data.message || 'Return request submitted. Awaiting manager approval.');
      await loadData();
    } catch {
      setEquipment((prev) =>
        prev.map((e) => (e.id === equipmentId ? { ...e, status: 'pending_return' } : e))
      );
      setCheckouts((prev) =>
        prev.map((c) =>
          c.id === checkoutId ? { ...c, surrender_requested: true, status: 'pending_return' } : c
        )
      );
      showNotification('Return request submitted. Awaiting manager approval.');
    }
  };

  const handleApproveReturn = async (checkoutId: string, equipmentId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkout_id: checkoutId,
          equipment_id: equipmentId,
          action: 'approve_return',
          actor_name: currentActorName,
          actor_regnum: currentActorReg,
          actor_role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve return');

      showNotification(data.message || 'Equipment return approved. Item is now Available.');
      await loadData();
    } catch {
      setEquipment((prev) =>
        prev.map((e) => (e.id === equipmentId ? { ...e, status: 'available' } : e))
      );
      setCheckouts((prev) =>
        prev.map((c) =>
          c.id === checkoutId
            ? { ...c, actual_return_time: new Date().toISOString(), status: 'returned', surrender_requested: false }
            : c
        )
      );
      showNotification('Equipment return approved. Item is now Available.');
    }
  };

  const handleRejectReturn = async (checkoutId: string, equipmentId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkout_id: checkoutId,
          equipment_id: equipmentId,
          action: 'reject_return',
          actor_name: currentActorName,
          actor_regnum: currentActorReg,
          actor_role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject return');

      showNotification(data.message || 'Return request rejected. Item remains checked out.');
      await loadData();
    } catch {
      setEquipment((prev) =>
        prev.map((e) => (e.id === equipmentId ? { ...e, status: 'checked_out' } : e))
      );
      setCheckouts((prev) =>
        prev.map((c) =>
          c.id === checkoutId ? { ...c, surrender_requested: false, status: 'active' } : c
        )
      );
      showNotification('Return request rejected. Item remains checked out.');
    }
  };

  const handleForceReturn = async (checkoutId: string, equipmentId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkout_id: checkoutId,
          equipment_id: equipmentId,
          action: 'force_return',
          actor_name: currentActorName,
          actor_regnum: currentActorReg,
          actor_role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to force return');

      showNotification(data.message || 'Equipment force-returned successfully.');
      await loadData();
    } catch {
      setEquipment((prev) =>
        prev.map((e) => (e.id === equipmentId ? { ...e, status: 'available' } : e))
      );
      setCheckouts((prev) =>
        prev.map((c) =>
          c.id === checkoutId
            ? { ...c, actual_return_time: new Date().toISOString(), status: 'returned', surrender_requested: false }
            : c
        )
      );
      showNotification('Equipment force-returned successfully.');
    }
  };

  const handleApproveCheckout = async (checkoutId: string, equipmentId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkout_id: checkoutId,
          equipment_id: equipmentId,
          action: 'approve_checkout',
          actor_name: currentActorName,
          actor_regnum: currentActorReg,
          actor_role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve checkout');

      showNotification(data.message || 'Equipment checkout approved.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cm_checkout_updated'));
      }
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error approving checkout';
      showNotification(msg, 'error');
    }
  };

  const handleRejectCheckout = async (checkoutId: string, equipmentId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkout_id: checkoutId,
          equipment_id: equipmentId,
          action: 'reject_checkout',
          actor_name: currentActorName,
          actor_regnum: currentActorReg,
          actor_role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject checkout');

      showNotification(data.message || 'Checkout request rejected.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cm_checkout_updated'));
      }
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error rejecting checkout';
      showNotification(msg, 'error');
    }
  };

  const handleOpenCheckoutRequest = (item: Equipment) => {
    if (status === 'pending') {
      showNotification('Your account is pending approval by an Organizer or Manager.', 'error');
      return;
    }
    setRequestModalGear(item);
    setRequestNotes('');
    setRequestExpectedReturn('');
  };

  const handleSubmitCheckoutRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestModalGear) return;
    if (!userProfile?.id) {
      showNotification('User profile not loaded. Please log in again.', 'error');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment_id: requestModalGear.id,
          user_id: userProfile.id,
          expected_return_time: requestExpectedReturn || null,
          notes: requestNotes,
          action: 'request_checkout',
          actor_name: currentActorName,
          actor_regnum: currentActorReg,
          actor_role: role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit checkout request');
      }

      showNotification('Checkout request submitted. Awaiting Organizer or Manager approval.');
      setRequestModalGear(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cm_checkout_updated'));
      }
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit request';
      showNotification(msg, 'error');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const isPendingCheckoutRequest = (c: CheckoutLog) => {
    return (
      c.actual_return_time === null &&
      (c.status === 'pending' ||
        c.status === 'pending_checkout' ||
        (Boolean(c.notes?.includes('[CHECKOUT_REQUEST]')) &&
          c.status !== 'returned' &&
          c.status !== 'rejected' &&
          !c.surrender_requested))
    );
  };

  const pendingCheckoutRequests = checkouts.filter(isPendingCheckoutRequest);
  const pendingCheckoutCount = pendingCheckoutRequests.length;

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

      {/* Account Pending Approval Banner */}
      {status === 'pending' && (
        <div className="bg-white border-2 border-amber-600 rounded p-4 text-xs space-y-1">
          <div className="font-bold uppercase tracking-wider text-amber-900">
            Account Pending Approval
          </div>
          <p className="text-neutral-700">
            Your account is waiting to be approved by an <strong>Organizer</strong> or <strong>Manager</strong>.
            Until approved, equipment checkouts cannot be assigned to you.
          </p>
        </div>
      )}

      {/* Header and Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-black">
            Live Equipment Dashboard
          </h1>
          <p className="text-xs text-neutral-600 mt-1">
            Real-time equipment availability, checkouts, and pending return verifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isManager && (
            <Link href="/inventory">
              <Button size="sm" variant="primary">
                + Add Equipment
              </Button>
            </Link>
          )}
          <Button size="sm" variant="outline" onClick={loadData} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Pending Checkout Requests Alert Banner (for Managers/Organizers) */}
      {isManager && pendingCheckoutCount > 0 && (
        <div className="bg-white border-2 border-amber-600 rounded p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Action Required: {pendingCheckoutCount} Volunteer Checkout Request{pendingCheckoutCount > 1 ? 's' : ''} Pending
              </div>
              <p className="text-xs text-neutral-700 mt-0.5">
                Volunteers have requested equipment checkout. Review and approve or reject to allocate gear.
              </p>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white uppercase tracking-wider">
              {pendingCheckoutCount} Pending Review
            </span>
          </div>

          <div className="divide-y divide-neutral-200">
            {pendingCheckoutRequests.map((req) => (
              <div
                key={req.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-neutral-900 flex items-center gap-2">
                    <span>{req.equipment?.name || 'Equipment'}</span>
                    <span className="font-mono text-[11px] text-neutral-500 font-normal">
                      ({req.equipment?.serial_number})
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-600 mt-0.5">
                    Requested by: <strong>{req.user?.full_name || 'Volunteer'}</strong>{' '}
                    <span className="font-mono">({req.user?.register_number})</span> • {req.user?.email}
                  </div>
                  {req.notes && (
                    <div className="text-[11px] text-neutral-600 italic mt-0.5">
                      Note: {req.notes.replace('[CHECKOUT_REQUEST]', '').trim()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleApproveCheckout(req.id, req.equipment_id)}
                  >
                    Approve Checkout
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRejectCheckout(req.id, req.equipment_id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Return Alert Banner (for Managers/Organizers) */}
      {isManager && pendingReturnCount > 0 && (
        <div className="bg-white border-2 border-amber-600 rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Action Required: {pendingReturnCount} Pending Return{pendingReturnCount > 1 ? 's' : ''}
            </div>
            <p className="text-xs text-neutral-700 mt-0.5">
              Volunteers have surrendered equipment. Review and approve or reject in the table below to restore inventory availability.
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-amber-600 text-white uppercase tracking-wider">
            Review Below
          </span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-neutral-300 p-4 rounded">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Total Gear
          </div>
          <div className="text-2xl font-bold text-neutral-900 mt-1 font-mono">{totalCount}</div>
        </div>

        <div className="bg-white border border-neutral-300 p-4 rounded">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Available
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{availableCount}</div>
        </div>

        <div className="bg-white border border-neutral-300 p-4 rounded">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Pending Requests
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">{pendingCheckoutCount}</div>
        </div>

        <div className="bg-white border border-neutral-300 p-4 rounded">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Checked Out
          </div>
          <div className="text-2xl font-bold text-neutral-700 mt-1 font-mono">{checkedOutCount}</div>
        </div>

        <div className="bg-white border border-neutral-300 p-4 rounded">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Pending Returns
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">{pendingReturnCount}</div>
        </div>
      </div>

      {/* Main Gear Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
            Gear Status & Checkout Table
          </h2>
          <span className="text-[11px] text-neutral-500 font-mono">
            Active Role: <strong className="uppercase text-neutral-900">{role}</strong>
          </span>
        </div>

        <DashboardTable
          equipment={equipment}
          checkouts={checkouts}
          users={users.filter((u) => u.status === 'approved')}
          currentUser={userProfile}
          currentRole={role}
          onAssignCheckout={handleAssignCheckout}
          onRequestReturn={handleRequestReturn}
          onApproveReturn={handleApproveReturn}
          onRejectReturn={handleRejectReturn}
          onForceReturn={handleForceReturn}
          onRequestCheckoutDirect={handleOpenCheckoutRequest}
          onApproveCheckout={handleApproveCheckout}
          onRejectCheckout={handleRejectCheckout}
        />
      </div>

      {/* Volunteer Checkout Request Modal */}
      {requestModalGear && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                Request Equipment Checkout
              </h3>
              <button
                onClick={() => setRequestModalGear(null)}
                className="text-neutral-500 hover:text-black font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-neutral-700 space-y-1">
              <div className="font-semibold text-neutral-900 text-sm">
                {requestModalGear.name}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
                <span>SN: {requestModalGear.serial_number}</span>
                <span>•</span>
                <span>{requestModalGear.category}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitCheckoutRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                  Purpose / Notes
                </label>
                <textarea
                  rows={2}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="e.g. Club photoshoot, event recording..."
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                  Expected Return Date / Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={requestExpectedReturn}
                  onChange={(e) => setRequestExpectedReturn(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestModalGear(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isSubmittingRequest}
                >
                  Submit Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
