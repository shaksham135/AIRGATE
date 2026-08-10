import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/AuthService';
import { 
  FiSend, FiRefreshCw, FiCheckCircle, FiXCircle, 
  FiEye, FiClock, FiSettings, FiCheck
} from 'react-icons/fi';

export default function AdminBetaPaymentsTab() {
  const [betaVerifications, setBetaVerifications] = useState([]);
  const [betaLoading, setBetaLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // VIP Beta Payment Config State
  const [betaConfig, setBetaConfig] = useState({
    betaPaymentEnabled: true,
    betaUpiId: 'airgate@upi',
    betaQrImageUrl: '',
    betaSpotsRemaining: 100,
    betaTier1Price: 49.00,
    betaTier2Price: 149.00,
    betaTier3Price: 249.00,
    betaBannerHeading: "⚡ Limited Founder's VIP Beta Access",
    betaBannerSubheading: "Get Full Aspirant Pro Access starting at ₹49/month!",
    betaTier1Offer: "⚡ 1-Month Founder Pass — Save 75%!",
    betaTier2Offer: "🔥 3-Month Sprint Pass — Save 70%!",
    betaTier3Offer: "🏆 6-Month Ultimate Pass — Save 65%!"
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState('');

  const fetchBetaVerifications = async () => {
    try {
      setBetaLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/payments/admin/verifications`, {
        headers: AuthService.getAuthHeader()
      });
      const contentList = Array.isArray(res.data) ? res.data : (res.data?.content || []);
      setBetaVerifications(contentList);
    } catch (err) {
      console.error("Failed to load payment verifications", err);
    } finally {
      setBetaLoading(false);
    }
  };

  const fetchPricingConfig = async () => {
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/payments/pricing`);
      if (res.data) {
        setBetaConfig(prev => ({
          ...prev,
          betaPaymentEnabled: res.data.isBetaMode !== undefined ? res.data.isBetaMode : true,
          betaUpiId: res.data.betaUpiId || 'airgate@upi',
          betaQrImageUrl: res.data.betaQrImageUrl || '',
          betaSpotsRemaining: res.data.betaSpotsRemaining !== undefined ? res.data.betaSpotsRemaining : 100,
          betaTier1Price: res.data.betaTier1Price || 49.00,
          betaTier2Price: res.data.betaTier2Price || 149.00,
          betaTier3Price: res.data.betaTier3Price || 249.00,
          betaBannerHeading: res.data.betaBannerHeading || "⚡ Limited Founder's VIP Beta Access",
          betaBannerSubheading: res.data.betaBannerSubheading || "Get Full Aspirant Pro Access starting at ₹49/month!",
          betaTier1Offer: res.data.betaTier1Offer || "⚡ 1-Month Founder Pass — Save 75%!",
          betaTier2Offer: res.data.betaTier2Offer || "🔥 3-Month Sprint Pass — Save 70%!",
          betaTier3Offer: res.data.betaTier3Offer || "🏆 6-Month Ultimate Pass — Save 65%!"
        }));
      }
    } catch (err) {
      console.error("Failed to load pricing config", err);
    }
  };

  useEffect(() => {
    fetchBetaVerifications();
    fetchPricingConfig();
  }, []);

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this payment and upgrade user account to Aspirant Pro?")) return;
    try {
      setActionLoading(true);
      setActionMessage('');
      await axios.post(`${API_CONFIG.BASE_URL}/api/payments/admin/verifications/${id}/approve`, {}, {
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
      await axios.post(`${API_CONFIG.BASE_URL}/api/payments/admin/verifications/${id}/reject`, {
        notes: reason
      }, {
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

  const handleSaveBetaSettings = async (e) => {
    e.preventDefault();
    try {
      setConfigLoading(true);
      setConfigSuccessMsg('');
      await axios.post(`${API_CONFIG.BASE_URL}/api/payments/admin/settings/beta`, betaConfig, {
        headers: AuthService.getAuthHeader()
      });
      setConfigSuccessMsg("⚙️ VIP Beta Payment Settings updated successfully!");
      fetchPricingConfig();
    } catch (err) {
      alert("Failed to save VIP Beta payment settings.");
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Card */}
      <div className="admin-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="admin-header-title">
              <FiSend style={{ color: '#ec4899' }} /> VIP Beta Manual Payment Submissions
            </h2>
            <p className="admin-header-desc">
              Review & approve manual UPI QR payments and configure VIP Beta pricing passes and UPI details.
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

      {/* Main Grid: Left Payment Verification List + Right VIP Beta Mode Controls */}
      <div className="admin-grid-split-rev" style={{ marginBottom: '32px' }}>

        {/* LEFT: Submissions Table */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700 }}>
            📥 Pending & Processed Payments ({betaVerifications.length})
          </h3>

          {betaLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading payment verifications...</div>
          ) : betaVerifications.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No payment verification submissions recorded yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan & Amount</th>
                    <th>UTR / Ref</th>
                    <th>Status</th>
                    <th>Screenshot</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {betaVerifications.map(pv => {
                    const isPending = pv.status === 'PENDING';
                    return (
                      <tr key={pv.id}>
                        <td style={{ fontWeight: 600 }}>
                          <div>{pv.username || pv.email || `User #${pv.userId}`}</div>
                          {pv.email && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{pv.email}</div>}
                        </td>
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
                        <td>
                          {pv.screenshotUrl ? (
                            <button 
                              onClick={() => setPreviewImage(`${API_CONFIG.BASE_URL}${pv.screenshotUrl}`)}
                              className="btn btn-outline"
                              style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <FiEye /> View
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No File</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button 
                                disabled={actionLoading}
                                onClick={() => handleApprove(pv.id)}
                                className="btn btn-primary"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#10b981', borderColor: '#10b981', fontWeight: 700 }}
                              >
                                Approve
                              </button>
                              <button 
                                disabled={actionLoading}
                                onClick={() => handleReject(pv.id)}
                                className="btn btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Done</span>
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

        {/* RIGHT: VIP Beta Payment Settings Controls */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiSettings style={{ color: '#ec4899' }} /> VIP Beta & UPI Settings
          </h3>

          {configSuccessMsg && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.82rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
              {configSuccessMsg}
            </div>
          )}

          <form onSubmit={handleSaveBetaSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Beta Payment Mode Toggle */}
            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#ec4899', fontSize: '0.88rem' }}>VIP Beta UPI Mode</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enable manual QR code & UTR payment verification</div>
              </div>
              <input 
                type="checkbox"
                checked={betaConfig.betaPaymentEnabled}
                onChange={e => setBetaConfig({ ...betaConfig, betaPaymentEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>UPI ID (VPA)</label>
              <input 
                type="text" 
                value={betaConfig.betaUpiId}
                onChange={e => setBetaConfig({ ...betaConfig, betaUpiId: e.target.value })}
                className="admin-input"
                style={{ fontWeight: 700, fontFamily: 'monospace' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>QR Code Image URL</label>
              <input 
                type="text" 
                placeholder="e.g. /uploads/upi_qr.png" 
                value={betaConfig.betaQrImageUrl}
                onChange={e => setBetaConfig({ ...betaConfig, betaQrImageUrl: e.target.value })}
                className="admin-input"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>1-Mo Price (₹)</label>
                <input 
                  type="number" 
                  value={betaConfig.betaTier1Price}
                  onChange={e => setBetaConfig({ ...betaConfig, betaTier1Price: parseFloat(e.target.value) || 0 })}
                  className="admin-input"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>3-Mo Price (₹)</label>
                <input 
                  type="number" 
                  value={betaConfig.betaTier2Price}
                  onChange={e => setBetaConfig({ ...betaConfig, betaTier2Price: parseFloat(e.target.value) || 0 })}
                  className="admin-input"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>6-Mo Price (₹)</label>
                <input 
                  type="number" 
                  value={betaConfig.betaTier3Price}
                  onChange={e => setBetaConfig({ ...betaConfig, betaTier3Price: parseFloat(e.target.value) || 0 })}
                  className="admin-input"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Beta Spots Counter</label>
              <input 
                type="number" 
                value={betaConfig.betaSpotsRemaining}
                onChange={e => setBetaConfig({ ...betaConfig, betaSpotsRemaining: parseInt(e.target.value, 10) || 0 })}
                className="admin-input"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={configLoading}
              className="btn btn-primary"
              style={{ marginTop: '6px', padding: '10px', background: '#ec4899', borderColor: '#ec4899', fontWeight: 800, fontSize: '0.85rem' }}
            >
              Save VIP Beta Config
            </button>
          </form>
        </div>

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
