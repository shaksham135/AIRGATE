import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/authService';
import { FiBookOpen, FiPlus, FiRefreshCw, FiTrash2, FiCheck, FiX } from 'react-icons/fi';

export default function AdminLoaderTipsTab() {
  const [adminTips, setAdminTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [newTipText, setNewTipText] = useState('');
  const [newTipCategory, setNewTipCategory] = useState('Motivation');
  const [tipActionMsg, setTipActionMsg] = useState('');

  const fetchTipsAdmin = async () => {
    try {
      setTipsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/tips`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) {
        setAdminTips(res.data);
      }
    } catch (err) {
      console.error("Failed to load admin tips", err);
    } finally {
      setTipsLoading(false);
    }
  };

  useEffect(() => {
    fetchTipsAdmin();
  }, []);

  const handleCreateTip = async (e) => {
    e.preventDefault();
    if (!newTipText.trim()) return;
    try {
      setTipActionMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/tips`, {
        text: newTipText.trim(),
        category: newTipCategory,
        active: true
      }, { headers: AuthService.getAuthHeader() });
      if (res.data) {
        setTipActionMsg('✅ Loader tip created successfully!');
        setNewTipText('');
        fetchTipsAdmin();
      }
    } catch (err) {
      alert("Failed to create tip.");
    }
  };

  const handleToggleTipActive = async (id, currentActive) => {
    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/admin/tips/${id}`, {
        active: !currentActive
      }, { headers: AuthService.getAuthHeader() });
      setAdminTips(prev => prev.map(t => t.id === id ? { ...t, active: !currentActive } : t));
    } catch (err) {
      alert("Failed to update tip status.");
    }
  };

  const handleDeleteTip = async (id) => {
    if (!window.confirm("Delete this loader tip?")) return;
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/api/admin/tips/${id}`, {
        headers: AuthService.getAuthHeader()
      });
      fetchTipsAdmin();
    } catch (err) {
      alert("Failed to delete tip.");
    }
  };

  const handleSeedDefaultTips = async () => {
    try {
      setTipActionMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/tips/seed-defaults`, {}, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data) {
        setTipActionMsg("🎉 50 High-Yield GATE CS Study Tips & Motivational Tricks seeded!");
        fetchTipsAdmin();
      }
    } catch (err) {
      alert("Failed to seed default tips.");
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Card */}
      <div className="admin-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="admin-header-title">
              <FiBookOpen style={{ color: '#f59e0b' }} /> Dynamic Loader Tips & GATE Advice Engine
            </h2>
            <p className="admin-header-desc">
              Manage motivational quotes, GATE preparation strategy tricks, and exam insights displayed randomly during page loading spinners.
            </p>
          </div>
          <button 
            onClick={handleSeedDefaultTips}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', background: '#f59e0b', borderColor: '#f59e0b', fontWeight: 700 }}
          >
            ⚡ Reset / Seed Default 50 Tips
          </button>
        </div>
      </div>

      {tipActionMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>
          {tipActionMsg}
        </div>
      )}

      <div className="admin-grid-tips">
        
        {/* Left: Create Tip Form */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700 }}>
            ➕ Add New Loader Tip
          </h3>

          <form onSubmit={handleCreateTip} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Category</label>
              <select 
                value={newTipCategory}
                onChange={e => setNewTipCategory(e.target.value)}
                className="admin-select"
              >
                <option value="Motivation">🔥 Motivation & Mindset</option>
                <option value="GATE Strategy">🎯 GATE Strategy</option>
                <option value="Algorithm Trick">⚡ Algorithm Trick</option>
                <option value="OS Insight">💻 OS Insight</option>
                <option value="Math Formula">📐 Math Formula</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Tip Text</label>
              <textarea 
                rows={4}
                placeholder="e.g. Master the Master Theorem for divide-and-conquer recurrence relations to save 3 minutes in GATE CS!"
                value={newTipText}
                onChange={e => setNewTipText(e.target.value)}
                className="admin-textarea"
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '12px', background: '#f59e0b', borderColor: '#f59e0b', fontWeight: 800 }}
            >
              Add Loader Tip
            </button>
          </form>
        </div>

        {/* Right: Existing Tips Table */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📜 Active Tips Repository ({adminTips.length})</span>
            <button onClick={fetchTipsAdmin} className="btn btn-outline" style={{ padding: '3px 8px', fontSize: '0.75rem' }}><FiRefreshCw /></button>
          </h3>

          {tipsLoading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Loading tips...</div>
          ) : adminTips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No loader tips in database. Click "Reset / Seed Default 50 Tips" above!</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '550px', overflowY: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Tip Text</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminTips.map(t => (
                    <tr key={t.id}>
                      <td><span className="admin-badge admin-badge-amber">{t.category}</span></td>
                      <td style={{ fontSize: '0.85rem', color: '#e2e8f0', maxWidth: '350px' }}>{t.text}</td>
                      <td>
                        <button 
                          onClick={() => handleToggleTipActive(t.id, t.active)}
                          className={`admin-badge ${t.active ? 'admin-badge-emerald' : 'admin-badge-rose'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                        >
                          {t.active ? <FiCheck /> : <FiX />} {t.active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteTip(t.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
