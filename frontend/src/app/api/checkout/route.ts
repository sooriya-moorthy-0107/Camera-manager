import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkoutSchema, returnRequestSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      console.error('[API/checkout POST] Validation failed:', JSON.stringify(validation.error.flatten()));
      return NextResponse.json(
        { error: 'Invalid checkout payload', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { equipment_id, user_id, expected_return_time, notes, action } = validation.data;
    const actorName = body.actor_name || 'User';
    const actorReg = body.actor_regnum || 'REG-VOL-01';
    const actorRole = body.actor_role || 'volunteer';
    const isVolunteerRequest = action === 'request_checkout' || actorRole === 'volunteer' || actorRole === 'coordinator';

    const supabase = createServerClient();

    // 1. Verify equipment status
    const { data: gear, error: gearError } = await supabase
      .from('equipment')
      .select('id, name, status, serial_number')
      .eq('id', equipment_id)
      .maybeSingle();

    if (gearError || !gear) {
      return NextResponse.json({ error: `Equipment not found with ID ${equipment_id}` }, { status: 404 });
    }

    if (gear.status !== 'available') {
      return NextResponse.json(
        { error: `Cannot checkout "${gear.name}". Current status is "${gear.status}". Duplicate checkouts are prevented.` },
        { status: 409 }
      );
    }

    // 2. Fetch target user with flexible matching (id, auth_id, register_number, email)
    let targetUser = null;
    const { data: userById } = await supabase
      .from('users')
      .select('id, full_name, register_number, status')
      .eq('id', user_id)
      .maybeSingle();

    if (userById) {
      targetUser = userById;
    } else {
      const { data: userByOther } = await supabase
        .from('users')
        .select('id, full_name, register_number, status')
        .or(`auth_id.eq.${user_id},register_number.eq.${user_id},email.eq.${user_id}`)
        .maybeSingle();
      targetUser = userByOther;
    }

    if (!targetUser && body.actor_regnum) {
      const { data: userByReg } = await supabase
        .from('users')
        .select('id, full_name, register_number, status')
        .eq('register_number', body.actor_regnum)
        .maybeSingle();
      if (userByReg) {
        targetUser = userByReg;
      }
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User profile not found in database. Please ensure your account is registered.' },
        { status: 404 }
      );
    }

    const resolvedUserId = targetUser.id;
    const targetName = targetUser.full_name || actorName;
    const targetReg = targetUser.register_number || actorReg;

    if (!isVolunteerRequest && targetUser.status === 'pending') {
      return NextResponse.json(
        { error: `User ${targetUser.full_name} is pending approval and cannot be assigned gear.` },
        { status: 403 }
      );
    }

    // 3. Handle Volunteer Checkout Request vs Manager Direct Assignment
    if (isVolunteerRequest) {
      const requestNotes = `[CHECKOUT_REQUEST] ${notes || 'Volunteer checkout request'}`.trim();
      let newLog = null;

      // Attempt insert with 'pending' status
      const { data: logData, error: logError } = await supabase
        .from('checkout_logs')
        .insert({
          equipment_id,
          user_id: resolvedUserId,
          expected_return_time: expected_return_time || null,
          notes: requestNotes,
          status: 'pending',
          surrender_requested: false,
        })
        .select('*, equipment:equipment_id(*), user:user_id(*)')
        .single();

      if (logError) {
        // Fallback for check constraint violation if DB has not yet applied 'pending'
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('checkout_logs')
          .insert({
            equipment_id,
            user_id: resolvedUserId,
            expected_return_time: expected_return_time || null,
            notes: requestNotes,
            status: 'pending_return',
            surrender_requested: false,
          })
          .select('*, equipment:equipment_id(*), user:user_id(*)')
          .single();

        if (fallbackError) {
          console.error('[API/checkout POST] Failed to insert fallback checkout request:', fallbackError);
          return NextResponse.json(
            { error: `Failed to create checkout request: ${fallbackError.message}` },
            { status: 500 }
          );
        }
        newLog = fallbackData;
      } else {
        newLog = logData;
      }

      const logSentence = `${actorName} (${actorReg}) submitted checkout request for ${gear.name} (${gear.serial_number})`;

      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: actorRole,
        action: 'REQUEST_CHECKOUT',
        details: logSentence,
      });

      return NextResponse.json({
        success: true,
        message: 'Checkout request submitted. Awaiting Organizer or Manager approval.',
        checkout: newLog,
        is_request: true,
      });
    }

    // Direct Assignment by Manager / Organizer
    const { data: newLog, error: logError } = await supabase
      .from('checkout_logs')
      .insert({
        equipment_id,
        user_id: resolvedUserId,
        expected_return_time: expected_return_time || null,
        notes: notes || null,
        status: 'active',
        surrender_requested: false,
      })
      .select('*, equipment:equipment_id(*), user:user_id(*)')
      .single();

    if (logError) {
      console.error('[API/checkout POST] Failed to create direct assignment log:', logError);
      return NextResponse.json(
        { error: `Failed to create checkout log: ${logError.message}` },
        { status: 500 }
      );
    }

    // Update equipment status
    await supabase.from('equipment').update({ status: 'checked_out' }).eq('id', equipment_id);

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
      is_request: false,
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
      console.error('[API/checkout PATCH] Validation failed:', JSON.stringify(validation.error.flatten()));
      return NextResponse.json(
        { error: 'Invalid checkout action payload', details: validation.error.flatten().fieldErrors },
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

    // 1. APPROVE CHECKOUT REQUEST
    if (action === 'approve_checkout') {
      const checkoutTimestamp = new Date().toISOString();

      try {
        await supabase.rpc('approve_checkout', {
          p_checkout_id: checkout_id,
          p_actor_name: actorName,
          p_actor_regnum: actorReg,
          p_actor_role: actorRole,
        });
      } catch {
        // Fallback
      }

      const cleanNotes = logEntry?.notes
        ? logEntry.notes.replace('[CHECKOUT_REQUEST]', '').trim()
        : null;

      await supabase
        .from('checkout_logs')
        .update({
          status: 'active',
          assigned_by: body.actor_id || null,
          checkout_time: checkoutTimestamp,
          notes: cleanNotes || null,
          surrender_requested: false,
        })
        .eq('id', checkout_id);

      await supabase.from('equipment').update({ status: 'checked_out' }).eq('id', equipment_id);

      const logSentence = `${actorName} (${actorReg}) approved checkout of ${gearLabel} for ${userLabel}`;
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: actorRole,
        action: 'APPROVE_CHECKOUT',
        details: logSentence,
      });

      return NextResponse.json({ success: true, status: 'checked_out', message: logSentence });
    }

    // 2. REJECT CHECKOUT REQUEST
    if (action === 'reject_checkout') {
      const rejectTimestamp = new Date().toISOString();

      try {
        await supabase.rpc('reject_checkout', {
          p_checkout_id: checkout_id,
          p_actor_name: actorName,
          p_actor_regnum: actorReg,
          p_actor_role: actorRole,
        });
      } catch {
        // Fallback
      }

      await supabase
        .from('checkout_logs')
        .update({
          status: 'rejected',
          actual_return_time: rejectTimestamp,
          surrender_requested: false,
        })
        .eq('id', checkout_id);

      await supabase.from('equipment').update({ status: 'available' }).eq('id', equipment_id);

      const logSentence = `${actorName} (${actorReg}) rejected checkout request of ${gearLabel} for ${userLabel}`;
      await supabase.from('activity_logs').insert({
        actor_name: actorName,
        actor_regnum: actorReg,
        actor_role: actorRole,
        action: 'REJECT_CHECKOUT',
        details: logSentence,
      });

      return NextResponse.json({ success: true, status: 'available', message: logSentence });
    }

    // 3. REQUEST RETURN (Volunteer surrenders gear)
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

    // 4. APPROVE RETURN
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

    // 5. REJECT RETURN
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

    // 6. FORCE RETURN
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
