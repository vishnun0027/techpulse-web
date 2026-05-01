import { createClient } from 'npm:@supabase/supabase-js@2';
import { hasPermission, normalizeRole, type AppRole, type Permission } from './permissions.ts';

type AuthContext = {
  user: {
    id: string;
    email?: string | null;
  };
  role: AppRole;
  status: string;
  service: ReturnType<typeof createClient>;
};

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Response(`Missing environment variable: ${name}`, { status: 500 });
  }
  return value;
}

export async function requirePermission(req: Request, permission: Permission): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Response('Missing Authorization header', { status: 401 });
  }

  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await anon.auth.getUser();

  if (authError || !user) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const service = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  const { data: profile, error: profileError } = await service
    .from('tenant_profiles')
    .select('role, status')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Response('Forbidden', { status: 403 });
  }

  const role = normalizeRole(profile.role);
  const status = profile.status ?? 'active';

  if (status !== 'active') {
    throw new Response('Account is not active', { status: 403 });
  }

  if (!hasPermission(role, permission)) {
    throw new Response('Forbidden', { status: 403 });
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    role,
    status,
    service,
  };
}
