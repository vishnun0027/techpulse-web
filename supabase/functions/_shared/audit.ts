type AuditPayload = {
  actorUserId: string;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(
  service: {
    from: (table: string) => {
      insert: (value: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  },
  payload: AuditPayload,
): Promise<void> {
  const { error } = await service.from('admin_audit_log').insert({
    actor_user_id: payload.actorUserId,
    action: payload.action,
    target_user_id: payload.targetUserId ?? null,
    metadata: payload.metadata ?? {},
  });

  if (error) {
    console.error('Failed to write admin audit log:', error.message);
  }
}
