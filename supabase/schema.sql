-- ==============================================================================
-- Equipment Checkout System: PostgreSQL Schema for Supabase
-- Tables: users, equipment, checkout_logs + RLS Policies & Indexes
-- ==============================================================================

-- 1. Create ENUM Types (Safe idempotent creation)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('organizer', 'manager', 'coordinator', 'volunteer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE equipment_status AS ENUM ('available', 'checked_out', 'maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'volunteer',
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Equipment Table
CREATE TABLE IF NOT EXISTS public.equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Camera',
    serial_number TEXT UNIQUE NOT NULL,
    status equipment_status NOT NULL DEFAULT 'available',
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
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Indexes for fast mobile scan queries
CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_serial ON public.equipment(serial_number);
CREATE INDEX IF NOT EXISTS idx_checkout_logs_active ON public.checkout_logs(equipment_id) WHERE actual_return_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_checkout_logs_user ON public.checkout_logs(user_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies: Allow read access and authenticated modifications
CREATE POLICY "Allow read access to all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to equipment" ON public.equipment
    FOR SELECT USING (true);

CREATE POLICY "Allow insert/update to equipment" ON public.equipment
    FOR ALL USING (true);

CREATE POLICY "Allow read access to checkout_logs" ON public.checkout_logs
    FOR SELECT USING (true);

CREATE POLICY "Allow insert/update to checkout_logs" ON public.checkout_logs
    FOR ALL USING (true);

-- 8. Seed Initial Sample Data (Optional starter items)
INSERT INTO public.users (full_name, role) VALUES
    ('Admin Organizer', 'organizer'),
    ('Desk Manager', 'manager'),
    ('Priya Patel', 'coordinator'),
    ('Rahul Sharma', 'volunteer')
ON CONFLICT DO NOTHING;

INSERT INTO public.equipment (name, category, serial_number, status) VALUES
    ('Sony Alpha A7 IV (Body)', 'Camera', 'SN-SNY-9481', 'available'),
    ('Canon EOS R6 Mark II', 'Camera', 'SN-CAN-1024', 'available'),
    ('DJI RS 3 Pro Gimbal', 'Stabilizer', 'SN-DJI-5521', 'available'),
    ('Rode Wireless GO II Dual', 'Audio', 'SN-ROD-8812', 'available'),
    ('Sony FE 24-70mm f/2.8 GM II', 'Lens', 'SN-SNY-4491', 'available')
ON CONFLICT (serial_number) DO NOTHING;
