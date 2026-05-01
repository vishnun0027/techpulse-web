import { supabase } from './supabase';

function fallbackMessage(functionName) {
  return `Secure admin function "${functionName}" is not available yet. Deploy the protected backend endpoint to enable this operator workflow.`;
}

/**
 * Generic invoker for Supabase Edge Functions
 */
export async function invokeAdminFunction(functionName, payload = {}) {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  });

  if (error) {
    throw new Error(error.message || fallbackMessage(functionName));
  }

  if (!data) {
    throw new Error(fallbackMessage(functionName));
  }

  return data;
}

/**
 * Convenience wrappers for specific admin operations
 */

export const listTenants = () => invokeAdminFunction('admin-list-tenants');

export const getCommandCenter = (userId) => invokeAdminFunction('admin-get-command-center', { userId });

export const updateRole = (actorUserId, targetUserId, role) => 
  invokeAdminFunction('admin-update-role', { actorUserId, targetUserId, role });

export const deleteUser = (actorUserId, targetUserId) => 
  invokeAdminFunction('admin-delete-user', { actorUserId, targetUserId });

export const enrollTenant = (actorUserId, email, fullName) => 
  invokeAdminFunction('admin-enroll-tenant', { actorUserId, email, fullName });

export const getPlatformIntelligence = (userId) => 
  invokeAdminFunction('admin-get-platform-intelligence', { userId });

export const getBriefReport = (userId) => 
  invokeAdminFunction('admin-get-brief-report', { userId });
