import { useState, useEffect } from 'react';
import { supabase, supabaseAdmin } from '../supabase';
import { 
  Users, Activity, Shield, Rss, 
  ArrowUpRight, AlertCircle, CheckCircle2,
  Clock, Server, ShieldCheck, ShieldOff, Trash2, UserPlus, X, Mail
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminView({ session }) {
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
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    async function fetchAdminData() {
      setLoading(true);
      setError(null);
      
      // 1. Authorization check (Strict Database Flag)
      const { data: profile, error: profileError } = await supabase
        .from('tenant_profiles')
        .select('is_admin')
        .eq('user_id', session.user.id)
        .single();
      
      if (profileError || !profile?.is_admin) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // 2. Check if admin client is available
      if (!supabaseAdmin) {
        setError('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file.');
        setLoading(false);
        return;
      }

      // 3. Fetch all data using admin client (bypasses RLS)
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const [
          resArticles, resTenants, resSources, resChart, resColl, resSumm
        ] = await Promise.all([
          supabaseAdmin.from('articles').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('tenant_profiles').select('*', { count: 'exact' }),
          supabaseAdmin.from('rss_sources').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('articles').select('created_at').gte('created_at', sevenDaysAgo.toISOString()),
          supabaseAdmin.from('telemetry').select('metrics').eq('service', 'collector').order('timestamp', { ascending: false }).limit(1),
          supabaseAdmin.from('telemetry').select('metrics').eq('service', 'summarizer').order('timestamp', { ascending: false }).limit(1)
        ]);

        // Check for errors
        const firstErr = resArticles.error || resTenants.error || resSources.error || resChart.error || resColl.error || resSumm.error;
        if (firstErr) {
          console.error("Admin Fetch Error:", firstErr);
          setError(firstErr.message || 'Failed to fetch admin data');
        }

        // Build chart data
        const days = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          days[d.toISOString().split('T')[0]] = 0;
        }
        if (resChart.data) {
          resChart.data.forEach(a => {
            const date = a.created_at?.split('T')[0];
            if (date && days[date] !== undefined) days[date]++;
          });
        }

        const collMetrics = resColl.data?.[0]?.metrics || {};
        const summMetrics = resSumm.data?.[0]?.metrics || {};

        setGlobalStats({
          totalArticles: resArticles.count || 0,
          totalUsers: resTenants.count || 0,
          totalSources: resSources.count || 0,
          pipelineHealth: collMetrics.total_sources > 0 
            ? Math.round(((collMetrics.total_sources - collMetrics.error_count) / collMetrics.total_sources) * 100) 
            : 0,
          avgNoise: summMetrics.noise_ratio || 0
        });

        if (resTenants.data) setTenants(resTenants.data);
        setChartData(Object.entries(days).map(([name, value]) => ({ name, value })).reverse());
      } catch (e) {
        console.error("Critical Admin View Error:", e);
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }

    fetchAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh tenants list
  async function refreshTenants() {
    if (!supabaseAdmin) return;
    const { data } = await supabaseAdmin.from('tenant_profiles').select('*', { count: 'exact' });
    if (data) {
      setTenants(data);
      setGlobalStats(prev => ({ ...prev, totalUsers: data.length }));
    }
  }

  // Toggle admin role
  async function toggleAdmin(userId, currentStatus) {
    if (userId === session.user.id) return; // Can't demote yourself
    setActionLoading(userId);
    await supabaseAdmin.from('tenant_profiles').update({ is_admin: !currentStatus }).eq('user_id', userId);
    await refreshTenants();
    setActionLoading(null);
  }

  // Remove user (Full Deletion)
  async function removeUser(userId, name) {
    if (userId === session.user.id) return; // Can't remove yourself
    if (!confirm(`\u26a0\ufe0f PERMANENT DELETION\n\nAre you sure you want to delete "${name || 'Anonymous'}"?\nThis will permanently destroy their account and ALL associated data (Profiles, Articles, RSS Sources).`)) return;
    
    setActionLoading(userId);
    try {
      // Deleting from auth.users triggers ON DELETE CASCADE in all related tables
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
      await refreshTenants();
    } catch (err) {
      console.error("Deletion Error:", err);
      alert("Error deleting user: " + (err.message || String(err)));
    } finally {
      setActionLoading(null);
    }
  }

  // Add user
  async function addUser(e) {
    e.preventDefault();
    if (!newUserEmail.trim()) return;
    setActionLoading('add');
    // Look up user by email in auth.users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const found = authUsers?.users?.find(u => u.email === newUserEmail.trim());
    if (!found) {
      alert(`No registered user found with email: ${newUserEmail}`);
      setActionLoading(null);
      return;
    }
    await supabaseAdmin.from('tenant_profiles').upsert({
      user_id: found.id,
      email: found.email,
      full_name: newUserName.trim() || found.user_metadata?.full_name || newUserEmail.split('@')[0],
      is_admin: false
    });
    setNewUserEmail('');
    setNewUserName('');
    setShowAddUser(false);
    await refreshTenants();
    setActionLoading(null);
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Administrative Console...</div>;

  if (!isAuthorized) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '2rem' }}>
        <div style={{ padding: '2rem', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
          <Shield size={64} color="var(--semantic-danger)" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Restricted Access</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.6' }}>
            This console is reserved for system administrators. Your credentials do not have the required permissions to view global telemetry.
          </p>
          <button onClick={() => window.location.href = '/'} style={{ marginTop: '2rem', padding: '0.75rem 2rem' }}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0.5rem' }}>
      {error && (
        <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>Configuration Issue</div>
            <div style={{ fontSize: '0.85rem' }}>{error}</div>
          </div>
        </div>
      )}
      
      <div className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Shield size={24} color="var(--accent)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Super Admin</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>System Control Center</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Global oversight across all localized intelligence nodes.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Server size={14} color="var(--semantic-success)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6ee7b7' }}>Pipeline Online</span>
          </div>
        </div>
      </div>

      {/* Global Metrics High-Density Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <AdminStatCard label="Total Intelligence" value={globalStats.totalArticles} icon={Activity} />
        <AdminStatCard label="Active Tenants" value={globalStats.totalUsers} icon={Users} />
        <AdminStatCard label="Global Sources" value={globalStats.totalSources} icon={Rss} />
        <AdminStatCard label="Pipeline Health" value={`${globalStats.pipelineHealth}%`} icon={CheckCircle2} statusColor={globalStats.pipelineHealth > 90 ? '#6ee7b7' : '#fcd34d'} />
        <AdminStatCard label="Noise Reduction" value={`${globalStats.avgNoise}%`} icon={AlertCircle} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Global Velocity Chart */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>System-wide Processing Velocity</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total articles synthesized (7D)</span>
          </div>
          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAdmin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 10}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: '1px solid var(--card-border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--accent)', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorAdmin)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Events / Health */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Critical System Events</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <Clock size={32} className="empty-state-icon" />
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>System Idle</p>
                <p style={{ fontSize: '0.75rem' }}>Waiting for pipeline triggers...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tenant Management Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Tenant Oversight</h3>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600,
              background: showAddUser ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              border: '1px solid ' + (showAddUser ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'),
              borderRadius: '8px', cursor: 'pointer',
              color: showAddUser ? '#fca5a5' : '#6ee7b7',
              transition: 'all 0.2s'
            }}
          >
            {showAddUser ? <><X size={14} /> Cancel</> : <><UserPlus size={14} /> Add User</>}
          </button>
        </div>

        {/* Add User Form */}
        {showAddUser && (
          <form onSubmit={addUser} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--card-border)', background: 'rgba(16,185,129,0.03)', display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Email (must be registered)</label>
              <input
                type="email"
                value={newUserEmail}
                onChange={e => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
                required
                style={{ marginBottom: 0, padding: '0.5rem 0.75rem' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Display Name (optional)</label>
              <input
                type="text"
                value={newUserName}
                onChange={e => setNewUserName(e.target.value)}
                placeholder="John Doe"
                style={{ marginBottom: 0, padding: '0.5rem 0.75rem' }}
              />
            </div>
            <button
              type="submit"
              disabled={actionLoading === 'add'}
              style={{ padding: '0.5rem 1.5rem', whiteSpace: 'nowrap', height: 'fit-content' }}
            >
              {actionLoading === 'add' ? 'Adding...' : 'Add Tenant'}
            </button>
          </form>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tenant/User</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, idx) => {
                const isSelf = t.user_id === session.user.id;
                const isLoading = actionLoading === t.user_id;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.2s', opacity: isLoading ? 0.5 : 1 }} className="hover-row">
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.full_name || 'Anonymous Tenant'}</div>
                        {isSelf && <span style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', fontWeight: 700 }}>YOU</span>}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <Mail size={12} style={{ opacity: 0.6 }} />
                        {t.email || <em style={{ opacity: 0.5 }}>Not Synced</em>}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6ee7b7' }} />
                        <span style={{ fontSize: '0.85rem' }}>Active</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.6rem', borderRadius: '6px',
                        background: t.is_admin ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                        border: '1px solid ' + (t.is_admin ? 'rgba(16,185,129,0.2)' : 'var(--card-border)'),
                        color: t.is_admin ? '#6ee7b7' : 'var(--text-secondary)'
                      }}>
                        {t.is_admin ? '🛡️ Admin' : 'Standard'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => toggleAdmin(t.user_id, t.is_admin)}
                          disabled={isSelf || isLoading}
                          title={isSelf ? 'Cannot change your own role' : (t.is_admin ? 'Demote to Standard' : 'Promote to Admin')}
                          style={{
                            padding: '0.4rem 0.6rem', fontSize: '0.75rem', cursor: isSelf ? 'not-allowed' : 'pointer',
                            background: 'transparent', border: '1px solid var(--card-border)', borderRadius: '6px',
                            color: isSelf ? 'var(--text-muted)' : (t.is_admin ? '#fcd34d' : '#6ee7b7'),
                            opacity: isSelf ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '0.35rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={e => { if (!isSelf) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {t.is_admin ? <><ShieldOff size={12} /> Demote</> : <><ShieldCheck size={12} /> Promote</>}
                        </button>
                        <button
                          onClick={() => removeUser(t.user_id, t.full_name)}
                          disabled={isSelf || isLoading}
                          title={isSelf ? 'Cannot remove yourself' : 'Remove tenant'}
                          style={{
                            padding: '0.4rem 0.6rem', fontSize: '0.75rem', cursor: isSelf ? 'not-allowed' : 'pointer',
                            background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px',
                            color: '#ef4444', opacity: isSelf ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '0.35rem',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={e => { if (!isSelf) e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No tenant profiles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminStatCard({ label, value, icon, statusColor }) {
  const Icon = icon;
  return (
    <div className="glass-panel stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)' }}>
          <Icon size={16} color={statusColor || 'var(--accent)'} />
        </div>
        <ArrowUpRight size={14} color="var(--text-muted)" />
      </div>
      <div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

function EventRow({ status, label, time }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
      {status === 'success' ? <CheckCircle2 size={14} color="#6ee7b7" /> : <AlertCircle size={14} color="#fcd34d" />}
      <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        <Clock size={12} />
        {time}
      </div>
    </div>
  );
}
