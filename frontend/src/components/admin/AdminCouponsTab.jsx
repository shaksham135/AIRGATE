import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/authService';
import { FiGift, FiPlus, FiTrash2 } from 'react-icons/fi';

export default function AdminCouponsTab() {
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponDiscountType, setCouponDiscountType] = useState('PERCENTAGE');
  const [couponDiscountValue, setCouponDiscountValue] = useState(50);
  const [couponPlanTier, setCouponPlanTier] = useState('ALL');
  const [couponMaxUses, setCouponMaxUses] = useState(100);
  const [couponMinOrder, setCouponMinOrder] = useState(0);
  const [couponActionMsg, setCouponActionMsg] = useState('');

  const fetchCoupons = async () => {
    try {
      setCouponsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/coupons`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) {
        setCoupons(res.data);
      }
    } catch (err) {
      console.error("Failed to load coupons", err);
    } finally {
      setCouponsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!couponCodeInput.trim()) return;

    try {
      setCouponActionMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/coupons`, {
        code: couponCodeInput.trim().toUpperCase(),
        discountType: couponDiscountType,
        discountValue: parseFloat(couponDiscountValue),
        applicableTier: couponPlanTier,
        maxUses: parseInt(couponMaxUses, 10),
        minOrderAmount: parseFloat(couponMinOrder),
        active: true
      }, { headers: AuthService.getAuthHeader() });

      if (res.data) {
        setCouponActionMsg(`🎉 Coupon '${res.data.code}' created successfully!`);
        setCouponCodeInput('');
        fetchCoupons();
      }
    } catch (err) {
      alert("Failed to create coupon.");
    }
  };

  const handleDeleteCoupon = async (id, code) => {
    if (!window.confirm(`Delete coupon '${code}'?`)) return;
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/api/admin/coupons/${id}`, {
        headers: AuthService.getAuthHeader()
      });
      fetchCoupons();
    } catch (err) {
      alert("Failed to delete coupon.");
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Card */}
      <div className="admin-header-card">
        <h2 className="admin-header-title">
          <FiGift style={{ color: '#ec4899' }} /> Enterprise Coupons & Discount Rules Hub
        </h2>
        <p className="admin-header-desc">
          Generate promo codes, percentage/fixed discounts, usage limits, and tier-restricted promotional vouchers.
        </p>
      </div>

      <div className="admin-grid-split">
        
        {/* Left: Create Coupon Form */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700 }}>
            ➕ Create Promo Coupon
          </h3>

          {couponActionMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
              {couponActionMsg}
            </div>
          )}

          <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Coupon Code</label>
              <input 
                type="text" 
                placeholder="e.g. GATEPRO50" 
                value={couponCodeInput}
                onChange={e => setCouponCodeInput(e.target.value.toUpperCase())}
                className="admin-input"
                style={{ fontWeight: 800, fontFamily: 'monospace' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Discount Type</label>
                <select 
                  value={couponDiscountType}
                  onChange={e => setCouponDiscountType(e.target.value)}
                  className="admin-select"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Discount Value</label>
                <input 
                  type="number" 
                  value={couponDiscountValue}
                  onChange={e => setCouponDiscountValue(e.target.value)}
                  className="admin-input"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Max Total Uses</label>
                <input 
                  type="number" 
                  value={couponMaxUses}
                  onChange={e => setCouponMaxUses(e.target.value)}
                  className="admin-input"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Min Order Amount (₹)</label>
                <input 
                  type="number" 
                  value={couponMinOrder}
                  onChange={e => setCouponMinOrder(e.target.value)}
                  className="admin-input"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '12px', background: '#ec4899', borderColor: '#ec4899', fontWeight: 800 }}
            >
              Create Coupon Code
            </button>
          </form>
        </div>

        {/* Right: Active Coupons List */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700 }}>
            🎟️ Active Coupons ({coupons.length})
          </h3>

          {couponsLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading coupons...</p>
          ) : coupons.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No coupon rules created. Add your first coupon on the left!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {coupons.map(c => (
                <div key={c.id} style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ec4899', fontFamily: 'monospace' }}>{c.code}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`} • Max uses: {c.maxUses}
                    </div>
                  </div>
                  <button 
                    className="btn btn-outline"
                    onClick={() => handleDeleteCoupon(c.id, c.code)}
                    style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', padding: '4px 10px', fontSize: '0.78rem' }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
