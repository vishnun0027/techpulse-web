import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { invokeAdminFunction } from '../adminApi';
import { useUserProfile } from '../context/UserProfileContext';
import { Newspaper, ChevronRight, ThumbsUp, ThumbsDown, Bookmark, ExternalLink, Zap, Globe, Users } from 'lucide-react';

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
        const { data } = await supabase
          .from('articles')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('v2_processed', true)
          .order('score', { ascending: false })
          .limit(20);

        if (data) {
          const grouped = data.reduce((acc, art) => {
            const theme = art.topics?.[0] || '📡 Quiet Signals';
            if (!acc[theme]) acc[theme] = [];
            acc[theme].push(art);
            return acc;
          }, {});
          setDigest({
            intro: "Here's your personal tech intelligence briefing for today.",
            sections: grouped,
            breaking: data.filter(a => a.score >= 8.0)
          });
        }
      }
      setLoading(false);
    }
    fetchDigest();
  }, [canViewPlatformReport, session]);

  const handleFeedback = async (articleId, signal) => {
    await supabase.from('user_feedback').insert({
      user_id: session.user.id,
      article_id: articleId,
      signal: signal
    });
    // Add toast or UI feedback here
  };

  if (loading) return <div className="p-8 opacity-50">Loading briefing...</div>;

  if (error) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--semantic-danger)' }}>{error}</div>;
  }

  // ── ADMIN: System Delivery Report ─────────────────────────────────────────
  if (canViewPlatformReport && adminReport) {
    const { byTenant, tenantMap } = adminReport;
    const tenantIds = Object.keys(byTenant);
    const totalDelivered = tenantIds.reduce((s, id) => s + byTenant[id].delivered, 0);
    const totalArticles  = tenantIds.reduce((s, id) => s + byTenant[id].total, 0);

    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '2rem', borderRadius: '20px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <Globe size={28} color="#93c5fd" />
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>System Delivery Report</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.25rem' }}>Morning Brief — All Tenants</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {tenantIds.length} active tenants · {totalDelivered} of {totalArticles} articles delivered
            </p>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {tenantIds.map(uid => {
            const t = tenantMap[uid] || {};
            const stats = byTenant[uid];
            const pct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
            const roleColour = { admin: '#6ee7b7', auditor: '#93c5fd', premium: '#fcd34d', user: 'var(--text-muted)' }[t.role] || 'var(--text-muted)';
            return (
              <div key={uid} className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{t.full_name || 'Anonymous'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.email || uid.slice(0, 12) + '…'}</div>
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.45rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)', color: roleColour }}>
                    {t.role || 'user'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '0.75rem', borderRadius: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6ee7b7' }}>{stats.delivered}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivered</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '0.75rem', borderRadius: '10px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fcd34d' }}>{stats.pending}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending</div>
                  </div>
                </div>
                <div style={{ height: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), #6ee7b7)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>{pct}% delivery rate</div>
              </div>
            );
          })}
        </div>

        {tenantIds.length === 0 && (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>No tenant activity found.</p>
          </div>
        )}
      </div>
    );
  }

  // ── REGULAR USER: Personal Briefing ───────────────────────────────────────
  if (!digest || Object.keys(digest.sections).length === 0) return <div className="p-8 text-center text-muted">No briefing available. Run the pipeline to generate one.</div>;

  return (
    <div className="brief-container animate-in fade-in duration-700" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', background: 'var(--accent-glow)', padding: '10px 20px', borderRadius: '100px', border: '1px solid var(--accent-glow)' }}>
          <Newspaper size={20} className="text-accent" />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Intelligence Briefing</span>
        </div>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '1.5rem', lineHeight: 1.1 }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto' }}>
          {digest.intro}
        </p>
      </header>

      {digest.breaking.length > 0 && (
        <section style={{ marginBottom: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--semantic-danger)', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            <Zap size={14} fill="currentColor" />
            <span>CRITICAL UPDATES</span>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {digest.breaking.map(art => (
              <div key={art.id} className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid var(--semantic-danger)', background: 'linear-gradient(90deg, hsla(350, 89%, 60%, 0.05) 0%, transparent 100%)' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>{art.title}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '1rem' }}>{art.summary}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="badge danger">Urgent Coverage</span>
                  <a href={art.source_url} target="_blank" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    View Full Intelligence <ExternalLink size={14} className="text-accent" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gap: '4rem' }}>
        {Object.entries(digest.sections).map(([theme, articles]) => (
          <section key={theme}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              <span style={{ color: 'var(--accent)' }}>//</span> {theme}
              <div style={{ flex: 1, height: '1px', background: 'var(--card-border)' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>{articles.length} signals detected</span>
            </h2>
            <div style={{ display: 'grid', gap: '2.5rem' }}>
              {articles.map(art => (
                <div key={art.id} style={{ position: 'relative' }}>
                  <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)' }}>{art.source}</span>
                    <span style={{ color: 'var(--card-border)' }}>|</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {new Date(art.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    {art.novelty_score > 0.8 && (
                      <span className="badge success" style={{ fontSize: '0.6rem', padding: '0 8px' }}>High Novelty</span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'white' }}>
                    <a href={art.source_url} target="_blank" rel="noreferrer" className="article-title-link" style={{ fontSize: '1.25rem' }}>{art.title}</a>
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>{art.summary}</p>
                  
                  {art.why_it_matters && (
                    <div style={{ 
                      background: 'hsla(0, 0%, 100%, 0.03)', 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      fontSize: '0.85rem', 
                      lineHeight: 1.6, 
                      border: '1px solid var(--card-border)', 
                      marginBottom: '1.5rem',
                      color: 'var(--text-secondary)'
                    }}>
                      <div style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Why it matters</div>
                      {art.why_it_matters}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <button onClick={() => handleFeedback(art.id, 'more_like_this')} title="More like this" style={{ background: 'transparent', padding: 0, color: 'var(--text-muted)', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='var(--accent)'} onMouseOut={e => e.currentTarget.style.color='var(--text-muted)'}>
                      <ThumbsUp size={16} />
                    </button>
                    <button onClick={() => handleFeedback(art.id, 'less_like_this')} title="Less like this" style={{ background: 'transparent', padding: 0, color: 'var(--text-muted)', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='var(--semantic-danger)'} onMouseOut={e => e.currentTarget.style.color='var(--text-muted)'}>
                      <ThumbsDown size={16} />
                    </button>
                    <button onClick={() => handleFeedback(art.id, 'saved')} title="Save" style={{ marginLeft: 'auto', background: 'transparent', padding: 0, color: 'var(--text-muted)', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='var(--accent)'} onMouseOut={e => e.currentTarget.style.color='var(--text-muted)'}>
                      <Bookmark size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
