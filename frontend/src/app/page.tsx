"use client";

import { createClientComponentClient } from '@/utils/supabase/client';
import {
  Camera,
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  Search,
  ArrowRightLeft,
  Check,
  Plus,
  ShieldCheck,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Database } from '@/types/supabase';

type Equipment = Database['public']['Tables']['equipment']['Row'];
type CheckoutLog = Database['public']['Tables']['checkout_logs']['Row'];
type AppUser = Database['public']['Tables']['users']['Row'];
type UserRole = 'organizer' | 'manager' | 'coordinator' | 'volunteer';

type CheckedOutItem = CheckoutLog & {
  equipment: Equipment;
  users: AppUser;
  surrender_requested?: boolean;
};

// Initial Mock Users
const INITIAL_USERS: AppUser[] = [
  { id: 'u-1', full_name: 'Rahul Sharma (Volunteer)', role: 'volunteer' },
  { id: 'u-2', full_name: 'Priya Patel (Coordinator)', role: 'coordinator' },
  { id: 'u-3', full_name: 'Aakash Verma (Volunteer)', role: 'volunteer' },
  { id: 'u-4', full_name: 'Sneha Reddy (Volunteer)', role: 'volunteer' },
];

// Initial Mock Inventory
const INITIAL_EQUIPMENT: Equipment[] = [
  { id: '1', name: 'Sony Alpha A7 IV (Body)', category: 'Camera', serial_number: 'SN-SNY-9481', status: 'available' },
  { id: '2', name: 'Canon EOS R6 Mark II', category: 'Camera', serial_number: 'SN-CAN-1024', status: 'available' },
  { id: '3', name: 'DJI RS 3 Pro Gimbal', category: 'Stabilizer', serial_number: 'SN-DJI-5521', status: 'available' },
  { id: '4', name: 'Rode Wireless GO II Dual', category: 'Audio', serial_number: 'SN-ROD-8812', status: 'available' },
  { id: '5', name: 'Sony FE 24-70mm f/2.8 GM II', category: 'Lens', serial_number: 'SN-SNY-4491', status: 'available' },
];

