import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_CONFIG from '../config/api';
import AuthService from '../services/authService';
import '../styles/adminPanel.css';

import { 
  FiGrid, FiLayers, FiSend, FiMail, FiGift, 
  FiBookOpen, FiSettings, FiActivity, FiInbox, 
  FiAlertTriangle, FiDatabase, FiExternalLink, FiUsers 
} from 'react-icons/fi';

import AdminSubjectsTab from '../components/admin/AdminSubjectsTab';
import AdminBetaPaymentsTab from '../components/admin/AdminBetaPaymentsTab';
import AdminEmailHubTab from '../components/admin/AdminEmailHubTab';
import AdminBannersTab from '../components/admin/AdminBannersTab';
import AdminLoaderTipsTab from '../components/admin/AdminLoaderTipsTab';
import AdminCouponsTab from '../components/admin/AdminCouponsTab';
import AdminSettingsTab from '../components/admin/AdminSettingsTab';
import AdminMetricsTab from '../components/admin/AdminMetricsTab';
import AdminBugsReportsTab from '../components/admin/AdminBugsReportsTab';
import AdminOverviewTab from '../components/admin/AdminOverviewTab';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('subjects');
  const [currentUser, setCurrentUser] = useState(null);

  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalApproved: 0,
    totalPending: 0
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [betaPendingCount, setBetaPendingCount] = useState(0);
  const [bugs, setBugs] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      navigate('/login');
      return;
    }
    setCurrentUser(user);
    fetchOverviewStats();
    fetchPendingBetaCount();
  }, []);

  const fetchOverviewStats = async () => {
    try {
      setStatsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/questions/stats`, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data) setStats(res.data);
    } catch (err) {
      console.error("Failed to load overview stats", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPendingBetaCount = async () => {
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/payments/verifications`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) {
        const pending = res.data.filter(v => v.status === 'PENDING').length;
        setBetaPendingCount(pending);
      }
    } catch (err) {
      console.error("Failed to load pending beta payment count", err);
    }
  };

  return (
    <div style={{ padding: '0', width: '100%', maxWidth: '100%', margin: '0 auto', background: '#0f121e', minHeight: '100vh' }}>

      {/* ── Premium Sticky Admin Header ─────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'linear-gradient(135deg, rgba(15,18,30,0.98) 0%, rgba(20,24,40,0.98) 100%)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
        padding: '12px 28px 0 28px'
      }}>
        {/* Top Row: Title, User Badge & Go to Website */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(99,102,241,0.5)'
            }}>
              <FiLayers color="#fff" size={18} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                AIRGATE Admin Panel
                <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)', fontWeight: 700 }}>
                  v2.4 Live
                </span>
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => navigate('/admin/users')}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', borderColor: 'rgba(168,85,247,0.4)', color: '#a855f7' }}
            >
              <FiUsers size={14} /> User Management
            </button>

            <button 
              onClick={() => navigate('/')}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}
            >
              <FiExternalLink size={13} /> Go to Website
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div style={{
          display: 'flex', gap: '4px', padding: '8px 0',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {[
            { key: 'subjects',      icon: <FiLayers size={14}/>,        label: 'Subjects Architecture', accent: '#f59e0b' },
            { key: 'beta-payments', icon: <FiSend size={14}/>,          label: 'VIP Beta Payments', accent: '#ec4899', count: betaPendingCount },
            { key: 'email',         icon: <FiMail size={14}/>,          label: 'Email Broadcast Hub', accent: '#0ea5e9' },
            { key: 'banners',       icon: <FiSend size={14}/>,          label: 'Ad Banners', accent: '#8b5cf6' },
            { key: 'tips',          icon: <FiBookOpen size={14}/>,      label: 'Loader Tips', accent: '#f59e0b' },
            { key: 'coupons',       icon: <FiGift size={14}/>,          label: 'Coupons', accent: '#ec4899' },
            { key: 'settings',      icon: <FiSettings size={14}/>,      label: 'Settings', accent: '#a855f7' },
            { key: 'metrics',       icon: <FiActivity size={14}/>,      label: 'Metrics & Telemetry', accent: '#10b981' },
            { key: 'bugs',          icon: <FiInbox size={14}/>,         label: 'User Bugs & Reports', accent: '#ec4899', count: bugs.length + reports.length },
            { key: 'overview',      icon: <FiGrid size={14}/>,          label: 'Overview', accent: '#38bdf8' },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px',
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontSize: '0.82rem', fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.18s ease',
                  position: 'relative',
                  background: isActive ? `linear-gradient(135deg, ${tab.accent}22, ${tab.accent}11)` : 'transparent',
                  color: isActive ? tab.accent : '#94a3b8',
                  borderBottom: isActive ? `2px solid ${tab.accent}` : '2px solid transparent'
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.count > 0 && (
                  <span style={{
                    fontSize: '0.68rem', padding: '1px 6px', borderRadius: '10px',
                    background: tab.accent, color: '#000', fontWeight: 800
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content Container ───────────────────────────────────────────── */}
      <div style={{ padding: '32px 28px' }}>
        {activeTab === 'subjects' && <AdminSubjectsTab />}
        {activeTab === 'beta-payments' && <AdminBetaPaymentsTab />}
        {activeTab === 'email' && <AdminEmailHubTab />}
        {activeTab === 'banners' && <AdminBannersTab />}
        {activeTab === 'tips' && <AdminLoaderTipsTab />}
        {activeTab === 'coupons' && <AdminCouponsTab />}
        {activeTab === 'settings' && <AdminSettingsTab />}
        {activeTab === 'metrics' && <AdminMetricsTab />}
        {activeTab === 'bugs' && <AdminBugsReportsTab bugs={bugs} reports={reports} />}
        {activeTab === 'overview' && <AdminOverviewTab stats={stats} statsLoading={statsLoading} setActiveTab={setActiveTab} />}
      </div>

    </div>
  );
}
