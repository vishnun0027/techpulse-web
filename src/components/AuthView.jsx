import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabase';

export default function AuthView() {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: '', title: '' }

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { full_name: fullName.trim() }
          }
        });
        if (error) throw error;
        setNotification({ 
          type: 'success', 
          title: 'Account Created', 
          message: 'Your TechPulse Pro identity has been established. You can now log in.' 
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setNotification({ 
        type: 'error', 
        title: 'Authentication Failed', 
        message: err.message 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-shell">
        <div className="glass-panel auth-aside">
          <div>
            <div className="auth-badge">
              <span style={{ width: 8, height: 8, borderRadius: '999px', background: 'var(--accent)' }} />
              Live intelligence workspace
            </div>
            <h1>
              Turn signal overload into
              <span className="auth-gradient"> a clear daily brief.</span>
            </h1>
            <p className="auth-lead">
              TechPulse pulls high-value technical developments into one modern control surface so teams can spot momentum, risk, and strategic openings without digging through ten tools.
            </p>
            <div className="auth-highlights">
              <div className="auth-highlight">
                <span className="auth-highlight-label">Radar</span>
                <strong>Track live emerging themes</strong>
              </div>
              <div className="auth-highlight">
                <span className="auth-highlight-label">Briefing</span>
                <strong>Start every day with a sharper summary</strong>
              </div>
              <div className="auth-highlight">
                <span className="auth-highlight-label">Search</span>
                <strong>Query your archive by meaning, not keywords</strong>
              </div>
            </div>
          </div>
          <div className="auth-note">
            Built for operators, researchers, and product teams who need something calmer and smarter than a traditional admin dashboard.
          </div>
        </div>

        <div className="glass-panel auth-card">
          <div className="auth-card-header">
            <div className="auth-badge" style={{ marginBottom: '1rem' }}>TechPulse Pro</div>
            <h2>{isSignUp ? 'Create your workspace' : 'Welcome back'}</h2>
            <p>{isSignUp ? 'Set up your identity and start curating your signal pipeline.' : 'Access your intelligence dashboard and continue where you left off.'}</p>
          </div>

          <form className="auth-form" onSubmit={handleAuth}>
            {isSignUp && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <label className="field-label">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="e.g. Vishnu Vardhan"
                  style={{ marginBottom: '1rem' }}
                />
              </div>
            )}
            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@domain.com"
              />
            </div>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <label className="field-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ paddingRight: '2.8rem', marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="secondary"
                  style={{
                    position: 'absolute',
                    right: '0.35rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0.4rem',
                    minWidth: 'unset',
                    borderRadius: '10px'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {isSignUp && (
              <div style={{ animation: 'fadeIn 0.3s ease', marginBottom: '1rem' }}>
                <label className="field-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ paddingRight: '2.8rem', marginBottom: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="secondary"
                    style={{
                      position: 'absolute',
                      right: '0.35rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '0.4rem',
                      minWidth: 'unset',
                      borderRadius: '10px'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}
            <button type="submit" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Access Dashboard')}
            </button>
          </form>

          <div className="auth-card-footer">
            <span>{isSignUp ? 'Already configured?' : 'New to TechPulse?'}</span>
            <button
              type="button"
              className="secondary"
              style={{ padding: '0.4rem 0.75rem', marginLeft: '0.5rem', fontSize: '0.875rem' }}
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Log In' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>

      {/* Notification Modal */}
      {notification && (
        <div className="notification-overlay" style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="glass-panel notification-card" style={{ 
            padding: '2.5rem', 
            textAlign: 'center',
            border: `1px solid ${notification.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
          }}>
            <div style={{ 
              fontSize: '2rem', 
              marginBottom: '1rem',
              background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto'
            }}>
              {notification.type === 'error' ? '❌' : '✅'}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>{notification.title}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              {notification.message}
            </p>
            <button 
              onClick={() => setNotification(null)} 
              style={{ width: '100%', background: notification.type === 'error' ? 'var(--semantic-danger)' : 'var(--semantic-success)' }}
            >
              {notification.type === 'error' ? 'Go Back' : 'Get Started'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
