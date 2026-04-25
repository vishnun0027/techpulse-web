import { useState } from 'react';
import { supabase } from '../supabase';
import { Search, Loader2, Sparkles, ExternalLink, Calendar } from 'lucide-react';

export default function SemanticSearchView({ session }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get embedding via Supabase Edge Function
      const { data: embeddingData, error: embedError } = await supabase.functions.invoke('embed', {
        body: { text: query }
      });

      if (embedError) throw new Error('Failed to generate embedding. Ensure the "embed" Edge Function is deployed.');

      // Step 2: Semantic search via RPC
      const { data, error: searchError } = await supabase.rpc('match_articles', {
        query_embedding:  embeddingData.embedding,
        match_threshold:  0.65,
        match_count:      12,
        p_user_id:        session.user.id
      });

      if (searchError) throw searchError;
      setResults(data || []);
    } catch (err) {
      console.error('Semantic search error:', err);
      setError(err.message);
      
      // Fallback: simple keyword search
      const { data } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', session.user.id)
        .ilike('title', `%${query}%`)
        .limit(10);
      setResults(data || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-view animate-in fade-in duration-1000" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'hsla(38, 92%, 50%, 0.1)', padding: '8px 16px', borderRadius: '100px', border: '1px solid hsla(38, 92%, 50%, 0.2)', marginBottom: '1.5rem' }}>
          <Sparkles size={14} className="text-semantic-warning" />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--semantic-warning)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Neural Search Active</span>
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1rem' }}>Ask TechPulse</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Query your intelligence archive by meaning and context.</p>
      </header>

      <form onSubmit={handleSearch} style={{ marginBottom: '5rem' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., 'Transformer risk mitigation' or 'Next-gen LLM architectural shifts'"
            style={{ 
              width: '100%', 
              background: 'hsla(0, 0%, 100%, 0.03)', 
              border: '1px solid var(--card-border)', 
              padding: '1.5rem 1.5rem 1.5rem 4rem', 
              borderRadius: '24px', 
              fontSize: '1.25rem', 
              color: 'white',
              boxShadow: '0 20px 40px -10px rgba(0,0,0,0.4)',
              transition: 'var(--transition-smooth)'
            }}
            onFocus={e => e.currentTarget.style.borderColor='var(--accent)'}
            onBlur={e => e.currentTarget.style.borderColor='var(--card-border)'}
          />
          <div style={{ position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>
            <Search size={24} />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              position: 'absolute', 
              right: '0.75rem', 
              top: '50%', 
              transform: 'translateY(-50%)',
              padding: '0.75rem 1.5rem',
              borderRadius: '16px',
              fontSize: '0.9rem',
              fontWeight: 700
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Ask AI'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: '1.5rem', padding: '0.75rem 1.25rem', background: 'var(--semantic-danger-bg)', borderRadius: '12px', border: '1px solid hsla(350, 89%, 60%, 0.1)', color: 'var(--semantic-danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             ⚠️ {error} (Used keyword fallback)
          </div>
        )}
      </form>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {results.length > 0 ? (
          results.map((art) => (
            <div key={art.id} className="glass-panel hoverable" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>
                    <Calendar size={12}/> {new Date(art.published_at || art.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: 800, 
                    color: art.similarity > 0.8 ? 'var(--accent)' : 'var(--text-muted)', 
                    background: art.similarity > 0.8 ? 'var(--accent-glow)' : 'hsla(0,0%,100%,0.05)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    {art.similarity ? `${(art.similarity * 100).toFixed(0)}% MATCH` : 'KEYWORD'}
                  </div>
                </div>
                <a href={art.source_url} target="_blank" style={{ color: 'var(--text-muted)', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='white'} onMouseOut={e => e.currentTarget.style.color='var(--text-muted)'}>
                  <ExternalLink size={18} />
                </a>
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', lineHeight: 1.3 }}>{art.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>{art.summary}</p>
              
              {art.why_it_matters && (
                <div style={{ background: 'hsla(0, 0%, 100%, 0.03)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Strategic Insight</div>
                  <p style={{ color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.5 }}>{art.why_it_matters}</p>
                </div>
              )}
            </div>
          ))
        ) : !loading && query && (
          <div style={{ padding: '5rem 0', textAlign: 'center', opacity: 0.3 }}>
            <Search size={48} strokeWidth={1} style={{ marginBottom: '1rem' }} />
            <p style={{ fontSize: '1.25rem', fontWeight: 500 }}>No intelligence signals discovered.</p>
          </div>
        )}
      </div>
    </div>
  );
}
