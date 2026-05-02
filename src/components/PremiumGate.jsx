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
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {description ?? 'Upgrade to a Premium account to unlock this capability.'}
        </div>
      </div>
    </div>
  );
}
