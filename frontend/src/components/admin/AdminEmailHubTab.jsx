import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/AuthService';
import { FiMail, FiSend, FiRefreshCw, FiGlobe, FiCheckCircle, FiCheck, FiPlay, FiSettings } from 'react-icons/fi';

export default function AdminEmailHubTab() {
  const [emailSegment, setEmailSegment] = useState('ALL');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBodyHtml, setEmailBodyHtml] = useState('');
  const [customSingleEmail, setCustomSingleEmail] = useState('');
  const [emailLogs, setEmailLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [broadcastResultMsg, setBroadcastResultMsg] = useState('');

  // Website Link & Domain Configuration State
  const [frontendBaseUrl, setFrontendBaseUrl] = useState('https://airgate-in.vercel.app');
  const [supportEmail, setSupportEmail] = useState('support@airgate.in');
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainSuccessMsg, setDomainSuccessMsg] = useState('');
  const [testEmailMsg, setTestEmailMsg] = useState('');

  const fetchEmailLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/email/logs`, {
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

  const fetchSettingsDomain = async () => {
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/settings`, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data) {
        if (res.data.frontendBaseUrl) setFrontendBaseUrl(res.data.frontendBaseUrl);
        if (res.data.supportEmail) setSupportEmail(res.data.supportEmail);
      }
    } catch (err) {
      console.error("Failed to load email domain settings", err);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
    fetchSettingsDomain();
  }, []);

  const handleSaveDomainConfig = async (e) => {
    e.preventDefault();
    try {
      setDomainSaving(true);
      setDomainSuccessMsg('');
      await axios.put(`${API_CONFIG.BASE_URL}/api/admin/settings`, {
        frontendBaseUrl: frontendBaseUrl.trim(),
        supportEmail: supportEmail.trim()
      }, {
        headers: AuthService.getAuthHeader()
      });
      setDomainSuccessMsg("✅ Email website URL updated successfully! All outgoing emails will now use this link.");
      fetchSettingsDomain();
    } catch (err) {
      alert("Failed to save email domain settings.");
    } finally {
      setDomainSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    const target = testEmailTarget.trim() || supportEmail.trim() || AuthService.getCurrentUser()?.email;
    if (!target) {
      alert("Please enter a target email address for the diagnostic test.");
      return;
    }
    try {
      setTestEmailMsg("Sending test email...");
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/email/test`, {
        email: target
      }, {
        headers: AuthService.getAuthHeader()
      });
      setTestEmailMsg(res.data.message || `✅ Test email successfully sent to ${target}`);
      fetchEmailLogs();
    } catch (err) {
      setTestEmailMsg("❌ " + (err.response?.data?.error || "Failed to send test email. Check server logs."));
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailBodyHtml.trim()) return;
    if (emailSegment === 'SINGLE' && !customSingleEmail.trim()) return;

    if (!window.confirm(`Send broadcast email to target segment [${emailSegment}]?`)) return;

    try {
      setSending(true);
      setBroadcastResultMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/email/broadcast`, {
        targetSegment: emailSegment,
        customSingleEmail: emailSegment === 'SINGLE' ? customSingleEmail.trim() : null,
        subject: emailSubject.trim(),
        bodyHtml: emailBodyHtml.trim()
      }, {
        headers: AuthService.getAuthHeader()
      });

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
          <FiMail style={{ color: '#0ea5e9' }} /> Targeted Email & Website Links Hub
        </h2>
        <p className="admin-header-desc">
          Configure outgoing email website domain URLs, test email templates, and dispatch announcements to aspirants.
        </p>
      </div>

      {/* SECTION 1: Website Link & Domain Configuration Panel */}
      <div className="admin-card" style={{ marginBottom: '28px', borderLeft: '4px solid #0ea5e9' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiGlobe style={{ color: '#38bdf8' }} /> Outgoing Email Website URL & Domain Settings
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Configure the active frontend domain link embedded in all outgoing emails (Welcome, Payment Confirmation, UTR Approvals, Password Reset, etc.).
        </p>

        {domainSuccessMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.84rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
            {domainSuccessMsg}
          </div>
        )}

        <form onSubmit={handleSaveDomainConfig} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '14px', alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Active Website Base URL (Link in Emails)
            </label>
            <input 
              type="url" 
              value={frontendBaseUrl}
              onChange={e => setFrontendBaseUrl(e.target.value)}
              placeholder="e.g. https://airgate-in.vercel.app"
              className="admin-input"
              style={{ fontWeight: 700, color: '#38bdf8' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Sender / Support Email
            </label>
            <input 
              type="email" 
              value={supportEmail}
              onChange={e => setSupportEmail(e.target.value)}
              placeholder="support@airgate.in"
              className="admin-input"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={domainSaving}
            className="btn btn-primary"
            style={{ padding: '10px 18px', background: '#0ea5e9', borderColor: '#0ea5e9', fontWeight: 800, fontSize: '0.85rem' }}
          >
            {domainSaving ? 'Saving...' : 'Save Email Link'}
          </button>
        </form>

        {/* Diagnostic Test Email Bar */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '500px' }}>
            <input 
              type="email" 
              placeholder="Enter email to send diagnostic test" 
              value={testEmailTarget}
              onChange={e => setTestEmailTarget(e.target.value)}
              className="admin-input"
              style={{ fontSize: '0.82rem', padding: '8px 12px' }}
            />
            <button 
              type="button" 
              onClick={handleSendTestEmail}
              className="btn btn-outline"
              style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FiPlay size={12} /> Send Test Email
            </button>
          </div>
          {testEmailMsg && (
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: testEmailMsg.startsWith('❌') ? '#ef4444' : '#10b981' }}>
              {testEmailMsg}
            </div>
          )}
        </div>
      </div>

      {broadcastResultMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.3)', fontWeight: 600 }}>
          {broadcastResultMsg}
        </div>
      )}

      {/* Form + Broadcast History Grid */}
      <div className="admin-grid-split-rev">
        
        {/* Left: Broadcast Composer Form */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '20px', fontWeight: 700 }}>
            ✍️ Compose Broadcast Message
          </h3>

          <form onSubmit={handleSendBroadcast}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Target Segment</label>
              <select 
                value={emailSegment} 
                onChange={e => setEmailSegment(e.target.value)}
                className="admin-input"
              >
                <option value="ALL">All Registered Aspirants</option>
                <option value="FREE">Free Tier Aspirants</option>
                <option value="PREMIUM">Aspirant Pro Members Only</option>
                <option value="SINGLE">Custom Single Email Recipient</option>
              </select>
            </div>

            {emailSegment === 'SINGLE' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Custom Single Target Email</label>
                <input 
                  type="email" 
                  value={customSingleEmail} 
                  onChange={e => setCustomSingleEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="admin-input" 
                  required
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email Subject Line</label>
              <input 
                type="text" 
                value={emailSubject} 
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="e.g. ⚡ Limited Offer: Upgrade to Aspirant Pro & Unlock Full PYQs"
                className="admin-input" 
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email Body (HTML Supported)</label>
              <textarea 
                rows={7} 
                value={emailBodyHtml} 
                onChange={e => setEmailBodyHtml(e.target.value)}
                placeholder="<p>Dear Aspirant,</p><p>We have added 50+ new GATE 2026 practice questions...</p>"
                className="admin-textarea" 
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={sending}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', background: '#0ea5e9', borderColor: '#0ea5e9', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <FiSend /> {sending ? 'Triggering Broadcast...' : 'Dispatch Email Broadcast'}
            </button>
          </form>
        </div>

        {/* Right: Recent Email Logs */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, fontWeight: 700 }}>
              📜 Recent Dispatched Logs
            </h3>
            <button 
              onClick={fetchEmailLogs} 
              className="btn btn-outline"
              style={{ padding: '4px 8px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <FiRefreshCw size={12} /> Refresh
            </button>
          </div>

          {logsLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading email logs...</p>
          ) : emailLogs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No email logs recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
              {emailLogs.map((log, idx) => (
                <div key={idx} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#38bdf8' }}>{log.recipientEmail}</span>
                    <span className="admin-badge admin-badge-emerald" style={{ fontSize: '0.68rem' }}>{log.status || 'SENT'}</span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{log.subject}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Type: {log.emailType} • {log.sentAt ? new Date(log.sentAt).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
