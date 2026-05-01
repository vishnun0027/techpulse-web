import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { requirePermission } from '../_shared/auth.ts';
import { writeAuditLog } from '../_shared/audit.ts';

import { corsHeaders } from '../_shared/cors.ts';

type StatsResponse = {
  collected: number;
  delivered: number;
  ready: number;
  sources: number;
  noiseRatio: number;
  avgScore: number;
  sourceHealth: number;
};

function startOfSevenDayWindow(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildDayBuckets() {
  const buckets: Record<string, number> = {};
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const label = date.toLocaleDateString('en-US', { weekday: 'short' });
    buckets[label] = 0;
  }
  return buckets;
}

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
    const { selectedUserId } = await req.json().catch(() => ({ selectedUserId: 'all' }));

    const targetUserId =
      typeof selectedUserId === 'string' && selectedUserId.trim() && selectedUserId !== 'all'
        ? selectedUserId
        : 'all';

    if (targetUserId === 'all') {
      const sevenDaysAgo = startOfSevenDayWindow();
      const [
        { data: tenants, error: tenantsError },
        { data: articles, error: articlesError },
        { data: sources, error: sourcesError },
        { data: chartArticles, error: chartError },
        { data: collectorTelemetry, error: collectorError },
        { data: summarizerTelemetry, error: summarizerError },
      ] = await Promise.all([
        service.from('tenant_profiles').select('user_id, email, full_name, role, status').order('full_name', { ascending: true }),
        service.from('articles').select('user_id, is_delivered, created_at'),
        service.from('rss_sources').select('user_id'),
        service.from('articles').select('created_at, is_delivered').gte('created_at', sevenDaysAgo.toISOString()),
        service.from('telemetry').select('metrics').eq('service', 'collector').order('timestamp', { ascending: false }).limit(1),
        service.from('telemetry').select('metrics').eq('service', 'summarizer').order('timestamp', { ascending: false }).limit(1),
      ]);

      const errors = [tenantsError, articlesError, sourcesError, chartError, collectorError, summarizerError].filter(Boolean);
      if (errors.length > 0) {
        throw new Response(errors[0]?.message ?? 'Failed to load platform intelligence', { status: 500 });
      }

      const articleCountByUser: Record<string, number> = {};
      const deliveredCountByUser: Record<string, number> = {};
      const lastActivityByUser: Record<string, string> = {};
      let totalArticles = 0;
      let totalDelivered = 0;

      for (const article of articles ?? []) {
        const articleUserId = article.user_id as string | null;
        if (!articleUserId) continue;
        articleCountByUser[articleUserId] = (articleCountByUser[articleUserId] ?? 0) + 1;
        totalArticles += 1;
        const createdAt = article.created_at as string | null;
        if (createdAt && (!lastActivityByUser[articleUserId] || createdAt > lastActivityByUser[articleUserId])) {
          lastActivityByUser[articleUserId] = createdAt;
        }

        if (article.is_delivered) {
          deliveredCountByUser[articleUserId] = (deliveredCountByUser[articleUserId] ?? 0) + 1;
          totalDelivered += 1;
        }
      }

      const sourceCountByUser: Record<string, number> = {};
      let totalSources = 0;
      for (const source of sources ?? []) {
        const sourceUserId = source.user_id as string | null;
        if (!sourceUserId) continue;
        sourceCountByUser[sourceUserId] = (sourceCountByUser[sourceUserId] ?? 0) + 1;
        totalSources += 1;
      }

      const tenantStats = (tenants ?? []).map((tenant) => {
        const tenantUserId = tenant.user_id as string;
        return {
          ...tenant,
          totalArticles: articleCountByUser[tenantUserId] ?? 0,
          deliveredArticles: deliveredCountByUser[tenantUserId] ?? 0,
          sourcesCount: sourceCountByUser[tenantUserId] ?? 0,
          lastActivity: lastActivityByUser[tenantUserId] ?? null,
        };
      });

      const deliveryBuckets = buildDayBuckets();
      for (const article of chartArticles ?? []) {
        if (!article.is_delivered) continue;
        const label = new Date(article.created_at as string).toLocaleDateString('en-US', { weekday: 'short' });
        if (deliveryBuckets[label] !== undefined) {
          deliveryBuckets[label] += 1;
        }
      }

      const collectorMetrics = collectorTelemetry?.[0]?.metrics ?? {};
      const summarizerMetrics = summarizerTelemetry?.[0]?.metrics ?? {};
      const stats: StatsResponse = {
        collected: totalArticles,
        delivered: totalDelivered,
        ready: Math.max(totalArticles - totalDelivered, 0),
        sources: totalSources,
        noiseRatio: collectorMetrics.noise_ratio ?? 0,
        avgScore: summarizerMetrics.avg_score ?? 0,
        sourceHealth:
          collectorMetrics.total_sources > 0
            ? Math.round(((collectorMetrics.total_sources - collectorMetrics.error_count) / collectorMetrics.total_sources) * 100)
            : 0,
      };

      await writeAuditLog(service, {
        actorUserId: user.id,
        action: 'admin_view_platform_intelligence',
        metadata: {
          scope: 'all',
          tenantCount: tenantStats.length,
          articleCount: totalArticles,
        },
      });

      return new Response(
        JSON.stringify({
          stats,
          chartData: Object.entries(deliveryBuckets).map(([name, delivered]) => ({ name, delivered })),
          tenantStats,
          inspectingUser: null,
          inspectingSources: [],
          articles: [],
          filteredCount: 0,
          sourceOptions: [],
        }),
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    const [
      { data: tenant, error: tenantError },
      { data: sources, error: sourcesError },
      { data: articles, error: articlesError, count: filteredCount },
      { count: totalArticles, error: totalArticlesError },
      { count: deliveredArticles, error: deliveredArticlesError },
      { count: sourceCount, error: sourceCountError },
      { data: chartArticles, error: chartError },
      { data: collectorTelemetry, error: collectorError },
      { data: summarizerTelemetry, error: summarizerError },
    ] = await Promise.all([
      service.from('tenant_profiles').select('user_id, email, full_name, role, status').eq('user_id', targetUserId).single(),
      service.from('rss_sources').select('id, name, url, is_active, created_at').eq('user_id', targetUserId).order('created_at', { ascending: false }),
      service
        .from('articles')
        .select('id, source_url, title, summary, score, source, is_delivered, created_at', { count: 'exact' })
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(50),
      service.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', targetUserId),
      service.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', targetUserId).eq('is_delivered', true),
      service.from('rss_sources').select('*', { count: 'exact', head: true }).eq('user_id', targetUserId),
      service
        .from('articles')
        .select('created_at, is_delivered')
        .eq('user_id', targetUserId)
        .gte('created_at', startOfSevenDayWindow().toISOString()),
      service.from('telemetry').select('metrics').eq('user_id', targetUserId).eq('service', 'collector').order('timestamp', { ascending: false }).limit(1),
      service.from('telemetry').select('metrics').eq('user_id', targetUserId).eq('service', 'summarizer').order('timestamp', { ascending: false }).limit(1),
    ]);

    const errors = [
      tenantError,
      sourcesError,
      articlesError,
      totalArticlesError,
      deliveredArticlesError,
      sourceCountError,
      chartError,
      collectorError,
      summarizerError,
    ].filter(Boolean);

    if (errors.length > 0) {
      throw new Response(errors[0]?.message ?? 'Failed to load tenant intelligence', { status: 500 });
    }

    if (!tenant) {
      throw new Response('Tenant not found', { status: 404 });
    }

    const collectorMetrics = collectorTelemetry?.[0]?.metrics ?? {};
    const summarizerMetrics = summarizerTelemetry?.[0]?.metrics ?? {};
    const stats: StatsResponse = {
      collected: totalArticles ?? 0,
      delivered: deliveredArticles ?? 0,
      ready: Math.max((totalArticles ?? 0) - (deliveredArticles ?? 0), 0),
      sources: sourceCount ?? 0,
      noiseRatio: collectorMetrics.noise_ratio ?? 0,
      avgScore: summarizerMetrics.avg_score ?? 0,
      sourceHealth:
        collectorMetrics.total_sources > 0
          ? Math.round(((collectorMetrics.total_sources - collectorMetrics.error_count) / collectorMetrics.total_sources) * 100)
          : 0,
    };

    const sourceOptions = Array.from(
      new Set(
        (articles ?? [])
          .map((article) => article.source as string | null)
          .filter((source): source is string => Boolean(source)),
      ),
    ).sort((left, right) => left.localeCompare(right));
    const deliveryBuckets = buildDayBuckets();
    for (const article of chartArticles ?? []) {
      if (!article.is_delivered) continue;
      const label = new Date(article.created_at as string).toLocaleDateString('en-US', { weekday: 'short' });
      if (deliveryBuckets[label] !== undefined) {
        deliveryBuckets[label] += 1;
      }
    }

    await writeAuditLog(service, {
      actorUserId: user.id,
      action: 'admin_view_platform_intelligence',
      targetUserId,
      metadata: {
        scope: 'tenant',
        articleCount: totalArticles ?? 0,
      },
    });

    return new Response(
      JSON.stringify({
        stats,
        chartData: Object.entries(deliveryBuckets).map(([name, delivered]) => ({ name, delivered })),
        tenantStats: [],
        inspectingUser: tenant,
        inspectingSources: sources ?? [],
        articles: articles ?? [],
        filteredCount: filteredCount ?? 0,
        sourceOptions,
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
