import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_CONFIG from '../config/api';
import { FiLock, FiCpu, FiClock, FiActivity, FiFileText, FiArrowRight, FiX } from 'react-icons/fi';

export default function PremiumGateModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [pricing, setPricing] = useState({
    tier1Price: 49,
    tier2Price: 149,
    tier3Price: 249,
    bannerHeading: "⚡ Founder's VIP Beta Access"
  });

  const [selectedDuration, setSelectedDuration] = useState(6);

  useEffect(() => {
    if (!isOpen) return;
    const fetchPricing = async () => {
      try {
        const res = await axios.get(`${API_CONFIG.BASE_URL}/api/payments/pricing`);
        if (res.data) {
          setPricing({
            tier1Price: res.data.betaTier1Price || 49,
            tier2Price: res.data.betaTier2Price || 149,
            tier3Price: res.data.betaTier3Price || 249,
            bannerHeading: res.data.betaBannerHeading || "⚡ Founder's VIP Beta Access"
          });
        }
      } catch (e) {
        // Fallback to default VIP pricing
      }
    };
    fetchPricing();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProceedToPayment = () => {
    if (onClose) onClose();
    navigate('/premium');
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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '24px',
        maxWidth: '520px',
        width: '100%',
        padding: '36px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(139, 92, 246, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
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
          onMouseEnter={e => { e.target.style.color = '#fff'; e.target.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.target.style.color = 'var(--text-muted)'; e.target.style.backgroundColor = 'transparent'; }}
          title="Close Modal"
        >
          <FiX size={20} />
        </button>

        {/* Glow Background Decorator */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary)',
          filter: 'blur(70px)',
          opacity: 0.25,
          pointerEvents: 'none'
        }}></div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
              boxShadow: '0 0 15px rgba(139, 92, 246, 0.2)'
            }}>
              <FiLock size={26} />
            </div>
          </div>

          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            textAlign: 'center',
            marginBottom: '6px',
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
            fontSize: '0.88rem',
            marginBottom: '24px'
          }}>
            Supercharge your GATE CSE preparation with advanced AI tutors, customizable mock generators, and printable revision PDFs.
          </p>

          {/* Features list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ color: 'var(--color-secondary)', marginTop: '2px' }}><FiCpu size={17} /></div>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '2px', color: '#fff' }}>Interactive KaTeX AI Doubt Solver</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Step-by-step math breakdowns and explanations.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ color: 'var(--color-secondary)', marginTop: '2px' }}><FiClock size={17} /></div>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '2px', color: '#fff' }}>Dynamic Custom Mock Test Generator</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Practice specific subjects & topics with custom timers.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ color: 'var(--color-secondary)', marginTop: '2px' }}><FiActivity size={17} /></div>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '2px', color: '#fff' }}>Time & Topic Performance Analytics</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Identify weak concepts and compare speed with toppers.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ color: 'var(--color-secondary)', marginTop: '2px' }}><FiFileText size={17} /></div>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '2px', color: '#fff' }}>Printable Revision PDF Compiler</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Export bookmarked questions and step-by-step formulas.</p>
              </div>
            </div>
          </div>

          {/* Plan Tier Selection */}
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
              Select Membership Plan
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { duration: 1, label: '1 Month', price: pricing.tier1Price, save: null },
                { duration: 3, label: '3 Months', price: pricing.tier2Price, save: 'SAVE 70%' },
                { duration: 6, label: '6 Months', price: pricing.tier3Price, save: 'SAVE 75%' }
              ].map((t) => {
                const isSelected = selectedDuration === t.duration;
                return (
                  <div 
                    key={t.duration}
                    onClick={() => setSelectedDuration(t.duration)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      position: 'relative',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {t.save && (
                      <span style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '4px',
                        background: '#10b981',
                        color: '#000',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '10px'
                      }}>
                        {t.save}
                      </span>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.label}</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>₹{t.price}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              style={{ flex: 1, padding: '12px' }}
              onClick={onClose}
            >
              Maybe Later
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ flex: 2, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700 }}
              onClick={handleProceedToPayment}
            >
              Get Aspirant Pro Now <FiArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
