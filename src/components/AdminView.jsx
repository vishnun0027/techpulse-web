import { useState, useEffect } from 'react';
import { invokeAdminFunction } from '../adminApi';
import { useUserProfile } from '../context/UserProfileContext';
import { 
  Users, Activity, Shield, Rss, 
  ArrowUpRight, AlertCircle, CheckCircle2,
  Clock, Server, ShieldCheck, ShieldOff, Trash2, UserPlus, X, Mail, Eye, Globe, ChevronRight, Zap
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TenantInspector from './TenantInspector';

export default function AdminView({ session }) {
  const { hasPermission } = useUserProfile();
  const canAccessPlatform = hasPermission('platform.access');
  const canManageTenants = hasPermission('platform.tenants.manage');
  const canAssignRoles = hasPermission('platform.roles.assign');
  const canDeleteUsers = hasPermission('platform.users.delete');
  const isAuditor = !canManageTenants;
  const readOnly = isAuditor;

  const [globalStats, setGlobalStats] = useState({
    totalArticles: 0,
    totalUsers: 0,
    totalSources: 0,
    pipelineHealth: 0,
    avgNoise: 0
  });
  const [tenants, setTenants] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);

  useEffect(() => {
    async function fetchAdminData() {
      setLoading(true);
      setError(null);
      if (!canAccessPlatform) {
        setError('You are not authorized to access platform controls.');
        setLoading(false);
        return;
      }

      try {
        const data = await invokeAdminFunction('admin-get-command-center', {
          userId: session.user.id,
        });

        setGlobalStats(data.globalStats ?? {
          totalArticles: 0,
          totalUsers: 0,
          totalSources: 0,
          pipelineHealth: 0,
          avgNoise: 0,
        });
        setTenants(data.tenants ?? []);
        setChartData(data.chartData ?? []);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    fetchAdminData();
  }, [canAccessPlatform, session.user.id]);

  async function refreshTenants() {
    try {
      const data = await invokeAdminFunction('admin-list-tenants', {
        userId: session.user.id,
      });
      setTenants(data.tenants ?? []);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function changeRole(userId, newRole) {
    if (userId === session.user.id || !canAssignRoles) return;
    try {
      await invokeAdminFunction('admin-update-role', {
        actorUserId: session.user.id,
        targetUserId: userId,
        role: newRole,
      });
      await refreshTenants();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function removeUser(userId, name) {
    if (userId === session.user.id || !canDeleteUsers) return;
    if (!confirm(`Permanently delete "${name || 'Anonymous'}"?`)) return;
    try {
      await invokeAdminFunction('admin-delete-user', {
        actorUserId: session.user.id,
        targetUserId: userId,
      });
      await refreshTenants();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function addUser(e) {
    e.preventDefault();
    if (!newUserEmail.trim() || !canManageTenants) return;
    try {
      await invokeAdminFunction('admin-enroll-tenant', {
        actorUserId: session.user.id,
        email: newUserEmail.trim(),
        fullName: newUserName.trim(),
      });
      setNewUserEmail('');
      setNewUserName('');
      setShowAddUser(false);
      await refreshTenants();
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  const StatCard = ({ label, value, icon: Icon, color }) => (
    <div className="stat-card" style={{ borderTop: `2px solid ${color || 'var(--card-border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.55rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <Icon size={12} style={{ color: color || 'var(--text-muted)', opacity: 0.5 }} />
      </div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{loading ? '...' : value}</div>
    </div>
  );

  if (loading && tenants.length === 0) return <div className="p-8 text-center opacity-50">Initializing Center...</div>;

  if (error) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--semantic-danger)', fontSize: '0.875rem' }}>{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Shield size={16} color="var(--accent)" />
            <span style={{ fontSize: '0.55rem', fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fleet Command</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>System Operator</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {canManageTenants && (
            <button 
              className="secondary" 
              style={{ padding: '0.4rem 1rem', borderRadius: '100px', fontSize: '0.75rem' }}
              onClick={() => setShowAddUser(!showAddUser)}
            >
              {showAddUser ? <X size={14} /> : <UserPlus size={14} />} {showAddUser ? 'Cancel' : 'Enroll Node'}
            </button>
          )}
        </div>
      </div>

      {readOnly && (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--semantic-warning-bg)', border: '1px solid hsla(38, 92%, 50%, 0.1)', color: 'var(--semantic-warning)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
          <Eye size={14} /> Audit Mode Restricted
        </div>
      )}

      {/* GLOBAL METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <StatCard label="Total Intel" value={globalStats.totalArticles} icon={Zap} color="var(--accent)" />
        <StatCard label="Fleet Size" value={globalStats.totalUsers} icon={Users} color="#10b981" />
        <StatCard label="Registry" value={globalStats.totalSources} icon={Rss} color="#818cf8" />
        <StatCard label="Uptime" value={globalStats.pipelineHealth + '%'} icon={Activity} color="#f59e0b" />
        <StatCard label="Noise" value={globalStats.avgNoise + '%'} icon={ShieldCheck} color="#ec4899" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {/* CHART */}
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Synthesis Rate</h3>
          </div>
          <div style={{ height: '160px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.02)" />
                <XAxis dataKey="name" hide />
                <Tooltip contentStyle={{ background: 'var(--bg-color)', border: '1px solid var(--card-border)', borderRadius: '8px', fontSize: '0.7rem' }} />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="var(--accent-glow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* STATUS */}
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Core Nodes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { label: 'Summarizer', status: 'ACTIVE', color: '#10b981' },
              { label: 'Collector', status: 'SYNC', color: 'var(--accent)' },
              { label: 'Database', status: 'OK', color: '#10b981' },
            ].map(e => (
              <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{e.label}</span>
                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: e.color }}>{e.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ADD USER FORM */}
      {showAddUser && canManageTenants && (
        <form onSubmit={addUser} className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(56,189,248,0.03)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div className="filter-group"><label>Endpoint</label><input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Email..." required style={{ marginBottom: 0 }} /></div>
          <div className="filter-group"><label>Alias</label><input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Name..." style={{ marginBottom: 0 }} /></div>
          <button type="submit" style={{ height: '36px', padding: '0 1.5rem', fontWeight: 700, borderRadius: '100px' }}>ENROLL</button>
        </form>
      )}

      {/* TENANT TABLE */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--card-border)', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 800 }}>Fleet Management</h3>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>{tenants.length} NODES ONLINE</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Identity</th>
                <th className="hide-mobile">Endpoint</th>
                <th>Architecture</th>
                <th className="hide-mobile">Sources</th>
                <th style={{ textAlign: 'right' }}>Operations</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => {
                const isSelf = t.user_id === session.user.id;
                return (
                  <tr key={t.user_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', display: 'grid', placeItems: 'center', fontWeight: 800, color: 'var(--accent)', fontSize: '0.65rem' }}>{t.full_name?.[0] || 'A'}</div>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.full_name || 'Anon'}</span>
                        {isSelf && <span style={{ fontSize: '0.5rem', color: 'var(--accent)', fontWeight: 900 }}>[SELF]</span>}
                      </div>
                    </td>
                    <td className="hide-mobile" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.email}</td>
                    <td><span className="badge info" style={{ fontSize: '0.55rem' }}>{t.role}</span></td>
                    <td className="hide-mobile" style={{ fontWeight: 700, fontSize: '0.75rem' }}>{t.sourceCount || 0}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <select 
                          value={t.role || 'user'} 
                          disabled={isSelf || !canAssignRoles} 
                          onChange={e => changeRole(t.user_id, e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', color: '#fff', fontSize: '0.65rem', padding: '0.2rem', borderRadius: '4px', marginBottom: 0, width: 'auto' }}
                        >
                          <option value="admin">Admin</option>
                          <option value="auditor">Auditor</option>
                          <option value="premium">Premium</option>
                          <option value="user">User</option>
                        </select>
                        <button className="secondary" disabled={isSelf || !canDeleteUsers} onClick={() => removeUser(t.user_id, t.full_name)} style={{ color: 'var(--semantic-danger)', padding: '0.2rem 0.5rem' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .filter-group label { font-size: 0.55rem; }
        .filter-group input { padding: 0.4rem 0.75rem !important; }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
        }
      `}} />

      {selectedTenant && (
        <TenantInspector 
          tenant={selectedTenant} 
          onClose={() => setSelectedTenant(null)} 
        />
      )}
    </div>
  );
}
