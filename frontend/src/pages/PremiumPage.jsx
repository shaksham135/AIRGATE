import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { FiCheck, FiX, FiCpu, FiClock, FiActivity, FiFileText, FiAward, FiZap, FiLoader } from 'react-icons/fi';

export default function PremiumPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [upgraded, setUpgraded] = useState(AuthService.isPremium());
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMsg, setCouponMsg] = useState('');

  // Dynamic Multi-Tier Pricing state
  const [tiers, setTiers] = useState({
    tier1: { price: 99.0, duration: 1, offer: 'Best for quick revisions' },
    tier2: { price: 249.0, duration: 3, offer: 'Save 15% - Most Popular' },
    tier3: { price: 449.0, duration: 6, offer: 'Save 25% - Complete Prep' }
  });

  React.useEffect(() => {
    const fetchTiers = async () => {
      try {
        const response = await axios.get(`${API_CONFIG.BASE_URL}/api/payments/pricing`);
        if (response.data) {
          setTiers(prev => ({
            enabled: response.data.enabled !== undefined ? response.data.enabled : prev.enabled,
            tier1: response.data.tier1 || prev.tier1 || { price: 99.0, duration: 1, offer: 'Best for quick revisions' },
            tier2: response.data.tier2 || prev.tier2 || { price: 249.0, duration: 3, offer: 'Save 15% - Most Popular' },
            tier3: response.data.tier3 || prev.tier3 || { price: 449.0, duration: 6, offer: 'Save 25% - Complete Prep' }
          }));
          if (response.data.tier1?.duration) {
            setSelectedDuration(response.data.tier1.duration);
          }
        }
      } catch (err) {
        console.error("Failed to load dynamic pricing tiers:", err);
      }
    };
    fetchTiers();
  }, []);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async () => {
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) {
      setError('Please Sign In or Create an Account first to activate Aspirant Pro!');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const resLoaded = await loadRazorpayScript();
    if (!resLoaded) {
      setError('Razorpay SDK failed to load. Are you online?');
      setLoading(false);
      return;
    }

    try {
      // 1. Create Order with duration and optional couponCode
      const couponParam = appliedCoupon ? `&couponCode=${encodeURIComponent(appliedCoupon.code || couponCode)}` : '';
      const orderRes = await axios.post(`${API_CONFIG.BASE_URL}/api/payments/create-order?duration=${selectedDuration}${couponParam}`, {}, {
        headers: AuthService.getAuthHeader()
      });

      const { orderId, amount, currency, keyId, isMock } = orderRes.data;

      // 2. If Sandbox simulated mock order, directly verify
      if (isMock) {
        const verifyRes = await axios.post(`${API_CONFIG.BASE_URL}/api/payments/verify`, {
          razorpayOrderId: orderId,
          razorpayPaymentId: 'mock_pay_' + Date.now(),
          razorpaySignature: 'mock_sig_' + Date.now()
        }, {
          headers: AuthService.getAuthHeader()
        });

        const now = new Date();
        const newExpiry = new Date(now.setMonth(now.getMonth() + selectedDuration)).toISOString();
        AuthService.updatePremiumStatus(true, newExpiry);

        setUpgraded(true);
        setSuccess(`[Sandbox Mode] Subscription simulated successfully!`);
        setTimeout(() => { window.location.reload(); }, 1500);
        return;
      }

      // 3. Regular Razorpay checkout modal
      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: 'AIRGate Pro',
        description: `Aspirant Pro (${selectedDuration} Month${selectedDuration > 1 ? 's' : ''})`,
        order_id: orderId,
        handler: async (response) => {
          setLoading(true);
          try {
            await axios.post(`${API_CONFIG.BASE_URL}/api/payments/verify`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            }, {
              headers: AuthService.getAuthHeader()
            });

            const now = new Date();
            const newExpiry = new Date(now.setMonth(now.getMonth() + selectedDuration)).toISOString();
            AuthService.updatePremiumStatus(true, newExpiry);

            setUpgraded(true);
            setSuccess('Aspirant Pro activated successfully! All features are unlocked.');
            setTimeout(() => { window.location.reload(); }, 1500);
          } catch (err) {
            setError(err.response?.data?.error || 'Payment verification failed. Please contact support.');
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: AuthService.getCurrentUser()?.username || '',
          email: AuthService.getCurrentUser()?.email || ''
        },
        theme: {
          color: '#8b5cf6'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        setError('Payment transaction failed: ' + resp.error.description);
      });
      rzp.open();

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start payment processing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', width: '100%', fontFamily: 'var(--font-main)' }}>
      {/* Hero Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <span style={{
          backgroundColor: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          color: '#c4b5fd',
          padding: '6px 18px',
          borderRadius: '30px',
          fontSize: '0.82rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '18px',
          boxShadow: '0 4px 20px rgba(139, 92, 246, 0.2)'
        }}>
          ✨ Rank Accelerator Suite
        </span>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', marginBottom: '16px', fontFamily: 'var(--font-title)' }}>
          Don't Just Practice. Accelerate Your GATE Rank.
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '680px', margin: '0 auto', lineHeight: 1.6, marginBottom: '32px' }}>
          Aspirant Pro isn't a feature bundle — it is your daily competitive edge engineered to convert negative marks into AIR top ranks.
        </p>
      </div>

      {/* Outcome Highlights Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
        marginBottom: '48px',
        marginTop: '-16px'
      }}>
        <div style={{
          backgroundColor: 'rgba(6, 182, 212, 0.05)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>⚡</div>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Instant Doubt Elimination</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Never spend 2 hours stuck on a single derivation. Get step-by-step KaTeX mathematical solutions in seconds.
          </p>
        </div>
        
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>🎯</div>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Unlimited 3-Hr Exam Reps</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Condition your brain for exam day. Take unlimited 65-question (100 marks) full syllabus exam simulations.
          </p>
        </div>

        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>📄</div>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Fast Offline Revision Sheets</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Compile all your bookmarked weak questions and AI derivations into clean text files for quick last-week revisions.
          </p>
        </div>
      </div>

      {success && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: 'var(--color-success)',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '32px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <FiCheck /> {success}
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--color-error)',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '32px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <FiX /> {error}
        </div>
      )}

      {/* Main SaaS Comparison Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px', marginBottom: '64px' }}>
        
        {/* Features list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>What's Included in Aspirant Pro</h3>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: 'var(--color-primary)', padding: '10px', borderRadius: '12px' }}>
              <FiCpu size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Interactive KaTeX AI Doubt Solver</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Stuck on a complex equation or a cache mapping address offset? Fire up the AI doubt solver next to any question for instant derivations and step-by-step guidance.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', padding: '10px', borderRadius: '12px' }}>
              <FiClock size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Unlimited Full-Syllabus Mock Tests</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Free tier accounts are limited to only 5 full-syllabus mock attempts. Pro unlocks unlimited full-syllabus assessments.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', padding: '10px', borderRadius: '12px' }}>
              <FiZap size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Custom Subject-Wise practice Generator</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Generate practice papers targeting specific subjects (e.g. databases, compiler design). Configure custom timers and question counts.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', padding: '10px', borderRadius: '12px' }}>
              <FiFileText size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Printable Revision PDF Compiler</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Instantly compile all your bookmarked questions and AI explanations into a clean, downloadable text document for quick offline revision.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: upgraded ? '2px solid var(--color-success)' : '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: upgraded ? '0 10px 40px rgba(16, 185, 129, 0.1)' : '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(139, 92, 246, 0.1)',
          borderRadius: '24px',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          {upgraded && (
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: 'var(--color-success)',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '20px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Active
            </div>
          )}

          <div>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>GATE Aspirant Plan</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>Perfect for candidates aiming to rank in top 100.</p>
            
            {/* Plan Duration Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              {[
                { months: tiers.tier1.duration, label: `${tiers.tier1.duration} Month${tiers.tier1.duration > 1 ? 's' : ''}` },
                { months: tiers.tier2.duration, label: `${tiers.tier2.duration} Months` },
                { months: tiers.tier3.duration, label: `${tiers.tier3.duration} Months` }
              ].map(opt => (
                <button
                  key={opt.months}
                  onClick={() => setSelectedDuration(opt.months)}
                  disabled={upgraded}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: selectedDuration === opt.months ? 'var(--color-primary)' : 'transparent',
                    color: selectedDuration === opt.months ? '#fff' : 'var(--text-secondary)',
                    cursor: upgraded ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: upgraded && selectedDuration !== opt.months ? 0.5 : 1
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Plan Price amount and Duration */}
            {(() => {
              const t1 = tiers?.tier1 || { price: 99.0, duration: 1, offer: 'Best for quick revisions' };
              const t2 = tiers?.tier2 || { price: 249.0, duration: 3, offer: 'Save 15% - Most Popular' };
              const t3 = tiers?.tier3 || { price: 449.0, duration: 6, offer: 'Save 25% - Complete Prep' };

              let currentPrice = t1.price;
              let currentDuration = t1.duration;
              let currentOffer = t1.offer;
              
              if (selectedDuration === t1.duration) {
                currentPrice = t1.price;
                currentDuration = t1.duration;
                currentOffer = t1.offer;
              } else if (selectedDuration === t2.duration) {
                currentPrice = t2.price;
                currentDuration = t2.duration;
                currentOffer = t2.offer;
              } else if (selectedDuration === t3.duration) {
                currentPrice = t3.price;
                currentDuration = t3.duration;
                currentOffer = t3.offer;
              }

              // Dynamic proportional coupon calculation per tier
              let calculatedFinalPrice = currentPrice;
              let calculatedDiscountAmount = 0;

              if (appliedCoupon) {
                if (appliedCoupon.discountType === 'PERCENTAGE' || appliedCoupon.discountPercent || appliedCoupon.discountPercentage) {
                  const pct = appliedCoupon.discountPercent || appliedCoupon.discountPercentage || appliedCoupon.discountValue || 0;
                  calculatedDiscountAmount = Math.round((currentPrice * pct) / 100);
                } else if (appliedCoupon.discountAmount || appliedCoupon.discountValue) {
                  calculatedDiscountAmount = appliedCoupon.discountAmount || appliedCoupon.discountValue || 0;
                } else if (appliedCoupon.discountedAmount !== undefined && appliedCoupon.originalPrice) {
                  const pct = Math.round(((appliedCoupon.originalPrice - appliedCoupon.discountedAmount) / appliedCoupon.originalPrice) * 100);
                  calculatedDiscountAmount = Math.round((currentPrice * pct) / 100);
                }
                calculatedFinalPrice = Math.max(0, currentPrice - calculatedDiscountAmount);
              }

              return (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                    {appliedCoupon ? (
                      <>
                        <span style={{ fontSize: '3rem', fontWeight: 800, color: '#10b981' }}>
                          ₹{calculatedFinalPrice}
                        </span>
                        <span style={{ fontSize: '1.4rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          ₹{currentPrice}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: '3rem', fontWeight: 800, color: '#fff' }}>
                        ₹{currentPrice}
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                      {currentDuration === 1 ? ' / month' : ` / ${currentDuration} months`}
                    </span>
                  </div>

                  {appliedCoupon && (
                    <div style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      marginBottom: '8px',
                      display: 'inline-block'
                    }}>
                      🎟️ {appliedCoupon.code} Applied — Saved ₹{calculatedDiscountAmount}!
                    </div>
                  )}

                  {currentOffer && !appliedCoupon && (
                    <div style={{ 
                      background: 'linear-gradient(90deg, rgba(168,85,247,0.15), rgba(6,182,212,0.15))',
                      border: '1px solid rgba(168,85,247,0.3)',
                      color: '#e9d5ff',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 0 12px rgba(168,85,247,0.25)',
                      marginTop: '4px'
                    }}>
                      🎁 Deal: {currentOffer}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Coupon Code Entry Section */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Promo / Coupon Code
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Enter Code (e.g. AIRGATE50)"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  disabled={upgraded}
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
                      const t1 = tiers?.tier1 || { price: 99.0, duration: 1 };
                      const t2 = tiers?.tier2 || { price: 249.0, duration: 3 };
                      const t3 = tiers?.tier3 || { price: 449.0, duration: 6 };
                      let activePrice = t1.price;
                      if (selectedDuration === t2.duration) activePrice = t2.price;
                      else if (selectedDuration === t3.duration) activePrice = t3.price;

                      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/coupons/validate`, {
                        code: couponCode.trim(),
                        originalPrice: activePrice
                      }, { headers: AuthService.getAuthHeader() });

                      if (res.data && res.data.valid) {
                        setAppliedCoupon(res.data);
                        setCouponMsg({ type: 'success', text: res.data.message });
                      } else {
                        setAppliedCoupon(null);
                        setCouponMsg({ type: 'error', text: res.data?.message || 'Invalid Coupon Code' });
                      }
                    } catch (err) {
                      setAppliedCoupon(null);
                      setCouponMsg({ type: 'error', text: err.response?.data?.message || 'Failed to validate coupon' });
                    } finally {
                      setCouponLoading(false);
                    }
                  }}
                  disabled={couponLoading || !couponCode.trim() || upgraded}
                  style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                >
                  {couponLoading ? 'Checking...' : 'Apply'}
                </button>
              </div>

              {couponMsg && (
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: couponMsg.type === 'success' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {couponMsg.text}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginBottom: '32px' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheck style={{ color: 'var(--color-success)' }} /> Unlimited syllabus mocks</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheck style={{ color: 'var(--color-success)' }} /> Subject-wise mock generator</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheck style={{ color: 'var(--color-success)' }} /> AI Tutor Doubt solver (KaTeX)</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheck style={{ color: 'var(--color-success)' }} /> Export revision files</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FiCheck style={{ color: 'var(--color-success)' }} /> Topper speed comparisons</li>
              </ul>
            </div>
          </div>

          <div>
            {upgraded ? (
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ width: '100%', padding: '14px', borderColor: 'var(--color-success)', color: 'var(--color-success)', cursor: 'default' }}
                disabled={true}
              >
                ✓ Subscriber Active
              </button>
            ) : tiers.enabled === false ? (
              <div>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0.9, cursor: 'not-allowed', borderColor: '#38bdf8', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.08)' }}
                  disabled={true}
                >
                  Coming Soon 🚀
                </button>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '10px', lineHeight: 1.45 }}>
                  Payment gateway integration in progress. All GATE practice features are currently 100% FREE for all users!
                </div>
              </div>
            ) : (
              <div>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={handleUpgrade}
                  disabled={loading}
                >
                  {loading ? <FiLoader className="spin" /> : <>Activate Aspirant Pro <FiAward /></>}
                </button>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '12px' }}>
                  Instant upgrade. Cancel subscription anytime.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature matrix table */}
      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: '20px', textAlign: 'center' }}>Plan Feature Matrix</h3>
      <div style={{
        overflowX: 'auto',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>Features</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>Free Tier</th>
              <th style={{ padding: '16px 20px', color: 'var(--color-primary)', fontWeight: 700 }}>Aspirant Pro (₹99)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '16px 20px', color: '#fff', fontWeight: 600 }}>Previous Year Questions Explorer</td>
              <td style={{ padding: '16px 20px', color: 'var(--color-success)' }}><FiCheck /> Unlimited</td>
              <td style={{ padding: '16px 20px', color: 'var(--color-success)' }}><FiCheck /> Unlimited</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '16px 20px', color: '#fff', fontWeight: 600 }}>Full-Syllabus Mock Exams</td>
              <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>Max 5 Attempts</td>
              <td style={{ padding: '16px 20px', color: 'var(--color-success)' }}><FiCheck /> Unlimited</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '16px 20px', color: '#fff', fontWeight: 600 }}>Subject-Wise Practice Generator</td>
              <td style={{ padding: '16px 20px', color: 'var(--color-error)' }}><FiX /> Locked</td>
              <td style={{ padding: '16px 20px', color: 'var(--color-success)' }}><FiCheck /> Unlimited</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <td style={{ padding: '16px 20px', color: '#fff', fontWeight: 600 }}>Interactive AI Doubt Solver (Tutor)</td>
              <td style={{ padding: '16px 20px', color: 'var(--color-error)' }}><FiX /> Locked</td>
              <td style={{ padding: '16px 20px', color: 'var(--color-success)' }}><FiCheck /> Unlimited</td>
            </tr>
            <tr>
              <td style={{ padding: '16px 20px', color: '#fff', fontWeight: 600 }}>Printable Revision Compilation exports</td>
              <td style={{ padding: '16px 20px', color: 'var(--color-error)' }}><FiX /> Locked</td>
              <td style={{ padding: '16px 20px', color: 'var(--color-success)' }}><FiCheck /> Unlimited</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
