import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

// ── Context ────────────────────────────────────────────────────────────────────
const UserProfileContext = createContext(null);

// ── Permission model ───────────────────────────────────────────────────────────
const PERMISSIONS = {
  platformAccess: 'platform.access',
  platformMetricsView: 'platform.metrics.view',
  platformTenantsView: 'platform.tenants.view',
  platformTenantsManage: 'platform.tenants.manage',
  platformRolesAssign: 'platform.roles.assign',
  platformUsersDelete: 'platform.users.delete',
  platformReportsView: 'platform.reports.view',
  workspaceDashboardView: 'workspace.dashboard.view',
  workspaceSettingsView: 'workspace.settings.view',
  workspaceSourcesView: 'workspace.sources.view',
  workspaceSourcesCreate: 'workspace.sources.create',
  workspaceSourcesUpdate: 'workspace.sources.update',
  workspaceSourcesDelete: 'workspace.sources.delete',
  workspaceSourcesBulkImport: 'workspace.sources.bulk_import',
  workspaceRulesView: 'workspace.rules.view',
  workspaceRulesManage: 'workspace.rules.manage',
  workspaceSearchUse: 'workspace.search.use',
  workspaceRadarView: 'workspace.radar.view',
  workspaceBriefView: 'workspace.brief.view',
  workspaceFeedbackSubmit: 'workspace.feedback.submit',
  workspaceWebhooksManage: 'workspace.webhooks.manage',
};

const ROLE_PERMISSIONS = {
  owner: Object.values(PERMISSIONS),
  admin: Object.values(PERMISSIONS),
  operator: [
    PERMISSIONS.platformAccess,
    PERMISSIONS.platformMetricsView,
    PERMISSIONS.platformTenantsView,
    PERMISSIONS.platformTenantsManage,
    PERMISSIONS.platformReportsView,
  ],
  auditor: [
    PERMISSIONS.platformAccess,
    PERMISSIONS.platformMetricsView,
    PERMISSIONS.platformTenantsView,
    PERMISSIONS.platformReportsView,
  ],
  premium_member: [
    PERMISSIONS.workspaceDashboardView,
    PERMISSIONS.workspaceSettingsView,
    PERMISSIONS.workspaceSourcesView,
    PERMISSIONS.workspaceSourcesCreate,
    PERMISSIONS.workspaceSourcesUpdate,
    PERMISSIONS.workspaceSourcesDelete,
    PERMISSIONS.workspaceSourcesBulkImport,
    PERMISSIONS.workspaceRulesView,
    PERMISSIONS.workspaceRulesManage,
    PERMISSIONS.workspaceSearchUse,
    PERMISSIONS.workspaceRadarView,
    PERMISSIONS.workspaceBriefView,
    PERMISSIONS.workspaceFeedbackSubmit,
    PERMISSIONS.workspaceWebhooksManage,
  ],
  premium: [
    PERMISSIONS.workspaceDashboardView,
    PERMISSIONS.workspaceSettingsView,
    PERMISSIONS.workspaceSourcesView,
    PERMISSIONS.workspaceSourcesCreate,
    PERMISSIONS.workspaceSourcesUpdate,
    PERMISSIONS.workspaceSourcesDelete,
    PERMISSIONS.workspaceSourcesBulkImport,
    PERMISSIONS.workspaceRulesView,
    PERMISSIONS.workspaceRulesManage,
    PERMISSIONS.workspaceSearchUse,
    PERMISSIONS.workspaceRadarView,
    PERMISSIONS.workspaceBriefView,
    PERMISSIONS.workspaceFeedbackSubmit,
    PERMISSIONS.workspaceWebhooksManage,
  ],
  member: [
    PERMISSIONS.workspaceDashboardView,
    PERMISSIONS.workspaceSettingsView,
    PERMISSIONS.workspaceSourcesView,
    PERMISSIONS.workspaceSourcesCreate,
    PERMISSIONS.workspaceSourcesUpdate,
    PERMISSIONS.workspaceSourcesDelete,
    PERMISSIONS.workspaceRadarView,
    PERMISSIONS.workspaceBriefView,
    PERMISSIONS.workspaceFeedbackSubmit,
  ],
  user: [
    PERMISSIONS.workspaceDashboardView,
    PERMISSIONS.workspaceSettingsView,
    PERMISSIONS.workspaceSourcesView,
    PERMISSIONS.workspaceSourcesCreate,
    PERMISSIONS.workspaceSourcesUpdate,
    PERMISSIONS.workspaceSourcesDelete,
    PERMISSIONS.workspaceRadarView,
    PERMISSIONS.workspaceBriefView,
    PERMISSIONS.workspaceFeedbackSubmit,
  ],
};

// Feature aliases preserve the existing component API while delegating to permissions.
const FEATURE_PERMISSIONS = {
  semanticSearch: [PERMISSIONS.workspaceSearchUse],
  webhookDelivery: [PERMISSIONS.workspaceWebhooksManage],
  bulkImport: [PERMISSIONS.workspaceSourcesBulkImport],
  inferenceRules: [PERMISSIONS.workspaceRulesManage],
  adminConsole: [PERMISSIONS.platformAccess],
  assignRoles: [PERMISSIONS.platformRolesAssign],
  deleteUsers: [PERMISSIONS.platformUsersDelete],
  articleFeedback: [PERMISSIONS.workspaceFeedbackSubmit],
};

const NAV_PERMISSIONS = {
  dashboard: [PERMISSIONS.platformAccess, PERMISSIONS.workspaceDashboardView],
  settings: [PERMISSIONS.workspaceSettingsView],
  morningBrief: [PERMISSIONS.platformReportsView, PERMISSIONS.workspaceBriefView],
  semanticSearch: [PERMISSIONS.workspaceSearchUse],
  radar: [PERMISSIONS.workspaceRadarView],
  adminConsole: [PERMISSIONS.platformAccess],
};

// RSS source limits per role
export const RSS_LIMITS = {
  admin:   Infinity,
  owner:   Infinity,
  operator: 0,
  auditor: 0,         // auditors cannot add sources
  premium_member: 50,
  premium: 50,
  member:  5,
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
