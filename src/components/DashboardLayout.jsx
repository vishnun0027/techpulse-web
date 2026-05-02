import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useUserProfile } from '../context/UserProfileContext';
import { LayoutDashboard, Settings, LogOut, Activity, ChevronDown, User, Shield, Newspaper, Search } from 'lucide-react';

export default function DashboardLayout({ session }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Role data from context
  const { isAuditor, canNav, roleLabel } = useUserProfile();

  const handleLogout = async (event) => {
    event?.preventDefault();
    setShowMenu(false);
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="app-container">
      <nav className="navbar" style={{ position: 'sticky', top: '1rem', zIndex: 100 }}>
        <div className="brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div className="brand-mark">
            <Activity size={18} color="white" strokeWidth={3} />
          </div>
          <div className="brand-copy">
            <span className="brand-kicker">TechPulse</span>
            <span className="brand-title">Intelligence</span>
          </div>
        </div>
        
        <div className="nav-links">
          {canNav('dashboard') && (
            <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={16} /> <span>Dashboard</span>
            </NavLink>
          )}
          {canNav('morningBrief') && (
            <NavLink to="/brief" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Newspaper size={16} /> <span>Brief</span>
            </NavLink>
          )}
          {canNav('semanticSearch') && (
            <NavLink to="/search" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Search size={16} /> <span>Ask AI</span>
            </NavLink>
          )}
          {canNav('radar') && (
            <NavLink to="/radar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Activity size={16} /> <span>Radar</span>
            </NavLink>
          )}
          {canNav('settings') && (
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Settings size={16} /> <span>Settings</span>
            </NavLink>
          )}
          {canNav('adminConsole') && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={{ color: isAuditor ? 'var(--accent)' : 'var(--semantic-warning)' }}
            >
              <Shield size={16} /> <span>Admin</span>
            </NavLink>
          )}
        </div>

        <div className="profile-container" style={{ position: 'relative' }} ref={menuRef}>
          <button 
            type="button"
            className="secondary profile-button" 
            onClick={() => setShowMenu(prev => !prev)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent' }}
          >
            <div className="profile-avatar">
              <User size={14} />
            </div>
            <div className="profile-text" style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white' }}>
                {session.user.user_metadata?.full_name?.split(' ')[0] || session.user.email.split('@')[0]}
              </div>
            </div>
            <ChevronDown size={12} style={{ opacity: 0.5, transform: showMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showMenu && (
            <div className="glass-panel" style={{ 
              position: 'absolute', 
              top: 'calc(100% + 0.5rem)', 
              right: 0, 
              minWidth: '200px', 
              padding: '0.5rem', 
              zIndex: 101,
              borderRadius: '16px'
            }}>
              <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--card-border)', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{session.user.email}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{roleLabel}</div>
              </div>
              <button 
                type="button"
                onClick={handleLogout} 
                style={{ 
                  width: '100%', 
                  justifyContent: 'flex-start', 
                  gap: '0.5rem', 
                  padding: '0.6rem 0.75rem',
                  color: 'var(--semantic-danger)',
                  background: 'transparent',
                  boxShadow: 'none'
                }}
              >
                <LogOut size={14} /> <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
