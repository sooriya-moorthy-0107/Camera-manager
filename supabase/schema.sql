-- ==============================================================================
-- Equipment Checkout System: PostgreSQL Schema for Supabase
-- Tables: users, equipment, checkout_logs, activity_logs
-- Primary Super Admin: sooriyamoorthy0107@gmail.com / Sooriya123*
-- All sample users removed; real camera inventory preserved.
-- ==============================================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create ENUM Types (Idempotent)
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('organizer', 'manager', 'coordinator', 'volunteer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.user_status AS ENUM ('pending', 'approved', 'rejected');
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
    status public.user_status NOT NULL DEFAULT 'pending',
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
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    checkout_time TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expected_return_time TIMESTAMPTZ,
    actual_return_time TIMESTAMPTZ,
    surrender_requested BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'pending_checkout', 'active', 'pending_return', 'returned', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Human-Readable Activity Logs Table (System Transactions)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    actor_regnum TEXT NOT NULL,
    actor_role public.user_role NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_register_number ON public.users(register_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_serial ON public.equipment(serial_number);
CREATE INDEX IF NOT EXISTS idx_equipment_entered_by ON public.equipment(entered_by);

CREATE INDEX IF NOT EXISTS idx_checkout_logs_active ON public.checkout_logs(equipment_id) WHERE actual_return_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_checkout_logs_user ON public.checkout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_logs_equipment ON public.checkout_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_checkout_logs_status ON public.checkout_logs(status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- 7. Helper Security Functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.users
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT * FROM public.users WHERE auth_id = (SELECT auth.uid()) LIMIT 1;
$$;

-- Organizer has Super Admin access (adding, editing, and deleting)
CREATE OR REPLACE FUNCTION public.is_organizer()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE auth_id = (SELECT auth.uid())
          AND role = 'organizer'
    );
$$;

-- Organizer and Manager have operational management access
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

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 9. Clean up any existing policies dynamically on public tables
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('users', 'equipment', 'checkout_logs', 'activity_logs')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 10. Users Table Policies (Accessible to authenticated & anon for seamless sync)
CREATE POLICY "p_users_select" ON public.users FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "p_users_insert" ON public.users FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "p_users_update" ON public.users FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "p_users_delete" ON public.users FOR DELETE TO authenticated, anon USING (true);

-- 11. Equipment Table Policies
CREATE POLICY "p_equipment_select" ON public.equipment FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "p_equipment_insert" ON public.equipment FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "p_equipment_update" ON public.equipment FOR UPDATE TO authenticated, anon USING (true);
CREATE POLICY "p_equipment_delete" ON public.equipment FOR DELETE TO authenticated, anon USING (true);

-- 12. Checkout Logs Table Policies
CREATE POLICY "p_checkout_select" ON public.checkout_logs FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "p_checkout_insert" ON public.checkout_logs FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "p_checkout_update" ON public.checkout_logs FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
CREATE POLICY "p_checkout_delete" ON public.checkout_logs FOR DELETE TO authenticated, anon USING (true);

-- 13. Activity Logs Table Policies
CREATE POLICY "p_activity_select" ON public.activity_logs FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "p_activity_insert" ON public.activity_logs FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "p_activity_delete" ON public.activity_logs FOR DELETE TO authenticated, anon USING (true);

-- 14. Automatic Trigger for New Signups from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    new_reg TEXT;
    new_name TEXT;
    new_role public.user_role;
BEGIN
    IF lower(NEW.email) = 'sooriyamoorthy0107@gmail.com' THEN
        RETURN NEW;
    END IF;

    new_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    new_reg := COALESCE(NEW.raw_user_meta_data->>'register_number', 'REG-' || UPPER(SUBSTRING(NEW.id::text FROM 1 FOR 6)));
    
    BEGIN
        new_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
    EXCEPTION WHEN OTHERS THEN
        new_role := 'volunteer'::public.user_role;
    END;

    INSERT INTO public.users (
        id,
        auth_id,
        full_name,
        register_number,
        email,
        role,
        status
    )
    VALUES (
        NEW.id,
        NEW.id,
        new_name,
        new_reg,
        NEW.email,
        new_role,
        'pending'
    )
    ON CONFLICT (register_number) DO UPDATE
    SET auth_id = EXCLUDED.auth_id,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    -- Also record in activity logs
    INSERT INTO public.activity_logs (
        actor_id,
        actor_name,
        actor_regnum,
        actor_role,
        action,
        details
    )
    VALUES (
        NEW.id,
        new_name,
        new_reg,
        new_role,
        'USER_SIGNUP',
        'New user ' || new_name || ' (' || new_reg || ') registered with role ' || new_role || '. Status is Pending Approval.'
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 15. Seed Main Super Admin Account (sooriyamoorthy0107@gmail.com / Sooriya123*)
-- Automatically populates auth.users (pre-confirmed, no email link needed)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
SELECT
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'sooriyamoorthy0107@gmail.com',
    crypt('Sooriya123*', gen_salt('bf')),
    timezone('utc'::text, now()),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Sooriya Moorthy","register_number":"REG-ORG-001","role":"organizer"}',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    '',
    '',
    '',
    ''
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'sooriyamoorthy0107@gmail.com'
);

-- Ensure password and confirmed status are always up to date for Super Admin
UPDATE auth.users
SET encrypted_password = crypt('Sooriya123*', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, timezone('utc'::text, now())),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}',
    raw_user_meta_data = '{"full_name":"Sooriya Moorthy","register_number":"REG-ORG-001","role":"organizer"}'
WHERE email = 'sooriyamoorthy0107@gmail.com';

-- Ensure identity exists in auth.identities
DO $$
BEGIN
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    )
    VALUES (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        json_build_object('sub', '00000000-0000-0000-0000-000000000001', 'email', 'sooriyamoorthy0107@gmail.com'),
        'email',
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Seed into public.users as Super Admin Organizer (Approved)
INSERT INTO public.users (
    id,
    auth_id,
    full_name,
    register_number,
    email,
    role,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Sooriya Moorthy',
    'REG-ORG-001',
    'sooriyamoorthy0107@gmail.com',
    'organizer',
    'approved'
)
ON CONFLICT (register_number) DO UPDATE 
SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, role = 'organizer', status = 'approved';

-- 16. Real Equipment Inventory (All camera gear preserved with valid UUIDs)
INSERT INTO public.equipment (id, name, category, serial_number, status, entered_by) VALUES
    ('00000000-0000-0000-0000-000000000101', 'Sony Alpha A7 IV (Body)', 'Camera', 'SN-SNY-9481', 'available', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000102', 'Canon EOS R6 Mark II', 'Camera', 'SN-CAN-1024', 'available', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000103', 'DJI RS 3 Pro Gimbal', 'Stabilizer', 'SN-DJI-5521', 'available', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000104', 'Rode Wireless GO II Dual', 'Audio', 'SN-ROD-8812', 'available', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000105', 'Sony FE 24-70mm f/2.8 GM II', 'Lens', 'SN-SNY-4491', 'available', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (serial_number) DO UPDATE
SET name = EXCLUDED.name, category = EXCLUDED.category, status = EXCLUDED.status;

-- 17. Initial Activity Log
INSERT INTO public.activity_logs (actor_id, actor_name, actor_regnum, actor_role, action, details)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Sooriya Moorthy',
    'REG-ORG-001',
    'organizer',
    'SYSTEM_INIT',
    'Super Admin Sooriya Moorthy (REG-ORG-001) initialized the Equipment Checkout System.'
);

-- 18. Self-Contained User Registration Function (Pre-confirms account so users are never blocked by SMTP rate limits)
CREATE OR REPLACE FUNCTION public.register_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_register_number TEXT,
    p_role public.user_role DEFAULT 'volunteer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    clean_email TEXT := lower(trim(p_email));
    clean_reg TEXT := upper(trim(p_register_number));
    clean_name TEXT := trim(p_full_name);
BEGIN
    IF clean_email = '' OR clean_email NOT LIKE '%@%.%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid email address format.');
    END IF;

    IF length(p_password) < 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters.');
    END IF;

    IF clean_name = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Full name is required.');
    END IF;

    IF clean_reg = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Register number is required.');
    END IF;

    -- Check if email already registered in auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = clean_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'An account with this email address already exists.');
    END IF;

    -- Check if register number already registered in public.users
    IF EXISTS (SELECT 1 FROM public.users WHERE register_number = clean_reg) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Register number ' || clean_reg || ' is already in use.');
    END IF;

    -- Insert into auth.users (Pre-confirmed: zero email rate limits!)
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id,
        'authenticated',
        'authenticated',
        clean_email,
        crypt(p_password, gen_salt('bf')),
        timezone('utc'::text, now()),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', clean_name, 'register_number', clean_reg, 'role', p_role),
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        '',
        '',
        '',
        ''
    );

    -- Insert into auth.identities
    BEGIN
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            new_user_id::text,
            new_user_id,
            jsonb_build_object('sub', new_user_id::text, 'email', clean_email),
            'email',
            timezone('utc'::text, now()),
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Insert into public.users with 'pending' status
    INSERT INTO public.users (
        id,
        auth_id,
        full_name,
        register_number,
        email,
        role,
        status,
        created_at
    ) VALUES (
        new_user_id,
        new_user_id,
        clean_name,
        clean_reg,
        clean_email,
        p_role,
        'pending',
        timezone('utc'::text, now())
    )
    ON CONFLICT (register_number) DO UPDATE
    SET auth_id = EXCLUDED.auth_id,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    -- Record in activity logs
    INSERT INTO public.activity_logs (
        actor_id,
        actor_name,
        actor_regnum,
        actor_role,
        action,
        details
    ) VALUES (
        new_user_id,
        clean_name,
        clean_reg,
        p_role,
        'USER_SIGNUP',
        'New user ' || clean_name || ' (' || clean_reg || ') registered with role ' || p_role || '. Status is Pending Approval.'
    );

    RETURN jsonb_build_object('success', true, 'user_id', new_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user TO anon, authenticated, service_role;

-- 19. Helper: Approve User (Used by Organizer/Manager to activate pending accounts)
CREATE OR REPLACE FUNCTION public.approve_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.users
    SET status = 'approved'
    WHERE id = p_user_id OR auth_id = p_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user TO anon, authenticated, service_role;

-- 20. Helper: Reject User
CREATE OR REPLACE FUNCTION public.reject_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.users
    SET status = 'rejected'
    WHERE id = p_user_id OR auth_id = p_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_user TO anon, authenticated, service_role;

-- 21. Helper: Admin Set Password (Direct database password update, bypasses email SMTP)
CREATE OR REPLACE FUNCTION public.admin_set_password(
    p_email TEXT,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    target_email TEXT := lower(trim(p_email));
BEGIN
    IF length(p_new_password) < 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = target_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'User with email ' || target_email || ' not found in auth system.');
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = timezone('utc'::text, now())
    WHERE email = target_email;

    RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_password TO anon, authenticated, service_role;

-- 22. Update Checkout Logs Status Constraint (Adds 'pending' and 'pending_checkout')
DO $$ BEGIN
    ALTER TABLE public.checkout_logs DROP CONSTRAINT IF EXISTS checkout_logs_status_check;
    ALTER TABLE public.checkout_logs ADD CONSTRAINT checkout_logs_status_check 
        CHECK (status IN ('pending', 'pending_checkout', 'active', 'pending_return', 'returned', 'rejected'));
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- 23. Helper: Approve Equipment Checkout Request
CREATE OR REPLACE FUNCTION public.approve_checkout(
    p_checkout_id UUID,
    p_actor_name TEXT DEFAULT 'Organizer',
    p_actor_regnum TEXT DEFAULT 'REG-ORG-001',
    p_actor_role public.user_role DEFAULT 'organizer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_eq_id UUID;
    v_gear_name TEXT;
    v_gear_serial TEXT;
    v_user_name TEXT;
    v_user_regnum TEXT;
BEGIN
    SELECT equipment_id INTO v_eq_id FROM public.checkout_logs WHERE id = p_checkout_id;
    IF v_eq_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Checkout record not found.');
    END IF;

    SELECT name, serial_number INTO v_gear_name, v_gear_serial FROM public.equipment WHERE id = v_eq_id;
    SELECT u.full_name, u.register_number INTO v_user_name, v_user_regnum
    FROM public.checkout_logs c JOIN public.users u ON c.user_id = u.id
    WHERE c.id = p_checkout_id;

    UPDATE public.checkout_logs
    SET status = 'active',
        checkout_time = timezone('utc'::text, now()),
        notes = trim(replace(COALESCE(notes, ''), '[CHECKOUT_REQUEST]', ''))
    WHERE id = p_checkout_id;

    UPDATE public.equipment
    SET status = 'checked_out'
    WHERE id = v_eq_id;

    INSERT INTO public.activity_logs (actor_name, actor_regnum, actor_role, action, details)
    VALUES (
        p_actor_name,
        p_actor_regnum,
        p_actor_role,
        'APPROVE_CHECKOUT',
        p_actor_name || ' (' || p_actor_regnum || ') approved checkout of ' || v_gear_name || ' (' || v_gear_serial || ') for ' || v_user_name || ' (' || v_user_regnum || ')'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_checkout TO anon, authenticated, service_role;

-- 24. Helper: Reject Equipment Checkout Request
CREATE OR REPLACE FUNCTION public.reject_checkout(
    p_checkout_id UUID,
    p_actor_name TEXT DEFAULT 'Organizer',
    p_actor_regnum TEXT DEFAULT 'REG-ORG-001',
    p_actor_role public.user_role DEFAULT 'organizer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_eq_id UUID;
    v_gear_name TEXT;
    v_gear_serial TEXT;
    v_user_name TEXT;
    v_user_regnum TEXT;
BEGIN
    SELECT equipment_id INTO v_eq_id FROM public.checkout_logs WHERE id = p_checkout_id;
    IF v_eq_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Checkout record not found.');
    END IF;

    SELECT name, serial_number INTO v_gear_name, v_gear_serial FROM public.equipment WHERE id = v_eq_id;
    SELECT u.full_name, u.register_number INTO v_user_name, v_user_regnum
    FROM public.checkout_logs c JOIN public.users u ON c.user_id = u.id
    WHERE c.id = p_checkout_id;

    UPDATE public.checkout_logs
    SET status = 'rejected',
        actual_return_time = timezone('utc'::text, now())
    WHERE id = p_checkout_id;

    UPDATE public.equipment
    SET status = 'available'
    WHERE id = v_eq_id;

    INSERT INTO public.activity_logs (actor_name, actor_regnum, actor_role, action, details)
    VALUES (
        p_actor_name,
        p_actor_regnum,
        p_actor_role,
        'REJECT_CHECKOUT',
        p_actor_name || ' (' || p_actor_regnum || ') rejected checkout request of ' || v_gear_name || ' (' || v_gear_serial || ') for ' || v_user_name || ' (' || v_user_regnum || ')'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_checkout TO anon, authenticated, service_role;
