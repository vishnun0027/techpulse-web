import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Activity, TrendingUp, HeartPulse, BarChart3, Clock, Users } from 'lucide-react';

export default function RadarView({ session }) {
  const [events, setEvents] = useState([]);
  const [sourceHealth, setSourceHealth] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Fetch top events
      const { data: eventData } = await supabase
        .from('article_events')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('last_updated', thirtyDaysAgo)
        .order('article_count', { ascending: false })
        .limit(10);
      
      setEvents(eventData || []);

      // 2. Fetch source health metrics
      const { data: healthData } = await supabase
        .from('source_health')
        .select('*, rss_sources(name)')
        .eq('user_id', session.user.id)
        .order('quality_score', { ascending: false });
      
      setSourceHealth(healthData || []);
      setLoading(false);
    }
    fetchData();
  }, [session]);

  if (loading) return <div className="p-8 opacity-50">Scanning the tech landscape...</div>;

  return (
    <div className="radar-view animate-in slide-in-from-bottom-6 duration-1000">
      <header style={{ marginBottom: '4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '12px', background: 'var(--accent-glow)', borderRadius: '16px', border: '1px solid var(--accent-glow)' }}>
            <Activity className="text-accent" size={32} strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>Tech Radar</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem', fontWeight: 500 }}>30D Intelligence Landscape</p>
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', lineHeight: 1.6 }}>
          Visualizing strategic trends and signal quality across your tech intelligence streams.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        {/* Top Events Cluster */}
        <section className="glass-panel" style={{ padding: '2.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <TrendingUp size={18} className="text-accent" />
            Strategic Clusters
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {events.length > 0 ? events.map((event) => (
              <div key={event.id} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {event.theme || 'SIGNAL'}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={10} /> {new Date(event.last_updated).toLocaleDateString()}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', lineHeight: 1.4 }}>{event.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1, h: '4px', height: '4px', background: 'var(--card-border)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        background: 'linear-gradient(90deg, var(--accent) 0%, #60a5fa 100%)', 
                        width: `${Math.min(100, (event.article_count / 15) * 100)}%`,
                        transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 0 10px var(--accent-glow)'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)', minWidth: '80px', textAlign: 'right' }}>
                    {event.article_count} Signals
                  </span>
                </div>
              </div>
            )) : (
              <div style={{ padding: '4rem 0', textAlign: 'center' }}>
                <Activity size={40} color="var(--card-border)" style={{ marginBottom: '1rem' }} />
                <p style={{ color: 'var(--text-muted)', italic: 'true' }}>Awaiting cluster synchronization...</p>
              </div>
            )}
          </div>
        </section>

        {/* Source Health Leaderboard */}
        <section className="glass-panel" style={{ padding: '2.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'white', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <HeartPulse size={18} className="text-semantic-danger" />
            Signal Integrity
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sourceHealth.length > 0 ? sourceHealth.map((source) => (
              <div key={source.source_id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '1rem 1.25rem', 
                background: 'hsla(0, 0%, 100%, 0.02)', 
                borderRadius: '16px', 
                border: '1px solid var(--card-border)',
                transition: 'var(--transition-smooth)'
              }} onMouseOver={e => e.currentTarget.style.borderColor='var(--card-border-hover)'} onMouseOut={e => e.currentTarget.style.borderColor='var(--card-border)'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '42px', 
                    height: '42px', 
                    background: 'var(--panel-top)', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 800, 
                    fontSize: '1rem', 
                    color: 'var(--accent)',
                    border: '1px solid var(--card-border)'
                  }}>
                    {source.rss_sources?.name?.[0].toUpperCase() || 'S'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'white' }}>{source.rss_sources?.name || 'Unknown Stream'}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><BarChart3 size={10} /> {source.articles_ingested}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Users size={10} /> {source.articles_clicked}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: source.quality_score > 0.7 ? 'var(--semantic-success)' : 'white' }}>
                    {(source.quality_score * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>QUALITY</div>
                </div>
              </div>
            )) : (
              <div style={{ padding: '4rem 0', textAlign: 'center' }}>
                <Activity size={40} color="var(--card-border)" style={{ marginBottom: '1rem' }} />
                <p style={{ color: 'var(--text-muted)', italic: 'true' }}>Establishing stream analytics...</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
