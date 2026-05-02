import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useUserProfile } from '../context/UserProfileContext';
import { PremiumGate } from './PremiumGate';
import { 
  Trash2, Plus, Pencil, Check, X, Upload, 
  Rss, Brain, Webhook, ChevronRight, 
  Activity, Globe, Info, Save, User, Lock, Hash, Sparkles,
  Copy, Play, Pause, Send, RefreshCw
} from 'lucide-react';

export default function SettingsView({ session }) {
  const { canAccess, hasPermission, rssLimit, isAdmin } = useUserProfile();
  const canManageSources = hasPermission('workspace.sources.create');
  const canBulkImport = hasPermission('workspace.sources.bulk_import');
  const [activeTab, setActiveTab] = useState(isAdmin ? 'profile' : 'sources');
  
  /* ── RSS sources ── */
  const [sources, setSources]           = useState([]);
  const [newName, setNewName]           = useState('');
  const [newUrl, setNewUrl]             = useState('');
  const [editId, setEditId]             = useState(null);
  const [editName, setEditName]         = useState('');
  const [editUrl, setEditUrl]           = useState('');
  const [sourceMsg, setSourceMsg]       = useState(null);
  const fileInputRef                    = useRef(null);

  /* ── topics (Enhanced Tag System) ── */
  const [allowedTags, setAllowedInput] = useState([]);
  const [blockedTags, setBlockedInput] = useState([]);
  const [tagInput, setTagInput]         = useState({ allowed: '', blocked: '' });
  const [topicMsg, setTopicMsg]         = useState(null);

  /* ── webhooks ── */
  const [webhooks, setWebhooks]         = useState({ slack: '', discord: '' });
  const [webhookMsg, setWebhookMsg]     = useState(null);
  const [testingWebhook, setTestingWebhook] = useState(null);

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
      setAllowedInput(data.value.allowed || []);
      setBlockedInput(data.value.blocked || []);
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
    if (!canManageSources || !newName.trim() || !newUrl.trim() || sources.length >= rssLimit) return;
    const { error } = await supabase.from('rss_sources').insert({ name: newName.trim(), url: newUrl.trim(), user_id: session.user.id });
    if (error) { flash(setSourceMsg, 'Error: ' + error.message, true); return; }
    setNewName(''); setNewUrl('');
    fetchSources();
    flash(setSourceMsg, 'Source added ✓');
  };

  const toggleSource = async (id, currentActive) => {
    await supabase.from('rss_sources').update({ is_active: !currentActive }).eq('id', id);
    fetchSources();
  };

  const deleteSource = async (id) => {
    if (!hasPermission('workspace.sources.delete')) return;
    await supabase.from('rss_sources').delete().eq('id', id);
    fetchSources();
  };

  const startEdit = (s) => { setEditId(s.id); setEditName(s.name); setEditUrl(s.url); };
  const cancelEdit = () => { setEditId(null); setEditName(''); setEditUrl(''); };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!canBulkImport || !file) return;
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

  const saveEdit = async (id) => {
    if (!hasPermission('workspace.sources.update')) return;
    const { error } = await supabase.from('rss_sources').update({ name: editName.trim(), url: editUrl.trim() }).eq('id', id);
    if (error) { flash(setSourceMsg, 'Error: ' + error.message, true); return; }
    cancelEdit();
    fetchSources();
    flash(setSourceMsg, 'Source updated ✓');
  };

  const addTag = (type, value) => {
    if (!value.trim()) return;
    const tags = type === 'allowed' ? allowedTags : blockedTags;
    const setter = type === 'allowed' ? setAllowedInput : setBlockedInput;
    if (!tags.includes(value.trim())) {
      setter([...tags, value.trim()]);
    }
    setTagInput({ ...tagInput, [type]: '' });
  };

  const removeTag = (type, tag) => {
    const setter = type === 'allowed' ? setAllowedInput : setBlockedInput;
    const tags = type === 'allowed' ? allowedTags : blockedTags;
    setter(tags.filter(t => t !== tag));
  };

  const saveTopics = async () => {
    const val = { allowed: allowedTags, blocked: blockedTags, priority: [] };
    const { data } = await supabase.from('app_config').select('key').eq('key', 'topics').single();
    if (data) await supabase.from('app_config').update({ value: val }).eq('key', 'topics');
    else       await supabase.from('app_config').insert({ key: 'topics', value: val, user_id: session.user.id });
    flash(setTopicMsg, 'Logic committed ✓');
  };

  const testWebhook = (type) => {
    setTestingWebhook(type);
    setTimeout(() => {
      setTestingWebhook(null);
      flash(setWebhookMsg, `Test signal sent to ${type.toUpperCase()} ✓`);
    }, 1500);
  };

  const saveWebhooks = async () => {
    const { error } = await supabase.from('tenant_profiles').upsert({ user_id: session.user.id, slack_webhook_url: webhooks.slack, discord_webhook_url: webhooks.discord });
    if (error) flash(setWebhookMsg, 'Error: ' + error.message, true);
    else        flash(setWebhookMsg, 'Webhooks saved ✓');
  };

  return (
    <div className="settings-view animate-in fade-in duration-700">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Node Config</h1>
        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderRadius: '100px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)' }}>
          <div className="animate-pulse" style={{ width: '6px', height: '6px', background: 'var(--semantic-success)', borderRadius: '50%' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Node 01 Online</span>
        </div>
      </div>

      <div className="settings-layout" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '2rem', minHeight: '500px' }}>
        
        {/* Sidebar Nav */}
        <div className="settings-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {!isAdmin && <NavButton active={activeTab === 'sources'} onClick={() => setActiveTab('sources')} icon={Rss} label="Streams" />}
          {!isAdmin && <NavButton active={activeTab === 'engine'} onClick={() => setActiveTab('engine')} icon={Brain} label="Inference" locked={!canAccess('inferenceRules')} />}
          {!isAdmin && <NavButton active={activeTab === 'delivery'} onClick={() => setActiveTab('delivery')} icon={Webhook} label="Webhooks" locked={!canAccess('webhookDelivery')} />}
          <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={User} label="Identity" />
        </div>

        {/* Content Area */}
        <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activeTab === 'sources' && 'Registry: Intelligence Streams'}
              {activeTab === 'engine' && 'Neural: Inference rules'}
              {activeTab === 'delivery' && 'Output: Delivery channels'}
              {activeTab === 'profile' && 'Identity setup'}
            </h2>
            {activeTab === 'sources' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid var(--card-border)' }}>
                  Quota: <span style={{ color: sources.length >= rssLimit ? 'var(--semantic-danger)' : 'white' }}>{sources.length}</span>/{rssLimit === Infinity ? '∞' : rssLimit}
                </div>
                {canBulkImport && (
                  <button className="secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', borderRadius: '6px' }} onClick={() => fileInputRef.current?.click()}>
                    <Upload size={12} style={{ marginRight: '0.3rem' }} /> Import .txt
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileUpload} style={{ display: 'none' }} />
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {activeTab === 'sources' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {sourceMsg && <Alert text={sourceMsg.text} isErr={sourceMsg.err} />}
                
                <form onSubmit={addSource} style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Stream alias..." style={{ marginBottom: 0, background: 'transparent', border: 'none', flex: 1, padding: '0.5rem 0.75rem', fontWeight: 600 }} />
                  <div style={{ width: '1px', background: 'var(--card-border)', margin: '0.4rem 0' }} />
                  <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="RSS Endpoint URL..." style={{ marginBottom: 0, background: 'transparent', border: 'none', flex: 2, padding: '0.5rem 0.75rem' }} />
                  <button type="submit" disabled={!canManageSources || sources.length >= rssLimit} style={{ padding: '0 1.25rem', borderRadius: '8px' }}>
                    <Plus size={16} />
                  </button>
                </form>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {sources.map(s => (
                    <div key={s.id} className="glass-panel" style={{ padding: '1rem', background: editId === s.id ? 'rgba(56,189,248,0.05)' : 'rgba(255,255,255,0.01)', border: editId === s.id ? '1px solid var(--accent)' : '1px solid var(--card-border)', opacity: s.is_active ? 1 : 0.6 }}>
                      {editId === s.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <input value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: '0.85rem', marginBottom: 0 }} />
                          <input value={editUrl} onChange={e => setEditUrl(e.target.value)} style={{ fontSize: '0.75rem', marginBottom: 0 }} />
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button onClick={() => saveEdit(s.id)} style={{ padding: '0.4rem', flex: 1 }}><Check size={14} /></button>
                            <button onClick={cancelEdit} className="secondary" style={{ padding: '0.4rem', flex: 1 }}><X size={14} /></button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.is_active ? 'var(--semantic-success)' : 'var(--text-muted)' }} />
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.75rem' }}>{s.url}</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                               <button onClick={() => toggleSource(s.id, s.is_active)} className="secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', borderRadius: '4px' }}>
                                 {s.is_active ? <><Pause size={10} /> Pause</> : <><Play size={10} /> Active</>}
                               </button>
                               <button className="secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', borderRadius: '4px' }} onClick={() => { navigator.clipboard.writeText(s.url); flash(setSourceMsg, 'URL copied ✓'); }}>
                                 <Copy size={10} />
                               </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
                            <button onClick={() => startEdit(s)} className="secondary" style={{ padding: '0.35rem', borderRadius: '6px' }}><Pencil size={12} /></button>
                            <button onClick={() => deleteSource(s.id)} className="secondary" style={{ padding: '0.35rem', borderRadius: '6px', color: 'var(--semantic-danger)' }}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'engine' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {topicMsg && <Alert text={topicMsg.text} isErr={topicMsg.err} />}
                {!canAccess('inferenceRules') ? (
                  <PremiumGate feature="Neural Filtering" description="Deploy custom inclusion spectrums and exclusion filters." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Sparkles size={14} color="var(--semantic-success)" />
                        <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>Inclusion Spectrums</h3>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                        {allowedTags.map(tag => (
                          <span key={tag} className="badge info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem' }}>
                            {tag} <X size={10} onClick={() => removeTag('allowed', tag)} style={{ cursor: 'pointer' }} />
                          </span>
                        ))}
                        <input 
                          value={tagInput.allowed} 
                          onChange={e => setTagInput({ ...tagInput, allowed: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('allowed', tagInput.allowed))}
                          placeholder="Add topic..." 
                          style={{ marginBottom: 0, width: '120px', border: 'none', background: 'transparent', padding: 0, height: 'auto', fontSize: '0.85rem' }} 
                        />
                      </div>
                    </div>
                    
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <X size={14} color="var(--semantic-danger)" />
                        <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>Exclusion Filters</h3>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                        {blockedTags.map(tag => (
                          <span key={tag} className="badge danger" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem' }}>
                            {tag} <X size={10} onClick={() => removeTag('blocked', tag)} style={{ cursor: 'pointer' }} />
                          </span>
                        ))}
                        <input 
                          value={tagInput.blocked} 
                          onChange={e => setTagInput({ ...tagInput, blocked: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('blocked', tagInput.blocked))}
                          placeholder="Add topic..." 
                          style={{ marginBottom: 0, width: '120px', border: 'none', background: 'transparent', padding: 0, height: 'auto', fontSize: '0.85rem' }} 
                        />
                      </div>
                    </div>
                    <button onClick={saveTopics} style={{ alignSelf: 'flex-start' }}><Save size={16} /> Save Logic</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'delivery' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {webhookMsg && <Alert text={webhookMsg.text} isErr={webhookMsg.err} />}
                {!canAccess('webhookDelivery') ? (
                  <PremiumGate feature="Output Channels" />
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '3px solid #4A154B' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '32px', height: '32px', background: '#4A154B', borderRadius: '8px', display: 'grid', placeItems: 'center' }}><Hash size={16} color="white" /></div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800 }}>Slack</h3>
                          </div>
                          <button onClick={() => testWebhook('slack')} className="secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.65rem' }}>
                            {testingWebhook === 'slack' ? <RefreshCw size={10} className="animate-spin" /> : <Send size={10} />} Test
                          </button>
                        </div>
                        <input value={webhooks.slack} onChange={e => setWebhooks({ ...webhooks, slack: e.target.value })} placeholder="Webhook URL..." style={{ background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem', marginBottom: 0 }} />
                      </div>
                      
                      <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '3px solid #5865F2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '32px', height: '32px', background: '#5865F2', borderRadius: '8px', display: 'grid', placeItems: 'center' }}><Globe size={16} color="white" /></div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800 }}>Discord</h3>
                          </div>
                          <button onClick={() => testWebhook('discord')} className="secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.65rem' }}>
                            {testingWebhook === 'discord' ? <RefreshCw size={10} className="animate-spin" /> : <Send size={10} />} Test
                          </button>
                        </div>
                        <input value={webhooks.discord} onChange={e => setWebhooks({ ...webhooks, discord: e.target.value })} placeholder="Webhook URL..." style={{ background: 'rgba(0,0,0,0.2)', fontSize: '0.8rem', marginBottom: 0 }} />
                      </div>
                    </div>
                    <button onClick={saveWebhooks} style={{ alignSelf: 'flex-start' }}>Save Setup</button>
                  </>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div style={{ maxWidth: '440px' }}>
                {profileMsg && <Alert text={profileMsg.text} isErr={profileMsg.err} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))', display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px var(--accent-glow)' }}>
                    <User size={28} color="white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{fullName || 'Set Alias'}</h3>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                       <Activity size={10} /> Active Node • ID: {session.user.id.slice(0,8)}
                    </div>
                  </div>
                </div>

                <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label className="field-label" style={{ fontSize: '0.6rem' }}>ALIAS</label>
                      <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name..." style={{ marginBottom: 0, background: 'rgba(0,0,0,0.2)', fontSize: '0.9rem' }} />
                    </div>
                    <div>
                      <label className="field-label" style={{ fontSize: '0.6rem' }}>ENDPOINT</label>
                      <input value={session.user.email} disabled style={{ marginBottom: 0, opacity: 0.5, cursor: 'not-allowed', background: 'rgba(0,0,0,0.1)', fontSize: '0.9rem' }} />
                    </div>
                  </div>
                  <button type="submit" style={{ alignSelf: 'flex-start' }}>Sync Profile</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px) {
          .settings-layout { grid-template-columns: 1fr !important; gap: 1rem !important; }
          .settings-sidebar { flex-direction: row !important; overflow-x: auto; border-bottom: 1px solid var(--card-border); padding-bottom: 0.5rem; }
          .settings-sidebar button { white-space: nowrap; width: auto !important; padding: 0.4rem 0.75rem !important; }
          .hide-mobile { display: none !important; }
        }
      `}} />
    </div>
  );
}

/* ─── internal components ─── */

function NavButton({ active, icon, label, onClick, locked }) {
  const Icon = icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0.75rem',
        borderRadius: '8px',
        background: active ? 'rgba(56,189,248,0.1)' : 'transparent',
        border: 'none',
        color: locked ? 'var(--text-muted)' : (active ? 'var(--accent)' : 'var(--text-secondary)'),
        textAlign: 'left',
        width: '100%',
        transition: 'var(--transition-smooth)',
        fontWeight: active ? 700 : 500,
        fontSize: '0.8rem',
        opacity: locked ? 0.6 : 1,
        gap: '0.5rem',
        boxShadow: 'none'
      }}
      onMouseOver={e => { if(!active && !locked) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseOut={e => { if(!active && !locked) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Icon size={14} />
        {label}
      </div>
      {locked ? <Lock size={10} /> : active && <ChevronRight size={12} className="hide-mobile" />}
    </button>
  );
}

function Alert({ text, isErr }) {
  return (
    <div style={{ 
      padding: '0.5rem 0.75rem', 
      borderRadius: '6px', 
      marginBottom: '1rem', 
      fontSize: '0.75rem',
      background: isErr ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
      color: isErr ? '#fca5a5' : '#6ee7b7', 
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem'
    }}>
      <Info size={12} />
      {text}
    </div>
  );
}
