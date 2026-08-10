import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiActivity, FiFileText, FiLayers, FiUsers, 
  FiArrowRight, FiShield, FiAlertTriangle 
} from 'react-icons/fi';

export default function AdminOverviewTab({ stats, statsLoading, setActiveTab }) {
  const navigate = useNavigate();

  return (
    <div>
      {/* Top Stats Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        
        {/* Approved Stats Card */}
        <div className="admin-card">
          <div style={{ position: 'absolute', top: '16px', right: '16px', color: '#10b981', opacity: 0.15 }}>
            <FiActivity size={48} />
          </div>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', marginBottom: '8px' }}>
            Approved PYQ Questions
          </h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981', margin: 0 }}>
            {statsLoading ? '...' : stats.totalApproved}
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Live official PYQs in database
          </div>
        </div>

        {/* Pending Stats Card */}
        <div className="admin-card">
          <div style={{ position: 'absolute', top: '16px', right: '16px', color: '#f59e0b', opacity: 0.15 }}>
            <FiFileText size={48} />
          </div>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', marginBottom: '8px' }}>
            Pending Review PYQs
          </h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f59e0b', margin: 0 }}>
            {statsLoading ? '...' : stats.totalPending}
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Awaiting administrator evaluation
          </div>
        </div>

        {/* Total Questions Card */}
        <div className="admin-card">
          <div style={{ position: 'absolute', top: '16px', right: '16px', color: '#38bdf8', opacity: 0.15 }}>
            <FiLayers size={48} />
          </div>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', marginBottom: '8px' }}>
            Total Official PYQs
          </h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, color: '#38bdf8', margin: 0 }}>
            {statsLoading ? '...' : stats.totalQuestions}
          </p>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            PDF Ingestion dataset size (Excludes AI generated Qs)
          </div>
        </div>

      </div>

      {/* Quick Actions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>

        <div 
          onClick={() => navigate('/admin/users')}
          className="admin-card"
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <FiUsers size={22} style={{ color: '#a855f7' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>User Management</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                View all users, toggle premium, ban/unban, delete accounts
              </p>
            </div>
            <FiArrowRight size={20} style={{ color: '#a855f7' }} />
          </div>
        </div>

        <div 
          onClick={() => navigate('/admin/review-queue')}
          className="admin-card"
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <FiFileText size={22} style={{ color: '#f59e0b' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Review Queue</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                {stats.totalPending} questions awaiting your approval
              </p>
            </div>
            <FiArrowRight size={20} style={{ color: '#f59e0b' }} />
          </div>
        </div>

        <div 
          onClick={() => navigate('/uploads')}
          className="admin-card"
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <FiLayers size={22} style={{ color: '#38bdf8' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Upload PDFs</h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                Parse new official GATE question paper PDFs
              </p>
            </div>
            <FiArrowRight size={20} style={{ color: '#38bdf8' }} />
          </div>
        </div>

      </div>

    </div>
  );
}
