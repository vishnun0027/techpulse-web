import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { requirePermission } from '../_shared/auth.ts';
import { normalizeRole } from '../_shared/permissions.ts';
import { writeAuditLog } from '../_shared/audit.ts';

import { corsHeaders } from '../_shared/cors.ts';

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
    const { user, role, service } = await requirePermission(req, 'platform.users.delete');
    const { targetUserId } = await req.json();

    if (!targetUserId || typeof targetUserId !== 'string') {
      throw new Response('targetUserId is required', { status: 400 });
    }

    if (targetUserId === user.id) {
      throw new Response('You cannot delete your own account', { status: 400 });
    }

    const { data: targetProfile, error: targetError } = await service
      .from('tenant_profiles')
      .select('user_id, role, email')
      .eq('user_id', targetUserId)
      .single();

    if (targetError || !targetProfile) {
      throw new Response('Target tenant profile not found', { status: 404 });
    }

    const targetRole = normalizeRole(targetProfile.role);
    if ((targetRole === 'owner' || targetRole === 'admin') && role !== 'owner') {
      throw new Response('Only owners may delete owner or admin accounts', { status: 403 });
    }

    const { error: deleteError } = await service.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      throw new Response(deleteError.message, { status: 500 });
    }

    await writeAuditLog(service, {
      actorUserId: user.id,
      action: 'admin_delete_user',
      targetUserId,
      metadata: {
        deletedRole: targetRole,
        deletedEmail: targetProfile.email ?? null,
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
