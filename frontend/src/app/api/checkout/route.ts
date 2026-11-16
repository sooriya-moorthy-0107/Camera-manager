import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkoutSchema, returnRequestSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid checkout payload', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { equipment_id, user_id, expected_return_time, notes } = validation.data;
    const supabase = createServerClient();

    // 1. Verify equipment status - prevent duplicate checkout requests for already checked-out gear
    const { data: gear, error: gearError } = await supabase
      .from('equipment')
      .select('id, name, status, serial_number')
      .eq('id', equipment_id)
      .single();

    if (gearError || !gear) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    if (gear.status !== 'available') {
      return NextResponse.json(
        { error: `Cannot checkout "${gear.name}". Current status is "${gear.status}". Duplicate checkouts are prevented.` },
        { status: 409 }
      );
    }

    // 2. Check if there is an active checkout log without return
    const { data: activeLogs } = await supabase
      .from('checkout_logs')
      .select('id')
      .eq('equipment_id', equipment_id)
      .is('actual_return_time', null);

    if (activeLogs && activeLogs.length > 0) {
      return NextResponse.json(
        { error: 'Equipment currently has an active open checkout record' },
        { status: 409 }
      );
    }

    // 3. Insert checkout log
    const { data: newLog, error: logError } = await supabase
      .from('checkout_logs')
      .insert({
        equipment_id,
        user_id,
        expected_return_time: expected_return_time || null,
        notes: notes || null,
        status: 'active',
        surrender_requested: false,
      })
      .select()
      .single();

    if (logError) {
      return NextResponse.json(
        { error: `Failed to create checkout log: ${logError.message}` },
        { status: 500 }
      );
    }

    // 4. Update equipment status to checked_out
    const { error: updateGearError } = await supabase
      .from('equipment')
      .update({ status: 'checked_out' })
      .eq('id', equipment_id);

    if (updateGearError) {
      return NextResponse.json(
        { error: `Failed to update equipment status: ${updateGearError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Equipment ${gear.name} successfully assigned`,
      checkout: newLog,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = returnRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid return request payload', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { checkout_id, equipment_id, action, notes } = validation.data;
    const supabase = createServerClient();

    if (action === 'request_return') {
      // Volunteer initiates return: changes status to pending_return
      const { error: logErr } = await supabase
        .from('checkout_logs')
        .update({
          surrender_requested: true,
          status: 'pending_return',
          ...(notes ? { notes } : {}),
        })
        .eq('id', checkout_id);

      if (logErr) {
        return NextResponse.json({ error: logErr.message }, { status: 500 });
      }

      await supabase
        .from('equipment')
        .update({ status: 'pending_return' })
        .eq('id', equipment_id);

      return NextResponse.json({ success: true, status: 'pending_return' });
    }

    if (action === 'approve_return' || action === 'force_return') {
      // Manager approves return or forces return: finalizes equipment availability
      const returnTimestamp = new Date().toISOString();

      const { error: logErr } = await supabase
        .from('checkout_logs')
        .update({
          actual_return_time: returnTimestamp,
          status: 'returned',
          surrender_requested: false,
          ...(notes ? { notes } : {}),
        })
        .eq('id', checkout_id);

      if (logErr) {
        return NextResponse.json({ error: logErr.message }, { status: 500 });
      }

      await supabase
        .from('equipment')
        .update({ status: 'available' })
        .eq('id', equipment_id);

      return NextResponse.json({ success: true, status: 'available' });
    }

    if (action === 'reject_return') {
      // Manager rejects return request: item stays checked out
      const { error: logErr } = await supabase
        .from('checkout_logs')
        .update({
          surrender_requested: false,
          status: 'active',
          ...(notes ? { notes } : {}),
        })
        .eq('id', checkout_id);

      if (logErr) {
        return NextResponse.json({ error: logErr.message }, { status: 500 });
      }

      await supabase
        .from('equipment')
        .update({ status: 'checked_out' })
        .eq('id', equipment_id);

      return NextResponse.json({ success: true, status: 'checked_out' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

