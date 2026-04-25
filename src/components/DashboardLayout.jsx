import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../supabase';
import { LayoutDashboard, Settings, LogOut, Activity, ChevronDown, User, Shield, Newspaper, Search } from 'lucide-react';

export default function DashboardLayout({ session }) {
  const [showMenu, setShowMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Check for admin privileges (Strict Database Check)
  useEffect(() => {
    async function checkAdmin() {
      try {
        const { data, error } = await supabase
          .from('tenant_profiles')
          .select('is_admin')
          .eq('user_id', session.user.id)
          .single();
          
        if (error) throw error;
        setIsAdmin(!!data?.is_admin);
      } catch (err) {
        console.warn("RBAC check failed:", err?.message || err);
        setIsAdmin(false);
      }
    }
    checkAdmin();
  }, [session]);

  return (
    <div className="app-container">
      <nav className="navbar glass-panel" style={{ 
        borderRadius: 0, 
        borderTop: 0, 
        borderLeft: 0, 
        borderRight: 0, 
        position: 'sticky', 
        top: 0, 
        zIndex: 100,
        backdropFilter: 'blur(30px)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4rem' }}>
          <div className="brand" style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
            <div style={{ 
              background: 'var(--accent-glow)', 
              padding: '8px', 
              borderRadius: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 0 15px var(--accent-glow)' 
            }}>
              <Activity size={22} color="var(--accent)" strokeWidth={3} />
            </div>
            TechPulse Pro
          </div>
          
          <div className="nav-links">
            <NavLink 
              to="/" 
              end
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} /> <span>Dashboard</span>
            </NavLink>
            <NavLink 
              to="/settings" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Settings size={18} /> <span>Settings</span>
            </NavLink>
            <NavLink 
              to="/brief" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Newspaper size={18} /> <span>Morning Brief</span>
            </NavLink>
            <NavLink 
              to="/search" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Search size={18} /> <span>Ask TechPulse</span>
            </NavLink>
            <NavLink 
              to="/radar" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Activity size={18} /> <span>Radar</span>
            </NavLink>

            {isAdmin && (
              <NavLink 
                to="/admin" 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{ color: 'var(--semantic-warning)', marginLeft: '1rem' }}
              >
                <Shield size={18} /> <span>Admin</span>
              </NavLink>
            )}
          </div>
        </div>

        <div style={{ position: 'relative' }} ref={menuRef}>
          <button 
            className="secondary" 
            onClick={() => setShowMenu(!showMenu)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              padding: '0.4rem 0.75rem', 
              background: showMenu ? 'hsla(0, 0%, 100%, 0.05)' : 'transparent',
              border: '1px solid var(--card-border)',
              borderRadius: '12px',
              transition: 'var(--transition-smooth)'
            }}
          >
            <div style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, var(--accent) 0%, hsl(217, 91%, 40%) 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 0 10px var(--accent-glow)' 
            }}>
              <User size={16} color="white" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                {session.user.user_metadata?.full_name || session.user.email.split('@')[0]}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isAdmin ? 'Super Admin' : 'Pro Member'}
              </div>
            </div>
            <ChevronDown size={14} style={{ transform: showMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
          </button>

          {showMenu && (
            <div className="glass-panel" style={{ 
              position: 'absolute', 
              top: 'calc(100% + 0.75rem)', 
              right: 0, 
              minWidth: '240px', 
              padding: '0.75rem', 
              zIndex: 101,
              boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)',
              transform: 'translateY(0)',
              opacity: 1,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <div style={{ padding: '0.5rem 0.75rem 0.75rem', borderBottom: '1px solid var(--card-border)', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.1rem' }}>
                  {session.user.user_metadata?.full_name || 'User Profile'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.user.email}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <button 
                  className="secondary" 
                  onClick={handleLogout} 
                  style={{ 
                    width: '100%', 
                    justifyContent: 'flex-start', 
                    gap: '0.75rem', 
                    padding: '0.65rem 0.75rem',
                    border: 'none',
                    color: 'var(--semantic-danger)',
                    background: 'transparent',
                    borderRadius: '8px'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--semantic-danger-bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={16} /> 
                  <span style={{ fontWeight: 600 }}>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>


      <main className="main-content" style={{ margin: '0 auto', width: '100%', maxWidth: '1400px' }}>
        <Outlet />
      </main>
    </div>
  );
}
