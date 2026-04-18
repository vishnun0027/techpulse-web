import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';
import AuthView from './components/AuthView';
import DashboardLayout from './components/DashboardLayout';
import DashboardView from './components/DashboardView';
import SettingsView from './components/SettingsView';
import AdminView from './components/AdminView';
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

      // Admin email bypass — always has access
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
      if (adminEmail && session.user.email === adminEmail) {
        setHasProfile(true);
        return;
      }

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
      <div className="auth-wrapper">
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', border: '1px solid var(--semantic-danger)' }}>
          <h1 style={{ color: 'var(--semantic-danger)', fontSize: '1.5rem', marginBottom: '1rem' }}>Configuration Error</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Missing project credentials in <code>.env</code> file.</p>
          <code style={{ display: 'block', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.8rem' }}>VITE_SUPABASE_URL is undefined</code>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="auth-wrapper">Loading TechPulse AI...</div>;
  }

  // User is logged in but has no tenant profile — block access
  if (session && hasProfile === false) {
    return (
      <div className="auth-wrapper">
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem', opacity: 0.8 }}>🔒</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1rem' }}>
            The account <strong style={{ color: 'var(--text-primary)' }}>{session.user.email}</strong> is not authorized for this workspace.
          </p>
          <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)', marginBottom: '2rem' }}>
            <p style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600 }}>System Note:</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Self-serve approval is pending or account has been deactivated by an admin.</p>
          </div>
          <button
            className="secondary"
            onClick={() => supabase.auth.signOut()}
            style={{ width: '100%', padding: '0.75rem' }}
          >
            Sign Out & Switch Account
          </button>
        </div>
      </div>
    );
  }

  // Still checking profile
  if (session && hasProfile === null) {
    return <div className="auth-wrapper">Verifying access...</div>;
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </Router>
  );
}

export default App;
