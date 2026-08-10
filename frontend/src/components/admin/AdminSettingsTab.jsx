import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/AuthService';
import { FiSettings, FiCheckCircle, FiGlobe, FiCpu, FiMail, FiShield, FiPhone } from 'react-icons/fi';

export default function AdminSettingsTab() {
  const [settings, setSettings] = useState({
    premiumPriceInr: 299.00,
    premiumDurationMonths: 3,
    aiDailyLimitPremium: 100,
    isMaintenanceMode: false,
    
    // Multi-Tiers
    tier1PriceInr: 199.00,
    tier1DurationMonths: 1,
    tier1SpecialOffer: "Starter Pass",
    tier2PriceInr: 299.00,
    tier2DurationMonths: 3,
    tier2SpecialOffer: "Save 15% - Most Popular",
    tier3PriceInr: 449.00,
    tier3DurationMonths: 6,
    tier3SpecialOffer: "Save 25% - Complete Prep",

    // SEO & Analytics
    seoSiteTitle: "AIRGATE – Gateway to Top All India Ranks | GATE PYQs & AI Tutor",
    seoMetaDescription: "Ace GATE 2027 exam with AIRGATE. Solve 20+ years of GATE previous year question papers (PYQs) with step-by-step AI tutor solutions, subject-wise analytics, and dynamic mock tests.",
    seoKeywords: "GATE 2027, AIRGATE, GATE CS PYQ, Previous Year Questions, GATE Operating Systems, GATE Mock Test, AI GATE Tutor",
    googleSiteVerification: "",
    umamiWebsiteId: "",

    // Support & Automation
    supportEmail: "support@airgate.in",
    supportPhone: "+91 (800) AIR-GATE",
    frontendBaseUrl: "https://airgate.in",
    autoWelcomeEmailEnabled: true,
    autoDripOfferEmailEnabled: true,
    aiGeneratorEnabled: true
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
        setSettings(prev => ({ ...prev, ...response.data }));
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
      setSettingsSuccess('✅ System configuration updated successfully!');
      fetchSettings();
    } catch (err) {
      alert("Failed to save settings.");
    } finally {
      setSettingsLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
      
      <div className="admin-header-card">
        <h2 className="admin-header-title">
          <FiSettings style={{ color: '#a855f7' }} /> System Settings & Enterprise Platform Config
        </h2>
        <p className="admin-header-desc">
          Configure multi-tier pricing passes, SEO meta tags, Brevo email automation, AI quota limits, and maintenance mode.
        </p>
      </div>

      {settingsSuccess && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <FiCheckCircle /> {settingsSuccess}
        </div>
      )}

      <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* SECTION 1: Aspirant Pro Multi-Tier Pricing */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            💳 Aspirant Pro Membership Pricing Tiers
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tier 1 Price (₹)</label>
              <input 
                type="number" step="0.01" value={settings.tier1PriceInr || 199.00}
                onChange={e => setSettings({ ...settings, tier1PriceInr: parseFloat(e.target.value) || 0 })}
                className="admin-input" required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tier 1 Duration (Months)</label>
              <input 
                type="number" value={settings.tier1DurationMonths || 1}
                onChange={e => setSettings({ ...settings, tier1DurationMonths: parseInt(e.target.value, 10) || 1 })}
                className="admin-input" required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tier 1 Special Offer Label</label>
              <input 
                type="text" value={settings.tier1SpecialOffer || ''}
                onChange={e => setSettings({ ...settings, tier1SpecialOffer: e.target.value })}
                className="admin-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tier 2 Price (₹)</label>
              <input 
                type="number" step="0.01" value={settings.tier2PriceInr || 299.00}
                onChange={e => setSettings({ ...settings, tier2PriceInr: parseFloat(e.target.value) || 0 })}
                className="admin-input" required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tier 2 Duration (Months)</label>
              <input 
                type="number" value={settings.tier2DurationMonths || 3}
                onChange={e => setSettings({ ...settings, tier2DurationMonths: parseInt(e.target.value, 10) || 3 })}
                className="admin-input" required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tier 2 Special Offer Label</label>
              <input 
                type="text" value={settings.tier2SpecialOffer || ''}
                onChange={e => setSettings({ ...settings, tier2SpecialOffer: e.target.value })}
                className="admin-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tier 3 Price (₹)</label>
              <input 
                type="number" step="0.01" value={settings.tier3PriceInr || 449.00}
                onChange={e => setSettings({ ...settings, tier3PriceInr: parseFloat(e.target.value) || 0 })}
                className="admin-input" required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tier 3 Duration (Months)</label>
              <input 
                type="number" value={settings.tier3DurationMonths || 6}
                onChange={e => setSettings({ ...settings, tier3DurationMonths: parseInt(e.target.value, 10) || 6 })}
                className="admin-input" required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tier 3 Special Offer Label</label>
              <input 
                type="text" value={settings.tier3SpecialOffer || ''}
                onChange={e => setSettings({ ...settings, tier3SpecialOffer: e.target.value })}
                className="admin-input"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: SEO Meta Tags & Analytics Config */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiGlobe style={{ color: '#38bdf8' }} /> SEO Meta Tags & Analytics
          </h3>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>SEO Site Title</label>
            <input 
              type="text" value={settings.seoSiteTitle || ''}
              onChange={e => setSettings({ ...settings, seoSiteTitle: e.target.value })}
              className="admin-input" style={{ fontWeight: 600 }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>SEO Meta Description</label>
            <textarea 
              rows={2} value={settings.seoMetaDescription || ''}
              onChange={e => setSettings({ ...settings, seoMetaDescription: e.target.value })}
              className="admin-textarea"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Google Site Verification</label>
              <input 
                type="text" value={settings.googleSiteVerification || ''}
                onChange={e => setSettings({ ...settings, googleSiteVerification: e.target.value })}
                className="admin-input"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Umami Website ID</label>
              <input 
                type="text" value={settings.umamiWebsiteId || ''}
                onChange={e => setSettings({ ...settings, umamiWebsiteId: e.target.value })}
                className="admin-input"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: AI Quota & Support Contact Info */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiCpu style={{ color: '#8b5cf6' }} /> AI Quota & Support Contacts
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Website Domain URL (Email Link)</label>
              <input 
                type="url" value={settings.frontendBaseUrl || 'https://airgate-in.vercel.app'}
                onChange={e => setSettings({ ...settings, frontendBaseUrl: e.target.value })}
                className="admin-input" style={{ fontWeight: 700, color: '#38bdf8' }} required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Pro AI Daily Query Limit</label>
              <input 
                type="number" value={settings.aiDailyLimitPremium || 100}
                onChange={e => setSettings({ ...settings, aiDailyLimitPremium: parseInt(e.target.value, 10) || 100 })}
                className="admin-input" required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Support Email</label>
              <input 
                type="email" value={settings.supportEmail || 'support@airgate.in'}
                onChange={e => setSettings({ ...settings, supportEmail: e.target.value })}
                className="admin-input" required
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Support Phone</label>
              <input 
                type="text" value={settings.supportPhone || ''}
                onChange={e => setSettings({ ...settings, supportPhone: e.target.value })}
                className="admin-input"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: Email Automation & Maintenance Mode Toggles */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiShield style={{ color: '#ef4444' }} /> Automations & Maintenance Controls
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem' }}>Auto Welcome Email</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send welcome onboarding email on signup</div>
              </div>
              <input 
                type="checkbox" checked={Boolean(settings.autoWelcomeEmailEnabled)}
                onChange={e => setSettings({ ...settings, autoWelcomeEmailEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem' }}>Auto Drip Offer Email</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send 24h upgrade discount email to free tier users</div>
              </div>
              <input 
                type="checkbox" checked={Boolean(settings.autoDripOfferEmailEnabled)}
                onChange={e => setSettings({ ...settings, autoDripOfferEmailEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.95rem' }}>Maintenance Mode</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Restrict portal access temporarily for core platform updates</div>
            </div>
            <input 
              type="checkbox" checked={Boolean(settings.isMaintenanceMode)}
              onChange={e => setSettings({ ...settings, isMaintenanceMode: e.target.checked })}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
          </div>
        </div>

        <button 
          type="submit" disabled={settingsLoading}
          className="btn btn-primary"
          style={{ padding: '14px', background: '#a855f7', borderColor: '#a855f7', fontWeight: 800, fontSize: '0.98rem' }}
        >
          {settingsLoading ? 'Saving Configuration...' : 'Save All Platform Settings'}
        </button>

      </form>

    </div>
  );
}
