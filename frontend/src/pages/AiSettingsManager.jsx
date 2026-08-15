import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { 
  FiCpu, FiKey, FiServer, FiCheckCircle, FiAlertTriangle, 
  FiActivity, FiSave, FiRefreshCw, FiZap, FiShield, FiXCircle, FiSlash
} from 'react-icons/fi';

export default function AiSettingsManager() {
  const [settings, setSettings] = useState({
    groq_fast_model: 'llama-3.3-70b-versatile',
    groq_heavy_model: 'llama-3.3-70b-versatile',
    groq_api_url: 'https://api.groq.com/openai/v1/chat/completions',
    ai_tutor_model: 'llama-3.3-70b-versatile',
    ai_tutor_api_url: 'https://api.groq.com/openai/v1/chat/completions',
    ai_tutor_max_tokens: '2000',
    ai_solution_max_tokens: '3500',
    groq_api_keys: ''
  });

  const [activeKeysCount, setActiveKeysCount] = useState(0);
  const [maskedKeys, setMaskedKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Per-section check status states
  const [fastCheckState, setFastCheckState] = useState({ loading: false, result: null });
  const [heavyCheckState, setHeavyCheckState] = useState({ loading: false, result: null });
  const [tutorCheckState, setTutorCheckState] = useState({ loading: false, result: null });

  // Key Pool Batch Diagnostic States
  const [poolDiagnostics, setPoolDiagnostics] = useState({ loading: false, results: null });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/settings/ai`, {
        headers: AuthService.getAuthHeader()
      });
      if (response.data) {
        if (response.data.settings) {
          setSettings(prev => ({ ...prev, ...response.data.settings }));
        }
        setActiveKeysCount(response.data.activeKeysCount || 0);
        setMaskedKeys(response.data.maskedKeys || []);
      }
    } catch (err) {
      console.error('Failed to load AI settings', err);
      setError(err.response?.data?.message || 'Failed to load AI settings from backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/admin/settings/ai`, settings, {
        headers: AuthService.getAuthHeader()
      });
      setSuccess('⚡ AI Platform Configuration updated and reloaded live in backend memory!');
      fetchSettings();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Failed to save settings', err);
      setError(err.response?.data?.message || 'Failed to update AI configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Helper method for testing an individual section
  const testSectionStatus = async (model, apiUrl, apiKey, setState) => {
    setState({ loading: true, result: null });
    try {
      const payload = {
        model: model || settings.groq_fast_model,
        apiUrl: apiUrl || settings.groq_api_url,
        apiKey: apiKey?.trim() || undefined
      };
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/settings/ai/test-connection`, payload, {
        headers: AuthService.getAuthHeader()
      });
      setState({ loading: false, result: response.data });
    } catch (err) {
      console.error('Status check failed', err);
      setState({
        loading: false,
        result: err.response?.data || {
          status: 'FAILED',
          message: err.response?.data?.message || err.message || 'Status check failed'
        }
      });
    }
  };

  // Run full key pool diagnostics
  const runKeyPoolDiagnostics = async () => {
    setPoolDiagnostics({ loading: true, results: null });
    try {
      const payload = {
        keys: settings.groq_api_keys,
        apiUrl: settings.groq_api_url,
        model: settings.groq_fast_model
      };
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/settings/ai/test-key-pool`, payload, {
        headers: AuthService.getAuthHeader()
      });
      setPoolDiagnostics({ loading: false, results: response.data.results || [] });
    } catch (err) {
      console.error('Key pool diagnostics failed', err);
      setPoolDiagnostics({ loading: false, results: [] });
    }
  };

  // Helper component to render status badge with sleek styling
  const renderStatusBadge = (result) => {
    if (!result) return null;
    const status = result.status || 'FAILED';
    const isSuccess = status === 'ACTIVE' || status === 'SUCCESS';
    const isRateLimit = status === 'RATE_LIMITED';
    const isInvalidKey = status === 'INVALID_KEY';
    const isDecommissioned = status === 'MODEL_DECOMMISSIONED';

    let bg = 'rgba(239, 68, 68, 0.12)';
    let border = 'rgba(239, 68, 68, 0.4)';
    let color = '#f87171';
    let icon = <FiXCircle size={16} />;
    let text = result.message || 'Status Check Failed';

    if (isSuccess) {
      bg = 'rgba(16, 185, 129, 0.12)';
      border = 'rgba(16, 185, 129, 0.4)';
      color = '#34d399';
      icon = <FiCheckCircle size={16} />;
    } else if (isRateLimit) {
      bg = 'rgba(245, 158, 11, 0.12)';
      border = 'rgba(245, 158, 11, 0.4)';
      color = '#fbbf24';
      icon = <FiAlertTriangle size={16} />;
    } else if (isInvalidKey) {
      bg = 'rgba(239, 68, 68, 0.15)';
      border = 'rgba(239, 68, 68, 0.5)';
      color = '#f87171';
      icon = <FiSlash size={16} />;
    } else if (isDecommissioned) {
      bg = 'rgba(168, 85, 247, 0.15)';
      border = 'rgba(168, 85, 247, 0.5)';
      color = '#c084fc';
      icon = <FiAlertTriangle size={16} />;
    }

    return (
      <div style={{
        marginTop: '14px',
        padding: '12px 14px',
        borderRadius: '10px',
        background: bg,
        border: `1px solid ${border}`,
        color: color,
        fontSize: '0.84rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span>{text}</span>
        </div>
        {result.latencyMs !== undefined && (
          <span style={{
            fontSize: '0.75rem',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '2px 8px',
            borderRadius: '6px',
            fontFamily: 'monospace'
          }}>
            ⚡ {result.latencyMs}ms
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <FiRefreshCw className="spin" size={32} style={{ color: 'var(--color-primary)' }} />
        <p style={{ marginTop: '16px', fontWeight: 600 }}>Loading AI Platform Configurations...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '32px 20px' }}>
      
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '16px',
        padding: '28px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <FiCpu size={26} style={{ color: '#38bdf8' }} />
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: '#fff' }}>
              AI Models & API Keys Management
            </h1>
            <span className="badge badge-success" style={{ fontSize: '0.78rem', padding: '3px 10px' }}>
              Dynamic Live-Reloading
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '720px' }}>
            Configure and test each AI model, version, and API key pool individually. Click <strong>"Check Status"</strong> inside any section to instantly verify API key health and latency!
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="btn btn-primary"
          style={{ padding: '12px 26px', fontSize: '0.95rem', fontWeight: 700, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {saving ? <FiRefreshCw className="spin" /> : <FiSave />}
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '14px 18px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiAlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '14px 18px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FiCheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings}>
        
        {/* Model Configurations Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '24px', marginBottom: '28px' }}>
          
          {/* Card 1: Fast AI Model Slot */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                  <FiZap size={20} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>Fast AI Model Slot</h3>
                </div>
                <button
                  type="button"
                  onClick={() => testSectionStatus(settings.groq_fast_model, settings.groq_api_url, null, setFastCheckState)}
                  disabled={fastCheckState.loading}
                  className="btn btn-outline"
                  style={{ padding: '4px 12px', fontSize: '0.78rem', borderColor: '#38bdf8', color: '#38bdf8', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  title="Test if Fast Model is active and responsive"
                >
                  {fastCheckState.loading ? <FiRefreshCw className="spin" size={12} /> : <FiZap size={12} />}
                  <span>{fastCheckState.loading ? 'Checking...' : 'Check Status'}</span>
                </button>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Used for PDF question parsing, fast classification, and initial option extraction.
              </p>

              <div className="form-group">
                <label className="form-label">Model Name / Version ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.groq_fast_model || ''}
                  onChange={(e) => handleInputChange('groq_fast_model', e.target.value)}
                  placeholder="e.g. llama-3.3-70b-versatile or gemma2-9b-it"
                  required
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Suggested: <code>llama-3.3-70b-versatile</code>, <code>gemma2-9b-it</code>
              </div>
            </div>

            {renderStatusBadge(fastCheckState.result)}
          </div>

          {/* Card 2: Heavy Reasoning Model Slot */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a78bfa' }}>
                  <FiActivity size={20} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>Heavy Reasoning Slot</h3>
                </div>
                <button
                  type="button"
                  onClick={() => testSectionStatus(settings.groq_heavy_model, settings.groq_api_url, null, setHeavyCheckState)}
                  disabled={heavyCheckState.loading}
                  className="btn btn-outline"
                  style={{ padding: '4px 12px', fontSize: '0.78rem', borderColor: '#a78bfa', color: '#a78bfa', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  title="Test if Heavy Reasoning Model is active and responsive"
                >
                  {heavyCheckState.loading ? <FiRefreshCw className="spin" size={12} /> : <FiActivity size={12} />}
                  <span>{heavyCheckState.loading ? 'Checking...' : 'Check Status'}</span>
                </button>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Used for step-by-step mathematical derivations, practice question generator & dual verification.
              </p>

              <div className="form-group">
                <label className="form-label">Model Name / Version ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.groq_heavy_model || ''}
                  onChange={(e) => handleInputChange('groq_heavy_model', e.target.value)}
                  placeholder="e.g. llama-3.3-70b-versatile"
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Detailed Solution Max Output Tokens</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.ai_solution_max_tokens || '3500'}
                  onChange={(e) => handleInputChange('ai_solution_max_tokens', e.target.value)}
                  placeholder="3500"
                  min={500}
                  max={16000}
                  required
                />
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Suggested: <code>llama-3.3-70b-versatile</code>, <code>mixtral-8x7b-32768</code>
              </div>
            </div>

            {renderStatusBadge(heavyCheckState.result)}
          </div>

          {/* Card 3: AI Tutor Model Slot */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f472b6' }}>
                  <FiCpu size={20} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#fff' }}>AI Tutor Assistant Slot</h3>
                </div>
                <button
                  type="button"
                  onClick={() => testSectionStatus(settings.ai_tutor_model, settings.ai_tutor_api_url, null, setTutorCheckState)}
                  disabled={tutorCheckState.loading}
                  className="btn btn-outline"
                  style={{ padding: '4px 12px', fontSize: '0.78rem', borderColor: '#f472b6', color: '#f472b6', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  title="Test if AI Tutor endpoint and model are active"
                >
                  {tutorCheckState.loading ? <FiRefreshCw className="spin" size={12} /> : <FiCpu size={12} />}
                  <span>{tutorCheckState.loading ? 'Checking...' : 'Check Status'}</span>
                </button>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Powers student interactive AI Chat Tutor & instant hint derivations.
              </p>

              <div className="form-group">
                <label className="form-label">Tutor Model Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.ai_tutor_model || ''}
                  onChange={(e) => handleInputChange('ai_tutor_model', e.target.value)}
                  placeholder="e.g. llama-3.3-70b-versatile or deepseek-chat"
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Tutor API Endpoint URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.ai_tutor_api_url || ''}
                  onChange={(e) => handleInputChange('ai_tutor_api_url', e.target.value)}
                  placeholder="https://api.groq.com/openai/v1/chat/completions"
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Tutor Max Tokens per Request</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.ai_tutor_max_tokens || '2000'}
                  onChange={(e) => handleInputChange('ai_tutor_max_tokens', e.target.value)}
                  placeholder="2000"
                  min={200}
                  max={16000}
                  required
                />
              </div>
            </div>

            {renderStatusBadge(tutorCheckState.result)}
          </div>

        </div>

        {/* API Key Pool & Multi-Key Diagnostics Card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '28px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiKey size={22} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#fff' }}>
                  Groq API Key Pool & Load Balancer
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Round-Robin load balancing and 60-second rate-limit cooldown isolation.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="badge badge-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiServer style={{ color: 'var(--color-success)' }} />
                <span>Active Keys in Pool: <strong>{activeKeysCount}</strong></span>
              </div>

              <button
                type="button"
                onClick={runKeyPoolDiagnostics}
                disabled={poolDiagnostics.loading}
                className="btn btn-outline"
                style={{ padding: '8px 18px', fontSize: '0.85rem', borderColor: '#f59e0b', color: '#f59e0b', fontWeight: 700, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {poolDiagnostics.loading ? <FiRefreshCw className="spin" size={14} /> : <FiShield size={14} />}
                <span>{poolDiagnostics.loading ? 'Diagnosing Pool...' : 'Diagnose All Pool Keys'}</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Primary Groq API Endpoint URL</label>
            <input
              type="text"
              className="form-input"
              value={settings.groq_api_url || ''}
              onChange={(e) => handleInputChange('groq_api_url', e.target.value)}
              placeholder="https://api.groq.com/openai/v1/chat/completions"
              required
            />
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Groq API Key Pool (Comma or Newline Separated)</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Paste multiple keys (gsk_...)</span>
            </label>
            <textarea
              className="form-input"
              rows={4}
              style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}
              value={settings.groq_api_keys || ''}
              onChange={(e) => handleInputChange('groq_api_keys', e.target.value)}
              placeholder="gsk_key1_here&#10;gsk_key2_here&#10;gsk_key3_here"
            />
          </div>

          {/* Active Key Preview List */}
          {maskedKeys && maskedKeys.length > 0 && !poolDiagnostics.results && (
            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pool Key Preview:</span>
              {maskedKeys.map((mk, idx) => (
                <span key={idx} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'monospace', color: '#38bdf8' }}>
                  🔑 {mk}
                </span>
              ))}
            </div>
          )}

          {/* Interactive Batch Key Diagnostic Results */}
          {poolDiagnostics.results && poolDiagnostics.results.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px 0', color: '#fff' }}>
                📊 Key Pool Diagnostic Health Report:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {poolDiagnostics.results.map((res, idx) => {
                  const isOk = res.status === 'ACTIVE' || res.status === 'SUCCESS';
                  const isRate = res.status === 'RATE_LIMITED';
                  const isInvalid = res.status === 'INVALID_KEY';

                  let badgeBg = 'rgba(239, 68, 68, 0.12)';
                  let badgeBorder = 'rgba(239, 68, 68, 0.3)';
                  let badgeColor = '#f87171';
                  let statusLabel = res.message || 'FAILED';

                  if (isOk) {
                    badgeBg = 'rgba(16, 185, 129, 0.12)';
                    badgeBorder = 'rgba(16, 185, 129, 0.3)';
                    badgeColor = '#34d399';
                  } else if (isRate) {
                    badgeBg = 'rgba(245, 158, 11, 0.12)';
                    badgeBorder = 'rgba(245, 158, 11, 0.3)';
                    badgeColor = '#fbbf24';
                  }

                  return (
                    <div key={idx} style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: badgeBg,
                      border: `1px solid ${badgeBorder}`,
                      color: badgeColor,
                      fontSize: '0.82rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
                        <span>🔑 {res.maskedKey}</span>
                        {res.latencyMs !== undefined && (
                          <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>⚡ {res.latencyMs}ms</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                        {statusLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Bottom Save Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: '14px 32px', fontSize: '1rem', fontWeight: 700, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {saving ? <FiRefreshCw className="spin" /> : <FiSave />}
            <span>{saving ? 'Saving Changes...' : 'Save AI Configuration'}</span>
          </button>
        </div>

      </form>
    </div>
  );
}
