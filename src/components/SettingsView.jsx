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

  const fetchTopics = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'topics').single();
    if (data?.value) {
      setAllowedInput(data.value.allowed?.join(', ') || '');
      setBlockedInput(data.value.blocked?.join(', ') || '');
      setPriorityInput(data.value.priority?.join(', ') || '');
    }
  };

  const fetchWebhooks = async () => {
    const { data } = await supabase.from('tenant_profiles').select('*').single();
    if (data) setWebhooks({ slack: data.slack_webhook_url || '', discord: data.discord_webhook_url || '' });
  };

  useEffect(() => { 
    const init = async () => {
      await fetchSources(); 
      await fetchTopics(); 
      await fetchWebhooks();
    };
    init();
  }, [session]);

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
    } catch {
      flash(setSourceMsg, 'Failed to import file.', true);
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

  const saveWebhooks = async () => {
    const { error } = await supabase.from('tenant_profiles').upsert({ user_id: session.user.id, slack_webhook_url: webhooks.slack, discord_webhook_url: webhooks.discord });
    if (error) flash(setWebhookMsg, 'Error: ' + error.message, true);
    else        flash(setWebhookMsg, 'Webhooks saved ✓');
  };

  return (
    <div className="settings-view animate-in fade-in duration-700">
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900 }}>Configuration</h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Advanced node parameters and intelligence feed management.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '3rem', minHeight: '600px' }}>
        
        {/* Sidebar Nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <NavButton active={activeTab === 'sources'} onClick={() => setActiveTab('sources')} icon={Rss} label="Intelligence Streams" />
          <NavButton active={activeTab === 'engine'} onClick={() => setActiveTab('engine')} icon={Brain} label="Inference Rules" />
          <NavButton active={activeTab === 'delivery'} onClick={() => setActiveTab('delivery')} icon={Webhook} label="Delivery Channels" />
          <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={User} label="Identity Profile" />
          
          <div style={{ marginTop: 'auto', padding: '1.5rem', borderRadius: '16px', background: 'var(--panel-top)', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', background: 'var(--semantic-success)', borderRadius: '50%', boxShadow: '0 0 10px var(--semantic-success)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em' }}>PIPELINE ACTIVE</span>
            </div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>System processing at 124ms latency. Next sync in 42m.</p>
          </div>
        </div>

        {/* Content Area */}
        <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '700px' }}>
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsla(0, 0%, 100%, 0.01)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activeTab === 'sources' && 'Registry: Sources'}
              {activeTab === 'engine' && 'Neural: Filter Logic'}
              {activeTab === 'delivery' && 'Output: Webhooks'}
              {activeTab === 'profile' && 'Identity: Parameters'}
            </h2>
            {activeTab === 'sources' && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                <button className="secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: '10px' }} onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} style={{ marginRight: '0.5rem' }} /> Bulk Import
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
            {activeTab === 'sources' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {sourceMsg && <Alert text={sourceMsg.text} isErr={sourceMsg.err} />}
                
                <form onSubmit={addSource} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '1rem', alignItems: 'flex-end', padding: '1.5rem', background: 'hsla(0, 0%, 100%, 0.02)', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                  <div>
                    <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800 }}>STREAM ALIAS</label>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. OpenAI" style={{ marginBottom: 0, borderRadius: '10px' }} />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800 }}>SOURCE ENDPOINT</label>
                    <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." style={{ marginBottom: 0, borderRadius: '10px' }} />
                  </div>
                  <button type="submit" style={{ padding: '0.75rem 1.75rem', borderRadius: '10px' }}><Plus size={18} /> Register</button>
                </form>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                  {sources.map(s => (
                    <div key={s.id} className="glass-panel" style={{ padding: '1.25rem', background: editId === s.id ? 'var(--accent-glow)' : 'hsla(0, 0%, 100%, 0.02)', border: editId === s.id ? '1px solid var(--accent)' : '1px solid var(--card-border)', transition: 'var(--transition-smooth)' }}>
                      {editId === s.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <input value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: '0.9rem', marginBottom: 0 }} />
                          <input value={editUrl} onChange={e => setEditUrl(e.target.value)} style={{ fontSize: '0.8rem', marginBottom: 0 }} />
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={() => saveEdit(s.id)} style={{ padding: '0.5rem', flex: 1, background: 'var(--semantic-success)' }}><Check size={16} /></button>
                            <button onClick={cancelEdit} className="secondary" style={{ padding: '0.5rem', flex: 1 }}><X size={16} /></button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'white', marginBottom: '0.2rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{s.url}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => startEdit(s)} className="secondary" style={{ padding: '0.5rem', borderRadius: '8px' }}><Pencil size={14} /></button>
                            <button onClick={() => deleteSource(s.id)} className="secondary" style={{ padding: '0.5rem', borderRadius: '8px', color: 'var(--semantic-danger)' }} onMouseOver={e => e.currentTarget.style.background='var(--semantic-danger-bg)'} onMouseOut={e => e.currentTarget.style.background='transparent'}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {sources.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '5rem 0', textAlign: 'center', opacity: 0.3 }}>
                      <Rss size={48} strokeWidth={1} style={{ marginBottom: '1rem' }} />
                      <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No intelligence streams registered.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'engine' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {topicMsg && <Alert text={topicMsg.text} isErr={topicMsg.err} />}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      <Activity size={18} color="var(--semantic-success)" />
                      <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Inclusion Spectrum</h3>
                    </div>
                    <textarea rows={4} value={allowedInput} onChange={e => setAllowedInput(e.target.value)} placeholder="Comma-separated topics for summaries..." style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', borderRadius: '12px' }} />
                    <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Incoming signals matching these keywords will be prioritized for AI summarization.</p>
                  </div>

                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      <Trash2 size={18} color="var(--semantic-danger)" />
                      <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Exclusion Filters</h3>
                    </div>
                    <textarea rows={4} value={blockedInput} onChange={e => setBlockedInput(e.target.value)} placeholder="Topics to discard..." style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', borderRadius: '12px' }} />
                    <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Signals containing these terms will be dropped at the edge to reduce noise.</p>
                  </div>

                  <button onClick={saveTopics} style={{ alignSelf: 'flex-start', padding: '1rem 3rem', borderRadius: '12px', fontWeight: 700 }}>Commit Inference Rules</button>
                </div>
              </div>
            )}

            {activeTab === 'delivery' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {webhookMsg && <Alert text={webhookMsg.text} isErr={webhookMsg.err} />}
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                      <div style={{ background: '#4A154B', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(74, 21, 75, 0.3)' }}>
                        <svg width="24" height="24" viewBox="0 0 127 127" fill="white"><path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"/><path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"/><path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9 7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0c7.1 0 12.9 5.8 12.9 12.9v32.3z"/><path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9H77.6z"/></svg>
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Slack Integration</h3>
                    </div>
                    <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>OPERATIONAL WEBHOOK</label>
                    <input value={webhooks.slack} onChange={e => setWebhooks({ ...webhooks, slack: e.target.value })} placeholder="https://hooks.slack.com/services/..." style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', borderRadius: '10px' }} />
                  </div>

                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                      <div style={{ background: '#5865F2', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(88, 101, 242, 0.3)' }}>
                        <svg width="24" height="24" viewBox="0 0 71 55" fill="white"><path d="M60.1 4.9A58.6 58.6 0 0 0 45.5 0a40.9 40.9 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.4 0A40.9 40.9 0 0 0 25.5 0 58.5 58.5 0 0 0 10.9 4.9C1.6 18.7-1 32.2.3 45.5a59.1 59.1 0 0 0 18 9.1 44.3 44.3 0 0 0 3.8-6.2 38.4 38.4 0 0 1-6-2.9l1.5-1.1a42.1 42.1 0 0 0 36.1 0l1.5 1.1a38.4 38.4 0 0 1-6 2.9 44.3 44.3 0 0 0 3.8 6.2 58.9 58.9 0 0 0 18-9.1C72 30.2 68.3 16.8 60.1 4.9ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.4 3.2 6.4 7.2-2.8 7.2-6.4 7.2Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.4 3.2 6.4 7.2-2.8 7.2-6.4 7.2Z"/></svg>
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Discord Integration</h3>
                    </div>
                    <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)' }}>RELAY WEBHOOK</label>
                    <input value={webhooks.discord} onChange={e => setWebhooks({ ...webhooks, discord: e.target.value })} placeholder="https://discord.com/api/webhooks/..." style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', borderRadius: '10px' }} />
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', borderLeft: '4px solid var(--accent)', background: 'var(--accent-glow)' }}>
                  <Info size={20} className="text-accent" />
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>System automated digests are relayed to active channels on an hourly schedule.</p>
                  <button onClick={saveWebhooks} style={{ marginLeft: 'auto', padding: '0.75rem 2rem', borderRadius: '10px', fontWeight: 700 }}>Save Configurations</button>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {profileMsg && <Alert text={profileMsg.text} isErr={profileMsg.err} />}
                
                <div style={{ maxWidth: '600px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '3rem' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, var(--accent) 0%, hsl(217, 91%, 40%) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px var(--accent-glow)' }}>
                      <User size={32} color="white" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Identity Management</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Personalize your interface and intelligence reports.</p>
                    </div>
                  </div>

                  <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div>
                      <label className="field-label" style={{ fontSize: '0.7rem', fontWeight: 800 }}>DISPLAY NAME</label>
                      <input 
                        value={fullName} 
                        onChange={e => setFullName(e.target.value)} 
                        placeholder="e.g. Vishnu Vardhan" 
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--card-border)', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem' }}
                      />
                    </div>
                    <div>
                      <label className="field-label" style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)' }}>PRIMARY EMAIL</label>
                      <input 
                        value={session.user.email} 
                        disabled 
                        style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--card-border)', cursor: 'not-allowed', color: 'var(--text-muted)', padding: '1rem', borderRadius: '12px' }} 
                      />
                      <p style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Verified authentication contact. Email updates via gateway only.</p>
                    </div>
                    <button type="submit" style={{ alignSelf: 'flex-start', padding: '1rem 3.5rem', borderRadius: '12px', fontWeight: 800, background: 'var(--accent)', boxShadow: '0 10px 20px var(--accent-glow)' }}>Save Profile</button>
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

function NavButton({ active, icon, label, onClick }) {
  const Icon = icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderRadius: '16px',
        background: active ? 'var(--accent-glow)' : 'transparent',
        border: active ? '1px solid var(--accent)' : '1px solid transparent',
        color: active ? 'white' : 'var(--text-secondary)',
        textAlign: 'left',
        width: '100%',
        transition: 'var(--transition-smooth)',
        fontWeight: active ? 800 : 500,
        fontSize: '0.95rem'
      }}
      onMouseOver={e => { if(!active) e.currentTarget.style.background = 'hsla(0, 0%, 100%, 0.03)'; }}
      onMouseOut={e => { if(!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Icon size={20} strokeWidth={active ? 2.5 : 2} className={active ? 'text-accent' : ''} />
        {label}
      </div>
      {active && <ChevronRight size={16} className="text-accent" />}
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
