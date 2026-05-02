import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { invokeAdminFunction } from '../adminApi';
import { useUserProfile } from '../context/UserProfileContext';
import { formatDistanceToNow } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Database, Send, Radio, ShieldCheck, Zap, Activity as ActivityIcon, Search as SearchIcon, Globe, Newspaper, LayoutGrid, List } from 'lucide-react';

export default function DashboardView({ session }) {
  const { hasPermission } = useUserProfile();
  const isPlatformOperator = hasPermission('platform.access');
  const db = supabase;

  const [stats, setStats] = useState({ collected: 0, delivered: 0, ready: 0, sources: 0, noiseRatio: 0, avgScore: 0, sourceHealth: 0 });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenantStats, setTenantStats] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [feedback, setFeedback] = useState({});
  const [filteredCount, setFilteredCount] = useState(0);
  const [filters, setFilters] = useState({ title: '', source: '', minScore: '', status: 'all', timeRange: 'all' });
  const [sourceOptions, setSourceOptions] = useState([]);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list' for tenant overview

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedFilters(filters); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      if (isPlatformOperator) {
        try {
          const data = await invokeAdminFunction('admin-get-platform-intelligence', {
            userId: session.user.id,
            selectedUserId,
          });

          setStats(data.stats ?? { collected: 0, delivered: 0, ready: 0, sources: 0, noiseRatio: 0, avgScore: 0, sourceHealth: 0 });
          setChartData(data.chartData ?? []);
          setTenantStats(data.tenantStats ?? []);
          setArticles(data.articles ?? []);
          setFilteredCount(data.filteredCount ?? 0);
          setSourceOptions(data.sourceOptions ?? []);
        } catch (err) {
          console.error('Platform data fetch error:', err);
          setTenantStats([]);
          setArticles([]);
          setFilteredCount(0);
          setStats({ collected: 0, delivered: 0, ready: 0, sources: 0, noiseRatio: 0, avgScore: 0, sourceHealth: 0 });
          setChartData([]);
        }
      } else {
        const [
          { count: collectedCount },
          { count: deliveredCount },
          { count: readyCount },
          { count: sourcesCount },
          { data: chartArticles },
          { data: latestCollector },
          { data: latestSummarizer }
        ] = await Promise.all([
          db.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
          db.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('is_delivered', true),
          db.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('is_delivered', false).gte('score', 3.0),
          db.from('rss_sources').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id),
          db.from('articles').select('created_at').eq('user_id', session.user.id).eq('is_delivered', true).gte('created_at', sevenDaysAgo.toISOString()),
          db.from('telemetry').select('metrics').eq('user_id', session.user.id).eq('service', 'collector').order('timestamp', { ascending: false }).limit(1),
          db.from('telemetry').select('metrics').eq('user_id', session.user.id).eq('service', 'summarizer').order('timestamp', { ascending: false }).limit(1)
        ]);

        const collMetrics = latestCollector?.[0]?.metrics || {};
        const summMetrics = latestSummarizer?.[0]?.metrics || {};

        setStats({
          collected: collectedCount || 0,
          delivered: deliveredCount || 0,
          ready: readyCount || 0,
          sources: sourcesCount || 0,
          noiseRatio: collMetrics.noise_ratio || 0,
          avgScore: summMetrics.avg_score || 0,
          sourceHealth: collMetrics.total_sources > 0
            ? Math.round(((collMetrics.total_sources - collMetrics.error_count) / collMetrics.total_sources) * 100)
            : 0
        });

        const deliveryCounts = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          deliveryCounts[d.toLocaleDateString('en-US', { weekday: 'short' })] = 0;
        }
        (chartArticles || []).forEach(a => {
          const k = new Date(a.created_at).toLocaleDateString('en-US', { weekday: 'short' });
          if (deliveryCounts[k] !== undefined) deliveryCounts[k]++;
        });
        setChartData(Object.keys(deliveryCounts).map(k => ({ name: k, delivered: deliveryCounts[k] })));

        setSourceOptions([]);
        let query = db.from('articles').select('*', { count: 'exact' });
        if (!isPlatformOperator) query = query.eq('user_id', session.user.id);
        if (debouncedFilters.title)  query = query.ilike('title', `%${debouncedFilters.title}%`);
        if (debouncedFilters.source) query = query.eq('source', debouncedFilters.source);
        if (debouncedFilters.minScore) query = query.gte('score', parseFloat(debouncedFilters.minScore));
        if (debouncedFilters.status === 'delivered') query = query.eq('is_delivered', true);
        if (debouncedFilters.status === 'pending')   query = query.eq('is_delivered', false);
        if (debouncedFilters.timeRange !== 'all') {
          const since = new Date();
          if (debouncedFilters.timeRange === '24h') since.setHours(since.getHours() - 24);
          if (debouncedFilters.timeRange === '7d')  since.setDate(since.getDate() - 7);
          if (debouncedFilters.timeRange === '30d') since.setDate(since.getDate() - 30);
          query = query.gte('created_at', since.toISOString());
        }
        const { data: rssSources } = await db.from('rss_sources').select('name, is_active').order('name');
        setSourceOptions(Array.from(new Set((rssSources || []).map(s => s.name))));
        const { data: recent, count: matches } = await query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
        setArticles(recent || []);
        setFilteredCount(matches || 0);
      }
      setLoading(false);
    }
    fetchData();
  }, [session, isPlatformOperator, selectedUserId, page, debouncedFilters, db]);

  async function submitFeedback(article, isHelpful) {
    if (!session?.user?.id || feedback[article.id]) return;
    setFeedback(f => ({ ...f, [article.id]: 'saving' }));
    try {
      const { error } = await supabase.from('user_feedback').insert([{ 
        user_id: session.user.id, 
        article_id: article.id, 
        is_helpful: isHelpful, 
        score_at_time: article.score,
        signal: isHelpful ? 'clicked' : 'dismissed'
      }]);
      if (error) throw error;
      setFeedback(f => ({ ...f, [article.id]: isHelpful ? 'clicked' : 'dismissed' }));
    } catch (err) {
      console.error('Feedback error:', err);
      setFeedback(f => { const nf = {...f}; delete nf[article.id]; return nf; });
    }
  }

  const trackArticleClick = (article) => {
    supabase.from('telemetry').insert([{ user_id: session.user.id, service: 'webapp', event: 'article_click', metrics: { article_id: article.id, source: article.source } }]).then();
  };

  const StatCard = ({ label, value, icon: Icon, color, subValue, subLabel }) => (
    <div className="stat-card" style={{ borderTop: `2px solid ${color || 'var(--card-border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <Icon size={12} style={{ color: color || 'var(--text-muted)', opacity: 0.5 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{loading ? '...' : value}</span>
        {subValue && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{subValue} {subLabel}</span>}
      </div>
    </div>
  );

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div style={{ width: '6px', height: '6px', background: isPlatformOperator ? 'var(--semantic-danger)' : 'var(--accent)', borderRadius: '50%' }} />
            <span style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {isPlatformOperator ? 'Fleet Monitor' : 'Local Signal Node'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            {isPlatformOperator ? 'Platform Intel' : 'Intelligence Feed'}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--semantic-success)', fontSize: '0.65rem', fontWeight: 700 }}>
              <div className="animate-pulse" style={{ width: '5px', height: '5px', background: 'currentColor', borderRadius: '50%' }} />
              OPERATIONAL
            </div>
          </div>
        </div>
      </div>

      {/* STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <StatCard label="Collected" value={stats.collected} icon={Database} color="var(--accent)" subValue="+12" subLabel="today" />
        <StatCard label="Delivered" value={stats.delivered} icon={Send} color="#10b981" />
        <StatCard label="Noise floor" value={stats.noiseRatio + '%'} icon={ShieldCheck} color="#818cf8" />
        <StatCard label="Signal" value={stats.avgScore.toFixed(1)} icon={Zap} color="#f59e0b" subValue="/ 5.0" />
        <StatCard label="Health" value={stats.sourceHealth + '%'} icon={Radio} color={stats.sourceHealth > 90 ? '#10b981' : '#f59e0b'} />
      </div>

      {/* MAIN VIEW */}
      <div style={{ display: 'grid', gridTemplateColumns: isPlatformOperator ? '1fr' : '1fr 300px', gap: '1.5rem' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {isPlatformOperator && (
            /* ADMIN COMMAND BAR */
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                  onClick={() => setSelectedUserId('all')}
                  className={selectedUserId === 'all' ? 'active' : 'secondary'}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '100px' }}
                >
                  <Globe size={14} style={{ marginRight: '0.4rem' }} /> Global Fleet
                </button>
                <select 
                  value={selectedUserId === 'all' ? '' : selectedUserId} 
                  onChange={(e) => setSelectedUserId(e.target.value)} 
                  style={{ marginBottom: 0, width: '200px', borderRadius: '100px', padding: '0.4rem 1rem' }}
                >
                  <option value="" disabled>Select node...</option>
                  {tenantStats.map(t => <option key={t.user_id} value={t.user_id}>{t.full_name || t.email.split('@')[0]}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', padding: '0.2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '100px' }}>
                <button onClick={() => setViewMode('grid')} style={{ padding: '0.3rem', background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none' }}><LayoutGrid size={12} /></button>
                <button onClick={() => setViewMode('list')} style={{ padding: '0.3rem', background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none' }}><List size={12} /></button>
              </div>
            </div>
          )}

          {isPlatformOperator && selectedUserId === 'all' ? (
            /* ALL TENANTS OVERVIEW */
            <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(280px, 1fr))' : '1fr', gap: '0.75rem' }}>
              {tenantStats.map(t => {
                const pct = t.totalArticles > 0 ? Math.round((t.deliveredArticles / t.totalArticles) * 100) : 0;
                return (
                  <div key={t.user_id} className="glass-panel hoverable" style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => setSelectedUserId(t.user_id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(56,189,248,0.1)', color: 'var(--accent)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.75rem' }}>{t.full_name?.[0] || 'A'}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.full_name || 'Anonymous'}</div>
                      </div>
                      <span className="badge info">{t.role}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem' }}>
                      <div style={{ color: 'var(--text-muted)' }}>Intel: <span style={{ color: 'white', fontWeight: 600 }}>{t.totalArticles}</span></div>
                      <div style={{ color: 'var(--text-muted)' }}>Rate: <span style={{ color: 'var(--semantic-success)', fontWeight: 600 }}>{pct}%</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* DATA TABLE */
            <div className="glass-panel" style={{ border: 'none', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Signal Stream</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input value={filters.title} onChange={e => setFilters({...filters, title: e.target.value})} placeholder="Filter title..." style={{ marginBottom: 0, padding: '0.3rem 0.75rem', width: '180px', borderRadius: '100px' }} />
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="hide-mobile">Arrival</th>
                      <th>Source</th>
                      <th>Discovery</th>
                      <th>Score</th>
                      <th style={{ textAlign: 'center' }}>Training</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((a) => {
                      const fb = feedback[a.id];
                      return (
                        <tr key={a.id}>
                          <td className="hide-mobile" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</td>
                          <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{a.source}</td>
                          <td><a href={a.source_url} target="_blank" rel="noreferrer" className="article-title-link" style={{ fontSize: '0.85rem' }} onClick={() => trackArticleClick(a)}>{a.title}</a></td>
                          <td><span style={{ fontSize: '0.75rem', fontWeight: 700, color: a.score >= 4 ? 'var(--accent)' : 'white' }}>{a.score.toFixed(1)}</span></td>
                          <td style={{ textAlign: 'center' }}>
                            {!fb ? (
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                <button onClick={() => submitFeedback(a, true)} style={{ padding: '0.2rem 0.5rem', background: 'transparent', border: '1px solid var(--card-border)' }}>👍</button>
                                <button onClick={() => submitFeedback(a, false)} style={{ padding: '0.2rem 0.5rem', background: 'transparent', border: '1px solid var(--card-border)' }}>👎</button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: fb === 'clicked' ? 'var(--semantic-success)' : 'var(--text-muted)' }}>{fb === 'clicked' ? 'LEARNED' : 'SKIPPED'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Page {page} of {Math.ceil(filteredCount/PAGE_SIZE)}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="secondary" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding: '0.3rem 0.75rem' }}>Prev</button>
                  <button className="secondary" onClick={() => setPage(p => p+1)} disabled={page*PAGE_SIZE>=filteredCount} style={{ padding: '0.3rem 0.75rem' }}>Next</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {!isPlatformOperator && (
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Velocity</h3>
              <div style={{ height: '100px', width: '100%' }}>
                <ResponsiveContainer>
                  <AreaChart data={chartData}>
                    <Area type="monotone" dataKey="delivered" stroke="var(--accent)" fill="var(--accent-glow)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Source Health</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sourceOptions.slice(0, 5).map(s => (
                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                    <span>{s}</span>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--semantic-success)' }} />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .article-title-link { color: var(--text-primary); text-decoration: none; }
        .article-title-link:hover { color: var(--accent); }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
        }
      `}} />
    </div>
  );
}
