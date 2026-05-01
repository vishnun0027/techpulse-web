import { useState, useEffect } from 'react';
import { getPlatformIntelligence } from '../adminApi';
import { 
  X, Activity, Globe, Zap, Clock, Shield, 
  ArrowUpRight, AlertCircle, CheckCircle2, Search,
  BarChart3, PieChart, Layers
} from 'lucide-react';

export default function TenantInspector({ tenant, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const intel = await getPlatformIntelligence(tenant.user_id);
        setData(intel);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [tenant.user_id]);

  if (!tenant) return null;

  return (
    <div className="inspector-overlay fade-in">
      <div className="inspector-panel slide-up">
        {/* HEADER */}
        <div className="inspector-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="avatar">{tenant.full_name?.[0] || 'A'}</div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>{tenant.full_name || 'Anonymous'}</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>ID: {tenant.user_id}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="inspector-content">
          {loading ? (
            <div className="loader-container">
              <div className="animate-spin loader" />
              <span>Analyzing Node Intelligence...</span>
            </div>
          ) : error ? (
            <div className="error-panel">
              <AlertCircle size={32} />
              <p>{error}</p>
            </div>
          ) : (
            <div className="grid-layout">
              
              {/* LEFT COLUMN: SOURCE HEALTH */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <section className="glass-section">
                  <h3 className="section-title"><Globe size={14} /> Source Registry Health</h3>
                  <div className="source-list">
                    {data.sources?.map(source => (
                      <div key={source.id} className="source-item">
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{source.name}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{source.url}</div>
                        </div>
                        <div className="source-stats">
                          <div className="mini-stat">
                            <span className="label">Delivered</span>
                            <span className="value">{source.articles_delivered}</span>
                          </div>
                          <div className={`quality-badge ${source.quality_score > 0.7 ? 'high' : 'low'}`}>
                            {(source.quality_score * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!data.sources || data.sources.length === 0) && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem' }}>No active intelligence streams for this node.</p>
                    )}
                  </div>
                </section>

                <section className="glass-section">
                  <h3 className="section-title"><Activity size={14} /> Pipeline Performance</h3>
                  <div className="metrics-row">
                    <div className="metric-box">
                      <span className="label">Synthesis Rate</span>
                      <span className="value">{data.metrics?.totalArticles || 0}</span>
                    </div>
                    <div className="metric-box">
                      <span className="label">Avg Score</span>
                      <span className="value">{data.metrics?.avgScore?.toFixed(1) || '0.0'}</span>
                    </div>
                    <div className="metric-box">
                      <span className="label">Noise Floor</span>
                      <span className="value">{data.metrics?.noiseRatio || 0}%</span>
                    </div>
                  </div>
                </section>
              </div>

              {/* RIGHT COLUMN: RECENT INTELLIGENCE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <section className="glass-section" style={{ height: '100%' }}>
                  <h3 className="section-title"><Zap size={14} /> Recent Intelligence Synth</h3>
                  <div className="article-audit">
                    {data.recentArticles?.map(article => (
                      <div key={article.id} className="audit-item">
                        <div className="score-ribbon">{(article.score || 0).toFixed(1)}</div>
                        <div className="audit-details">
                          <div className="audit-title">{article.title}</div>
                          <div className="audit-meta">
                            <span className="tag">{article.source}</span>
                            <span className="time">{new Date(article.created_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!data.recentArticles || data.recentArticles.length === 0) && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '2rem' }}>No telemetry available for last 24h.</p>
                    )}
                  </div>
                </section>
              </div>

            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .inspector-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 1000; display: flex; align-items: flex-end; justify-content: center; }
        .inspector-panel { background: var(--bg-color); border: 1px solid var(--card-border); border-bottom: none; width: 100%; max-width: 1000px; height: 85vh; border-radius: 24px 24px 0 0; display: flex; flexDirection: column; overflow: hidden; box-shadow: 0 -20px 50px rgba(0,0,0,0.5); }
        .inspector-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; alignItems: center; background: rgba(255,255,255,0.01); }
        .avatar { width: 48px; height: 48px; background: var(--accent-glow); border: 1px solid var(--accent); border-radius: 14px; display: flex; alignItems: center; justify-content: center; font-size: 1.25rem; fontWeight: 900; color: #fff; }
        .close-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; transition: color 0.2s; }
        .close-btn:hover { color: #fff; }
        .inspector-content { padding: 2rem; flex: 1; overflow-y: auto; }
        .grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        .glass-section { background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 16px; padding: 1.25rem; }
        .section-title { font-size: 0.7rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; display: flex; alignItems: center; gap: 0.5rem; margin-bottom: 1.25rem; }
        .source-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .source-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid var(--card-border); border-radius: 10px; }
        .source-stats { display: flex; align-items: center; gap: 1rem; }
        .mini-stat { display: flex; flex-direction: column; align-items: flex-end; }
        .mini-stat .label { font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }
        .mini-stat .value { font-size: 0.8rem; font-weight: 900; }
        .quality-badge { font-size: 0.7rem; font-weight: 900; padding: 0.25rem 0.5rem; border-radius: 6px; background: rgba(255,255,255,0.05); }
        .quality-badge.high { color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
        .quality-badge.low { color: #f87171; border: 1px solid rgba(248,113,113,0.2); }
        .metrics-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
        .metric-box { background: rgba(255,255,255,0.03); border: 1px solid var(--card-border); padding: 1rem; border-radius: 12px; display: flex; flex-direction: column; gap: 0.25rem; }
        .metric-box .label { font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }
        .metric-box .value { font-size: 1.25rem; font-weight: 900; color: #fff; }
        .article-audit { display: flex; flex-direction: column; gap: 0.75rem; }
        .audit-item { position: relative; display: flex; gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.01); border: 1px solid var(--card-border); border-radius: 12px; overflow: hidden; }
        .score-ribbon { position: absolute; left: 0; top: 0; bottom: 0; width: 32px; background: var(--accent-glow); border-right: 1px solid var(--accent); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 900; color: #fff; }
        .audit-details { margin-left: 1.5rem; }
        .audit-title { font-size: 0.85rem; font-weight: 700; line-height: 1.4; margin-bottom: 0.4rem; }
        .audit-meta { display: flex; gap: 0.75rem; align-items: center; }
        .audit-meta .tag { font-size: 0.6rem; font-weight: 900; color: var(--accent); text-transform: uppercase; }
        .audit-meta .time { font-size: 0.6rem; color: var(--text-muted); }
        .loader-container { height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: var(--text-muted); font-size: 0.9rem; fontWeight: 600; }
        .loader { width: 32px; height: 32px; border: 3px solid var(--accent); border-top-color: transparent; border-radius: 50%; }
        .slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}} />
    </div>
  );
}
