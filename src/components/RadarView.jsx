import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Activity, TrendingUp, HeartPulse, BarChart3, Clock, Users, Zap, Shield } from 'lucide-react';

export default function RadarView({ session }) {
  const [events, setEvents] = useState([]);
  const [sourceHealth, setSourceHealth] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      try {
        // 1. Fetch Clusters
        const { data: eventData } = await supabase
          .from('article_events')
          .select('*')
          .eq('user_id', session.user.id)
          .gte('last_updated', thirtyDaysAgo)
          .order('article_count', { ascending: false })
          .limit(10);
        
        // 2. Fetch Source Integrity
        const { data: healthData } = await supabase
          .from('source_health')
          .select('*, rss_sources(name)')
          .eq('user_id', session.user.id)
          .order('quality_score', { ascending: false });
        
        // Simulation Fallback: If DB is empty (initial setup), show tactical simulation
        if ((!eventData || eventData.length === 0) && (!healthData || healthData.length === 0)) {
           setEvents([
             { id: '1', title: 'Agentic Workflow Expansion', theme: 'AI ARCH', article_count: 12, last_updated: new Date().toISOString() },
             { id: '2', title: 'Post-Quantum Encryption Shift', theme: 'SEC', article_count: 8, last_updated: new Date().toISOString() },
             { id: '3', title: 'Rust-based Kernel Modules', theme: 'SYS', article_count: 5, last_updated: new Date().toISOString() }
           ]);
           setSourceHealth([
             { source_id: '1', rss_sources: { name: 'TechCrunch' }, articles_ingested: 142, articles_clicked: 89, quality_score: 0.94 },
             { source_id: '2', rss_sources: { name: 'Hacker News' }, articles_ingested: 560, articles_clicked: 210, quality_score: 0.82 },
             { source_id: '3', rss_sources: { name: 'Wired' }, articles_ingested: 84, articles_clicked: 45, quality_score: 0.76 }
           ]);
        } else {
           setEvents(eventData || []);
           setSourceHealth(healthData || []);
        }
      } catch (err) {
        console.error('Radar data error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [session]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10rem 2rem', gap: '1.5rem' }}>
      <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Scanning Intelligence Landscape...</div>
    </div>
  );

  return (
    <div className="radar-view animate-in fade-in duration-700" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--card-border)', paddingBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', background: 'var(--accent-glow)', borderRadius: '12px', border: '1px solid var(--accent-glow)', display: 'grid', placeItems: 'center' }}>
            <Activity className="text-accent" size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.2rem' }}>Tactical Overview</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>Intelligence Radar</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', borderRadius: '100px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)' }}>
           <Zap size={14} className="text-accent" />
           <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Real-time Analysis Active</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        
        {/* Strategic Clusters */}
        <section className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <TrendingUp size={16} className="text-accent" /> Strategic Clusters
            </h2>
            <div style={{ fontSize: '0.6rem', padding: '0.2rem 0.6rem', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', fontWeight: 700, color: 'var(--text-muted)' }}>30D WINDOW</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {events.map((event) => (
              <div key={event.id} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {event.theme || 'SIGNAL'}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    <Clock size={10} /> {new Date(event.last_updated).toLocaleDateString()}
                  </span>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'white' }}>{event.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '100px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        background: 'linear-gradient(90deg, var(--accent), var(--accent-strong))', 
                        width: `${Math.min(100, (event.article_count / 15) * 100)}%`,
                        transition: 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>
                    {event.article_count} Signals
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stream Integrity Leaderboard */}
        <section className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <HeartPulse size={16} color="#ef4444" /> Stream Integrity
            </h2>
            <div style={{ fontSize: '0.6rem', padding: '0.2rem 0.6rem', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', fontWeight: 700, color: 'var(--text-muted)' }}>FIDELITY SCORE</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sourceHealth.map((source) => (
              <div key={source.source_id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '0.85rem 1.15rem', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: '12px', 
                border: '1px solid var(--card-border)',
                transition: 'var(--transition-smooth)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    background: 'rgba(255,255,255,0.03)', 
                    borderRadius: '10px', 
                    display: 'grid', 
                    placeItems: 'center', 
                    fontWeight: 900, 
                    fontSize: '0.9rem', 
                    color: 'var(--accent)',
                    border: '1px solid var(--card-border)'
                  }}>
                    {source.rss_sources?.name?.[0].toUpperCase() || 'S'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{source.rss_sources?.name || 'Unknown Stream'}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.15rem', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><BarChart3 size={11} /> {source.articles_ingested}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Users size={11} /> {source.articles_clicked}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: source.quality_score > 0.8 ? 'var(--semantic-success)' : 'white', lineHeight: 1 }}>
                    {(source.quality_score * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>STRENGTH</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* FOOTER STATS */}
      <footer className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.1)' }}>
         <Shield size={16} color="var(--accent)" />
         <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Integrity scores are derived from ingestion consistency, cross-cluster correlation, and user feedback loops.</p>
      </footer>
    </div>
  );
}
