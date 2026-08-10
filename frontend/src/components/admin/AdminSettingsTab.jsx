import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/AuthService';
import { FiSettings, FiCheckCircle } from 'react-icons/fi';

export default function AdminSettingsTab() {
  const [settings, setSettings] = useState({
    premiumPriceInr: 99.0,
    premiumDurationMonths: 1,
    aiDailyLimitPremium: 50,
    isMaintenanceMode: false
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/settings`, {
        headers: AuthService.getAuthHeader()
      });
      if (response.data) {
        setSettings(response.data);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSettingsLoading(true);
      setSettingsSuccess('');
      await axios.put(`${API_CONFIG.BASE_URL}/api/admin/settings`, settings, {
        headers: AuthService.getAuthHeader()
      });
      setSettingsSuccess('System configuration updated successfully!');
    } catch (err) {
      alert("Failed to save settings.");
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      
      <div className="admin-header-card">
        <h2 className="admin-header-title">
          <FiSettings style={{ color: '#a855f7' }} /> System Settings & Platform Config
        </h2>
        <p className="admin-header-desc">
          Configure platform pricing, daily AI quota limits, and system maintenance flags.
        </p>
      </div>

      {settingsSuccess && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <FiCheckCircle /> {settingsSuccess}
        </div>
      )}

      <div className="admin-card">
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Aspirant Pro Price (INR ₹)
              </label>
              <input 
                type="number"
                step="0.01"
                value={settings.premiumPriceInr}
                onChange={e => setSettings({ ...settings, premiumPriceInr: parseFloat(e.target.value) || 0 })}
                className="admin-input"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Membership Duration (Months)
              </label>
              <input 
                type="number"
                value={settings.premiumDurationMonths}
                onChange={e => setSettings({ ...settings, premiumDurationMonths: parseInt(e.target.value, 10) || 1 })}
                className="admin-input"
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
              Daily AI Tutor Query Limit (Pro Aspirants)
            </label>
            <input 
              type="number"
              value={settings.aiDailyLimitPremium}
              onChange={e => setSettings({ ...settings, aiDailyLimitPremium: parseInt(e.target.value, 10) || 50 })}
              className="admin-input"
              required
            />
          </div>

          <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.95rem' }}>Maintenance Mode</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Temporarily restrict student portal access for core updates</div>
            </div>
            <input 
              type="checkbox"
              checked={settings.isMaintenanceMode}
              onChange={e => setSettings({ ...settings, isMaintenanceMode: e.target.checked })}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>

          <button 
            type="submit"
            disabled={settingsLoading}
            className="btn btn-primary"
            style={{ padding: '12px', background: '#a855f7', borderColor: '#a855f7', fontWeight: 800, fontSize: '0.95rem' }}
          >
            {settingsLoading ? 'Saving Config...' : 'Save Configuration Changes'}
          </button>
        </form>
      </div>

    </div>
  );
}
