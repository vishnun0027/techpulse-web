import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

// ── Context ────────────────────────────────────────────────────────────────────
const UserProfileContext = createContext(null);

// ── Feature gate definitions ───────────────────────────────────────────────────
// FEATURE_GATES = which roles can ACCESS a feature (page content / actions)
const FEATURE_GATES = {
  semanticSearch:    ['admin', 'auditor', 'premium'],
  webhookDelivery:   ['premium'],                   // Consumers only — admins have no personal articles
  bulkImport:        ['admin', 'premium'],
  inferenceRules:    ['admin', 'premium'],
  adminConsole:      ['admin', 'auditor'],
  assignRoles:       ['admin'],
  deleteUsers:       ['admin'],
  articleFeedback:   ['premium', 'user'],   // admin observes, doesn't train
};

// NAV_GATES = which roles see each nav link
// Operators (admin/auditor) manage the platform — no personal feeds/briefs/radar
const NAV_GATES = {
  dashboard:      ['admin', 'auditor', 'premium', 'user'], // all (different view per role)
  settings:       ['admin', 'auditor', 'premium', 'user'], // all (different tabs per role)
  morningBrief:   ['premium', 'user'],   // personal digest — operators have no pipeline
  semanticSearch: ['premium'],           // personal vector search — operators have no articles
  radar:          ['premium', 'user'],   // personal RSS signal — operators have no feeds
  adminConsole:   ['admin', 'auditor'],  // management panel
};

// RSS source limits per role
export const RSS_LIMITS = {
  admin:   Infinity,
  auditor: 0,         // auditors cannot add sources
  premium: 50,
  user:    5,
};

// ── Provider ───────────────────────────────────────────────────────────────────
export function UserProfileProvider({ session, children }) {
  const [profile, setProfile] = useState({
    role: 'user',
    fullName: '',
    email: '',
    loading: true,
  });

  useEffect(() => {
    async function loadProfile() {
      if (!session || !supabase) {
        setProfile(p => ({ ...p, loading: false }));
        return;
      }
      try {
        const { data, error } = await supabase
          .from('tenant_profiles')
          .select('role, full_name, email')
          .eq('user_id', session.user.id)
          .single();

        if (error) throw error;

        setProfile({
          role: data?.role ?? 'user',
          fullName: data?.full_name ?? session.user.user_metadata?.full_name ?? '',
          email: data?.email ?? session.user.email ?? '',
          loading: false,
        });
      } catch (err) {
        console.warn('UserProfileContext: failed to load profile:', err?.message);
        setProfile(p => ({ ...p, loading: false }));
      }
    }
    loadProfile();
  }, [session]);

  // ── Derived helpers ──────────────────────────────────────────────────────────
  const role     = profile.role;
  const isAdmin  = role === 'admin';
  const isAuditor = role === 'auditor';
  const isPremium = role === 'admin' || role === 'premium';  // admin has all premium perks

  /** Returns true if the current user's role can access a named feature (content gate). */
  function canAccess(featureName) {
    const allowed = FEATURE_GATES[featureName];
    if (!allowed) return true;
    return allowed.includes(role);
  }

  /** Returns true if the current user's role should see a nav link. */
  function canNav(navItem) {
    const allowed = NAV_GATES[navItem];
    if (!allowed) return true;
    return allowed.includes(role);
  }

  /** Returns the RSS source limit for the current role. */
  const rssLimit = RSS_LIMITS[role] ?? 5;

  /** Human-readable label for the current role. */
  const roleLabel = {
    admin:   '🛡️ Super Admin',
    auditor: '👁️ Auditor',
    premium: '⭐ Premium Member',
    user:    'Pro Member',
  }[role] ?? 'Pro Member';

  /** Short badge text (for nav, tables) */
  const roleBadge = {
    admin:   { text: '🛡️ Admin',   color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)' },
    auditor: { text: '👁️ Auditor', color: '#93c5fd', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)' },
    premium: { text: '⭐ Premium',  color: '#fcd34d', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)' },
    user:    { text: 'Standard',    color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.03)', border: 'var(--card-border)' },
  }[role] ?? { text: 'Standard', color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.03)', border: 'var(--card-border)' };

  const value = {
    ...profile,
    role,
    isAdmin,
    isAuditor,
    isPremium,
    canAccess,
    canNav,
    rssLimit,
    roleLabel,
    roleBadge,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error('useUserProfile must be used inside <UserProfileProvider>');
  return ctx;
}

// ── PremiumGate component ──────────────────────────────────────────────────────
// Renders an upgrade banner in place of locked premium features.
export function PremiumGate({ feature, description }) {
  return (
    <div style={{
      padding: '2rem',
      borderRadius: '16px',
      background: 'rgba(251,191,36,0.04)',
      border: '1px solid rgba(251,191,36,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
    }}>
      <div style={{
        fontSize: '2rem',
        width: '56px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '14px',
        background: 'rgba(251,191,36,0.08)',
        border: '1px solid rgba(251,191,36,0.2)',
        flexShrink: 0,
      }}>
        ⭐
      </div>
      <div>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>
          Premium Feature
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          {feature}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description ?? 'Upgrade to a Premium account to unlock this capability.'}
        </div>
      </div>
    </div>
  );
}
