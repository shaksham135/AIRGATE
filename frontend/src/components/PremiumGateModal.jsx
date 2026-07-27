import React, { useState } from 'react';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { FiLock, FiCheck, FiCpu, FiClock, FiActivity, FiFileText, FiArrowRight, FiX } from 'react-icons/fi';

export default function PremiumGateModal({ isOpen, onClose, onUpgradeSuccess }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

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

            {/* Price Box */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '16px',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '28px'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aspirant Plan</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-title)' }}>
                  ₹99 <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ month</span>
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>100% Refund Guarantee</span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cancel anytime</div>
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