const INITIAL_CHECKOUTS: CheckedOutItem[] = [
  {
    id: 'log-1',
    equipment_id: 'e-101',
    user_id: 'u-1',
    checkout_time: new Date(Date.now() - 3600000 * 2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    expected_return_time: null,
    actual_return_time: null,
    surrender_requested: false,
    equipment: { id: 'e-101', name: 'Sony FX3 Cinema Line', category: 'Camera', serial_number: 'SN-SNY-3301', status: 'checked_out' },
    users: INITIAL_USERS[0],
  },
  {
    id: 'log-2',
    equipment_id: 'e-102',
    user_id: 'u-2',
    checkout_time: new Date(Date.now() - 3600000 * 5).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    expected_return_time: null,
    actual_return_time: null,
    surrender_requested: true,
    equipment: { id: 'e-102', name: 'Sigma 24-70mm f/2.8 Art', category: 'Lens', serial_number: 'SN-SIG-7729', status: 'checked_out' },
    users: INITIAL_USERS[1],
  }
];

export default function Dashboard() {
  // Role selector state
  const [currentRole, setCurrentRole] = useState<UserRole>('manager');
  
  // Data states
  const [equipmentList, setEquipmentList] = useState<Equipment[]>(INITIAL_EQUIPMENT);
  const [checkedOutItems, setCheckedOutItems] = useState<CheckedOutItem[]>(INITIAL_CHECKOUTS);
  const [usersList, setUsersList] = useState<AppUser[]>(INITIAL_USERS);
  const [loading, setLoading] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals / forms
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedGear, setSelectedGear] = useState<Equipment | null>(null);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string>('');

  // New Equipment Form State
  const [newGear, setNewGear] = useState({
    name: '',
    category: 'Camera',
    serial_number: '',
  });

  // Notification Banner
  const [notification, setNotification] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const isManagerOrOrganizer = currentRole === 'manager' || currentRole === 'organizer';

  // 1. Assign / Checkout Gear
  const handleAssignCheckout = () => {
    if (!selectedGear || !selectedVolunteerId) return;

    const assignedUser = usersList.find(u => u.id === selectedVolunteerId);
    if (!assignedUser) return;

    // Create checkout item
    const newLog: CheckedOutItem = {
      id: `log-${Date.now()}`,
      equipment_id: selectedGear.id,
      user_id: assignedUser.id,
      checkout_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      expected_return_time: null,
      actual_return_time: null,
      surrender_requested: false,
      equipment: { ...selectedGear, status: 'checked_out' },
      users: assignedUser,
    };

    // Remove from available, add to checked out
    setEquipmentList(prev => prev.filter(e => e.id !== selectedGear.id));
    setCheckedOutItems(prev => [newLog, ...prev]);

    setIsAssignModalOpen(false);
    setSelectedGear(null);
    setSelectedVolunteerId('');
    showNotice(`Successfully assigned ${selectedGear.name} to ${assignedUser.full_name}`);
  };

  // 2. Volunteer: Opt-out / Request Surrender
  const handleRequestSurrender = (logId: string) => {
    setCheckedOutItems(prev =>
      prev.map(item => (item.id === logId ? { ...item, surrender_requested: true } : item))
    );
    showNotice("Surrender request submitted. Awaiting Manager or Organizer approval.");
  };

  // 3. Manager/Organizer: Approve Return & Check-in
  const handleApproveReturn = (item: CheckedOutItem) => {
    // Remove from checked out
    setCheckedOutItems(prev => prev.filter(log => log.id !== item.id));

    // Return to available inventory
    const restoredItem: Equipment = {
      ...item.equipment,
      status: 'available',
    };
    setEquipmentList(prev => [restoredItem, ...prev]);

    showNotice(`Approved return for ${item.equipment.name}. Restored to inventory!`);
  };

  // 4. Manager/Organizer: Add new gear to inventory
  const handleAddEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGear.name || !newGear.serial_number) return;

    const gear: Equipment = {
      id: `gear-${Date.now()}`,
      name: newGear.name,
      category: newGear.category,
      serial_number: newGear.serial_number,
      status: 'available',
    };

    setEquipmentList(prev => [gear, ...prev]);
    setNewGear({ name: '', category: 'Camera', serial_number: '' });
    setIsAddModalOpen(false);
    showNotice(`New equipment "${gear.name}" added to inventory!`);
  };

  // Filtered available items
  const filteredAvailable = equipmentList.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 font-sans pb-20">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 border border-neutral-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-black text-white p-2.5 rounded-lg shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">EquipTrack</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-neutral-200 rounded text-neutral-800">
                  Event Mode
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium">Camera & Gear Checkout Desk</p>
            </div>
          </div>

          {/* Interactive Role Switcher */}
          <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-xl border border-neutral-300">
            <span className="text-xs font-semibold px-2 text-neutral-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-600" />
              Role:
            </span>
            {(['organizer', 'manager', 'coordinator', 'volunteer'] as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => setCurrentRole(role)}
                className={`text-xs capitalize font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  currentRole === role
                    ? 'bg-black text-white shadow-xs'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Role Banner / Context */}
      <div className="bg-white border-b border-neutral-200 py-3">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-700">Current View:</span>
            <span className="font-bold text-black uppercase bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
              {currentRole}
            </span>
            <span className="text-neutral-500">
              {isManagerOrOrganizer
                ? '• Full Admin: Add equipment, assign gear, approve volunteer surrenders'
                : '• Volunteer/Coord View: Request available gear & surrender held gear'}
            </span>
          </div>

          {isManagerOrOrganizer && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-black hover:bg-neutral-800 text-white font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Equipment
            </button>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 mt-6 space-y-8">
        
        {/* SECTION 1: Currently Checked Out Gear */}
        <section>
          <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-neutral-800" />
              <h2 className="text-lg font-bold text-neutral-900">Currently Checked Out</h2>
              <span className="bg-black text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {checkedOutItems.length}
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium">Active volunteer possession</p>
          </div>

          {checkedOutItems.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center shadow-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-bold text-neutral-800">No Items Checked Out</h3>
              <p className="text-xs text-neutral-500 mt-1">All equipment is returned and stored in inventory.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {checkedOutItems.map(item => (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                    item.surrender_requested
                      ? 'border-amber-400 ring-2 ring-amber-400/20'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                        {item.equipment.category}
                      </span>
                      {item.surrender_requested && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          Pending Return
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-neutral-900 text-base mt-2 leading-tight">
                      {item.equipment.name}
                    </h3>
                    <p className="text-xs font-mono text-neutral-500 mt-0.5">
                      SN: {item.equipment.serial_number}
                    </p>

                    <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-neutral-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-800 truncate">
                          {item.users.full_name}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          Checked out at {item.checkout_time}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions based on role */}
                  <div className="mt-4 pt-3 border-t border-neutral-100">
                    {isManagerOrOrganizer ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveReturn(item)}
                          className="w-full bg-black hover:bg-neutral-800 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          {item.surrender_requested ? 'Approve & Return Gear' : 'Force Check-In'}
                        </button>
                      </div>
                    ) : (
                      <div>
                        {item.surrender_requested ? (
                          <div className="bg-neutral-100 text-neutral-600 text-xs text-center py-2 rounded-lg font-medium">
                            Awaiting Manager Approval
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRequestSurrender(item.id)}
                            className="w-full bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Opt Out / Surrender Gear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2: Available Equipment */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-neutral-200 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-neutral-800" />
              <h2 className="text-lg font-bold text-neutral-900">Available Inventory</h2>
              <span className="bg-neutral-200 text-neutral-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {equipmentList.length}
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search gear or serial..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg bg-white w-64 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          {filteredAvailable.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center shadow-xs">
              <AlertCircle className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
              <h3 className="font-bold text-neutral-800">No Matching Gear Found</h3>
              <p className="text-xs text-neutral-500 mt-1">Try another search keyword or add new equipment.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAvailable.map(gear => (
                <div
                  key={gear.id}
                  className="bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                      {gear.category}
                    </span>
                    <h3 className="font-bold text-neutral-900 text-base mt-2 leading-tight">
                      {gear.name}
                    </h3>
                    <p className="text-xs font-mono text-neutral-500 mt-0.5">
                      SN: {gear.serial_number}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-neutral-100">
                    <button
                      onClick={() => {
                        setSelectedGear(gear);
                        setSelectedVolunteerId(usersList[0]?.id || '');
                        setIsAssignModalOpen(true);
                      }}
                      className="w-full bg-white border border-neutral-900 hover:bg-neutral-900 hover:text-white text-neutral-900 text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      {isManagerOrOrganizer ? 'Assign / Check Out' : 'Choose This Gear'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* MODAL: Assign / Checkout Gear */}
      {isAssignModalOpen && selectedGear && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200">
            <h3 className="text-base font-bold text-neutral-900">Check Out Equipment</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Select the coordinator or volunteer taking this gear.
            </p>

            <div className="my-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs space-y-1">
              <p className="font-bold text-neutral-900">{selectedGear.name}</p>
              <p className="text-neutral-500 font-mono">SN: {selectedGear.serial_number}</p>
              <p className="text-neutral-500">Category: {selectedGear.category}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700">Assign To Volunteer / Member:</label>
              <select
                value={selectedVolunteerId}
                onChange={e => setSelectedVolunteerId(e.target.value)}
                className="w-full text-xs border border-neutral-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-black"
              >
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedGear(null);
                }}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignCheckout}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-black text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Confirm Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New Equipment (Organizer/Manager only) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200">
            <h3 className="text-base font-bold text-neutral-900">Add New Gear to Inventory</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Registered by Managers and Organizers for event coverage.
            </p>

            <form onSubmit={handleAddEquipment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Equipment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sony A7 IV Body"
                  value={newGear.name}
                  onChange={e => setNewGear({ ...newGear, name: e.target.value })}
                  className="w-full text-xs border border-neutral-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Category</label>
                <select
                  value={newGear.category}
                  onChange={e => setNewGear({ ...newGear, category: e.target.value })}
                  className="w-full text-xs border border-neutral-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-black"
                >
                  <option value="Camera">Camera</option>
                  <option value="Lens">Lens</option>
                  <option value="Audio">Audio</option>
                  <option value="Stabilizer">Stabilizer / Gimbal</option>
                  <option value="Lighting">Lighting</option>
                  <option value="Accessory">Accessory</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Serial Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SN-SNY-1002"
                  value={newGear.serial_number}
                  onChange={e => setNewGear({ ...newGear, serial_number: e.target.value })}
                  className="w-full text-xs border border-neutral-300 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-neutral-300 hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-black text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Save Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
