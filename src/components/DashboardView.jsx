import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatDistanceToNow } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Database, Send, Radio, ShieldCheck, Zap, Activity as ActivityIcon, Search as SearchIcon, Filter } from 'lucide-react';

export default function DashboardView({ session }) {
  const [stats, setStats] = useState({ 
    collected: 0, 
    delivered: 0, 
    ready: 0, 
    sources: 0,
    noiseRatio: 0,
    avgScore: 0,
    sourceHealth: 0
  });
  const [articles, setArticles] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // feedback: { [article_id]: 'helpful' | 'skip' | 'saving' }
  const [feedback, setFeedback] = useState({});
  const [filteredCount, setFilteredCount] = useState(0);

  const [filters, setFilters] = useState({
    title: '',
    source: '',
    minScore: '',
    status: 'all',
    timeRange: 'all'
  });
  const [sourceOptions, setSourceOptions] = useState([]);

  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  // Debounce search filters to avoid excessive DB calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(1); // Reset to first page on filter change
    }, 400);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    async function fetchData() {
      // Setup date bounds for chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      // Fetch global stats, chart data, source list, and latest telemetry
      const [
        { count: collectedCount }, 
        { count: deliveredCount }, 
        { count: readyCount },
        { count: sourcesCount },
        { data: chartArticles },
        { data: rssSources },
        { data: latestCollector },
        { data: latestSummarizer }
      ] = await Promise.all([
        supabase.from('articles').select('*', { count: 'exact', head: true }),
        supabase.from('articles').select('*', { count: 'exact', head: true }).eq('is_delivered', true),
        supabase.from('articles').select('*', { count: 'exact', head: true }).eq('is_delivered', false).gte('score', 3.0),
        supabase.from('rss_sources').select('*', { count: 'exact', head: true }),
        supabase.from('articles').select('created_at').eq('is_delivered', true).gte('created_at', sevenDaysAgo.toISOString()),
        supabase.from('rss_sources').select('name, is_active').order('name'),
        supabase.from('telemetry').select('metrics').eq('service', 'collector').order('timestamp', { ascending: false }).limit(1),
        supabase.from('telemetry').select('metrics').eq('service', 'summarizer').order('timestamp', { ascending: false }).limit(1)
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
      setSourceOptions(Array.from(new Set((rssSources || []).map(s => s.name))));

      // Build Dynamic Query for Recent Intelligence
      let query = supabase.from('articles').select('*', { count: 'exact' });

      if (debouncedFilters.title) query = query.ilike('title', `%${debouncedFilters.title}%`);
      if (debouncedFilters.source) query = query.eq('source', debouncedFilters.source);
      if (debouncedFilters.minScore) query = query.gte('score', parseFloat(debouncedFilters.minScore));
      
      if (debouncedFilters.status === 'delivered') query = query.eq('is_delivered', true);
      if (debouncedFilters.status === 'pending') query = query.eq('is_delivered', false);

      if (debouncedFilters.timeRange !== 'all') {
        const since = new Date();
        if (debouncedFilters.timeRange === '24h') since.setHours(since.getHours() - 24);
        if (debouncedFilters.timeRange === '7d') since.setDate(since.getDate() - 7);
        if (debouncedFilters.timeRange === '30d') since.setDate(since.getDate() - 30);
        query = query.gte('created_at', since.toISOString());
      }

      const { data: recent, count: matches } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      setArticles(recent || []);
      setFilteredCount(matches || 0);

      // Build chart data
      const deliveryCounts = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        deliveryCounts[dayStr] = 0;
      }

      (chartArticles || []).forEach(a => {
        const d = new Date(a.created_at);
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        if (deliveryCounts[dayStr] !== undefined) {
          deliveryCounts[dayStr]++;
        }
      });

      setChartData(Object.keys(deliveryCounts).map(k => ({ name: k, delivered: deliveryCounts[k] })));
      setLoading(false);
    }
    fetchData();
  }, [session, page, debouncedFilters]);

  // ── Feedback Handlers ────────────────────────────────────────────────────

  async function submitFeedback(article, isHelpful) {
    if (!session?.user?.id || feedback[article.id]) return;
    setFeedback(f => ({ ...f, [article.id]: 'saving' }));
    try {
      await supabase.from('user_feedback').insert({
        user_id:    session.user.id,
        article_id: article.id,
        is_helpful: isHelpful,
      });
      setFeedback(f => ({ ...f, [article.id]: isHelpful ? 'helpful' : 'skip' }));
    } catch (err) {
      console.error('Feedback error:', err);
      setFeedback(f => ({ ...f, [article.id]: null }));
    }
  }

  async function trackArticleClick(article) {
    // Increment articles_clicked in source_health so quality_score learns
    // which sources produce content users actually read.
    if (!article.source_id || !session?.user?.id) return;
    await supabase.rpc('increment_source_click', {
      p_source_id: article.source_id,
      p_user_id:   session.user.id,
    }).catch(() => {});  // fire-and-forget, never block the user
  }



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* HIGH DENSITY OVERVIEW ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        
        {/* Core Stats */}
        <div className="glass-panel stat-card" style={{ borderLeftColor: 'var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="field-label" style={{ fontSize: '0.65rem' }}>Total Intelligence</span>
            <Database size={16} color="var(--accent)" opacity={0.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{loading ? '...' : stats.collected.toLocaleString()}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--semantic-success)', fontWeight: 700, background: 'var(--semantic-success-bg)', padding: '2px 6px', borderRadius: '4px' }}>
              +{stats.ready} new
            </span>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeftColor: 'var(--semantic-success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="field-label" style={{ fontSize: '0.65rem' }}>Delivered Insights</span>
            <Send size={16} color="var(--semantic-success)" opacity={0.5} />
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{loading ? '...' : stats.delivered.toLocaleString()}</span>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeftColor: 'var(--accent)', background: 'linear-gradient(135deg, hsla(217, 91%, 60%, 0.05) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="field-label" style={{ fontSize: '0.65rem' }}>Noise Reduction</span>
            <ShieldCheck size={16} color="var(--accent)" opacity={0.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)' }}>{loading ? '...' : stats.noiseRatio}%</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>FILTERED</span>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeftColor: 'var(--semantic-warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="field-label" style={{ fontSize: '0.65rem' }}>Avg Insight Score</span>
            <Zap size={16} color="var(--semantic-warning)" opacity={0.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--semantic-warning)' }}>{loading ? '...' : stats.avgScore}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>/ 5.0</span>
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeftColor: stats.sourceHealth > 90 ? 'var(--semantic-success)' : 'var(--semantic-warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="field-label" style={{ fontSize: '0.65rem' }}>Pipeline Health</span>
            <Radio size={16} color={stats.sourceHealth > 90 ? 'var(--semantic-success)' : 'var(--semantic-warning)'} opacity={0.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: stats.sourceHealth > 90 ? 'var(--semantic-success)' : 'var(--semantic-warning)' }}>{loading ? '...' : stats.sourceHealth}%</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>OPERATIONAL</span>
          </div>
        </div>
      </div>

      {/* COMPACT CHART & TRENDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '8px', background: 'var(--accent-glow)', borderRadius: '10px' }}>
                <ActivityIcon size={18} className="text-accent" />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.02em' }}>DELIVERY VELOCITY</h2>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
              7D Trend
            </div>
          </div>
          
          <div style={{ height: '120px', width: '100%', position: 'relative' }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px', backdropFilter: 'blur(4px)' }}
                  itemStyle={{ color: '#fff', padding: '0' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="delivered" 
                  stroke="var(--accent)" 
                  strokeWidth={2}
                  fill="url(#colorDelivered)" 
                  animationDuration={1500}
                />
                <defs>
                  <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '8px', background: 'hsla(0, 0%, 100%, 0.03)', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
              <SearchIcon size={18} className="text-secondary" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Recent Intelligence</h2>
          </div>
          <button 
            className="secondary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '10px' }}
            onClick={() => setFilters({ title: '', source: '', minScore: '', status: 'all', timeRange: 'all' })}
          >
            <Filter size={14} style={{ marginRight: '0.5rem' }} /> Clear Filters
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--card-border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div>
            <label className="field-label" style={{ fontSize: '0.65rem' }}>Title Search</label>
            <input 
              value={filters.title} 
              onChange={e => setFilters({...filters, title: e.target.value})}
              placeholder="Filter by title..." 
              style={{ marginBottom: 0, padding: '0.5rem 0.75rem' }} 
            />
          </div>
          <div>
            <label className="field-label" style={{ fontSize: '0.65rem' }}>Source</label>
            <select 
              value={filters.source} 
              onChange={e => setFilters({...filters, source: e.target.value})}
              style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'white', outline: 'none' }}
            >
              <option value="">All Sources</option>
              {sourceOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" style={{ fontSize: '0.65rem' }}>Min Score</label>
            <input 
              type="number" 
              step="0.1" 
              value={filters.minScore} 
              onChange={e => setFilters({...filters, minScore: e.target.value})}
              placeholder="0.0" 
              style={{ marginBottom: 0, padding: '0.5rem 0.75rem' }} 
            />
          </div>
          <div>
            <label className="field-label" style={{ fontSize: '0.65rem' }}>Status</label>
            <select 
              value={filters.status} 
              onChange={e => setFilters({...filters, status: e.target.value})}
              style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'white', outline: 'none' }}
            >
              <option value="all">All Status</option>
              <option value="delivered">Delivered</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label className="field-label" style={{ fontSize: '0.65rem' }}>Discovered</label>
            <select 
              value={filters.timeRange} 
              onChange={e => setFilters({...filters, timeRange: e.target.value})}
              style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'white', outline: 'none' }}
            >
              <option value="all">Anytime</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Discovered</th>
                <th>Source</th>
                <th>Title</th>
                <th>Score</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => {
                const fb = feedback[a.id];
                return (
                  <tr key={a.source_url}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </td>
                    <td>{a.source}</td>
                    <td style={{ maxWidth: '400px' }}>
                      <a
                        href={a.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="article-title-link"
                        onClick={() => trackArticleClick(a)}
                      >
                        {a.title}
                      </a>
                    </td>
                    <td>
                      <span className={`badge ${a.score >= 4 ? 'success' : 'info'}`}>
                        ⭐ {a.score.toFixed(1)}
                      </span>
                    </td>
                    <td>
                      {a.is_delivered ?
                        <span className="badge success">Delivered</span> :
                        <span className="badge warning">Pending</span>
                      }
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {fb === 'saving' && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>saving…</span>
                      )}
                      {fb === 'helpful' && (
                        <span className="badge success" style={{ fontSize: '0.7rem' }}>👍 Helpful</span>
                      )}
                      {fb === 'skip' && (
                        <span className="badge" style={{ fontSize: '0.7rem', opacity: 0.6 }}>👎 Skipped</span>
                      )}
                      {!fb && (
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            id={`feedback-helpful-${a.id}`}
                            onClick={() => submitFeedback(a, true)}
                            title="Mark as helpful — trains the ranker"
                            style={{
                              background: 'rgba(34,197,94,0.1)',
                              border: '1px solid rgba(34,197,94,0.3)',
                              borderRadius: '6px',
                              color: '#22c55e',
                              padding: '0.25rem 0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              transition: 'all 0.15s ease',
                              width: 'auto',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}
                          >
                            👍
                          </button>
                          <button
                            id={`feedback-skip-${a.id}`}
                            onClick={() => submitFeedback(a, false)}
                            title="Not relevant — trains the ranker"
                            style={{
                              background: 'rgba(239,68,68,0.08)',
                              border: '1px solid rgba(239,68,68,0.2)',
                              borderRadius: '6px',
                              color: '#ef4444',
                              padding: '0.25rem 0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              transition: 'all 0.15s ease',
                              width: 'auto',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                          >
                            👎
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {articles.length === 0 && !loading && (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No intelligence found</p>
                        <p style={{ fontSize: '0.875rem' }}>Add RSS sources in settings to begin collection.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--card-border)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filteredCount)} to {Math.min(page * PAGE_SIZE, filteredCount)} of {filteredCount} entries
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="secondary"
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1}
              style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            >
              Previous
            </button>
            <button 
              className="secondary"
              onClick={() => setPage(p => p + 1)} 
              disabled={page * PAGE_SIZE >= filteredCount}
              style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
