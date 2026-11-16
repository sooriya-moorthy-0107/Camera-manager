import { z } from 'zod';

export const userRoleEnum = z.enum(['organizer', 'manager', 'coordinator', 'volunteer']);

export const equipmentStatusEnum = z.enum(['available', 'checked_out', 'pending_return', 'maintenance']);

export const equipmentSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be under 100 characters'),
  category: z.string().trim().min(2, 'Category is required'),
  serial_number: z
    .string()
    .trim()
    .min(3, 'Serial number must be at least 3 characters')
    .max(50, 'Serial number must be under 50 characters')
    .regex(/^[A-Za-z0-9-_]+$/, 'Serial number can only contain letters, numbers, hyphens, and underscores')
    .transform((val) => val.toUpperCase()),
  entered_by: z.string().uuid().optional().nullable(),
});

export type EquipmentFormData = z.infer<typeof equipmentSchema>;

export const checkoutSchema = z.object({
  equipment_id: z.string().uuid('Invalid equipment ID'),
  user_id: z.string().uuid('Invalid user ID'),
  expected_return_time: z.string().optional().nullable(),
  notes: z.string().max(500, 'Notes must be under 500 characters').optional().nullable(),
  action: z.enum(['assign_checkout', 'request_checkout']).optional(),
});

export type CheckoutFormData = z.infer<typeof checkoutSchema>;

export const returnRequestSchema = z.object({
  checkout_id: z.string().uuid('Invalid checkout log ID'),
  equipment_id: z.string().uuid('Invalid equipment ID'),
  action: z.enum([
    'request_return',
    'approve_return',
    'reject_return',
    'force_return',
    'approve_checkout',
    'reject_checkout',
  ]),
  notes: z.string().max(500).optional().nullable(),
});

export type ReturnRequestData = z.infer<typeof returnRequestSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const signUpSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  register_number: z
    .string()
    .trim()
    .min(3, 'Register number must be at least 3 characters')
    .max(30, 'Register number must be under 30 characters')
    .regex(/^[A-Za-z0-9-_]+$/, 'Register number must be alphanumeric')
    .transform((val) => val.toUpperCase()),
  role: userRoleEnum.default('volunteer'),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;

export const roleAssignmentSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  role: userRoleEnum,
});

export type RoleAssignmentData = z.infer<typeof roleAssignmentSchema>;

