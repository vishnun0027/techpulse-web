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
    const { user, service } = await requirePermission(req, 'platform.reports.view');

    const [
      { data: tenants, error: tenantsError },
      { data: articles, error: articlesError },
    ] = await Promise.all([
      service.from('tenant_profiles').select('user_id, email, full_name, role, status').order('full_name', { ascending: true }),
      service.from('articles').select('user_id, is_delivered'),
    ]);

    const errors = [tenantsError, articlesError].filter(Boolean);
    if (errors.length > 0) {
      throw new Response(errors[0]?.message ?? 'Failed to load brief report', { status: 500 });
    }

    const tenantMap = Object.fromEntries(
      (tenants ?? []).map((tenant) => [
        tenant.user_id as string,
        {
          user_id: tenant.user_id,
          email: tenant.email,
          full_name: tenant.full_name,
          role: tenant.role,
          status: tenant.status,
        },
      ]),
    );

    const byTenant: Record<string, { total: number; delivered: number; pending: number }> = {};

    for (const tenant of tenants ?? []) {
      byTenant[tenant.user_id as string] = { total: 0, delivered: 0, pending: 0 };
    }

    for (const article of articles ?? []) {
      const tenantUserId = article.user_id as string | null;
      if (!tenantUserId) continue;
      if (!byTenant[tenantUserId]) {
        byTenant[tenantUserId] = { total: 0, delivered: 0, pending: 0 };
      }

      byTenant[tenantUserId].total += 1;
      if (article.is_delivered) {
        byTenant[tenantUserId].delivered += 1;
      } else {
        byTenant[tenantUserId].pending += 1;
      }
    }

    await writeAuditLog(service, {
      actorUserId: user.id,
      action: 'admin_view_brief_report',
      metadata: {
        tenantCount: Object.keys(tenantMap).length,
      },
    });

    return new Response(
      JSON.stringify({
        adminReport: {
          byTenant,
          tenantMap,
        },
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    );
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
