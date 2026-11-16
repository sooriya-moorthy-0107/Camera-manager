'use client';

import React, { useState, useMemo } from 'react';
import { Equipment, CheckoutLog, UserProfile, UserRole, isManagerOrOrganizer } from '@/types';
import { Button } from '@/components/ui/Button';

interface DashboardTableProps {
  equipment: Equipment[];
  checkouts: CheckoutLog[];
  users: UserProfile[];
  currentUser: UserProfile | null;
  currentRole: UserRole;
  onAssignCheckout: (equipmentId: string, targetUserId: string, notes?: string) => Promise<void>;
  onRequestReturn: (checkoutId: string, equipmentId: string) => Promise<void>;
  onApproveReturn: (checkoutId: string, equipmentId: string) => Promise<void>;
  onRejectReturn: (checkoutId: string, equipmentId: string) => Promise<void>;
  onForceReturn: (checkoutId: string, equipmentId: string) => Promise<void>;
  onRequestCheckoutDirect?: (item: Equipment) => void;
  onApproveCheckout?: (checkoutId: string, equipmentId: string) => Promise<void>;
  onRejectCheckout?: (checkoutId: string, equipmentId: string) => Promise<void>;
}

export const DashboardTable: React.FC<DashboardTableProps> = ({
  equipment,
  checkouts,
  users,
  currentUser,
  currentRole,
  onAssignCheckout,
  onRequestReturn,
  onApproveReturn,
  onRejectReturn,
  onForceReturn,
  onRequestCheckoutDirect,
  onApproveCheckout,
  onRejectCheckout,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Assignment Modal State
  const [assigningItem, setAssigningItem] = useState<Equipment | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Map active checkout by equipment id
  const activeCheckoutsByEquipment = useMemo(() => {
    const map = new Map<string, CheckoutLog>();
    for (const log of checkouts) {
      if (!log.actual_return_time) {
        map.set(log.equipment_id, log);
      }
    }
    return map;
  }, [checkouts]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    equipment.forEach((item) => set.add(item.category));
    return Array.from(set).sort();
  }, [equipment]);

  // Filtered equipment
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      const activeLog = activeCheckoutsByEquipment.get(item.id);
      const effectiveStatus = item.status;

      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }

      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesSerial = item.serial_number.toLowerCase().includes(query);
        const matchesHolder = activeLog?.user?.full_name?.toLowerCase().includes(query);
        const matchesReg = activeLog?.user?.register_number?.toLowerCase().includes(query);
        if (!matchesName && !matchesSerial && !matchesHolder && !matchesReg) {
          return false;
        }
      }

      return true;
    });
  }, [equipment, activeCheckoutsByEquipment, statusFilter, categoryFilter, searchTerm]);

  // Filtered users for assignment modal
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.register_number.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const handleOpenAssign = (item: Equipment) => {
    setAssigningItem(item);
    setSelectedUserId('');
    setUserSearch('');
    setAssignNotes('');
    setAssignError(null);
  };

  const handleConfirmAssign = async () => {
    if (!assigningItem || !selectedUserId) {
      setAssignError('Please select a user to assign this equipment');
      return;
    }
    try {
      setIsSubmittingAssign(true);
      await onAssignCheckout(assigningItem.id, selectedUserId, assignNotes);
      setAssigningItem(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign equipment';
      setAssignError(msg);
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const isManager = isManagerOrOrganizer(currentRole);

  const getStatusBadge = (status: Equipment['status']) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-700 text-white">
            Available
          </span>
        );
      case 'pending_return':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-600 text-white">
            Pending Return
          </span>
        );
      case 'checked_out':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-neutral-600 text-white">
            Checked Out
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-neutral-900 text-white">
            Maintenance
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-neutral-400 text-white">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-neutral-300 rounded">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search gear, serial number, or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
          />
        </div>

        <div className="flex items-center gap-2">
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="checked_out">Checked Out</option>
              <option value="pending_return">Pending Return</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto border border-neutral-300 rounded bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-800 uppercase tracking-wider font-semibold">
              <th className="py-2.5 px-3">Equipment</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Serial Number</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Assigned To</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {filteredEquipment.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-neutral-500">
                  No equipment matches the selected filters.
                </td>
              </tr>
            ) : (
              filteredEquipment.map((item) => {
                const activeLog = activeCheckoutsByEquipment.get(item.id);
                const isAssignedToCurrentUser =
                  currentUser && activeLog && activeLog.user_id === currentUser.id;

                const isPendingCheckoutReq = Boolean(
                  activeLog &&
                  (activeLog.status === 'pending' ||
                    activeLog.status === 'pending_checkout' ||
                    (Boolean(activeLog.notes?.includes('[CHECKOUT_REQUEST]')) &&
                      activeLog.status !== 'returned' &&
                      activeLog.status !== 'rejected' &&
                      !activeLog.surrender_requested))
                );

                return (
                  <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-neutral-900">{item.name}</td>
                    <td className="py-2.5 px-3 text-neutral-600">{item.category}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-800">{item.serial_number}</td>
                    <td className="py-2.5 px-3">
                      {isPendingCheckoutReq ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-600 text-white">
                          Pending Approval
                        </span>
                      ) : (
                        getStatusBadge(item.status)
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {activeLog?.user ? (
                        <div>
                          <div className="font-medium text-neutral-900 flex items-center gap-1.5">
                            <span>{activeLog.user.full_name}</span>
                            {isPendingCheckoutReq && (
                              <span className="text-[9px] uppercase font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1 rounded">
                                Requested
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-neutral-500">
                            {activeLog.user.register_number}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                      {/* 1. Pending Checkout Request Actions */}
                      {isPendingCheckoutReq && activeLog ? (
                        isManager ? (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => onApproveCheckout && onApproveCheckout(activeLog.id, item.id)}
                            >
                              Approve Checkout
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onRejectCheckout && onRejectCheckout(activeLog.id, item.id)}
                            >
                              Reject
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700 font-mono">
                            {isAssignedToCurrentUser ? 'Your Request Pending' : 'Requested'}
                          </span>
                        )
                      ) : isManager ? (
                        /* 2. Normal Manager Actions */
                        <>
                          {item.status === 'available' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleOpenAssign(item)}
                            >
                              Assign
                            </Button>
                          )}

                          {item.status === 'pending_return' && activeLog && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => onApproveReturn(activeLog.id, item.id)}
                              >
                                Approve Return
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onRejectReturn(activeLog.id, item.id)}
                              >
                                Reject
                              </Button>
                            </>
                          )}

                          {item.status === 'checked_out' && activeLog && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onForceReturn(activeLog.id, item.id)}
                            >
                              Force Return
                            </Button>
                          )}
                        </>
                      ) : (
                        /* 3. Normal Volunteer Actions */
                        <>
                          {item.status === 'available' && onRequestCheckoutDirect && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => onRequestCheckoutDirect(item)}
                            >
                              Request Checkout
                            </Button>
                          )}

                          {item.status === 'checked_out' &&
                            activeLog &&
                            (isAssignedToCurrentUser || !currentUser) && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => onRequestReturn(activeLog.id, item.id)}
                              >
                                Request Return
                              </Button>
                            )}

                          {item.status === 'pending_return' && (
                            <span className="text-xs text-neutral-500 font-medium">
                              Pending Return Approval
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Assignment Modal with Searchable User List */}
      {assigningItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-neutral-400 rounded-md w-full max-w-lg p-5 shadow-lg space-y-4">
            <div className="border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                Assign Equipment
              </h3>
              <p className="text-xs text-neutral-600 mt-1">
                {assigningItem.name} ({assigningItem.serial_number})
              </p>
            </div>

            {assignError && (
              <div className="p-2.5 bg-neutral-100 border border-neutral-400 text-xs text-neutral-900 rounded">
                {assignError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                Target User (Search by Name or Register Number)
              </label>
              <input
                type="text"
                placeholder="Type to search volunteers or coordinators..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black mb-2"
              />

              <div className="max-h-48 overflow-y-auto border border-neutral-300 rounded divide-y divide-neutral-200">
                {filteredUsers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-neutral-500">
                    No matching users found.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedUserId === u.id;
                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`p-2.5 cursor-pointer text-xs flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-900'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{u.full_name}</div>
                          <div
                            className={`text-[11px] font-mono ${
                              isSelected ? 'text-neutral-300' : 'text-neutral-500'
                            }`}
                          >
                            Reg: {u.register_number} • {u.email}
                          </div>
                        </div>
                        <div
                          className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                            isSelected
                              ? 'border-neutral-500 text-neutral-200'
                              : 'border-neutral-300 text-neutral-600'
                          }`}
                        >
                          {u.role}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1">
                Assignment Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Event location, specific assignment notes..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssigningItem(null)}
                disabled={isSubmittingAssign}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmAssign}
                loading={isSubmittingAssign}
                disabled={!selectedUserId}
              >
                Confirm Assignment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

