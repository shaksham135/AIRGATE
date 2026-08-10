import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/AuthService';
import { FiInbox, FiAlertTriangle, FiCheckCircle, FiClock, FiRefreshCw } from 'react-icons/fi';

export default function AdminBugsReportsTab() {
  const [bugs, setBugs] = useState([]);
  const [reports, setReports] = useState([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);

  const fetchBugs = async () => {
    try {
      setBugsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/bugs`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) {
        setBugs(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch bugs", err);
    } finally {
      setBugsLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      setReportsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/reports`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) {
        setReports(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch question flags", err);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
    fetchReports();
  }, []);

  const handleResolveBug = async (id) => {
    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/admin/bugs/${id}/status?status=RESOLVED`, {}, {
        headers: AuthService.getAuthHeader()
      });
      fetchBugs();
    } catch (err) {
      alert("Failed to resolve bug.");
    }
  };

  const handleResolveReport = async (id) => {
    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/admin/reports/${id}/status?status=RESOLVED`, {}, {
        headers: AuthService.getAuthHeader()
      });
      fetchReports();
    } catch (err) {
      alert("Failed to resolve report.");
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Card */}
      <div className="admin-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="admin-header-title">
              <FiInbox style={{ color: '#ec4899' }} /> User Bug Reports & Question Flags Hub
            </h2>
            <p className="admin-header-desc">
              Review issue reports and question content feedback submitted by students.
            </p>
          </div>
          <button 
            onClick={() => { fetchBugs(); fetchReports(); }}
            className="btn btn-outline"
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FiRefreshCw /> Refresh Lists
          </button>
        </div>
      </div>

      <div className="admin-grid-equal">
        
        {/* User Bugs */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiInbox style={{ color: '#ec4899' }} /> User Bug Reports ({bugs.length})
          </h3>

          {bugsLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading bug reports...</p>
          ) : bugs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No active bug reports reported by users.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto' }}>
              {bugs.map(b => (
                <div key={b.id} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: '#ec4899', fontSize: '0.85rem' }}>{b.username || b.email || 'Anonymous'}</span>
                    <span className={`admin-badge ${b.status === 'RESOLVED' ? 'admin-badge-emerald' : 'admin-badge-amber'}`}>
                      {b.status === 'RESOLVED' ? <FiCheckCircle /> : <FiClock />} {b.status || 'OPEN'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{b.title || 'User Feedback'}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px', whiteSpace: 'pre-line' }}>{b.description || b.message}</div>
                  {b.pageUrl && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '8px', wordBreak: 'break-all' }}>URL: {b.pageUrl}</div>}
                  
                  {b.status !== 'RESOLVED' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleResolveBug(b.id)}
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <FiCheckCircle /> Mark Resolved
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question Content Reports */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiAlertTriangle style={{ color: '#ef4444' }} /> Question Content Flags ({reports.length})
          </h3>

          {reportsLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading flagged questions...</p>
          ) : reports.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No flagged questions reported.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto' }}>
              {reports.map(r => (
                <div key={r.id} style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.85rem' }}>Question #{r.questionId}</span>
                    <span className={`admin-badge ${r.status === 'RESOLVED' ? 'admin-badge-emerald' : 'admin-badge-rose'}`}>
                      {r.status === 'RESOLVED' ? <FiCheckCircle /> : <FiAlertTriangle />} {r.status || 'OPEN'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '8px' }}>{r.reason || r.comment || 'Issue with options or formula typesetting.'}</div>
                  
                  {r.status !== 'RESOLVED' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleResolveReport(r.id)}
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <FiCheckCircle /> Dismiss / Resolve Flag
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
