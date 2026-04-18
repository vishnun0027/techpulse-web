import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { 
  Trash2, Plus, Pencil, Check, X, Upload, 
  Rss, Brain, Webhook, ChevronRight, 
  Activity, Globe, Info, Save, User
} from 'lucide-react';

export default function SettingsView({ session }) {
  const [activeTab, setActiveTab] = useState('sources');
  
  /* ── RSS sources ── */
  const [sources, setSources]           = useState([]);
  const [newName, setNewName]           = useState('');
  const [newUrl, setNewUrl]             = useState('');
  const [editId, setEditId]             = useState(null);
  const [editName, setEditName]         = useState('');
  const [editUrl, setEditUrl]           = useState('');
  const [sourceMsg, setSourceMsg]       = useState(null);
  const fileInputRef                    = useRef(null);

  /* ── topics ── */
  const [topics, setTopics]             = useState({ allowed: [], blocked: [], priority: [] });
  const [allowedInput, setAllowedInput] = useState('');
  const [blockedInput, setBlockedInput] = useState('');
  const [priorityInput, setPriorityInput] = useState('');
  const [topicMsg, setTopicMsg]         = useState(null);

  /* ── webhooks ── */
  const [webhooks, setWebhooks]         = useState({ slack: '', discord: '' });
  const [webhookMsg, setWebhookMsg]     = useState(null);

  /* ── profile ── */
  const [fullName, setFullName]         = useState(session.user.user_metadata?.full_name || '');
  const [profileMsg, setProfileMsg]     = useState(null);

  useEffect(() => { fetchSources(); fetchTopics(); fetchWebhooks(); }, [session]);

  const flash = (setter, msg, isErr = false) => {
    setter({ text: msg, err: isErr });
    setTimeout(() => setter(null), 3000);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() }
    });
    if (error) flash(setProfileMsg, 'Error: ' + error.message, true);
    else flash(setProfileMsg, 'Profile updated ✓');
  };

  const fetchSources = async () => {
    const { data } = await supabase.from('rss_sources').select('*').order('name');
    if (data) setSources(data);
  };

  const addSource = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    const { error } = await supabase.from('rss_sources').insert({ name: newName.trim(), url: newUrl.trim(), user_id: session.user.id });
    if (error) { flash(setSourceMsg, 'Error: ' + error.message, true); return; }
    setNewName(''); setNewUrl('');
    fetchSources();
    flash(setSourceMsg, 'Source added ✓');
  };

  const deleteSource = async (id) => {
    await supabase.from('rss_sources').delete().eq('id', id);
    fetchSources();
  };

  const startEdit = (s) => { setEditId(s.id); setEditName(s.name); setEditUrl(s.url); };
  const cancelEdit = () => { setEditId(null); setEditName(''); setEditUrl(''); };

  const saveEdit = async (id) => {
    const { error } = await supabase.from('rss_sources').update({ name: editName.trim(), url: editUrl.trim() }).eq('id', id);
    if (error) { flash(setSourceMsg, 'Error: ' + error.message, true); return; }
    cancelEdit();
    fetchSources();
    flash(setSourceMsg, 'Source updated ✓');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      const existingUrls = new Set(sources.map(s => s.url.toLowerCase()));
      const rows = [];
      for (const line of lines) {
        let name = '', url = '';
        if (line.includes('|')) [name, url] = line.split('|').map(s => s.trim());
        else if (line.startsWith('http')) {
          url = line.trim();
          try { name = new URL(url).hostname.replace(/^www\./, ''); } catch { name = url; }
        }
        if (name && url && !existingUrls.has(url.toLowerCase())) {
          rows.push({ name, url, user_id: session.user.id });
          existingUrls.add(url.toLowerCase());
        }
      }
      if (rows.length > 0) {
        await supabase.from('rss_sources').insert(rows);
        fetchSources();
        flash(setSourceMsg, `Imported ${rows.length} sources ✓`);
      } else {
        flash(setSourceMsg, 'No new valid sources found.', true);
      }
    } catch (err) {
      flash(setSourceMsg, 'Failed to import file.', true);
    }
  };

  const fetchTopics = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'topics').single();
    if (data?.value) {
      setTopics(data.value);
      setAllowedInput(data.value.allowed?.join(', ') || '');
      setBlockedInput(data.value.blocked?.join(', ') || '');
      setPriorityInput(data.value.priority?.join(', ') || '');
    }
  };

  const saveTopics = async () => {
    const clean = str => str.split(',').map(s => s.trim()).filter(Boolean);
    const val = { allowed: clean(allowedInput), blocked: clean(blockedInput), priority: clean(priorityInput) };
    const { data } = await supabase.from('app_config').select('key').eq('key', 'topics').single();
    if (data) await supabase.from('app_config').update({ value: val }).eq('key', 'topics');
    else       await supabase.from('app_config').insert({ key: 'topics', value: val, user_id: session.user.id });
    flash(setTopicMsg, 'Rules updated ✓');
  };

  const fetchWebhooks = async () => {
    const { data } = await supabase.from('tenant_profiles').select('*').single();
    if (data) setWebhooks({ slack: data.slack_webhook_url || '', discord: data.discord_webhook_url || '' });
  };

  const saveWebhooks = async () => {
    const { error } = await supabase.from('tenant_profiles').upsert({ user_id: session.user.id, slack_webhook_url: webhooks.slack, discord_webhook_url: webhooks.discord });
    if (error) flash(setWebhookMsg, 'Error: ' + error.message, true);
    else        flash(setWebhookMsg, 'Webhooks saved ✓');
  };

  return (
    <div style={{ padding: '0 0.5rem' }}>
      <div className="header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Configuration</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Manage intelligence sources and delivery channels.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '2rem', height: 'calc(100vh - 180px)' }}>
        
        {/* Sidebar Nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <NavButton active={activeTab === 'sources'} onClick={() => setActiveTab('sources')} icon={Rss} label="RSS Sources" />
          <NavButton active={activeTab === 'engine'} onClick={() => setActiveTab('engine')} icon={Brain} label="Intelligence Rules" />
          <NavButton active={activeTab === 'delivery'} onClick={() => setActiveTab('delivery')} icon={Webhook} label="Delivery Channels" />
          <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={User} label="Account Profile" />
          <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <Activity size={14} />
              <span>Pipeline: Active</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {activeTab === 'sources' && 'RSS Feeds'}
              {activeTab === 'engine' && 'Intelligence Rules'}
              {activeTab === 'delivery' && 'Delivery Webhooks'}
              {activeTab === 'profile' && 'Account Profile'}
            </h2>
            {activeTab === 'sources' && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                <button className="secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} /> Bulk Import
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {activeTab === 'sources' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {sourceMsg && <Alert text={sourceMsg.text} isErr={sourceMsg.err} />}
                
                <form onSubmit={addSource} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '1rem', alignItems: 'flex-end', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                  <div>
                    <label className="field-label">Feed Name</label>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. OpenAI" style={{ marginBottom: 0 }} />
                  </div>
                  <div>
                    <label className="field-label">RSS URL</label>
                    <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." style={{ marginBottom: 0 }} />
                  </div>
                  <button type="submit" style={{ padding: '0.75rem 1.25rem' }}><Plus size={18} /> Add</button>
                </form>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {sources.map(s => (
                    <div key={s.id} className="glass-panel hoverable" style={{ padding: '1rem', background: editId === s.id ? 'rgba(59,130,246,0.05)' : 'rgba(0,0,0,0.1)' }}>
                      {editId === s.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <input value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: '0.9rem', marginBottom: 0 }} />
                          <input value={editUrl} onChange={e => setEditUrl(e.target.value)} style={{ fontSize: '0.8rem', marginBottom: 0 }} />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => saveEdit(s.id)} style={{ padding: '0.4rem', flex: 1, background: 'var(--semantic-success)' }}><Check size={14} /></button>
                            <button onClick={cancelEdit} className="secondary" style={{ padding: '0.4rem', flex: 1 }}><X size={14} /></button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{s.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button onClick={() => startEdit(s)} className="secondary" style={{ padding: '0.4rem' }}><Pencil size={14} /></button>
                            <button onClick={() => deleteSource(s.id)} className="secondary" style={{ padding: '0.4rem' }}><Trash2 size={14} color="var(--semantic-danger)" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'engine' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {topicMsg && <Alert text={topicMsg.text} isErr={topicMsg.err} />}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <Activity size={18} color="var(--semantic-success)" />
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Allowed Keywords</h3>
                    </div>
                    <textarea rows={3} value={allowedInput} onChange={e => setAllowedInput(e.target.value)} placeholder="Topics to include (comma separated)..." style={{ marginBottom: 0 }} />
                    <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Articles matching these will be collected and summarized.</p>
                  </div>

                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <Trash2 size={18} color="var(--semantic-danger)" />
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Blocked Keywords</h3>
                    </div>
                    <textarea rows={3} value={blockedInput} onChange={e => setBlockedInput(e.target.value)} placeholder="Topics to ignore..." style={{ marginBottom: 0 }} />
                    <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Articles containing these will be automatically discarded.</p>
                  </div>

                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <Save size={18} color="var(--accent)" />
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Priority Scoring Boost</h3>
                    </div>
                    <textarea rows={3} value={priorityInput} onChange={e => setPriorityInput(e.target.value)} placeholder="Keywords that increase relevance score..." style={{ marginBottom: 0 }} />
                  </div>
                  
                  <button onClick={saveTopics} style={{ alignSelf: 'flex-start', padding: '0.75rem 2rem' }}>Apply Changes</button>
                </div>
              </div>
            )}

            {activeTab === 'delivery' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {webhookMsg && <Alert text={webhookMsg.text} isErr={webhookMsg.err} />}
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Configure where summarized intelligence is delivered.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: '#4A154B', padding: '0.5rem', borderRadius: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 127 127" fill="white"><path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"/><path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"/><path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9 7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0c7.1 0 12.9 5.8 12.9 12.9v32.3z"/><path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9H77.6z"/></svg>
                      </div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Slack</h3>
                    </div>
                    <div>
                      <label className="field-label">Incoming Webhook URL</label>
                      <input value={webhooks.slack} onChange={e => setWebhooks({ ...webhooks, slack: e.target.value })} placeholder="https://hooks.slack.com/services/..." />
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: '#5865F2', padding: '0.5rem', borderRadius: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 71 55" fill="white"><path d="M60.1 4.9A58.6 58.6 0 0 0 45.5 0a40.9 40.9 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.4 0A40.9 40.9 0 0 0 25.5 0 58.5 58.5 0 0 0 10.9 4.9C1.6 18.7-1 32.2.3 45.5a59.1 59.1 0 0 0 18 9.1 44.3 44.3 0 0 0 3.8-6.2 38.4 38.4 0 0 1-6-2.9l1.5-1.1a42.1 42.1 0 0 0 36.1 0l1.5 1.1a38.4 38.4 0 0 1-6 2.9 44.3 44.3 0 0 0 3.8 6.2 58.9 58.9 0 0 0 18-9.1C72 30.2 68.3 16.8 60.1 4.9ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.4 3.2 6.4 7.2-2.8 7.2-6.4 7.2Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.4 3.2 6.4 7.2-2.8 7.2-6.4 7.2Z"/></svg>
                      </div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Discord</h3>
                    </div>
                    <div>
                      <label className="field-label">Webhook URL</label>
                      <input value={webhooks.discord} onChange={e => setWebhooks({ ...webhooks, discord: e.target.value })} placeholder="https://discord.com/api/webhooks/..." />
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--accent)' }}>
                  <Info size={18} color="var(--accent)" />
                  <span style={{ fontSize: '0.85rem' }}>The background engine automatically sends digests to both enabled channels every hour.</span>
                  <button onClick={saveWebhooks} style={{ marginLeft: 'auto', padding: '0.5rem 1.5rem' }}>Save Endpoints</button>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {profileMsg && <Alert text={profileMsg.text} isErr={profileMsg.err} />}
                
                <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={32} color="white" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Personal Identity</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>This name will be displayed across your dashboard.</p>
                    </div>
                  </div>

                  <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <label className="field-label">Full Name</label>
                      <input 
                        value={fullName} 
                        onChange={e => setFullName(e.target.value)} 
                        placeholder="e.g. Vishnu Vardhan" 
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)' }}
                      />
                    </div>
                    <div>
                      <label className="field-label">Email Address</label>
                      <input 
                        value={session.user.email} 
                        disabled 
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)', cursor: 'not-allowed', color: 'var(--text-muted)' }} 
                      />
                      <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email cannot be changed currently.</p>
                    </div>
                    <button type="submit" style={{ alignSelf: 'flex-start', padding: '0.75rem 2rem' }}>Save Profile</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── internal components ─── */

function NavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
        border: active ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.2s ease',
        fontWeight: active ? 600 : 500,
        fontSize: '0.9rem'
      }}
      onMouseOver={e => { if(!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseOut={e => { if(!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Icon size={18} color={active ? 'var(--accent)' : 'currentColor'} />
        {label}
      </div>
      {active && <ChevronRight size={14} color="var(--accent)" />}
    </button>
  );
}

function Alert({ text, isErr }) {
  return (
    <div style={{ 
      padding: '0.75rem 1rem', 
      borderRadius: '10px', 
      marginBottom: '1rem', 
      fontSize: '0.85rem',
      background: isErr ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
      color: isErr ? '#fca5a5' : '#6ee7b7', 
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    }}>
      <Info size={16} />
      {text}
    </div>
  );
}
