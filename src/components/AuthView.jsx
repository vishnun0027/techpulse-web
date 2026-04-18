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
      <div className="glass-panel auth-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>🤖 TechPulse Pro</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Universal intelligence coordination system.</p>
        </div>

        <form onSubmit={handleAuth}>
          {isSignUp && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Full Name</label>
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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@domain.com"
            />
          </div>
          <div style={{ position: 'relative', marginBottom: isSignUp ? '1rem' : '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ paddingRight: '2.5rem', marginBottom: 0 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  padding: '0.25rem',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {isSignUp && (
            <div style={{ animation: 'fadeIn 0.3s ease', marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ paddingRight: '2.5rem', marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    padding: '0.25rem',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}
          <button type="submit" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Access Dashboard')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isSignUp ? 'Already configured?' : 'New to TechPulse?'}
          </span>
          <button 
            type="button" 
            className="secondary" 
            style={{ padding: '0.25rem 0.5rem', marginLeft: '0.5rem', fontSize: '0.875rem' }}
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Log In' : 'Sign Up'}
          </button>
        </div>
      </div>

      {/* Notification Modal */}
      {notification && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div className="glass-panel" style={{ 
            padding: '2.5rem', 
            maxWidth: '380px', 
            width: '90%',
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
