import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/authService';
import { FiMail, FiSend, FiRefreshCw } from 'react-icons/fi';

export default function AdminEmailHubTab() {
  const [emailSegment, setEmailSegment] = useState('ALL');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBodyHtml, setEmailBodyHtml] = useState('');
  const [customSingleEmail, setCustomSingleEmail] = useState('');
  const [emailLogs, setEmailLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [broadcastResultMsg, setBroadcastResultMsg] = useState('');

  const fetchEmailLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/email-logs`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) {
        setEmailLogs(res.data);
      }
    } catch (err) {
      console.error("Failed to load email logs", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
  }, []);

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailBodyHtml.trim()) return;
    if (emailSegment === 'SINGLE' && !customSingleEmail.trim()) return;

    if (!window.confirm(`Send broadcast email to target segment [${emailSegment}]?`)) return;

    try {
      setSending(true);
      setBroadcastResultMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/email-broadcast`, {
        targetSegment: emailSegment,
        singleRecipientEmail: emailSegment === 'SINGLE' ? customSingleEmail.trim() : null,
        subject: emailSubject.trim(),
        htmlContent: emailBodyHtml.trim()
      }, { headers: AuthService.getAuthHeader() });

      if (res.data) {
        setBroadcastResultMsg("📢 Broadcast email process triggered in background thread!");
        setEmailSubject('');
        setEmailBodyHtml('');
        setCustomSingleEmail('');
        fetchEmailLogs();
      }
    } catch (err) {
      alert("Failed to dispatch broadcast email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Card */}
      <div className="admin-header-card">
        <h2 className="admin-header-title">
          <FiMail style={{ color: '#0ea5e9' }} /> Targeted Email Broadcast Engine
        </h2>
        <p className="admin-header-desc">
          Dispatch announcements, study tips, or promo updates to specific aspirant segments asynchronously in the background.
        </p>
      </div>

      {broadcastResultMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.3)', fontWeight: 600 }}>
          {broadcastResultMsg}
        </div>
      )}

      {/* Form + Preset Templates Split Grid */}
      <div className="admin-grid-split-rev">
        
        {/* Left: Broadcast Composer Form */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '20px', fontWeight: 700 }}>
            ✍️ Compose Broadcast Message
          </h3>

          <form onSubmit={handleSendBroadcast}>
            
            {/* Target Audience Segment */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Target Audience Segment
              </label>
              <select 
                value={emailSegment}
                onChange={e => setEmailSegment(e.target.value)}
                className="admin-select"
              >
                <option value="ALL">👥 All Registered Aspirants</option>
                <option value="FREE">🆓 Free Tier Users Only (Upgrade Nudge)</option>
                <option value="PREMIUM">⭐ Aspirant Pro Members Only (Exclusive Updates)</option>
                <option value="SINGLE">🎯 Specific Single User Email</option>
              </select>
            </div>

            {emailSegment === 'SINGLE' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Recipient Email Address
                </label>
                <input 
                  type="email"
                  placeholder="student@example.com"
                  value={customSingleEmail}
                  onChange={e => setCustomSingleEmail(e.target.value)}
                  className="admin-input"
                  required
                />
              </div>
            )}

            {/* Email Subject Line */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Email Subject Line
              </label>
              <input 
                type="text"
                placeholder="e.g. 🚨 New GATE CSE Mock Test Released for Operating Systems!"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                className="admin-input"
                required
              />
            </div>

            {/* HTML Body */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                HTML Body Content
              </label>
              <textarea 
                rows={6}
                placeholder="<p>Write your HTML content or plain text here...</p>"
                value={emailBodyHtml}
                onChange={e => setEmailBodyHtml(e.target.value)}
                className="admin-textarea"
                required
              />
            </div>

            <button 
              type="submit"
              disabled={sending}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', background: '#0ea5e9', borderColor: '#0ea5e9', fontWeight: 800, fontSize: '0.92rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <FiSend /> {sending ? 'Dispatching Email Threads...' : 'Dispatch Broadcast Email'}
            </button>
          </form>
        </div>

        {/* Right: Quick Template Presets */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700 }}>
            ⚡ Preset Announcement Templates
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Click any template below to prefill subject and email content:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <button 
              type="button"
              onClick={() => {
                setEmailSubject('🚀 Brand New GATE CSE Smart Mock Test Series Released!');
                setEmailBodyHtml('<p>We have released a brand new Smart Hybrid Mock Test containing 70% fresh double-verified questions + 30% high-yield GATE PYQs.</p><p>Practice under exact GATE interface conditions now!</p>');
              }}
              style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600 }}
            >
              🚀 Preset: New Mock Release
            </button>

            <button 
              type="button"
              onClick={() => {
                setEmailSubject('✨ Unlock Unlimited AI Tutor & Full Proofs with Aspirant Pro');
                setEmailBodyHtml('<p>Stuck on complex GATE CS proofs? Upgrade to <strong>Aspirant Pro</strong> to get 50 daily AI Tutor queries and step-by-step math breakdowns.</p>');
              }}
              style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600 }}
            >
              ⭐ Preset: Pro Membership Offer
            </button>

            <button 
              type="button"
              onClick={() => {
                setEmailSubject('📢 Important System Maintenance Notice');
                setEmailBodyHtml('<p>AIRGATE platform will undergo a quick 15-minute maintenance update tonight at 2:00 AM IST. All mock history will remain secure.</p>');
              }}
              style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600 }}
            >
              📢 Preset: System Announcement
            </button>
          </div>

          <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.2)', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
            💡 <strong>Deliverability Tip:</strong> Bulk broadcast emails run in background threads with 100ms throttle between dispatches to maintain 100% inbox delivery rate.
          </div>
        </div>
      </div>

      {/* Email Audit Log History Table */}
      <div className="admin-card">
        <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>📜 Sent Email Logs (Top 50 Recent)</span>
          <button onClick={fetchEmailLogs} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.78rem' }}><FiRefreshCw /> Refresh Logs</button>
        </h3>

        {logsLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Loading email logs...</div>
        ) : emailLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No email dispatch logs recorded yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {emailLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600 }}>{log.recipientEmail}</td>
                    <td>{log.subject}</td>
                    <td><span className="admin-badge admin-badge-purple">{log.emailType}</span></td>
                    <td>
                      <span className={`admin-badge ${log.status === 'SENT' ? 'admin-badge-emerald' : 'admin-badge-rose'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(log.sentAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
