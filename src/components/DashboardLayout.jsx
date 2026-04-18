import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { supabase } from '../supabase';
import { LayoutDashboard, Settings, LogOut, Activity, ChevronDown, User, Shield } from 'lucide-react';

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

  // Check for admin privileges
  useEffect(() => {
    async function checkAdmin() {
      // 1. Developer Bypass
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
      if (adminEmail && session.user.email === adminEmail) {
        setIsAdmin(true);
        return;
      }

      // 2. Database Check
      try {
        const { data, error } = await supabase.from('tenant_profiles').select('is_admin').eq('user_id', session.user.id).single();
        if (error) throw error;
        setIsAdmin(!!data?.is_admin);
      } catch (err) {
        console.warn("RBAC check skipped or failed:", err?.message || err);
        setIsAdmin(false);
      }
    }
    checkAdmin();
  }, [session]);

  return (
    <div className="app-container">
      <nav className="navbar glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
          <div className="brand">
            <Activity size={24} color="var(--accent)" />
            TechPulse Pro
          </div>
          
          <div className="nav-links">
            <NavLink 
              to="/" 
              end
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} /> Dashboard
            </NavLink>
            <NavLink 
              to="/settings" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Settings size={18} /> Settings
            </NavLink>

            {isAdmin && (
              <NavLink 
                to="/admin" 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{ color: 'var(--accent)' }}
              >
                <Shield size={18} /> Admin
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
              padding: '0.5rem 0.75rem', 
              background: showMenu ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: '1px solid var(--card-border)',
              borderRadius: '8px'
            }}
          >
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={14} color="white" />
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {session.user.user_metadata?.full_name || session.user.email.split('@')[0]}
            </span>
            <ChevronDown size={14} style={{ transform: showMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showMenu && (
            <div className="glass-panel" style={{ 
              position: 'absolute', 
              top: 'calc(100% + 0.5rem)', 
              right: 0, 
              minWidth: '220px', 
              padding: '0.5rem', 
              zIndex: 101,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div style={{ padding: '0.75rem 0.75rem', borderBottom: '1px solid var(--card-border)', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.1rem' }}>
                  {session.user.user_metadata?.full_name || 'Guest User'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.user.email}
                </div>
              </div>
              <button 
                className="secondary" 
                onClick={handleLogout} 
                style={{ 
                  width: '100%', 
                  justifyContent: 'flex-start', 
                  gap: '0.75rem', 
                  padding: '0.6rem 0.75rem',
                  border: 'none',
                  color: 'var(--semantic-danger)',
                  background: 'transparent'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={16} /> 
                <span style={{ fontWeight: 500 }}>Sign Out</span>
              </button>
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
