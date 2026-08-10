import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/AuthService';
import { 
  FiSend, FiRefreshCw, FiCheckCircle, FiXCircle, 
  FiEye, FiClock, FiAlertCircle 
} from 'react-icons/fi';

export default function AdminBetaPaymentsTab() {
  const [betaVerifications, setBetaVerifications] = useState([]);
  const [betaLoading, setBetaLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchBetaVerifications = async () => {
    try {
      setBetaLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/payments/verifications`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) {
        setBetaVerifications(res.data);
      }
    } catch (err) {
      console.error("Failed to load payment verifications", err);
    } finally {
      setBetaLoading(false);
    }
  };

  useEffect(() => {
    fetchBetaVerifications();
  }, []);

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this payment and upgrade user account to Aspirant Pro?")) return;
    try {
      setActionLoading(true);
      setActionMessage('');
      await axios.put(`${API_CONFIG.BASE_URL}/api/admin/payments/verifications/${id}/approve`, {}, {
        headers: AuthService.getAuthHeader()
      });
      setActionMessage("✅ Payment approved and user upgraded to Aspirant Pro!");
      fetchBetaVerifications();
    } catch (err) {
      alert("Failed to approve payment verification.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt("Reason for rejection (e.g., UTR mismatch / invalid screenshot):", "Invalid Transaction Reference");
    if (reason === null) return;
    try {
      setActionLoading(true);
      setActionMessage('');
      await axios.put(`${API_CONFIG.BASE_URL}/api/admin/payments/verifications/${id}/reject?reason=${encodeURIComponent(reason)}`, {}, {
        headers: AuthService.getAuthHeader()
      });
      setActionMessage("❌ Payment verification rejected.");
      fetchBetaVerifications();
    } catch (err) {
      alert("Failed to reject payment verification.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Card */}
      <div className="admin-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="admin-header-title">
              <FiSend style={{ color: '#ec4899' }} /> VIP Beta Manual Payment Submissions
            </h2>
            <p className="admin-header-desc">
              Review and approve manual UPI QR payments and Razorpay receipts submitted by beta testers.
            </p>
          </div>
          <button 
            onClick={fetchBetaVerifications}
            className="btn btn-outline"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FiRefreshCw /> Refresh List
          </button>
        </div>
      </div>

      {actionMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.9rem', fontWeight: 600 }}>
          {actionMessage}
        </div>
      )}

      <div className="admin-card">
        {betaLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading payment verifications...</div>
        ) : betaVerifications.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No payment verification submissions recorded yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Plan & Amount</th>
                  <th>UTR / Ref Number</th>
                  <th>Status</th>
                  <th>Submitted At</th>
                  <th>Screenshot</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {betaVerifications.map(pv => {
                  const isPending = pv.status === 'PENDING';
                  return (
                    <tr key={pv.id}>
                      <td style={{ fontWeight: 600 }}>{pv.userEmail || `User #${pv.userId}`}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#ec4899' }}>₹{pv.amount}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pv.planType || '1 Month'}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                        {pv.utrNumber || 'N/A'}
                      </td>
                      <td>
                        <span className={`admin-badge ${pv.status === 'APPROVED' ? 'admin-badge-emerald' : pv.status === 'REJECTED' ? 'admin-badge-rose' : 'admin-badge-amber'}`}>
                          {pv.status === 'PENDING' ? <FiClock /> : pv.status === 'APPROVED' ? <FiCheckCircle /> : <FiXCircle />}
                          {pv.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {pv.createdAt ? new Date(pv.createdAt).toLocaleString('en-IN') : 'N/A'}
                      </td>
                      <td>
                        {pv.screenshotPath ? (
                          <button 
                            onClick={() => setPreviewImage(`${API_CONFIG.BASE_URL}${pv.screenshotPath}`)}
                            className="btn btn-outline"
                            style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <FiEye /> View Image
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No File</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isPending ? (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              disabled={actionLoading}
                              onClick={() => handleApprove(pv.id)}
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: '0.78rem', background: '#10b981', borderColor: '#10b981', fontWeight: 700 }}
                            >
                              Approve
                            </button>
                            <button 
                              disabled={actionLoading}
                              onClick={() => handleReject(pv.id)}
                              className="btn btn-outline"
                              style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SCREENSHOT PREVIEW MODAL */}
      {previewImage && (
        <div className="admin-modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="admin-modal-dialog" style={{ maxWidth: '650px', background: '#0f121e' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>🖼️ Payment Receipt Screenshot</h3>
              <button onClick={() => setPreviewImage(null)} className="btn btn-outline" style={{ padding: '2px 8px' }}>✕</button>
            </div>
            <img src={previewImage} alt="Payment Receipt" style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border-color)' }} />
          </div>
        </div>
      )}

    </div>
  );
}
