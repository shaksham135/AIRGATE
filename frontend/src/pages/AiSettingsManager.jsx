import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import '../styles/aiSettingsManager.css';
import { 
  FiCpu, FiKey, FiServer, FiCheckCircle, FiAlertTriangle, 
  FiActivity, FiSave, FiRefreshCw, FiZap, FiShield, FiXCircle, FiSlash, FiRadio, FiList
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

  // Live provider models
  const [liveModels, setLiveModels] = useState([]);
  const [fetchingLiveModels, setFetchingLiveModels] = useState(false);
  const [customModelInputs, setCustomModelInputs] = useState({
    fast: false,
    heavy: false,
    tutor: false
  });

  // Per-section check status states
  const [fastCheckState, setFastCheckState] = useState({ loading: false, result: null });
  const [heavyCheckState, setHeavyCheckState] = useState({ loading: false, result: null });
  const [tutorCheckState, setTutorCheckState] = useState({ loading: false, result: null });

  // Key Pool Batch Diagnostic States
  const [poolDiagnostics, setPoolDiagnostics] = useState({ loading: false, results: null });

  useEffect(() => {
    fetchSettings();
    fetchLiveModels();
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

  const fetchLiveModels = async () => {
    setFetchingLiveModels(true);
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/settings/ai/live-models`, {
        headers: AuthService.getAuthHeader()
      });
      if (response.data && response.data.models) {
        setLiveModels(response.data.models);
      }
    } catch (err) {
      console.warn('Could not fetch live models list from provider', err);
    } finally {
      setFetchingLiveModels(false);
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

    let badgeStyle = {
      background: 'rgba(239, 68, 68, 0.12)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      color: '#fca5a5'
    };
    let icon = <FiXCircle style={{ color: '#fca5a5' }} />;

    if (isSuccess) {
      badgeStyle = {
        background: 'rgba(16, 185, 129, 0.12)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        color: '#6ee7b7'
      };
      icon = <FiCheckCircle style={{ color: '#6ee7b7' }} />;
    } else if (isRateLimit) {
      badgeStyle = {
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        color: '#fcd34d'
      };
      icon = <FiAlertTriangle style={{ color: '#fcd34d' }} />;
    } else if (isInvalidKey) {
      badgeStyle = {
        background: 'rgba(244, 63, 94, 0.12)',
        border: '1px solid rgba(244, 63, 94, 0.3)',
        color: '#fda4af'
      };
      icon = <FiShield style={{ color: '#fda4af' }} />;
    } else if (isDecommissioned) {
      badgeStyle = {
        background: 'rgba(168, 85, 247, 0.12)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        color: '#d8b4fe'
      };
      icon = <FiSlash style={{ color: '#d8b4fe' }} />;
    }

    return (
      <div style={{
        marginTop: '12px',
        padding: '10px 14px',
        borderRadius: '10px',
        fontSize: '0.8rem',
        fontFamily: 'monospace',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        ...badgeStyle
      }}>
        <div style={{ display: 'flex', itemsCenter: 'center', gap: '8px', overflow: 'hidden' }}>
          {icon}
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.message || status}
          </span>
        </div>
        {result.latencyMs !== undefined && (
          <span style={{
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.4)',
            color: '#e2e8f0',
            whiteSpace: 'nowrap'
          }}>
            ⚡ {result.latencyMs}ms
          </span>
        )}
      </div>
    );
  };

  // Helper component to render model selection dropdown or custom text field
  const renderModelInput = (settingKey, customStateKey) => {
    const isCustom = customModelInputs[customStateKey];
    const currentValue = settings[settingKey] || '';

    if (isCustom || liveModels.length === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleInputChange(settingKey, e.target.value)}
            placeholder="e.g. llama-3.3-70b-versatile"
            className="ai-input"
          />
          {liveModels.length > 0 && (
            <button
              type="button"
              onClick={() => setCustomModelInputs(prev => ({ ...prev, [customStateKey]: false }))}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0
              }}
            >
              <FiList style={{ width: 12, height: 12 }} /> Select from live fetched Groq models list
            </button>
          )}
        </div>
      );
    }

    // Dropdown mode
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <select
          value={currentValue}
          onChange={(e) => {
            if (e.target.value === 'CUSTOM_INPUT') {
              setCustomModelInputs(prev => ({ ...prev, [customStateKey]: true }));
            } else {
              handleInputChange(settingKey, e.target.value);
            }
          }}
          className="ai-select"
        >
          {!liveModels.some(m => m.id === currentValue) && currentValue && (
            <option value={currentValue}>⚠️ Current ({currentValue})</option>
          )}
          {liveModels.map(m => (
            <option key={m.id} value={m.id}>
              {m.id} {m.ownedBy ? `(${m.ownedBy})` : ''}
            </option>
          ))}
          <option value="CUSTOM_INPUT">✏️ Type Custom Model String...</option>
        </select>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
          <span>📡 {liveModels.length} active Groq models loaded</span>
          <button
            type="button"
            onClick={() => setCustomModelInputs(prev => ({ ...prev, [customStateKey]: true }))}
            style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0 }}
          >
            Type Custom String
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="ai-settings-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <FiRefreshCw style={{ width: 32, height: 32, color: '#38bdf8' }} className="animate-spin" />
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Loading AI Engine Configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-settings-container">
      <div className="ai-settings-wrapper">

        {/* Top Header Card */}
        <div className="ai-header-card">
          <div className="ai-header-info">
            <div className="ai-header-icon-box">
              <FiCpu style={{ width: 28, height: 28 }} />
            </div>
            <div>
              <h1 className="ai-header-title">
                AI Models & Provider Settings
                <span className="ai-header-badge">Fully Dynamic</span>
              </h1>
              <p className="ai-header-desc">
                Configure models, API keys, endpoints, token limits, and run live diagnostic health checks.
              </p>
            </div>
          </div>

          <div className="ai-header-actions">
            <button
              type="button"
              onClick={fetchLiveModels}
              disabled={fetchingLiveModels}
              className="ai-btn-secondary"
            >
              <FiRadio style={{ color: '#38bdf8' }} />
              {fetchingLiveModels ? 'Fetching Models...' : '📡 Fetch Live Groq Models'}
            </button>
            <button
              type="button"
              onClick={fetchSettings}
              className="ai-btn-icon"
              title="Reload from Database"
            >
              <FiRefreshCw />
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="ai-btn-primary"
            >
              {saving ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="ai-alert-error">
            <FiAlertTriangle style={{ width: 20, height: 20, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="ai-alert-success">
            <FiCheckCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Grid Settings Layout */}
        <div className="ai-grid-cards">

          {/* Card 1: Fast AI Model */}
          <div className="ai-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="ai-card-header">
                <div className="ai-card-title-group">
                  <FiZap style={{ width: 20, height: 20, color: '#fbbf24' }} />
                  <h2 className="ai-card-title">Fast AI Model</h2>
                </div>
                <button
                  type="button"
                  onClick={() => testSectionStatus(settings.groq_fast_model, settings.groq_api_url, null, setFastCheckState)}
                  disabled={fastCheckState.loading}
                  className="ai-btn-status ai-btn-status-amber"
                >
                  {fastCheckState.loading ? <FiRefreshCw className="animate-spin" /> : <FiActivity />}
                  Check Status
                </button>
              </div>

              <p className="ai-card-desc">
                Used for question classification, PDF metadata extraction, and rapid indexing tasks.
              </p>

              <div className="ai-form-group">
                <label className="ai-label">Model ID / Name</label>
                {renderModelInput('groq_fast_model', 'fast')}
              </div>

              {renderStatusBadge(fastCheckState.result)}
            </div>
          </div>

          {/* Card 2: Heavy Reasoning Model */}
          <div className="ai-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="ai-card-header">
                <div className="ai-card-title-group">
                  <FiCpu style={{ width: 20, height: 20, color: '#38bdf8' }} />
                  <h2 className="ai-card-title">Heavy Reasoning Model</h2>
                </div>
                <button
                  type="button"
                  onClick={() => testSectionStatus(settings.groq_heavy_model, settings.groq_api_url, null, setHeavyCheckState)}
                  disabled={heavyCheckState.loading}
                  className="ai-btn-status ai-btn-status-cyan"
                >
                  {heavyCheckState.loading ? <FiRefreshCw className="animate-spin" /> : <FiActivity />}
                  Check Status
                </button>
              </div>

              <p className="ai-card-desc">
                Used for AI Practice Question Generation and step-by-step LaTeX solution derivations.
              </p>

              <div className="ai-form-group">
                <label className="ai-label">Model ID / Name</label>
                {renderModelInput('groq_heavy_model', 'heavy')}
              </div>

              <div className="ai-form-group">
                <label className="ai-label">Max Output Tokens per Solution</label>
                <input
                  type="number"
                  value={settings.ai_solution_max_tokens || '3500'}
                  onChange={(e) => handleInputChange('ai_solution_max_tokens', e.target.value)}
                  placeholder="3500"
                  className="ai-input"
                />
              </div>

              {renderStatusBadge(heavyCheckState.result)}
            </div>
          </div>

          {/* Card 3: AI Tutor Assistant */}
          <div className="ai-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="ai-card-header">
                <div className="ai-card-title-group">
                  <FiServer style={{ width: 20, height: 20, color: '#818cf8' }} />
                  <h2 className="ai-card-title">AI Tutor Assistant</h2>
                </div>
                <button
                  type="button"
                  onClick={() => testSectionStatus(settings.ai_tutor_model, settings.ai_tutor_api_url, null, setTutorCheckState)}
                  disabled={tutorCheckState.loading}
                  className="ai-btn-status ai-btn-status-indigo"
                >
                  {tutorCheckState.loading ? <FiRefreshCw className="animate-spin" /> : <FiActivity />}
                  Check Status
                </button>
              </div>

              <p className="ai-card-desc">
                Powers real-time student Q&A assistant chats on Question Detail pages.
              </p>

              <div className="ai-form-group">
                <label className="ai-label">Tutor Model ID</label>
                {renderModelInput('ai_tutor_model', 'tutor')}
              </div>

              <div className="ai-form-group">
                <label className="ai-label">Endpoint API URL</label>
                <input
                  type="text"
                  value={settings.ai_tutor_api_url || ''}
                  onChange={(e) => handleInputChange('ai_tutor_api_url', e.target.value)}
                  placeholder="https://api.groq.com/openai/v1/chat/completions"
                  className="ai-input"
                />
              </div>

              <div className="ai-form-group">
                <label className="ai-label">Max Output Tokens per Request</label>
                <input
                  type="number"
                  value={settings.ai_tutor_max_tokens || '2000'}
                  onChange={(e) => handleInputChange('ai_tutor_max_tokens', e.target.value)}
                  placeholder="2000"
                  className="ai-input"
                />
              </div>

              {renderStatusBadge(tutorCheckState.result)}
            </div>
          </div>

          {/* Card 4: Global Groq Endpoint API URL */}
          <div className="ai-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="ai-card-header">
                <div className="ai-card-title-group">
                  <FiServer style={{ width: 20, height: 20, color: '#34d399' }} />
                  <h2 className="ai-card-title">Global API Endpoint</h2>
                </div>
              </div>

              <p className="ai-card-desc">
                Primary completions endpoint URL for classification and practice question generators.
              </p>

              <div className="ai-form-group">
                <label className="ai-label">Groq API URL</label>
                <input
                  type="text"
                  value={settings.groq_api_url || ''}
                  onChange={(e) => handleInputChange('groq_api_url', e.target.value)}
                  placeholder="https://api.groq.com/openai/v1/chat/completions"
                  className="ai-input"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Card 5: Groq API Key Pool & Multi-Key Load Balancer */}
        <div className="ai-card">
          <div className="ai-card-header">
            <div className="ai-card-title-group">
              <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', color: '#34d399', display: 'flex' }}>
                <FiKey style={{ width: 20, height: 20 }} />
              </div>
              <div>
                <h2 className="ai-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Groq Multi-Key Load Balancer Pool
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontFamily: 'monospace' }}>
                    {activeKeysCount} Active Keys
                  </span>
                </h2>
                <p className="ai-card-desc" style={{ margin: 0 }}>
                  Enter multiple keys (separated by commas or newlines). The platform balances traffic in round-robin fashion.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={runKeyPoolDiagnostics}
              disabled={poolDiagnostics.loading}
              className="ai-btn-status ai-btn-status-emerald"
              style={{ padding: '8px 16px' }}
            >
              {poolDiagnostics.loading ? <FiRefreshCw className="animate-spin" /> : <FiZap />}
              Diagnose All Pool Keys
            </button>
          </div>

          <div className="ai-form-group">
            <label className="ai-label">
              Groq API Keys Pool (Comma or Line-separated)
            </label>
            <textarea
              rows={4}
              value={settings.groq_api_keys || ''}
              onChange={(e) => handleInputChange('groq_api_keys', e.target.value)}
              placeholder="gsk_1234567890...,&#10;gsk_0987654321..."
              className="ai-textarea"
            />
          </div>

          {/* Masked Active Keys Preview */}
          {maskedKeys && maskedKeys.length > 0 && (
            <div>
              <label className="ai-label" style={{ color: '#94a3b8', marginBottom: '8px', display: 'block' }}>Active Key Pool Previews:</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {maskedKeys.map((k, idx) => (
                  <span key={idx} className="ai-key-tag">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
                    Key {idx + 1}: <strong style={{ color: '#fff' }}>{k}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Batch Diagnostic Results */}
          {poolDiagnostics.results && poolDiagnostics.results.length > 0 && (
            <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiActivity style={{ color: '#34d399' }} />
                Key Pool Diagnostic Results ({poolDiagnostics.results.length} Keys Tested)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {poolDiagnostics.results.map((res, i) => (
                  <div key={i} style={{ padding: '12px', background: 'rgba(11, 15, 25, 0.9)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{res.maskedKey || `Key ${i + 1}`}</span>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        background: res.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: res.status === 'ACTIVE' ? '#34d399' : '#fca5a5'
                      }}>
                        {res.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.message}</p>
                    {res.latencyMs && (
                      <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#64748b', margin: 0 }}>Latency: {res.latencyMs}ms</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
