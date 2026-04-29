import { useState, useEffect } from 'react';
import { supabase, supabaseAdmin } from '../supabase';
import { useUserProfile } from '../context/UserProfileContext';
import { formatDistanceToNow } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Database, Send, Radio, ShieldCheck, Zap, Activity as ActivityIcon, Search as SearchIcon, Filter, Globe, Newspaper, User, ChevronRight, LayoutGrid, List } from 'lucide-react';

export default function DashboardView({ session }) {
  const { isAdmin } = useUserProfile();
  const db = isAdmin && supabaseAdmin ? supabaseAdmin : supabase;

  const [stats, setStats] = useState({ collected: 0, delivered: 0, ready: 0, sources: 0, noiseRatio: 0, avgScore: 0, sourceHealth: 0 });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenantStats, setTenantStats] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [inspectingUser, setInspectingUser] = useState(null);
  const [inspectingSources, setInspectingSources] = useState([]);
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

      const [
        { count: collectedCount },
        { count: deliveredCount },
        { count: readyCount },
        { count: sourcesCount },
        { data: chartArticles },
        { data: latestCollector },
        { data: latestSummarizer }
      ] = await Promise.all([
        db.from('articles').select('*', { count: 'exact', head: true }),
        db.from('articles').select('*', { count: 'exact', head: true }).eq('is_delivered', true),
        db.from('articles').select('*', { count: 'exact', head: true }).eq('is_delivered', false).gte('score', 3.0),
        db.from('rss_sources').select('*', { count: 'exact', head: true }),
        db.from('articles').select('created_at').eq('is_delivered', true).gte('created_at', sevenDaysAgo.toISOString()),
        db.from('telemetry').select('metrics').eq('service', 'collector').order('timestamp', { ascending: false }).limit(1),
        db.from('telemetry').select('metrics').eq('service', 'summarizer').order('timestamp', { ascending: false }).limit(1)
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

      if (isAdmin && supabaseAdmin) {
        const { data: tenants } = await supabaseAdmin.from('tenant_profiles').select('user_id, full_name, email, role').order('full_name');
        
        if (selectedUserId === 'all') {
          const [{ data: allArticles }, { data: allSources }] = await Promise.all([
            supabaseAdmin.from('articles').select('user_id, is_delivered, created_at'),
            supabaseAdmin.from('rss_sources').select('user_id'),
          ]);

          const artMap = {};
          (allArticles || []).forEach(a => {
            if (!artMap[a.user_id]) artMap[a.user_id] = { total: 0, delivered: 0, lastActivity: null };
            artMap[a.user_id].total++;
            if (a.is_delivered) artMap[a.user_id].delivered++;
            if (!artMap[a.user_id].lastActivity || a.created_at > artMap[a.user_id].lastActivity)
              artMap[a.user_id].lastActivity = a.created_at;
          });
          const srcMap = {};
          (allSources || []).forEach(s => { srcMap[s.user_id] = (srcMap[s.user_id] || 0) + 1; });

          setTenantStats((tenants || []).map(t => ({
            ...t,
            totalArticles: artMap[t.user_id]?.total || 0,
            deliveredArticles: artMap[t.user_id]?.delivered || 0,
            lastActivity: artMap[t.user_id]?.lastActivity || null,
            sourcesCount: srcMap[t.user_id] || 0,
          })).sort((a, b) => b.totalArticles - a.totalArticles));
          setInspectingUser(null);
        } else {
          const [{ data: userProfile }, { data: userSources }, { data: userArticles, count: userMatchCount }] = await Promise.all([
            supabaseAdmin.from('tenant_profiles').select('*').eq('user_id', selectedUserId).single(),
            supabaseAdmin.from('rss_sources').select('*').eq('user_id', selectedUserId).order('name'),
            supabaseAdmin.from('articles').select('*', { count: 'exact' }).eq('user_id', selectedUserId).order('created_at', { ascending: false }).limit(20)
          ]);
          setInspectingUser(userProfile);
          setInspectingSources(userSources || []);
          setArticles(userArticles || []);
          setFilteredCount(userMatchCount || 0);
          setTenantStats(tenants || []);
        }
      } else {
        setSourceOptions([]);
        let query = db.from('articles').select('*', { count: 'exact' });
        if (!isAdmin) query = query.eq('user_id', session.user.id);
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
  }, [session, isAdmin, selectedUserId, page, debouncedFilters]);

  async function submitFeedback(article, isHelpful) {
    if (!session?.user?.id || feedback[article.id]) return;
    setFeedback(f => ({ ...f, [article.id]: 'saving' }));
    try {
      const { error } = await supabase.from('feedback').insert([{ user_id: session.user.id, article_id: article.id, is_helpful: isHelpful, score_at_time: article.score }]);
      if (error) throw error;
      setFeedback(f => ({ ...f, [article.id]: isHelpful ? 'helpful' : 'skip' }));
    } catch (err) {
      console.error('Feedback error:', err);
      setFeedback(f => { const nf = {...f}; delete nf[article.id]; return nf; });
    }
  }

  const trackArticleClick = (article) => {
    supabase.from('telemetry').insert([{ user_id: session.user.id, service: 'webapp', event: 'article_click', metrics: { article_id: article.id, source: article.source } }]).then();
  };

  const StatCard = ({ label, value, icon: Icon, color, subValue, subLabel }) => (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: `3px solid ${color || 'transparent'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
        <Icon size={14} style={{ color: color || 'var(--text-muted)', opacity: 0.6 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>{loading ? '...' : value}</span>
        {subValue && <span style={{ fontSize: '0.75rem', color: color || 'var(--text-muted)', fontWeight: 600 }}>{subValue} {subLabel}</span>}
      </div>
    </div>
  );

  return (
    <div className="dashboard-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--card-border)', paddingBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '0.2rem 0.6rem', background: isAdmin ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: isAdmin ? '#f87171' : '#60a5fa', borderRadius: '4px', border: '1px solid currentColor', letterSpacing: '0.05em' }}>
              {isAdmin ? 'ADMIN CONSOLE' : 'PERSONAL DIGEST'}
            </span>
            <span style={{ width: '4px', height: '4px', background: 'var(--text-muted)', borderRadius: '50%' }} />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>VERSION 2.4.0</span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>
            {isAdmin ? 'Platform Intelligence' : 'Technology Signal'}
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--semantic-success)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            <div style={{ width: '6px', height: '6px', background: 'currentColor', borderRadius: '50%', boxShadow: '0 0 8px currentColor' }} />
            PIPELINE OPERATIONAL
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Next re-index in 42 minutes</div>
        </div>
      </div>

      {/* STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <StatCard label={isAdmin ? 'Total Intelligence' : 'Collected'} value={stats.collected} icon={Database} color="var(--accent)" subValue="+12" subLabel="today" />
        <StatCard label="Delivered" value={stats.delivered} icon={Send} color="#10b981" />
        <StatCard label="Noise Reduction" value={stats.noiseRatio + '%'} icon={ShieldCheck} color="#6366f1" subLabel="filtered" />
        <StatCard label="Signal Strength" value={stats.avgScore.toFixed(1)} icon={Zap} color="#f59e0b" subValue="/ 5.0" />
        <StatCard label="Pipeline Health" value={stats.sourceHealth + '%'} icon={Radio} color={stats.sourceHealth > 90 ? '#10b981' : '#f59e0b'} subLabel="uptime" />
      </div>

      {/* CHART SECTION */}
      <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '8px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px' }}>
              <ActivityIcon size={16} color="#60a5fa" />
            </div>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Delivery Velocity</h2>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>7 DAY ROLLING AVERAGE</div>
        </div>
        <div style={{ height: '140px', width: '100%' }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
              <XAxis dataKey="name" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }} />
              <Area type="monotone" dataKey="delivered" stroke="var(--accent)" strokeWidth={2} fill="url(#colorDelivered)" animationDuration={1000} />
              <defs>
                <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15}/><stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {isAdmin ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* ADMIN COMMAND BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.4rem 0.75rem', borderRadius: '8px', background: selectedUserId === 'all' ? 'rgba(255,255,255,0.05)' : 'transparent', border: selectedUserId === 'all' ? '1px solid var(--card-border)' : '1px solid transparent' }}
                onClick={() => setSelectedUserId('all')}
              >
                <Globe size={16} color={selectedUserId === 'all' ? 'var(--accent)' : 'var(--text-muted)'} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedUserId === 'all' ? '#fff' : 'var(--text-muted)' }}>Global Fleet</span>
              </div>
              <div style={{ width: '1px', height: '16px', background: 'var(--card-border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Inspect:</span>
                <select 
                  value={selectedUserId === 'all' ? '' : selectedUserId} 
                  onChange={(e) => setSelectedUserId(e.target.value)} 
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'white', padding: '0.4rem 2rem 0.4rem 1rem', fontSize: '0.8rem', outline: 'none', fontWeight: 600, appearance: 'none', minWidth: '180px', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}
                >
                  <option value="" disabled>Select tenant...</option>
                  {tenantStats.map(t => <option key={t.user_id} value={t.user_id}>{t.full_name || t.email.split('@')[0]}</option>)}
                </select>
              </div>
            </div>
            {selectedUserId === 'all' && (
              <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <button onClick={() => setViewMode('grid')} style={{ padding: '0.4rem', borderRadius: '6px', background: viewMode === 'grid' ? 'var(--card-border)' : 'transparent', border: 'none', cursor: 'pointer' }}><LayoutGrid size={14} color={viewMode === 'grid' ? '#fff' : 'var(--text-muted)'} /></button>
                <button onClick={() => setViewMode('list')} style={{ padding: '0.4rem', borderRadius: '6px', background: viewMode === 'list' ? 'var(--card-border)' : 'transparent', border: 'none', cursor: 'pointer' }}><List size={14} color={viewMode === 'list' ? '#fff' : 'var(--text-muted)'} /></button>
              </div>
            )}
          </div>

          {selectedUserId === 'all' ? (
            /* ALL TENANTS OVERVIEW */
            <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr', gap: '1rem' }}>
              {tenantStats.map(t => {
                const pct = t.totalArticles > 0 ? Math.round((t.deliveredArticles / t.totalArticles) * 100) : 0;
                const roleColor = t.role === 'admin' ? '#f87171' : t.role === 'premium' ? '#fbbf24' : '#94a3b8';
                return (
                  <div key={t.user_id} className="glass-panel" style={{ padding: '1.5rem', cursor: 'pointer', transition: 'var(--transition-smooth)', border: '1px solid var(--card-border)' }} onClick={() => setSelectedUserId(t.user_id)} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--card-border)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--accent)', fontSize: '1rem' }}>
                          {t.full_name?.[0] || t.email?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>{t.full_name || 'Anonymous'}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.email}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.6rem', fontWeight: 900, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${roleColor}`, color: roleColor, letterSpacing: '0.05em' }}>{t.role?.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
                      <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{t.totalArticles}</div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 700 }}>ARTICLES</div>
                      </div>
                      <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>{t.deliveredArticles}</div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 700 }}>DELIVERED</div>
                      </div>
                      <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#60a5fa' }}>{t.sourcesCount}</div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 700 }}>SOURCES</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>PIPELINE EFFICIENCY</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: pct > 80 ? '#10b981' : '#f59e0b' }}>{pct}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pct + '%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 1s ease-in-out' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* INDIVIDUAL TENANT INSPECTOR */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
              <div className="glass-panel" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--accent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent) 0%, #1e40af 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.5rem', fontWeight: 900, boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)' }}>
                    {inspectingUser?.full_name?.[0] || inspectingUser?.email?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: 0 }}>{inspectingUser?.full_name || 'Anonymous'}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{inspectingUser?.email}</span>
                      <span style={{ width: '4px', height: '4px', background: 'var(--card-border)', borderRadius: '50%' }} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 800 }}>ID: {selectedUserId.slice(0,8)}</span>
                    </div>
                  </div>
                </div>
                <button className="secondary" style={{ padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem' }} onClick={() => setSelectedUserId('all')}>Back to Overview</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Database size={16} color="var(--accent)" />
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.05em' }}>REGISTRY SOURCES</h3>
                  </div>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead><tr><th>Source</th><th>State</th><th>Created</th></tr></thead>
                    <tbody>
                      {inspectingSources.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.name}</td>
                          <td><span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '0.2rem 0.5rem', borderRadius: '4px', background: s.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: s.is_active ? '#10b981' : '#f87171' }}>{s.is_active ? 'ACTIVE' : 'PAUSED'}</span></td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {inspectingSources.length === 0 && (<tr><td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No sources configured.</td></tr>)}
                    </tbody>
                  </table>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.05em' }}>TENANT STATS</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>TOTAL ARTICLES</div>
                      <div style={{ fontSize: '2rem', fontWeight: 900 }}>{filteredCount}</div>
                    </div>
                    <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>DELIVERY RATE</div>
                      <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981' }}>{articles.length > 0 ? Math.round((articles.filter(a => a.is_delivered).length / articles.length) * 100) : 0}%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Newspaper size={16} color="var(--accent)" />
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.05em' }}>RECENT INTELLIGENCE DISCOVERIES</h3>
                </div>
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Source</th><th>Title</th><th>Score</th><th>Status</th></tr></thead>
                  <tbody>
                    {articles.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</td>
                        <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{a.source}</td>
                        <td style={{ fontSize: '0.85rem', fontWeight: 700 }}><a href={a.source_url} target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'none' }}>{a.title}</a></td>
                        <td><span style={{ fontSize: '0.7rem', fontWeight: 900, color: a.score > 4 ? '#fbbf24' : '#fff' }}>⭐ {a.score.toFixed(1)}</span></td>
                        <td><span style={{ fontSize: '0.65rem', fontWeight: 800, color: a.is_delivered ? '#10b981' : '#f59e0b' }}>{a.is_delivered ? 'DELIVERED' : 'PENDING'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* STANDARD USER DISCOVERY TABLE */
        <div className="glass-panel" style={{ overflow: 'hidden', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <SearchIcon size={18} color="var(--text-muted)" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>Intelligence Feed</h2>
            </div>
            <button className="secondary" style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setFilters({ title: '', source: '', minScore: '', status: 'all', timeRange: 'all' })}>
              <Filter size={14} /> Reset Filters
            </button>
          </div>
          
          <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--card-border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="filter-group"><label>Search Title</label><input value={filters.title} onChange={e => setFilters({...filters, title: e.target.value})} placeholder="Keyword..." /></div>
            <div className="filter-group"><label>Source</label><select value={filters.source} onChange={e => setFilters({...filters, source: e.target.value})}><option value="">All Streams</option>{sourceOptions.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
            <div className="filter-group"><label>Min Score</label><input type="number" step="0.1" value={filters.minScore} onChange={e => setFilters({...filters, minScore: e.target.value})} placeholder="0.0" /></div>
            <div className="filter-group"><label>Status</label><select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}><option value="all">Any Status</option><option value="delivered">Delivered</option><option value="pending">Pending</option></select></div>
            <div className="filter-group"><label>Time Window</label><select value={filters.timeRange} onChange={e => setFilters({...filters, timeRange: e.target.value})}><option value="all">Unlimited</option><option value="24h">24h Window</option><option value="7d">7d Window</option><option value="30d">30d Window</option></select></div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Timestamp</th><th>Stream</th><th>Intelligence Discovery</th><th>Score</th><th>State</th><th style={{ textAlign: 'center' }}>Training</th></tr></thead>
              <tbody>
                {articles.map((a) => {
                  const fb = feedback[a.id];
                  return (
                    <tr key={a.id} className="fade-in">
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</td>
                      <td style={{ fontWeight: 600 }}>{a.source}</td>
                      <td style={{ maxWidth: '450px' }}><a href={a.source_url} target="_blank" rel="noreferrer" className="article-title-link" onClick={() => trackArticleClick(a)}>{a.title}</a></td>
                      <td><span className={`badge ${a.score >= 4 ? 'success' : 'info'}`}>⭐ {a.score.toFixed(1)}</span></td>
                      <td>{a.is_delivered ? <span className="badge success">Delivered</span> : <span className="badge warning">Filtered</span>}</td>
                      <td style={{ textAlign: 'center' }}>
                        {!fb ? (
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button onClick={() => submitFeedback(a, true)} className="feedback-btn positive">👍</button>
                            <button onClick={() => submitFeedback(a, false)} className="feedback-btn negative">👎</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: fb === 'helpful' ? '#10b981' : '#94a3b8' }}>{fb === 'helpful' ? 'OPTIMIZED ✓' : 'SKIPPED'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Displaying indices {Math.min((page-1)*PAGE_SIZE+1, filteredCount)}–{Math.min(page*PAGE_SIZE, filteredCount)} of {filteredCount} records</div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="secondary" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ width: 'auto', padding: '0.5rem 1.25rem' }}>Prev</button>
              <button className="secondary" onClick={() => setPage(p => p+1)} disabled={page*PAGE_SIZE>=filteredCount} style={{ width: 'auto', padding: '0.5rem 1.25rem' }}>Next</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        .filter-group { display: flex; flexDirection: column; gap: 0.4rem; }
        .filter-group label { font-size: 0.65rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .filter-group input, .filter-group select { background: rgba(0,0,0,0.3); border: 1px solid var(--card-border); color: #fff; padding: 0.6rem; border-radius: 8px; font-size: 0.8rem; outline: none; transition: border-color 0.2s; }
        .filter-group input:focus, .filter-group select:focus { border-color: var(--accent); }
        .feedback-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid var(--card-border); background: transparent; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
        .feedback-btn.positive:hover { background: rgba(16,185,129,0.1); border-color: #10b981; color: #10b981; }
        .feedback-btn.negative:hover { background: rgba(239,68,68,0.1); border-color: #ef4444; color: #ef4444; }
      `}} />
    </div>
  );
}
