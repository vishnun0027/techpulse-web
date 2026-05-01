import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { requirePermission } from '../_shared/auth.ts';
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
    const { user, service } = await requirePermission(req, 'platform.tenants.manage');
    const { email, fullName } = await req.json();

    if (!email || typeof email !== 'string') {
      throw new Response('email is required', { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Response('email is required', { status: 400 });
    }

    const { data: authUsers, error: authUsersError } = await service.auth.admin.listUsers();
    if (authUsersError) {
      throw new Response(authUsersError.message, { status: 500 });
    }

    const foundUser = authUsers.users.find((authUser) => authUser.email?.toLowerCase() === normalizedEmail);
    if (!foundUser) {
      throw new Response(`User not found: ${normalizedEmail}`, { status: 404 });
    }

    const tenantPayload = {
      user_id: foundUser.id,
      email: foundUser.email,
      full_name:
        (typeof fullName === 'string' && fullName.trim()) ||
        foundUser.user_metadata?.full_name ||
        foundUser.email?.split('@')[0] ||
        'User',
      role: 'user',
      status: 'active',
    };

    const { data: tenant, error: upsertError } = await service
      .from('tenant_profiles')
      .upsert(tenantPayload, { onConflict: 'user_id' })
      .select('user_id, email, full_name, role, status')
      .single();

    if (upsertError || !tenant) {
      throw new Response(upsertError?.message ?? 'Failed to enroll tenant', { status: 500 });
    }

    await writeAuditLog(service, {
      actorUserId: user.id,
      action: 'admin_enroll_tenant',
      targetUserId: foundUser.id,
      metadata: {
        email: normalizedEmail,
      },
    });

    return new Response(JSON.stringify({ success: true, tenant }), {
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
