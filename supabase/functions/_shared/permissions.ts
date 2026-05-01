export type AppRole =
  | 'owner'
  | 'admin'
  | 'operator'
  | 'auditor'
  | 'premium_member'
  | 'premium'
  | 'member'
  | 'user';

export type Permission =
  | 'platform.access'
  | 'platform.metrics.view'
  | 'platform.tenants.view'
  | 'platform.tenants.manage'
  | 'platform.roles.assign'
  | 'platform.users.delete'
  | 'platform.reports.view';

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  owner: [
    'platform.access',
    'platform.metrics.view',
    'platform.tenants.view',
    'platform.tenants.manage',
    'platform.roles.assign',
    'platform.users.delete',
    'platform.reports.view',
  ],
  admin: [
    'platform.access',
    'platform.metrics.view',
    'platform.tenants.view',
    'platform.tenants.manage',
    'platform.roles.assign',
    'platform.users.delete',
    'platform.reports.view',
  ],
  operator: [
    'platform.access',
    'platform.metrics.view',
    'platform.tenants.view',
    'platform.tenants.manage',
    'platform.reports.view',
  ],
  auditor: [
    'platform.access',
    'platform.metrics.view',
    'platform.tenants.view',
    'platform.reports.view',
  ],
  premium_member: [],
  premium: [],
  member: [],
  user: [],
};

export function normalizeRole(role: string | null | undefined): AppRole {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'operator':
    case 'auditor':
    case 'premium_member':
    case 'premium':
    case 'member':
    case 'user':
      return role;
    default:
      return 'user';
  }
}

export function hasPermission(role: AppRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}
