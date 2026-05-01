import { useState, useEffect } from 'react';
import { invokeAdminFunction } from '../adminApi';
import { useUserProfile } from '../context/UserProfileContext';
import { 
  Users, Activity, Shield, Rss, 
  ArrowUpRight, AlertCircle, CheckCircle2,
  Clock, Server, ShieldCheck, ShieldOff, Trash2, UserPlus, X, Mail, Eye, Globe, ChevronRight, Zap
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminView({ session }) {
  const { hasPermission } = useUserProfile();
  const canAccessPlatform = hasPermission('platform.access');
  const canManageTenants = hasPermission('platform.tenants.manage');
  const canAssignRoles = hasPermission('platform.roles.assign');
  const canDeleteUsers = hasPermission('platform.users.delete');
  const readOnly = !canManageTenants;

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
  const [actionLoading, setActionLoading] = useState(null);

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
    setActionLoading(userId);
    try {
      await invokeAdminFunction('admin-update-role', {
        actorUserId: session.user.id,
        targetUserId: userId,
        role: newRole,
      });
      await refreshTenants();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function removeUser(userId, name) {
    if (userId === session.user.id || !canDeleteUsers) return;
    if (!confirm(`Permanently delete "${name || 'Anonymous'}"?`)) return;
    setActionLoading(userId);
    try {
      await invokeAdminFunction('admin-delete-user', {
        actorUserId: session.user.id,
        targetUserId: userId,
      });
      await refreshTenants();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function addUser(e) {
    e.preventDefault();
    if (!newUserEmail.trim() || !canManageTenants) return;
    setActionLoading('add');
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
    } finally {
      setActionLoading(null);
    }
  }

  const StatCard = ({ label, value, icon: Icon, color }) => (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: `1px solid ${color || 'transparent'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{label.toUpperCase()}</span>
        <Icon size={14} style={{ color: color || 'var(--text-muted)', opacity: 0.6 }} />
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>{loading ? '...' : value}</div>
    </div>
  );

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Initializing Command Center...</div>;

  if (error) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--semantic-danger)' }}>{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Shield size={20} color="var(--accent)" />
            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '0.1em' }}>PLATFORM OPERATOR</span>
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Command Center</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {canManageTenants && (
            <button 
              className="secondary" 
              style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => setShowAddUser(!showAddUser)}
            >
              {showAddUser ? <X size={14} /> : <UserPlus size={14} />} {showAddUser ? 'Cancel' : 'Enroll Tenant'}
            </button>
          )}
        </div>
      </div>

      {readOnly && (
        <div style={{ padding: '1rem 1.5rem', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', color: '#93c5fd', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>
          <Eye size={16} /> Audit Mode: System-wide observation enabled. Write operations restricted.
        </div>
      )}

      {/* GLOBAL METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <StatCard label="Platform Intelligence" value={globalStats.totalArticles} icon={Zap} color="var(--accent)" />
        <StatCard label="Fleet Capacity" value={globalStats.totalUsers} icon={Users} color="#10b981" />
        <StatCard label="Global Registry" value={globalStats.totalSources} icon={Rss} color="#6366f1" />
        <StatCard label="Core Uptime" value={globalStats.pipelineHealth + '%'} icon={Activity} color="#f59e0b" />
        <StatCard label="Noise floor" value={globalStats.avgNoise + '%'} icon={ShieldCheck} color="#ec4899" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* CHART */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Synthesis Velocity</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>SYSTEM-WIDE AGGREGATE (7D)</span>
          </div>
          <div style={{ height: '240px' }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.02)" />
                <XAxis dataKey="name" hide />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid var(--card-border)', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={3} fill="rgba(59, 130, 246, 0.05)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RECENT EVENTS MOCKUP */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>Operational Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Summarizer Node', status: 'ACTIVE', color: '#10b981' },
              { label: 'Collector Engine', status: 'SYNCING', color: '#60a5fa' },
              { label: 'Vector Database', status: 'CONNECTED', color: '#10b981' },
              { label: 'Auth Gateway', status: 'SECURE', color: '#10b981' },
            ].map(e => (
              <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{e.label}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 900, color: e.color }}>{e.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ADD USER FORM */}
      {showAddUser && canManageTenants && (
        <form onSubmit={addUser} className="glass-panel fade-in" style={{ padding: '1.5rem', background: 'rgba(59,130,246,0.03)', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="filter-group"><label>Email Endpoint</label><input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="user@example.com" required /></div>
          <div className="filter-group"><label>Identity Alias</label><input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Display name" /></div>
          <button type="submit" style={{ height: '42px', padding: '0 2rem', fontWeight: 900 }}>ENROLL</button>
        </form>
      )}

      {/* TENANT TABLE */}
      <div className="glass-panel" style={{ overflow: 'hidden', background: 'transparent', border: '1px solid var(--card-border)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 900 }}>Fleet Management</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{tenants.length} NODES DISCOVERED</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ border: 'none' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                <th>Identity</th>
                <th>Endpoint</th>
                <th>Role Architecture</th>
                <th>Sources</th>
                <th style={{ textAlign: 'right' }}>Operations</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => {
                const isSelf = t.user_id === session.user.id;
                const isLoading = actionLoading === t.user_id;
                const roleMap = {
                  admin:   { color: '#f87171', label: '🛡️ ADMIN' },
                  auditor: { color: '#60a5fa', label: '👁️ AUDITOR' },
                  premium: { color: '#fbbf24', label: '⭐ PREMIUM' },
                  user:    { color: '#94a3b8', label: 'STANDARD' },
                };
                const r = roleMap[t.role] || roleMap.user;
                return (
                  <tr key={t.user_id} style={{ opacity: isLoading ? 0.5 : 1 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--accent)' }}>{t.full_name?.[0] || 'A'}</div>
                        <span style={{ fontWeight: 800 }}>{t.full_name || 'Anonymous'}</span>
                        {isSelf && <span style={{ fontSize: '0.6rem', color: 'var(--accent)', fontWeight: 900, letterSpacing: '0.05em' }}>[YOU]</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.email}</td>
                    <td>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: r.color, border: `1px solid ${r.color}`, padding: '0.2rem 0.6rem', borderRadius: '4px' }}>{r.label}</span>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.sourceCount || 0}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <select 
                          value={t.role || 'user'} 
                          disabled={isSelf || !canAssignRoles} 
                          onChange={e => changeRole(t.user_id, e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', color: '#fff', fontSize: '0.75rem', padding: '0.3rem', borderRadius: '6px' }}
                        >
                          <option value="admin">Admin</option>
                          <option value="auditor">Auditor</option>
                          <option value="premium">Premium</option>
                          <option value="user">User</option>
                        </select>
                        <button className="secondary" disabled={isSelf || !canDeleteUsers} onClick={() => removeUser(t.user_id, t.full_name)} style={{ color: '#ef4444', padding: '0.3rem 0.6rem', border: '1px solid rgba(239,68,68,0.2)' }}><Trash2 size={12} /></button>
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
        .filter-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .filter-group label { font-size: 0.6rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; }
        .filter-group input { background: rgba(0,0,0,0.2); border: 1px solid var(--card-border); color: #fff; padding: 0.6rem; border-radius: 8px; font-size: 0.8rem; }
        .fade-in { animation: fadeIn 0.3s ease-out; }
      `}} />
    </div>
  );
}
