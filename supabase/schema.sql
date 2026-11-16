-- ==============================================================================
-- Equipment Checkout System: PostgreSQL Schema for Supabase
-- Requirements & Technical Specification compliant
-- Tables: users, equipment, checkout_logs + RLS Policies, Indexes & Helper Functions
-- ==============================================================================

-- 1. Create ENUM Types (Idempotent)
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('organizer', 'manager', 'coordinator', 'volunteer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.equipment_status AS ENUM ('available', 'checked_out', 'pending_return', 'maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    register_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role public.user_role NOT NULL DEFAULT 'volunteer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Equipment Table
CREATE TABLE IF NOT EXISTS public.equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Camera',
    serial_number TEXT UNIQUE NOT NULL,
    status public.equipment_status NOT NULL DEFAULT 'available',
    entered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Checkout Logs Table
CREATE TABLE IF NOT EXISTS public.checkout_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    checkout_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expected_return_time TIMESTAMPTZ,
    actual_return_time TIMESTAMPTZ,
    surrender_requested BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_return', 'returned', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_register_number ON public.users(register_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_serial ON public.equipment(serial_number);
CREATE INDEX IF NOT EXISTS idx_equipment_entered_by ON public.equipment(entered_by);

CREATE INDEX IF NOT EXISTS idx_checkout_logs_active ON public.checkout_logs(equipment_id) WHERE actual_return_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_checkout_logs_user ON public.checkout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_logs_equipment ON public.checkout_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_checkout_logs_status ON public.checkout_logs(status);

-- 6. Helper Security Functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.users
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT * FROM public.users WHERE auth_id = (SELECT auth.uid()) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_organizer()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE auth_id = (SELECT auth.uid())
          AND role IN ('organizer', 'manager')
    );
$$;

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_logs ENABLE ROW LEVEL SECURITY;

-- 8. Users Table RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read of user profiles" ON public.users;
CREATE POLICY "Allow authenticated read of user profiles" ON public.users
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT TO authenticated
    WITH CHECK (
        auth_id = (SELECT auth.uid())
        OR public.is_manager_or_organizer()
    );

DROP POLICY IF EXISTS "Users update own profile or manager update any" ON public.users;
CREATE POLICY "Users update own profile or manager update any" ON public.users
    FOR UPDATE TO authenticated
    USING (
        auth_id = (SELECT auth.uid())
        OR public.is_manager_or_organizer()
    )
    WITH CHECK (
        -- Regular users cannot promote themselves
        (auth_id = (SELECT auth.uid()) AND role = (SELECT u.role FROM public.users u WHERE u.auth_id = (SELECT auth.uid())))
        OR public.is_manager_or_organizer()
    );

-- 9. Equipment Table RLS Policies
DROP POLICY IF EXISTS "Allow authenticated users to read equipment" ON public.equipment;
CREATE POLICY "Allow authenticated users to read equipment" ON public.equipment
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Managers and organizers can insert equipment" ON public.equipment;
CREATE POLICY "Managers and organizers can insert equipment" ON public.equipment
    FOR INSERT TO authenticated
    WITH CHECK (public.is_manager_or_organizer());

DROP POLICY IF EXISTS "Managers and organizers can update equipment" ON public.equipment;
CREATE POLICY "Managers and organizers can update equipment" ON public.equipment
    FOR UPDATE TO authenticated
    USING (
        public.is_manager_or_organizer()
        OR EXISTS (
            -- Volunteers/Coordinators can update equipment status only to pending_return for items they checked out
            SELECT 1 FROM public.checkout_logs cl
            JOIN public.users u ON cl.user_id = u.id
            WHERE cl.equipment_id = public.equipment.id
              AND u.auth_id = (SELECT auth.uid())
              AND cl.actual_return_time IS NULL
        )
    );

DROP POLICY IF EXISTS "Managers and organizers can delete equipment" ON public.equipment;
CREATE POLICY "Managers and organizers can delete equipment" ON public.equipment
    FOR DELETE TO authenticated
    USING (public.is_manager_or_organizer());

-- 10. Checkout Logs Table RLS Policies
DROP POLICY IF EXISTS "Allow authenticated users to view checkout logs" ON public.checkout_logs;
CREATE POLICY "Allow authenticated users to view checkout logs" ON public.checkout_logs
    FOR SELECT TO authenticated
    USING (
        public.is_manager_or_organizer()
        OR user_id IN (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    );

DROP POLICY IF EXISTS "Allow checkout creation" ON public.checkout_logs;
CREATE POLICY "Allow checkout creation" ON public.checkout_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_manager_or_organizer()
        OR user_id IN (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    );

DROP POLICY IF EXISTS "Allow checkout updates" ON public.checkout_logs;
CREATE POLICY "Allow checkout updates" ON public.checkout_logs
    FOR UPDATE TO authenticated
    USING (
        public.is_manager_or_organizer()
        OR user_id IN (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    )
    WITH CHECK (
        public.is_manager_or_organizer()
        OR user_id IN (SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()))
    );

-- 11. Initial Seed Data (Safe sample entries for initial testing)
INSERT INTO public.users (id, full_name, register_number, email, role) VALUES
    ('00000000-0000-0000-0000-000000000001', 'Admin Organizer', 'REG-ADMIN-01', 'organizer@cameramanager.local', 'organizer'),
    ('00000000-0000-0000-0000-000000000002', 'Desk Manager', 'REG-MGR-02', 'manager@cameramanager.local', 'manager'),
    ('00000000-0000-0000-0000-000000000003', 'Priya Patel', 'REG-COORD-03', 'priya@cameramanager.local', 'coordinator'),
    ('00000000-0000-0000-0000-000000000004', 'Rahul Sharma', 'REG-VOL-04', 'rahul@cameramanager.local', 'volunteer')
ON CONFLICT (register_number) DO NOTHING;

INSERT INTO public.equipment (name, category, serial_number, status, entered_by) VALUES
    ('Sony Alpha A7 IV (Body)', 'Camera', 'SN-SNY-9481', 'available', '00000000-0000-0000-0000-000000000001'),
    ('Canon EOS R6 Mark II', 'Camera', 'SN-CAN-1024', 'available', '00000000-0000-0000-0000-000000000001'),
    ('DJI RS 3 Pro Gimbal', 'Stabilizer', 'SN-DJI-5521', 'available', '00000000-0000-0000-0000-000000000002'),
    ('Rode Wireless GO II Dual', 'Audio', 'SN-ROD-8812', 'available', '00000000-0000-0000-0000-000000000002'),
    ('Sony FE 24-70mm f/2.8 GM II', 'Lens', 'SN-SNY-4491', 'available', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (serial_number) DO NOTHING;
