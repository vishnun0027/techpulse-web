import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { requirePermission } from '../_shared/auth.ts';
import { normalizeRole } from '../_shared/permissions.ts';
import { writeAuditLog } from '../_shared/audit.ts';

import { corsHeaders } from '../_shared/cors.ts';

const ALLOWED_ASSIGNABLE_ROLES = new Set([
  'admin',
  'operator',
  'auditor',
  'premium_member',
  'premium',
  'member',
  'user',
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { user, role, service } = await requirePermission(req, 'platform.roles.assign');
    const { targetUserId, role: requestedRole } = await req.json();

    if (!targetUserId || typeof targetUserId !== 'string') {
      throw new Response('targetUserId is required', { status: 400 });
    }

    if (!requestedRole || typeof requestedRole !== 'string') {
      throw new Response('role is required', { status: 400 });
    }

    const normalizedRequestedRole = normalizeRole(requestedRole);

    if (!ALLOWED_ASSIGNABLE_ROLES.has(normalizedRequestedRole)) {
      throw new Response('Requested role is not assignable', { status: 400 });
    }

    if (targetUserId === user.id) {
      throw new Response('You cannot change your own role', { status: 400 });
    }

    if (normalizedRequestedRole === 'admin' && role !== 'owner' && role !== 'admin') {
      throw new Response('Only owners or admins may assign the admin role', { status: 403 });
    }

    const { data: targetProfile, error: targetError } = await service
      .from('tenant_profiles')
      .select('user_id, role')
      .eq('user_id', targetUserId)
      .single();

    if (targetError || !targetProfile) {
      throw new Response('Target tenant profile not found', { status: 404 });
    }

    const targetCurrentRole = normalizeRole(targetProfile.role);

    if (targetCurrentRole === 'owner' && role !== 'owner') {
      throw new Response('Only owners may change another owner role', { status: 403 });
    }

    const { error: updateError } = await service
      .from('tenant_profiles')
      .update({ role: normalizedRequestedRole })
      .eq('user_id', targetUserId);

    if (updateError) {
      throw new Response(updateError.message, { status: 500 });
    }

    await writeAuditLog(service, {
      actorUserId: user.id,
      action: 'admin_update_role',
      targetUserId,
      metadata: {
        previousRole: targetCurrentRole,
        nextRole: normalizedRequestedRole,
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return new Response(JSON.stringify({ error: message }), {
        status: error.status,
        headers: corsHeaders,
      });
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
