import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { invokeAdminFunction } from '../adminApi';
import { useUserProfile } from '../context/UserProfileContext';
import { Newspaper, ChevronRight, ThumbsUp, ThumbsDown, Bookmark, ExternalLink, Zap, Globe, Users, Clock, Sparkles } from 'lucide-react';

export default function MorningBriefView({ session }) {
  const { hasPermission } = useUserProfile();
  const canViewPlatformReport = hasPermission('platform.reports.view');
  const [digest, setDigest] = useState(null);
  const [adminReport, setAdminReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDigest() {
      setLoading(true);
      setError(null);

      if (canViewPlatformReport) {
        try {
          const data = await invokeAdminFunction('admin-get-brief-report', {
            userId: session.user.id,
          });
          setAdminReport(data.adminReport ?? { byTenant: {}, tenantMap: {} });
        } catch (err) {
          setError(err.message || String(err));
        }
      } else {
        // Regular user personal briefing
        try {
          const { data } = await supabase
            .from('articles')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('v2_processed', true)
            .order('score', { ascending: false })
            .limit(20);

          if (data && data.length > 0) {
            const grouped = data.reduce((acc, art) => {
              const theme = art.topics?.[0] || '📡 Signals';
              if (!acc[theme]) acc[theme] = [];
              acc[theme].push(art);
              return acc;
            }, {});
            setDigest({
              intro: "Automated synthesis of your active intelligence streams.",
              sections: grouped,
              breaking: data.filter(a => a.score >= 8.5)
            });
          } else {
            // Simulation Fallback for empty feeds
            setDigest({
              intro: "Simulation: tactical intelligence projection.",
              sections: {
                "Neural Architectures": [
                  { id: 'sim1', source: 'arXiv', title: 'Sparse MoE Scaling Laws in Transformer Blocks', summary: 'New research indicating a 40% reduction in inference compute while maintaining parameter efficiency through localized routing.', score: 9.2, novelty_score: 0.95, why_it_matters: 'Drastically lowers the barrier for edge deployment of multi-billion parameter models.' },
                  { id: 'sim2', source: 'Hacker News', title: 'DSPy: Programming over String-based Prompting', summary: 'The shift from manual prompt engineering to declarative programmatic optimization for LLM pipelines gaining significant traction.', score: 8.4, novelty_score: 0.82 }
                ],
                "Security & Privacy": [
                  { id: 'sim3', source: 'SecurityWeek', title: 'Side-channel vulnerabilities in Apple Silicon M-series', summary: 'Detailed analysis of data-dependent memory prefetchers that can leak cryptographic keys under specific load conditions.', score: 7.8, novelty_score: 0.88, why_it_matters: 'Requires kernel-level software mitigations that may impact system-wide memory performance.' }
                ]
              },
              breaking: [
                { id: 'sim1', source: 'arXiv', title: 'Sparse MoE Scaling Laws in Transformer Blocks', summary: 'New research indicating a 40% reduction in inference compute while maintaining parameter efficiency through localized routing.', score: 9.2, novelty_score: 0.95, why_it_matters: 'Drastically lowers the barrier for edge deployment of multi-billion parameter models.' }
              ]
            });
          }
        } catch (e) {
          console.error('Digest fetch error:', e);
        }
      }
      setLoading(false);
    }
    fetchDigest();
  }, [canViewPlatformReport, session]);

  const handleFeedback = async (articleId, signal) => {
    // In simulation, we just mock the success
    if (articleId.startsWith('sim')) return;
    await supabase.from('user_feedback').insert({
      user_id: session.user.id,
      article_id: articleId,
      signal: signal === 'more_like_this' ? 'more_like_this' : signal === 'less_like_this' ? 'less_like_this' : 'saved'
    });
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10rem 2rem', gap: '1rem' }}>
      <div className="animate-spin" style={{ width: '28px', height: '28px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Synthesizing Signals...</div>
    </div>
  );

  if (error) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--semantic-danger)', fontSize: '0.85rem' }}>{error}</div>;

  // ── ADMIN: Fleet Intelligence ──────────────────────────────────────────
  if (canViewPlatformReport && adminReport) {
    const { byTenant, tenantMap } = adminReport;
    const tenantIds = Object.keys(byTenant);
    const totalDelivered = tenantIds.reduce((s, id) => s + byTenant[id].delivered, 0);

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <header className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--accent-glow)', display: 'grid', placeItems: 'center' }}>
            <Globe size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: '0.55rem', fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Global Command</div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Morning Briefing Status</h1>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{totalDelivered} Signals</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>DELIVERED TODAY</div>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {tenantIds.map(uid => {
            const t = tenantMap[uid] || {};
            const stats = byTenant[uid];
            const pct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
            return (
              <div key={uid} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.full_name || 'Anonymous'}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{t.role?.toUpperCase()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>{stats.delivered}</div>
                    <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>DELIVERED</div>
                  </div>
                </div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.03)', borderRadius: '100px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', transition: 'width 1s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── USER: Personal Intelligence Brief ─────────────────────────────────────
  return (
    <div className="brief-view animate-in fade-in duration-700" style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      
      <header style={{ textAlign: 'center', paddingTop: '1rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.8rem', borderRadius: '100px', border: '1px solid var(--card-border)' }}>
          <Clock size={12} color="var(--accent)" />
          <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
          </span>
        </div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.04em' }}>Morning Brief</h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{digest.intro}</p>
      </header>

      {digest.breaking.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: 'var(--semantic-danger)', fontWeight: 900, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            <Zap size={14} fill="currentColor" /> CRITICAL SIGNALS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {digest.breaking.map(art => (
              <div key={art.id} className="glass-panel" style={{ padding: '1.5rem', borderLeft: '3px solid var(--semantic-danger)', background: 'linear-gradient(90deg, rgba(239,68,68,0.03) 0%, transparent 100%)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.75rem', lineHeight: 1.3 }}>{art.title}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem', lineHeight: 1.5 }}>{art.summary}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge danger" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>URGENT</span>
                  <a href={art.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'white' }}>
                    OPEN INTEL <ExternalLink size={12} className="text-accent" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
        {Object.entries(digest.sections).map(([theme, articles]) => (
          <section key={theme}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              <span style={{ color: 'var(--accent)' }}>/</span> {theme}
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {articles.map(art => (
                <div key={art.id} className="brief-item">
                  <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent)' }}>{art.source.toUpperCase()}</span>
                    {art.novelty_score > 0.8 && (
                      <span style={{ fontSize: '0.55rem', fontWeight: 900, background: 'var(--semantic-success-bg)', color: 'var(--semantic-success)', padding: '1px 5px', borderRadius: '4px' }}>NOVEL</span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem', lineHeight: 1.3 }}>
                    <a href={art.source_url} target="_blank" rel="noreferrer" style={{ color: 'white', textDecoration: 'none' }}>{art.title}</a>
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>{art.summary}</p>
                  
                  {art.why_it_matters && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--card-border)', marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                       <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Significance</div>
                       {art.why_it_matters}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => handleFeedback(art.id, 'more_like_this')} style={{ background: 'transparent', padding: '0.4rem', color: 'var(--text-muted)' }} onMouseOver={e => e.currentTarget.style.color='var(--accent)'} onMouseOut={e => e.currentTarget.style.color='var(--text-muted)'}><ThumbsUp size={14} /></button>
                      <button onClick={() => handleFeedback(art.id, 'less_like_this')} style={{ background: 'transparent', padding: '0.4rem', color: 'var(--text-muted)' }} onMouseOver={e => e.currentTarget.style.color='var(--semantic-danger)'} onMouseOut={e => e.currentTarget.style.color='var(--text-muted)'}><ThumbsDown size={14} /></button>
                    </div>
                    <button onClick={() => handleFeedback(art.id, 'saved')} style={{ marginLeft: 'auto', background: 'transparent', padding: '0.4rem', color: 'var(--text-muted)' }} onMouseOver={e => e.currentTarget.style.color='var(--accent)'} onMouseOut={e => e.currentTarget.style.color='var(--text-muted)'}><Bookmark size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer style={{ textAlign: 'center', padding: '4rem 0', opacity: 0.3 }}>
        <Sparkles size={24} style={{ marginBottom: '1rem' }} />
        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>End of Briefing</p>
      </footer>
    </div>
  );
}
