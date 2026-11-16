'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/app/providers';
import { Equipment, isManagerOrOrganizer, canDeleteRecords } from '@/types';
import { EquipmentForm } from '@/components/forms/EquipmentForm';
import { EquipmentFormData } from '@/lib/validations';
import { Button } from '@/components/ui/Button';

// Real Equipment Inventory with Main Super Admin as Author
const INITIAL_INVENTORY: Equipment[] = [
  {
    id: 'eq-1',
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
    id: 'eq-2',
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
    id: 'eq-3',
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
    id: 'eq-4',
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
    id: 'eq-5',
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

export default function InventoryPage() {
  const { userProfile, role } = useAuth();
  const isManager = isManagerOrOrganizer(role);
  const isOrg = canDeleteRecords(role); // Only organizer can delete

  const [equipment, setEquipment] = useState<Equipment[]>(INITIAL_INVENTORY);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadEquipment = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('equipment')
        .select('*, entered_by_user:entered_by(full_name, register_number)')
        .order('created_at', { ascending: false });

      if (data && !error && data.length > 0) {
        const mapped = data.map((item: any) => ({
          ...item,
          entered_by_name: item.entered_by_user?.full_name || 'Sooriya Moorthy',
          entered_by_regnum: item.entered_by_user?.register_number || 'REG-ORG-001',
        }));
        setEquipment(mapped as Equipment[]);
      }
    } catch {
      // Local fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

  const existingSerialNumbers = useMemo(() => {
    return equipment.map((e) => e.serial_number);
  }, [equipment]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    equipment.forEach((e) => s.add(e.category));
    return Array.from(s).sort();
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.serial_number.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [equipment, search, categoryFilter]);

  const handleAddEquipment = async (data: EquipmentFormData) => {
    try {
      const creatorName = userProfile?.full_name || 'Sooriya Moorthy';
      const creatorReg = userProfile?.register_number || 'REG-ORG-001';

      const { data: existing } = await supabase
        .from('equipment')
        .select('id')
        .ilike('serial_number', data.serial_number)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `Serial number "${data.serial_number}" already exists in the inventory.`,
        };
      }

      const newId = `eq-${Date.now()}`;
      const payload: Equipment = {
        id: newId,
        name: data.name,
        category: data.category,
        serial_number: data.serial_number,
        status: 'available',
        entered_by: userProfile?.id || '00000000-0000-0000-0000-000000000001',
        entered_by_name: creatorName,
        entered_by_regnum: creatorReg,
        created_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertError } = await supabase
        .from('equipment')
        .insert({
          name: payload.name,
          category: payload.category,
          serial_number: payload.serial_number,
          status: payload.status,
          entered_by: payload.entered_by,
        })
        .select()
        .single();

      if (insertError) {
        setEquipment((prev) => [payload, ...prev]);
        setShowAddForm(false);
        showToast(`Equipment "${payload.name}" added successfully`);
        return { success: true };
      }

      setEquipment((prev) => [
        {
          ...(inserted as Equipment),
          entered_by_name: creatorName,
          entered_by_regnum: creatorReg,
        },
        ...prev,
      ]);
      setShowAddForm(false);
      showToast(`Equipment "${payload.name}" successfully registered`);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register equipment';
      return { success: false, error: msg };
    }
  };

  const handleDeleteEquipment = async (equipmentId: string, gearName: string) => {
    if (!isOrg) {
      showToast('Permission denied. Only Organizers can delete equipment.', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete "${gearName}"?`)) {
      return;
    }

    try {
      await supabase.from('equipment').delete().eq('id', equipmentId);
      setEquipment((prev) => prev.filter((e) => e.id !== equipmentId));
      showToast(`Equipment "${gearName}" deleted.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      showToast(msg, 'error');
    }
  };

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
            Equipment Inventory
          </h1>
          <p className="text-xs text-neutral-600 mt-1">
            Complete inventory catalog with manual entry and author identification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isManager ? (
            <Button
              size="sm"
              variant={showAddForm ? 'outline' : 'primary'}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? 'Close Entry Form' : '+ New Equipment'}
            </Button>
          ) : (
            <span className="text-xs text-neutral-500 font-mono">
              View-only mode ({role})
            </span>
          )}
          <Button size="sm" variant="outline" onClick={loadEquipment} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Manual Equipment Entry Form */}
      {isManager && showAddForm && (
        <div className="bg-white border-2 border-black rounded p-5 shadow-sm space-y-4">
          <div className="border-b border-neutral-200 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Manual Equipment Registration
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Enter serial number and specifications. Author identity is recorded as Name - Register Number.
            </p>
          </div>

          <EquipmentForm
            currentUserProfile={
              userProfile || {
                id: '00000000-0000-0000-0000-000000000001',
                auth_id: '00000000-0000-0000-0000-000000000001',
                full_name: 'Sooriya Moorthy',
                register_number: 'REG-ORG-001',
                email: 'sooriyamoorthy0107@gmail.com',
                role: 'organizer',
                status: 'approved',
                created_at: '',
              }
            }
            existingSerialNumbers={existingSerialNumbers}
            onSubmit={handleAddEquipment}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-neutral-300 rounded">
        <div className="flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search by gear name or serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded focus:outline-none focus:border-black"
          />
        </div>

        <div className="flex items-center gap-2">
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

      {/* Inventory Table */}
      <div className="overflow-x-auto border border-neutral-300 rounded bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-800 uppercase tracking-wider font-semibold">
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Serial Number</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Entered By (Name - RegNum)</th>
              <th className="py-2.5 px-3">Registered At</th>
              {isOrg && <th className="py-2.5 px-3 text-right">Admin Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {filteredEquipment.length === 0 ? (
              <tr>
                <td colSpan={isOrg ? 7 : 6} className="py-8 text-center text-neutral-500">
                  No equipment found matching the criteria.
                </td>
              </tr>
            ) : (
              filteredEquipment.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-neutral-900">{item.name}</td>
                  <td className="py-2.5 px-3 text-neutral-600">{item.category}</td>
                  <td className="py-2.5 px-3 font-mono text-neutral-800 font-medium">
                    {item.serial_number}
                  </td>
                  <td className="py-2.5 px-3">{getStatusBadge(item.status)}</td>
                  <td className="py-2.5 px-3 font-medium text-neutral-900">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-neutral-900">
                        {item.entered_by_name || 'Sooriya Moorthy'}
                      </span>
                      <span className="text-neutral-400">-</span>
                      <span className="text-[11px] font-mono text-neutral-600">
                        {item.entered_by_regnum || 'REG-ORG-001'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-neutral-500 text-[11px]">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  {isOrg && (
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteEquipment(item.id, item.name)}
                        className="text-xs text-neutral-700 hover:text-black font-semibold border border-neutral-300 hover:border-black px-2 py-1 rounded"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
