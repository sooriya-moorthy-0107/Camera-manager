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
    const actorName = body.actor_name || 'Admin Organizer';
    const actorReg = body.actor_regnum || 'REG-ADMIN-01';
    const actorRole = body.actor_role || 'organizer';

    const supabase = createServerClient();

    // 1. Verify equipment status
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

    // 2. Fetch target user
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, full_name, register_number, status')
      .eq('id', user_id)
      .single();

    if (targetUser && targetUser.status === 'pending') {
      return NextResponse.json(
        { error: `User ${targetUser.full_name} is pending approval and cannot be assigned gear.` },
        { status: 403 }
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

    // 4. Update equipment status
    await supabase.from('equipment').update({ status: 'checked_out' }).eq('id', equipment_id);

    // 5. Log human-readable transaction
    const targetName = targetUser?.full_name || 'User';
    const targetReg = targetUser?.register_number || 'REG';
    const logSentence = `${actorName} (${actorReg}) assigned ${gear.name} (${gear.serial_number}) to ${targetName} (${targetReg})`;

    await supabase.from('activity_logs').insert({
      actor_name: actorName,
      actor_regnum: actorReg,
      actor_role: actorRole,
      action: 'ASSIGN_EQUIPMENT',
      details: logSentence,
    });

    return NextResponse.json({
      success: true,
      message: logSentence,
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
    const actorName = body.actor_name || 'Manager';
    const actorReg = body.actor_regnum || 'REG-MGR-02';
    const actorRole = body.actor_role || 'manager';

    const supabase = createServerClient();

    // Fetch equipment and user context
    const { data: gear } = await supabase
      .from('equipment')
      .select('name, serial_number')
      .eq('id', equipment_id)
      .single();

    const { data: logEntry } = await supabase
      .from('checkout_logs')
      .select('*, user:user_id(full_name, register_number)')
      .eq('id', checkout_id)
      .single();

    const gearLabel = gear ? `${gear.name} (${gear.serial_number})` : 'equipment';
    const userLabel = logEntry?.user
      ? `${logEntry.user.full_name} (${logEntry.user.register_number})`
      : 'holder';

    if (action === 'request_return') {
      await supabase
        .from('checkout_logs')
        .update({
          surrender_requested: true,
          status: 'pending_return',
          ...(notes ? { notes } : {}),
        })
        .eq('id', checkout_id);

      await supabase.from('equipment').update({ status: 'pending_return' }).eq('id', equipment_id);

      const logSentence = `${actorName} (${actorReg}) requested equipment return for ${gearLabel}`;
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: actorRole,
        action: 'REQUEST_RETURN',
        details: logSentence,
      });

      return NextResponse.json({ success: true, status: 'pending_return', message: logSentence });
    }

    if (action === 'approve_return') {
      const returnTimestamp = new Date().toISOString();

      await supabase
        .from('checkout_logs')
        .update({
          actual_return_time: returnTimestamp,
          status: 'returned',
          surrender_requested: false,
          ...(notes ? { notes } : {}),
        })
        .eq('id', checkout_id);

      await supabase.from('equipment').update({ status: 'available' }).eq('id', equipment_id);

      const logSentence = `${actorName} (${actorReg}) approved return of ${gearLabel} from ${userLabel}`;
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: actorRole,
        action: 'APPROVE_RETURN',
        details: logSentence,
      });

      return NextResponse.json({ success: true, status: 'available', message: logSentence });
    }

    if (action === 'reject_return') {
      await supabase
        .from('checkout_logs')
        .update({
          surrender_requested: false,
          status: 'active',
          ...(notes ? { notes } : {}),
        })
        .eq('id', checkout_id);

      await supabase.from('equipment').update({ status: 'checked_out' }).eq('id', equipment_id);

      const logSentence = `${actorName} (${actorReg}) rejected return request for ${gearLabel} from ${userLabel}`;
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: actorRole,
        action: 'REJECT_RETURN',
        details: logSentence,
      });

      return NextResponse.json({ success: true, status: 'checked_out', message: logSentence });
    }

    if (action === 'force_return') {
      const returnTimestamp = new Date().toISOString();

      await supabase
        .from('checkout_logs')
        .update({
          actual_return_time: returnTimestamp,
          status: 'returned',
          surrender_requested: false,
          ...(notes ? { notes } : {}),
        })
        .eq('id', checkout_id);

      await supabase.from('equipment').update({ status: 'available' }).eq('id', equipment_id);

      const logSentence = `${actorName} (${actorReg}) force-returned ${gearLabel} from ${userLabel}`;
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: actorRole,
        action: 'FORCE_RETURN',
        details: logSentence,
      });

      return NextResponse.json({ success: true, status: 'available', message: logSentence });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
