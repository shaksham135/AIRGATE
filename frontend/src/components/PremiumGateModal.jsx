import React, { useState } from 'react';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { FiLock, FiCheck, FiCpu, FiClock, FiActivity, FiFileText, FiArrowRight, FiX } from 'react-icons/fi';

export default function PremiumGateModal({ isOpen, onClose, onUpgradeSuccess, initialCoupon = '' }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);

  // Plan Tier & Coupon state
  const [selectedPlan, setSelectedPlan] = useState('SEASON'); // Default 6-Month Season Pass
  const [originalPrice, setOriginalPrice] = useState(499);
  const [couponCode, setCouponCode] = useState(initialCoupon);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMsg, setCouponMsg] = useState('');

  React.useEffect(() => {
    if (initialCoupon) {
      setCouponCode(initialCoupon);
    }
  }, [initialCoupon]);

  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await axios.get(`${API_CONFIG.BASE_URL}/api/payments/pricing`);
        if (res.data && res.data.enabled === false) {
          setPaymentsEnabled(false);
        }
      } catch (e) {}
    };
    checkStatus();
  }, []);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.put(`${API_CONFIG.BASE_URL}/api/users/premium`, {}, {
        headers: AuthService.getAuthHeader()
      });
      
      // Update local storage
      const user = AuthService.getCurrentUser();
      if (user) {
        user.isPremium = true;
        localStorage.setItem('user', JSON.stringify(user));
      }
      
      setSuccess(true);
      setTimeout(() => {
        if (onUpgradeSuccess) onUpgradeSuccess();
        onClose();
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upgrade to Premium. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 7, 12, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '40px 20px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '24px',
        maxWidth: '540px',
        width: '100%',
        padding: '40px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            borderRadius: '50%',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.target.style.color = '#fff'; e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => { e.target.style.color = 'var(--text-muted)'; e.target.style.backgroundColor = 'transparent'; }}
          title="Close Modal"
        >
          <FiX size={20} />
        </button>
        {/* Glow Decorator */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary)',
          filter: 'blur(70px)',
          opacity: 0.3,
          pointerEvents: 'none'
        }}></div>

        {!success ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '50%',
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
                boxShadow: '0 0 15px rgba(139, 92, 246, 0.2)'
              }}>
                <FiLock size={28} />
              </div>
            </div>

            <h3 style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              textAlign: 'center',
              marginBottom: '8px',
              fontFamily: 'var(--font-title)',
              background: 'linear-gradient(135deg, #fff 40%, var(--color-primary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Upgrade to Aspirant Pro
            </h3>
            <p style={{
              color: 'var(--text-secondary)',
              textAlign: 'center',
              fontSize: '0.9rem',
              marginBottom: '28px'
            }}>
              Supercharge your GATE CSE preparation with advanced AI tutors, customizable mock generators, and deep analytics.
            </p>

            {error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-error)',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.85rem',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                {error}
              </div>
            )}

            {/* Features list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ color: 'var(--color-secondary)', marginTop: '2px' }}><FiCpu size={18} /></div>
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '2px' }}>Interactive KaTeX AI Doubt Solver</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Get step-by-step math breakdowns and explanations of derivations.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ color: 'var(--color-secondary)', marginTop: '2px' }}><FiClock size={18} /></div>
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '2px' }}>Dynamic Custom Mock Test Generator</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Practice specific subjects & topics with custom questions & timers.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ color: 'var(--color-secondary)', marginTop: '2px' }}><FiActivity size={18} /></div>
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '2px' }}>Time & Topic Performance Analytics</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Identify weak concepts and compare answer speeds with toppers.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ color: 'var(--color-secondary)', marginTop: '2px' }}><FiFileText size={18} /></div>
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '2px' }}>Printable Revision PDF Compiler</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Compile and export bookmarked questions and step-by-step formulas.</p>
                </div>
              </div>
            </div>

            {/* Plan Tier Selection */}
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Select Membership Plan</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div 
                  onClick={() => { setSelectedPlan('MONTHLY'); setOriginalPrice(149); setAppliedCoupon(null); setCouponMsg(''); }}
                  style={{
                    padding: '10px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                    border: selectedPlan === 'MONTHLY' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                    background: selectedPlan === 'MONTHLY' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255,255,255,0.02)'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1 Month</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>₹149</div>
                </div>

                <div 
                  onClick={() => { setSelectedPlan('SEASON'); setOriginalPrice(499); setAppliedCoupon(null); setCouponMsg(''); }}
                  style={{
                    padding: '10px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center', position: 'relative',
                    border: selectedPlan === 'SEASON' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                    background: selectedPlan === 'SEASON' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255,255,255,0.02)'
                  }}
                >
                  <span style={{ position: 'absolute', top: '-8px', right: '4px', background: '#10b981', color: '#000', fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }}>BEST VALUE</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>6 Months</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>₹499</div>
                </div>

                <div 
                  onClick={() => { setSelectedPlan('ANNUAL'); setOriginalPrice(699); setAppliedCoupon(null); setCouponMsg(''); }}
                  style={{
                    padding: '10px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                    border: selectedPlan === 'ANNUAL' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                    background: selectedPlan === 'ANNUAL' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255,255,255,0.02)'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1 Year</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>₹699</div>
                </div>
              </div>
            </div>

            {/* Coupon Code Input */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Enter Coupon Code (e.g. GATE2026)"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)', color: '#fff', fontSize: '0.88rem', textTransform: 'uppercase',
                    fontFamily: 'monospace', fontWeight: 700
                  }}
                />
                <button 
                  type="button" 
                  className="btn btn-outline"
                  onClick={async () => {
                    if (!couponCode.trim()) return;
                    setCouponLoading(true);
                    setCouponMsg('');
                    try {
                      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/coupons/validate`, {
                        code: couponCode,
                        planTier: selectedPlan,
                        originalPrice: originalPrice
                      }, { headers: AuthService.getAuthHeader() });

                      if (res.data && res.data.valid) {
                        setAppliedCoupon(res.data);
                        setCouponMsg({ type: 'success', text: res.data.message });
                      } else {
                        setAppliedCoupon(null);
                        setCouponMsg({ type: 'error', text: res.data?.message || 'Invalid Coupon' });
                      }
                    } catch (err) {
                      setAppliedCoupon(null);
                      setCouponMsg({ type: 'error', text: err.response?.data?.message || 'Failed to validate coupon' });
                    } finally {
                      setCouponLoading(false);
                    }
                  }}
                  disabled={couponLoading || !couponCode.trim()}
                  style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                >
                  {couponLoading ? 'Checking...' : 'Apply'}
                </button>
              </div>

              {couponMsg && (
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: couponMsg.type === 'success' ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                  {couponMsg.text}
                </div>
              )}
            </div>

            {/* Final Price Summary Box */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '16px',
              padding: '16px 24px',
              marginBottom: '28px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: appliedCoupon ? '6px' : '0' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Original Plan Price:</span>
                <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>₹{originalPrice}</span>
              </div>

              {appliedCoupon && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                  <span>Discount ({appliedCoupon.code}):</span>
                  <span>-₹{appliedCoupon.discountAmount}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: appliedCoupon ? '1px dashed rgba(255,255,255,0.1)' : 'none', paddingTop: appliedCoupon ? '8px' : '0' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>Total Payable:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', fontFamily: 'var(--font-title)' }}>
                  ₹{appliedCoupon ? appliedCoupon.finalPrice : originalPrice}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ flex: 1, padding: '12px' }}
                onClick={onClose}
                disabled={loading}
              >
                Maybe Later
              </button>
              {!paymentsEnabled ? (
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ flex: 2, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0.9, cursor: 'not-allowed', borderColor: '#38bdf8', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.08)' }}
                  disabled={true}
                >
                  Coming Soon 🚀
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ flex: 2, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={handleUpgrade}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : (
                    <>
                      Activate Aspirant Pro <FiArrowRight />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '50%',
                width: '72px',
                height: '72px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-success)',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)'
              }}>
                <FiCheck size={36} />
              </div>
            </div>

            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
              Aspirant Pro Active!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '320px', margin: '0 auto' }}>
              Your account has been upgraded successfully. Unlocking all practice arenas, tutors, and advanced files...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
