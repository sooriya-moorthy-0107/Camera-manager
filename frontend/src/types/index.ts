export type UserRole = 'organizer' | 'manager' | 'coordinator' | 'volunteer';

export type UserStatus = 'pending' | 'approved' | 'rejected';

export type EquipmentStatus = 'available' | 'checked_out' | 'pending_return' | 'maintenance';

export type CheckoutStatus = 'active' | 'pending_return' | 'returned' | 'rejected';

export interface UserProfile {
  id: string;
  auth_id: string | null;
  full_name: string;
  register_number: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface Equipment {
  id: string;
  name: string;
  category: string;
  serial_number: string;
  status: EquipmentStatus;
  entered_by: string | null;
  entered_by_name?: string | null;
  entered_by_regnum?: string | null;
  created_at: string;
}

export interface CheckoutLog {
  id: string;
  equipment_id: string;
  user_id: string;
  assigned_by?: string | null;
  checkout_time: string;
  expected_return_time: string | null;
  actual_return_time: string | null;
  surrender_requested: boolean;
  status: CheckoutStatus;
  notes: string | null;
  created_at: string;
  equipment?: Equipment;
  user?: UserProfile;
}

export interface ActivityLog {
  id: string;
  actor_id?: string | null;
  actor_name: string;
  actor_regnum: string;
  actor_role: UserRole;
  action: string;
  details: string;
  created_at: string;
}

export function isOrganizer(role: UserRole | string | undefined | null): boolean {
  return role === 'organizer';
}

export function isManagerOrOrganizer(role: UserRole | string | undefined | null): boolean {
  return role === 'organizer' || role === 'manager';
}

export function isCoordinatorOrVolunteer(role: UserRole | string | undefined | null): boolean {
  return role === 'coordinator' || role === 'volunteer';
}

export function canDeleteRecords(role: UserRole | string | undefined | null): boolean {
  return role === 'organizer';
}
