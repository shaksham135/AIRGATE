import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
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

    let badgeBg = 'bg-red-500/10 border-red-500/30 text-red-400';
    let icon = <FiXCircle className="w-4 h-4 text-red-400" />;

    if (isSuccess) {
      badgeBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      icon = <FiCheckCircle className="w-4 h-4 text-emerald-400" />;
    } else if (isRateLimit) {
      badgeBg = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      icon = <FiAlertTriangle className="w-4 h-4 text-amber-400" />;
    } else if (isInvalidKey) {
      badgeBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      icon = <FiShield className="w-4 h-4 text-rose-400" />;
    } else if (isDecommissioned) {
      badgeBg = 'bg-purple-500/10 border-purple-500/30 text-purple-400';
      icon = <FiSlash className="w-4 h-4 text-purple-400" />;
    }

    return (
      <div className={`mt-3 p-3 rounded-lg border text-xs font-mono flex items-center justify-between gap-2 ${badgeBg}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          {icon}
          <span className="truncate font-semibold">{result.message || status}</span>
        </div>
        {result.latencyMs !== undefined && (
          <span className="shrink-0 font-bold px-2 py-0.5 rounded bg-black/40 text-slate-300">
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
        <div className="space-y-1.5">
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleInputChange(settingKey, e.target.value)}
            placeholder="e.g. llama-3.3-70b-versatile"
            className="w-full bg-slate-900/80 border border-slate-700/70 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono transition-all"
          />
          {liveModels.length > 0 && (
            <button
              type="button"
              onClick={() => setCustomModelInputs(prev => ({ ...prev, [customStateKey]: false }))}
              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
            >
              <FiList className="w-3 h-3" /> Select from live fetched Groq models list
            </button>
          )}
        </div>
      );
    }

    // Dropdown mode
    return (
      <div className="space-y-1.5">
        <select
          value={currentValue}
          onChange={(e) => {
            if (e.target.value === 'CUSTOM_INPUT') {
              setCustomModelInputs(prev => ({ ...prev, [customStateKey]: true }));
            } else {
              handleInputChange(settingKey, e.target.value);
            }
          }}
          className="w-full bg-slate-900/90 border border-slate-700/70 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono transition-all cursor-pointer"
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
        <div className="flex justify-between items-center text-[11px] text-slate-400 px-0.5">
          <span>📡 {liveModels.length} active Groq models loaded</span>
          <button
            type="button"
            onClick={() => setCustomModelInputs(prev => ({ ...prev, [customStateKey]: true }))}
            className="text-cyan-400 hover:underline"
          >
            Type Custom String
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <FiRefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Loading AI Engine Configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-xl text-cyan-400">
                <FiCpu className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  AI Models & Provider Settings
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-medium">
                    Fully Dynamic
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Configure models, API keys, endpoints, token limits, and run live diagnostic health checks.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={fetchLiveModels}
              disabled={fetchingLiveModels}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-medium text-xs flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <FiRadio className={`w-3.5 h-3.5 text-cyan-400 ${fetchingLiveModels ? 'animate-spin' : ''}`} />
              {fetchingLiveModels ? 'Fetching Models...' : '📡 Fetch Live Groq Models'}
            </button>
            <button
              type="button"
              onClick={fetchSettings}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all"
              title="Reload from Database"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {saving ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiSave className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-3">
            <FiAlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-3">
            <FiCheckCircle className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Grid Settings Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Card 1: Fast AI Model (Parsing & Classification) */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <FiZap className="w-5 h-5 text-amber-400" />
                  <h2 className="font-semibold text-white text-base">Fast AI Model</h2>
                </div>
                <button
                  type="button"
                  onClick={() => testSectionStatus(settings.groq_fast_model, settings.groq_api_url, null, setFastCheckState)}
                  disabled={fastCheckState.loading}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {fastCheckState.loading ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiActivity className="w-3 h-3" />}
                  Check Status
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Used for question classification, PDF metadata extraction, and rapid indexing tasks.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Model ID / Name</label>
                {renderModelInput('groq_fast_model', 'fast')}
              </div>

              {renderStatusBadge(fastCheckState.result)}
            </div>
          </div>

          {/* Card 2: Heavy Reasoning Model (Solution Generation) */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <FiCpu className="w-5 h-5 text-cyan-400" />
                  <h2 className="font-semibold text-white text-base">Heavy Reasoning Model</h2>
                </div>
                <button
                  type="button"
                  onClick={() => testSectionStatus(settings.groq_heavy_model, settings.groq_api_url, null, setHeavyCheckState)}
                  disabled={heavyCheckState.loading}
                  className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {heavyCheckState.loading ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiActivity className="w-3 h-3" />}
                  Check Status
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Used for AI Practice Question Generation and step-by-step LaTeX solution derivations.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Model ID / Name</label>
                {renderModelInput('groq_heavy_model', 'heavy')}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Max Output Tokens per Solution</label>
                <input
                  type="number"
                  value={settings.ai_solution_max_tokens || '3500'}
                  onChange={(e) => handleInputChange('ai_solution_max_tokens', e.target.value)}
                  placeholder="3500"
                  className="w-full bg-slate-900/80 border border-slate-700/70 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {renderStatusBadge(heavyCheckState.result)}
            </div>
          </div>

          {/* Card 3: AI Tutor Assistant */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <FiServer className="w-5 h-5 text-indigo-400" />
                  <h2 className="font-semibold text-white text-base">AI Tutor Assistant</h2>
                </div>
                <button
                  type="button"
                  onClick={() => testSectionStatus(settings.ai_tutor_model, settings.ai_tutor_api_url, null, setTutorCheckState)}
                  disabled={tutorCheckState.loading}
                  className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {tutorCheckState.loading ? <FiRefreshCw className="w-3 h-3 animate-spin" /> : <FiActivity className="w-3 h-3" />}
                  Check Status
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Powers real-time student Q&A assistant chats on Question Detail pages.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Tutor Model ID</label>
                {renderModelInput('ai_tutor_model', 'tutor')}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Endpoint API URL</label>
                <input
                  type="text"
                  value={settings.ai_tutor_api_url || ''}
                  onChange={(e) => handleInputChange('ai_tutor_api_url', e.target.value)}
                  placeholder="https://api.groq.com/openai/v1/chat/completions"
                  className="w-full bg-slate-900/80 border border-slate-700/70 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Max Output Tokens per Request</label>
                <input
                  type="number"
                  value={settings.ai_tutor_max_tokens || '2000'}
                  onChange={(e) => handleInputChange('ai_tutor_max_tokens', e.target.value)}
                  placeholder="2000"
                  className="w-full bg-slate-900/80 border border-slate-700/70 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {renderStatusBadge(tutorCheckState.result)}
            </div>
          </div>

          {/* Card 4: Global Groq Endpoint API URL */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                <FiServer className="w-5 h-5 text-emerald-400" />
                <h2 className="font-semibold text-white text-base">Global API Endpoint</h2>
              </div>

              <p className="text-xs text-slate-400">
                Primary completions endpoint URL for classification and practice question generators.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Groq API URL</label>
                <input
                  type="text"
                  value={settings.groq_api_url || ''}
                  onChange={(e) => handleInputChange('groq_api_url', e.target.value)}
                  placeholder="https://api.groq.com/openai/v1/chat/completions"
                  className="w-full bg-slate-900/80 border border-slate-700/70 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Card 5: Groq API Key Pool & Multi-Key Load Balancer */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <FiKey className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white text-base flex items-center gap-2">
                  Groq Multi-Key Load Balancer Pool
                  <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                    {activeKeysCount} Active Keys
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter multiple keys (separated by commas or newlines). The platform balances traffic in round-robin fashion.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={runKeyPoolDiagnostics}
              disabled={poolDiagnostics.loading}
              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 shrink-0"
            >
              {poolDiagnostics.loading ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiZap className="w-4 h-4 text-emerald-400" />}
              Diagnose All Pool Keys
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Groq API Keys Pool (Comma or Line-separated)
            </label>
            <textarea
              rows={4}
              value={settings.groq_api_keys || ''}
              onChange={(e) => handleInputChange('groq_api_keys', e.target.value)}
              placeholder="gsk_1234567890...,&#10;gsk_0987654321..."
              className="w-full bg-slate-900/90 border border-slate-700/70 rounded-xl p-3.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono leading-relaxed resize-y"
            />
          </div>

          {/* Masked Active Keys Preview */}
          {maskedKeys && maskedKeys.length > 0 && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-400 mb-2">Active Key Pool Previews:</label>
              <div className="flex flex-wrap gap-2">
                {maskedKeys.map((k, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-slate-800 border border-slate-700/60 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Key {idx + 1}: <span className="text-white font-semibold">{k}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Batch Diagnostic Results */}
          {poolDiagnostics.results && poolDiagnostics.results.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
              <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <FiActivity className="w-4 h-4 text-emerald-400" />
                Key Pool Diagnostic Results ({poolDiagnostics.results.length} Keys Tested)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {poolDiagnostics.results.map((res, i) => (
                  <div key={i} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300 font-semibold">{res.maskedKey || `Key ${i + 1}`}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        res.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                        res.status === 'RATE_LIMITED' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {res.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{res.message}</p>
                    {res.latencyMs && (
                      <p className="text-[10px] font-mono text-slate-500">Latency: {res.latencyMs}ms</p>
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
