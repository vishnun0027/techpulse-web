import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { requirePermission } from '../_shared/auth.ts';
import { writeAuditLog } from '../_shared/audit.ts';

import { corsHeaders } from '../_shared/cors.ts';

type ChartPoint = {
  name: string;
  value: number;
};

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
    const { user, service } = await requirePermission(req, 'platform.access');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      { count: totalArticles, error: articlesError },
      { data: tenants, error: tenantsError },
      { count: totalSources, error: sourcesError },
      { data: chartArticles, error: chartError },
      { data: collectorTelemetry, error: collectorError },
      { data: summarizerTelemetry, error: summarizerError },
      { data: allSources, error: allSourcesError },
    ] = await Promise.all([
      service.from('articles').select('*', { count: 'exact', head: true }),
      service.from('tenant_profiles').select('user_id, email, full_name, role, status').order('full_name', { ascending: true }),
      service.from('rss_sources').select('*', { count: 'exact', head: true }),
      service.from('articles').select('created_at').gte('created_at', sevenDaysAgo.toISOString()),
      service.from('telemetry').select('metrics').eq('service', 'collector').order('timestamp', { ascending: false }).limit(1),
      service.from('telemetry').select('metrics').eq('service', 'summarizer').order('timestamp', { ascending: false }).limit(1),
      service.from('rss_sources').select('user_id'),
    ]);

    const errors = [
      articlesError,
      tenantsError,
      sourcesError,
      chartError,
      collectorError,
      summarizerError,
      allSourcesError,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Response(errors[0]?.message ?? 'Failed to load command center data', { status: 500 });
    }

    const sourceCountByUser: Record<string, number> = {};
    for (const source of allSources ?? []) {
      const sourceUserId = source.user_id as string | null;
      if (!sourceUserId) continue;
      sourceCountByUser[sourceUserId] = (sourceCountByUser[sourceUserId] ?? 0) + 1;
    }

    const shapedTenants = (tenants ?? []).map((tenant) => ({
      ...tenant,
      sourceCount: sourceCountByUser[tenant.user_id as string] ?? 0,
    }));

    const deliveryCounts: Record<string, number> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      deliveryCounts[d.toISOString().split('T')[0]] = 0;
    }

    for (const article of chartArticles ?? []) {
      const date = (article.created_at as string | null)?.split('T')[0];
      if (date && deliveryCounts[date] !== undefined) {
        deliveryCounts[date] += 1;
      }
    }

    const chartData: ChartPoint[] = Object.entries(deliveryCounts).map(([name, value]) => ({ name, value }));
    const collectorMetrics = collectorTelemetry?.[0]?.metrics ?? {};
    const summarizerMetrics = summarizerTelemetry?.[0]?.metrics ?? {};
    const totalUsers = shapedTenants.length;
    const totalSourceCount = totalSources ?? 0;
    const pipelineHealth =
      collectorMetrics.total_sources > 0
        ? Math.round(((collectorMetrics.total_sources - collectorMetrics.error_count) / collectorMetrics.total_sources) * 100)
        : 0;

    await writeAuditLog(service, {
      actorUserId: user.id,
      action: 'admin_view_command_center',
      metadata: {
        tenantCount: totalUsers,
        articleCount: totalArticles ?? 0,
      },
    });

    return new Response(
      JSON.stringify({
        globalStats: {
          totalArticles: totalArticles ?? 0,
          totalUsers,
          totalSources: totalSourceCount,
          pipelineHealth,
          avgNoise: summarizerMetrics.noise_ratio ?? 0,
        },
        tenants: shapedTenants,
        chartData,
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
