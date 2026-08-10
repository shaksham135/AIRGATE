import React from 'react';
import { FiInbox, FiAlertTriangle, FiCheckCircle, FiClock } from 'react-icons/fi';

export default function AdminBugsReportsTab({ bugs = [], reports = [], onResolveBug, onResolveReport }) {
  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Card */}
      <div className="admin-header-card">
        <h2 className="admin-header-title">
          <FiInbox style={{ color: '#ec4899' }} /> User Bug Reports & Question Feedback
        </h2>
        <p className="admin-header-desc">
          Review issue reports submitted by students regarding mathematical errors, diagram typos, or portal bugs.
        </p>
      </div>

      <div className="admin-grid-equal">
        
        {/* User Bugs */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiInbox style={{ color: '#ec4899' }} /> User Bug Reports ({bugs.length})
          </h3>

          {bugs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No active bug reports reported by users.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
              {bugs.map(b => (
                <div key={b.id} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: '#ec4899', fontSize: '0.85rem' }}>{b.reporterEmail || 'Anonymous'}</span>
                    <span className="admin-badge admin-badge-amber"><FiClock /> {b.status || 'OPEN'}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '8px' }}>{b.description || b.message}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => onResolveBug && onResolveBug(b.id)}
                      className="btn btn-outline"
                      style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
                    >
                      <FiCheckCircle /> Mark Resolved
                    </button>
                  </div>
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

          {reports.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No flagged questions reported.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
              {reports.map(r => (
                <div key={r.id} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.85rem' }}>Question #{r.questionId}</span>
                    <span className="admin-badge admin-badge-rose">{r.reason || 'Flagged'}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginBottom: '8px' }}>{r.comment || 'Issue with options or formula typesetting.'}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => onResolveReport && onResolveReport(r.id)}
                      className="btn btn-outline"
                      style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
                    >
                      <FiCheckCircle /> Dismiss Flag
                    </button>
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
