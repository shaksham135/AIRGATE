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

  const [isBetaMode, setIsBetaMode] = useState(true);
  const [betaDetails, setBetaDetails] = useState({
    upiId: 'airgate@upi',
    qrImageUrl: '',
    spotsRemaining: 100,
    tier1Price: 49,
    tier2Price: 249
  });
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [screenshotUrlInput, setScreenshotUrlInput] = useState('');
  const [submittingUpi, setSubmittingUpi] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [myVerification, setMyVerification] = useState(null);

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
          setIsBetaMode(!!response.data.isBetaMode);
          setBetaDetails({
            upiId: response.data.betaUpiId || 'airgate@upi',
            qrImageUrl: response.data.betaQrImageUrl || '',
            spotsRemaining: response.data.betaSpotsRemaining !== undefined ? response.data.betaSpotsRemaining : 100,
            tier1Price: response.data.betaTier1Price || 49,
            tier2Price: response.data.betaTier2Price || 249,
            betaBannerHeading: response.data.betaBannerHeading || "⚡ Limited Founder's VIP Beta Access",
            betaBannerSubheading: response.data.betaBannerSubheading || "Get Full Aspirant Pro Access at Only ₹49/month or ₹249 for 6 Months!",
            betaTier1Offer: response.data.betaTier1Offer || "⚡ 1-Month Founder Pass — Save 75%!",
            betaTier2Offer: response.data.betaTier2Offer || "🔥 6-Month Season Pass — Save 75%!"
          });
          setTiers(prev => ({
            enabled: response.data.enabled !== undefined ? response.data.enabled : prev.enabled,
            tier1: response.data.tier1 || prev.tier1,
            tier2: response.data.tier2 || prev.tier2,
            tier3: response.data.tier3 || prev.tier3
          }));
        }
      } catch (err) {
        console.error("Failed to load dynamic pricing tiers:", err);
      }
    };
    fetchTiers();

    if (AuthService.getCurrentUser()) {
      // Sync real database isPremium status from backend
      axios.get(`${API_CONFIG.BASE_URL}/api/users/me`, {
        headers: AuthService.getAuthHeader()
      }).then(res => {
        if (res.data) {
          const isPrem = !!res.data.isPremium;
          setUpgraded(isPrem);
          const currentUser = AuthService.getCurrentUser();
          if (currentUser) {
            currentUser.isPremium = isPrem;
            currentUser.premiumExpiresAt = res.data.premiumExpiresAt;
            localStorage.setItem('user', JSON.stringify(currentUser));
          }
        }
      }).catch(e => console.error("Failed to sync user status from DB:", e));

      axios.get(`${API_CONFIG.BASE_URL}/api/payments/my-verification`, {
        headers: AuthService.getAuthHeader()
      }).then(res => {
        if (res.data && res.data.hasSubmitted) {
          setMyVerification(res.data);
        }
      }).catch(e => console.error("Failed to fetch my verification status:", e));
    }
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

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(betaDetails.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleUpiSubmit = async (e) => {
    e.preventDefault();
    if (!utrInput || utrInput.trim().length < 6) {
      setError("Please enter a valid 12-digit UTR or Transaction Reference number.");
      return;
    }
    const currentUser = AuthService.getCurrentUser();
    if (!currentUser) {
      setError("Please Sign In first to submit payment proof.");
      navigate('/login');
      return;
    }

    setSubmittingUpi(true);
    setError('');
    setSuccess('');

    try {
      const activeAmount = selectedDuration === 6 ? betaDetails.tier2Price : betaDetails.tier1Price;
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/payments/submit-upi`, {
        planType: selectedDuration === 6 ? 'SEASONAL_249' : 'MONTHLY_49',
        durationMonths: selectedDuration,
        amount: activeAmount,
        utrNumber: utrInput.trim(),
        screenshotUrl: screenshotUrlInput.trim()
      }, {
        headers: AuthService.getAuthHeader()
      });

      setSuccess(res.data.message || "Payment proof submitted successfully! Verification usually takes 5-15 minutes.");
      setShowUpiModal(false);
      setMyVerification({
        hasSubmitted: true,
        utrNumber: utrInput.trim(),
        status: 'PENDING',
        amount: activeAmount,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to submit UPI payment proof:", err);
      setError(err.response?.data?.error || "Failed to submit verification request. Please check UTR number.");
    } finally {
      setSubmittingUpi(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', width: '100%', fontFamily: 'var(--font-main)' }}>

      {/* 🚀 Dynamic Admin Controlled Founder's VIP Beta Highlight Banner */}
      {isBetaMode && !upgraded && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(139,92,246,0.2) 100%)',
          border: '1px solid rgba(236,72,153,0.4)',
          borderRadius: '20px',
          padding: '24px 32px',
          marginBottom: '40px',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(236,72,153,0.25)',
          backdropFilter: 'blur(12px)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <span style={{
            background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            color: '#fff', fontSize: '0.8rem', fontWeight: 800, padding: '5px 18px',
            borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-block', marginBottom: '10px',
            boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)'
          }}>
            {betaDetails.betaBannerHeading || "⚡ Limited Founder's VIP Beta Access"}
          </span>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', margin: '4px 0 8px 0', fontFamily: 'var(--font-title)' }}>
            {betaDetails.betaBannerSubheading || "Get Full Aspirant Pro Access at Only ₹49/month or ₹249 for 6 Months!"}
          </h3>
          <p style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.9)', margin: 0, fontWeight: 600 }}>
            🔥 Direct Founder's UPI Special • First 100 Aspirants Only • <strong style={{ color: '#ec4899', fontSize: '1.05rem' }}>{betaDetails.spotsRemaining} / 100 Early-Bird Spots Remaining</strong>
          </p>
        </div>
      )}

      {/* 🎯 15-Year Marketing Manager Emotional Hero Hook */}
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
          ✨ AIRGATE Rank Accelerator Suite
        </span>
        <h2 style={{ fontSize: '2.6rem', fontWeight: 900, color: '#fff', marginBottom: '16px', fontFamily: 'var(--font-title)', lineHeight: 1.25 }}>
          Your Top 100 GATE Rank Starts Here.<br />
          <span style={{ background: 'linear-gradient(90deg, #ec4899 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Stop Losing 20+ Marks to Silly Errors & Unsolved Doubts.
          </span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', maxWidth: '720px', margin: '0 auto', lineHeight: 1.6, marginBottom: '32px' }}>
          Engineered specifically for GATE aspirants who cannot afford to waste another attempt. Turn negative marks into IISc / IIT M.Tech admission calls.
        </p>
      </div>

      {/* 4 Pillar Transformation Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Zero Doubt Friction</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Never waste 3 hours stuck on 1 derivation. Instant step-by-step KaTeX solutions & 24/7 AI tutor guidance.
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
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Real TCS iON Environment</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Condition your mind for exam day. Take unlimited 65-question (100 marks) full syllabus exam simulations.
          </p>
        </div>

        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>📊</div>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Weak Area Generators</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Instantly target weak subjects (DBMS, OS, Discrete Math) with AI generated 10-question rapid sprints.
          </p>
        </div>

        <div style={{
          backgroundColor: 'rgba(236, 72, 153, 0.05)',
          border: '1px solid rgba(236, 72, 153, 0.2)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>📄</div>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>1-Click Printable PDFs</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Compile all your bookmarked weak questions & AI explanations into clean text documents for last-week revisions.
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
              {isBetaMode ? [
                { months: 1, label: `1 Month (₹${betaDetails.tier1Price})` },
                { months: 6, label: `6 Months (₹${betaDetails.tier2Price})` }
              ].map(opt => (
                <button
                  key={opt.months}
                  onClick={() => setSelectedDuration(opt.months)}
                  disabled={upgraded}
                  style={{
                    flex: 1,
                    padding: '10px 6px',
                    fontSize: '0.82rem',
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
              )) : [
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
              let currentPrice = 99.0;
              let currentDuration = selectedDuration;
              let currentOffer = 'Best for GATE revision';

              if (isBetaMode) {
                if (selectedDuration === 6) {
                  currentPrice = betaDetails.tier2Price;
                  currentDuration = 6;
                  currentOffer = betaDetails.betaTier2Offer || '🔥 6-Month Season Pass — Save 75%!';
                } else {
                  currentPrice = betaDetails.tier1Price;
                  currentDuration = 1;
                  currentOffer = betaDetails.betaTier1Offer || '⚡ 1-Month Founder Pass — Save 75%!';
                }
              } else {
                const t1 = tiers?.tier1 || { price: 99.0, duration: 1, offer: 'Best for quick revisions' };
                const t2 = tiers?.tier2 || { price: 249.0, duration: 3, offer: 'Save 15% - Most Popular' };
                const t3 = tiers?.tier3 || { price: 449.0, duration: 6, offer: 'Save 25% - Complete Prep' };

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

              const originalPrice = isBetaMode ? (selectedDuration === 6 ? 999 : 199) : null;

              return (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                    {appliedCoupon ? (
                      <>
                        <span style={{ fontSize: '3rem', fontWeight: 900, color: '#10b981' }}>
                          ₹{calculatedFinalPrice}
                        </span>
                        <span style={{ fontSize: '1.4rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          ₹{currentPrice}
                        </span>
                      </>
                    ) : isBetaMode ? (
                      <>
                        <span style={{ fontSize: '3.2rem', fontWeight: 900, color: '#fff', background: 'linear-gradient(90deg, #ec4899 0%, #8b5cf6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                          ₹{currentPrice}
                        </span>
                        <span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through', fontWeight: 600 }}>
                          ₹{originalPrice}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: '3rem', fontWeight: 800, color: '#fff' }}>
                        ₹{currentPrice}
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 600 }}>
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
                      background: isBetaMode ? 'linear-gradient(90deg, rgba(236,72,153,0.2), rgba(139,92,246,0.2))' : 'linear-gradient(90deg, rgba(168,85,247,0.15), rgba(6,182,212,0.15))',
                      border: isBetaMode ? '1px solid rgba(236,72,153,0.4)' : '1px solid rgba(168,85,247,0.3)',
                      color: isBetaMode ? '#f472b6' : '#e9d5ff',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 0 16px rgba(236,72,153,0.2)',
                      marginTop: '4px'
                    }}>
                      🎁 {currentOffer}
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
              ) : isBetaMode ? (
                <div>
                  {myVerification && myVerification.status === 'PENDING' ? (
                    <div style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#f59e0b',
                      padding: '14px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      fontSize: '0.88rem',
                      fontWeight: 700
                    }}>
                      ⏳ Payment Verification Pending
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>
                        UTR #{myVerification.utrNumber}. Verification takes 5-15 mins.
                      </div>
                    </div>
                  ) : (
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      style={{ 
                        width: '100%', 
                        padding: '16px', 
                        fontSize: '1.05rem', 
                        fontWeight: 800,
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                        boxShadow: '0 8px 25px rgba(236, 72, 153, 0.3)'
                      }}
                      onClick={() => setShowUpiModal(true)}
                    >
                      ⚡ Claim VIP Beta Pass ({selectedDuration === 6 ? `₹${betaDetails.tier2Price}` : `₹${betaDetails.tier1Price}`}) →
                    </button>
                  )}
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '12px' }}>
                    🔥 Direct Founder's Beta Discount. Limited to first 100 students.
                  </div>
                </div>
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
                <th style={{ padding: '16px 20px', color: 'var(--color-primary)', fontWeight: 700 }}>
                  {isBetaMode ? `VIP Beta (₹${selectedDuration === 6 ? betaDetails.tier2Price : betaDetails.tier1Price})` : 'Aspirant Pro'}
                </th>
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

        {/* 📲 Interactive VIP Beta UPI Payment Modal */}
        {showUpiModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '24px', maxWidth: '460px', width: '100%', padding: '28px',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(139, 92, 246, 0.2)',
              position: 'relative'
            }}>
              {/* Close Button */}
              <button 
                onClick={() => setShowUpiModal(false)}
                style={{
                  position: 'absolute', top: '18px', right: '18px', background: 'none',
                  border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem'
                }}
              >
                <FiX />
              </button>

              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <span style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                  color: '#fff', fontSize: '0.75rem', fontWeight: 800, padding: '4px 14px',
                  borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.06em'
                }}>
                  ⚡ Founder's VIP Beta Access
                </span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginTop: '10px', marginBottom: '4px' }}>
                  Scan & Pay via UPI App
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Amount to Pay: <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>₹{selectedDuration === 6 ? betaDetails.tier2Price : betaDetails.tier1Price}</strong> ({selectedDuration === 6 ? '6-Month Pass' : '1-Month Pass'})
                </p>
              </div>

              {/* QR Code Container */}
              <div style={{
                backgroundColor: '#fff', padding: '16px', borderRadius: '16px', textOverflow: 'ellipsis',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                maxWidth: '220px', margin: '0 auto 20px auto', boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
              }}>
                <img 
                  src={betaDetails.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${betaDetails.upiId}&pn=AIRGATE&am=${selectedDuration === 6 ? betaDetails.tier2Price : betaDetails.tier1Price}&cu=INR`)}`}
                  alt="AIRGATE UPI Payment QR Code"
                  style={{ width: '180px', height: '180px', borderRadius: '8px' }}
                />
                <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: 700, marginTop: '8px' }}>
                  GPay • PhonePe • Paytm • BHIM
                </span>
              </div>

              {/* UPI ID Copy Box */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                borderRadius: '12px', padding: '10px 14px', marginBottom: '20px'
              }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Official UPI ID
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
                    {betaDetails.upiId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  style={{
                    backgroundColor: copiedUpi ? '#10b981' : 'rgba(139, 92, 246, 0.2)',
                    border: `1px solid ${copiedUpi ? '#10b981' : 'var(--color-primary)'}`,
                    color: copiedUpi ? '#fff' : 'var(--color-primary)',
                    padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {copiedUpi ? '✓ Copied' : 'Copy ID'}
                </button>
              </div>

              {/* Payment Proof Submission Form */}
              <form onSubmit={handleUpiSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px' }}>
                    Enter 12-Digit UTR / Ref No. <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 421890123456"
                    value={utrInput}
                    onChange={e => setUtrInput(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: '10px',
                      border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)',
                      color: '#fff', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: 700
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '6px' }}>
                    Payment Screenshot URL (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Paste image link if available"
                    value={screenshotUrlInput}
                    onChange={e => setScreenshotUrlInput(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)',
                      color: '#fff', fontSize: '0.85rem'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingUpi || !utrInput.trim()}
                  className="btn btn-primary"
                  style={{
                    width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  {submittingUpi ? <FiLoader className="spin" /> : 'Submit Proof for Instant Activation'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }
