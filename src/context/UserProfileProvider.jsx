import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { UserProfileContext } from './UserProfileContext';
import { 
  PERMISSIONS, 
  ROLE_PERMISSIONS, 
  FEATURE_PERMISSIONS, 
  NAV_PERMISSIONS, 
  RSS_LIMITS 
} from '../constants';

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
  const role      = profile.role;
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.user;
  const isAdmin   = role === 'admin' || role === 'owner';
  const isAuditor = role === 'auditor';
  const isPremium = role === 'premium' || role === 'premium_member';

  function hasPermission(permission) {
    return permissions.includes(permission);
  }

  function hasAnyPermission(requiredPermissions = []) {
    if (requiredPermissions.length === 0) return true;
    return requiredPermissions.some(hasPermission);
  }

  /** Returns true if the current user's role can access a named feature (content gate). */
  function canAccess(featureName) {
    return hasAnyPermission(FEATURE_PERMISSIONS[featureName] ?? []);
  }

  /** Returns true if the current user's role should see a nav link. */
  function canNav(navItem) {
    return hasAnyPermission(NAV_PERMISSIONS[navItem] ?? []);
  }

  /** Returns the RSS source limit for the current role. */
  const rssLimit = RSS_LIMITS[role] ?? 5;

  /** Human-readable label for the current role. */
  const roleLabel = {
    admin:   '🛡️ Super Admin',
    owner:   '🛡️ Owner',
    operator: '🧭 Operator',
    auditor: '👁️ Auditor',
    premium: '⭐ Premium Member',
    premium_member: '⭐ Premium Member',
    member:  'Pro Member',
    user:    'Pro Member',
  }[role] ?? 'Pro Member';

  /** Short badge text (for nav, tables) */
  const roleBadge = {
    admin:   { text: '🛡️ Admin',   color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)' },
    owner:   { text: '🛡️ Owner',   color: '#6ee7b7', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)' },
    operator:{ text: '🧭 Operator', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
    auditor: { text: '👁️ Auditor', color: '#93c5fd', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)' },
    premium: { text: '⭐ Premium',  color: '#fcd34d', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)' },
    premium_member: { text: '⭐ Premium',  color: '#fcd34d', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)' },
    member:  { text: 'Standard',    color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.03)', border: 'var(--card-border)' },
    user:    { text: 'Standard',    color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.03)', border: 'var(--card-border)' },
  }[role] ?? { text: 'Standard', color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.03)', border: 'var(--card-border)' };

  const value = {
    ...profile,
    role,
    isAdmin,
    isAuditor,
    isPremium,
    permissions,
    hasPermission,
    hasAnyPermission,
    canAccess,
    canNav,
    rssLimit,
    roleLabel,
    roleBadge,
    permissionKeys: PERMISSIONS,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
