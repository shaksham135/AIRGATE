import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/authService';
import { FiActivity, FiUsers, FiCpu, FiTrendingUp } from 'react-icons/fi';

export default function AdminMetricsTab() {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    newSignupsToday: 0,
    dau: 0,
    mau: 0,
    retentionIndex: 0.0,
    aiRequestsToday: 0,
    questionsSolvedToday: 0,
    mockTestsAttempted: 0,
    totalRevenue: 0.0,
    revenueToday: 0.0,
    dailyTrends: []
  });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [groqUsage, setGroqUsage] = useState({ usedTokens: 0, limit: 10000000 });

  const fetchAdminMetrics = async () => {
    try {
      setMetricsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/analytics/dashboard`, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data) setMetrics(res.data);
    } catch (err) {
      console.error("Failed to load admin metrics:", err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const fetchGroqUsage = async () => {
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/groq-usage`, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data) setGroqUsage(res.data);
    } catch (err) {
      console.error("Failed to load Groq usage stats:", err);
    }
  };

  useEffect(() => {
    fetchAdminMetrics();
    fetchGroqUsage();
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div className="admin-header-card">
        <h2 className="admin-header-title">
          <FiActivity style={{ color: '#10b981' }} /> Realtime Analytics & Telemetry Metrics
        </h2>
        <p className="admin-header-desc">
          Monitor user signups, DAU/MAU ratios, daily AI queries, revenue trends, and Groq LLM API token consumption.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        <div className="admin-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Registered Users</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10b981', margin: '8px 0' }}>{metrics.totalUsers}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+{metrics.newSignupsToday} signups today</div>
        </div>

        <div className="admin-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Daily Active Users (DAU)</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8', margin: '8px 0' }}>{metrics.dau}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>MAU: {metrics.mau} aspirants</div>
        </div>

        <div className="admin-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Daily AI Tutor Queries</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#8b5cf6', margin: '8px 0' }}>{metrics.aiRequestsToday}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{metrics.questionsSolvedToday} questions solved today</div>
        </div>

        <div className="admin-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Platform Revenue</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ec4899', margin: '8px 0' }}>₹{metrics.totalRevenue}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+₹{metrics.revenueToday} revenue today</div>
        </div>

      </div>

      {/* Groq Token Meter */}
      <div className="admin-card" style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiCpu style={{ color: '#8b5cf6' }} /> Groq LLM API Token Meter
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
          Monitors daily token consumption across AI Tutor queries, explanation generation, and automated review tasks.
        </p>
        <div style={{ width: '100%', height: '14px', borderRadius: '7px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{ 
            width: `${Math.min(100, ((groqUsage.usedTokens || 0) / (groqUsage.limit || 10000000)) * 100)}%`, 
            height: '100%', 
            background: 'linear-gradient(90deg, #8b5cf6, #ec4899)', 
            borderRadius: '7px' 
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          <span>Used: {(groqUsage.usedTokens || 0).toLocaleString()} Tokens</span>
          <span>Daily Cap: {(groqUsage.limit || 10000000).toLocaleString()} Tokens</span>
        </div>
      </div>

    </div>
  );
}
