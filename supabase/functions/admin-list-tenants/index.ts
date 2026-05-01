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
    const { user, service } = await requirePermission(req, 'platform.tenants.view');

    const [{ data: tenants, error: tenantError }, { data: sources, error: sourceError }] = await Promise.all([
      service
        .from('tenant_profiles')
        .select('user_id, email, full_name, role, status')
        .order('full_name', { ascending: true }),
      service.from('rss_sources').select('user_id'),
    ]);

    if (tenantError) {
      throw new Response(tenantError.message, { status: 500 });
    }

    if (sourceError) {
      throw new Response(sourceError.message, { status: 500 });
    }

    const sourceCountByUser: Record<string, number> = {};
    for (const source of sources ?? []) {
      const sourceUserId = source.user_id as string | null;
      if (!sourceUserId) continue;
      sourceCountByUser[sourceUserId] = (sourceCountByUser[sourceUserId] ?? 0) + 1;
    }

    const shapedTenants = (tenants ?? []).map((tenant) => ({
      ...tenant,
      sourceCount: sourceCountByUser[tenant.user_id as string] ?? 0,
    }));

    await writeAuditLog(service, {
      actorUserId: user.id,
      action: 'admin_list_tenants',
      metadata: { tenantCount: shapedTenants.length },
    });

    return new Response(JSON.stringify({ tenants: shapedTenants }), {
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
