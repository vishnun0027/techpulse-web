import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';
import AuthView from './components/AuthView';
import DashboardLayout from './components/DashboardLayout';
import DashboardView from './components/DashboardView';
import SettingsView from './components/SettingsView';
import AdminView from './components/AdminView';
import MorningBriefView from './components/MorningBriefView';
import SemanticSearchView from './components/SemanticSearchView';
import RadarView from './components/RadarView';
import './index.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(null); // null=checking, true/false

  useEffect(() => {
    if (!supabase) {
      // Small timeout to avoid "setState in effect" warning during synchronous initialization
      setTimeout(() => setLoading(false), 0);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if the logged-in user has a tenant profile
  useEffect(() => {
    async function checkProfile() {
      if (!session || !supabase) {
        setHasProfile(null);
        return;
      }

      // NO BYPASS: Strictly check database for profile
      const { data } = await supabase
        .from('tenant_profiles')
        .select('user_id')
        .eq('user_id', session.user.id)
        .single();

      setHasProfile(!!data);
    }
    checkProfile();
  }, [session]);

  if (!supabase) {
    return (
      <div className="auth-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-color)' }}>
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', border: '1px solid var(--semantic-danger)', maxWidth: '500px' }}>
          <h1 style={{ color: 'var(--semantic-danger)', fontSize: '1.75rem', fontWeight: 900, marginBottom: '1rem' }}>Configuration Error</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>System credentials for TechPulse Intelligence remain unprovisioned. Please verify your environment configuration.</p>
          <code style={{ display: 'block', padding: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--semantic-danger)', border: '1px solid hsla(350, 89%, 60%, 0.1)' }}>VITE_SUPABASE_URL IS UNDEFINED</code>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="auth-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-glow)', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid var(--accent-glow)' }}>
            <div className="animate-spin" style={{ width: '24px', height: '24px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.02em' }}>Initializing Intelligence</h2>
        </div>
      </div>
    );
  }

  // User is logged in but has no tenant profile — block access
  if (session && hasProfile === false) {
    return (
      <div className="auth-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-color)' }}>
        <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 20px hsla(350, 89%, 60%, 0.2))' }}>🔒</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.75rem' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.75', marginBottom: '2rem', fontSize: '1rem' }}>
            The node <strong style={{ color: 'white' }}>{session.user.email}</strong> is not authenticated for this operational workspace.
          </p>
          <div style={{ padding: '1.25rem', background: 'var(--semantic-warning-bg)', borderRadius: '16px', border: '1px solid hsla(38, 92%, 50%, 0.1)', marginBottom: '2.5rem', textAlign: 'left' }}>
            <p style={{ color: 'var(--semantic-warning)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>System Status</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.5, fontWeight: 500 }}>Self-serve approval sequence is pending or the identity has been quarantined by an administrator.</p>
          </div>
          <button
            className="secondary"
            onClick={() => supabase.auth.signOut()}
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontWeight: 700 }}
          >
            Sign Out & Switch Identity
          </button>
        </div>
      </div>
    );
  }

  // Still checking profile
  if (session && hasProfile === null) {
    return (
      <div className="auth-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-color)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-glow)', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid var(--accent-glow)' }}>
            <div className="animate-pulse" style={{ width: '24px', height: '24px', background: 'var(--accent)', borderRadius: '5px' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.02em' }}>Authenticating Node</h2>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {!session ? (
          <>
            <Route path="/auth" element={<AuthView />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </>
        ) : (
          <Route element={<DashboardLayout session={session} />}>
            <Route path="/" element={<DashboardView session={session} />} />
            <Route path="/settings" element={<SettingsView session={session} />} />
            <Route path="/admin" element={<AdminView session={session} />} />
            <Route path="/brief" element={<MorningBriefView session={session} />} />
            <Route path="/search" element={<SemanticSearchView session={session} />} />
            <Route path="/radar" element={<RadarView session={session} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

export default App;
