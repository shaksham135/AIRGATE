import React from 'react';
import { FiZap, FiLoader } from 'react-icons/fi';

export default function AIRGATELoader({ text = "Loading AIRGATE Engine...", size = "normal" }) {
  const isCompact = size === "small";

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isCompact ? '24px 16px' : '60px 20px',
      textAlign: 'center',
      width: '100%'
    }}>
      {/* Outer Glow Ring & Logo Loader Container */}
      <div style={{
        position: 'relative',
        width: isCompact ? '56px' : '76px',
        height: isCompact ? '56px' : '76px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: isCompact ? '12px' : '18px'
      }}>
        {/* Outer Rotating Gradient Ring */}
        <div 
          className="spin-animation"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: 'var(--color-primary, #8b5cf6)',
            borderRightColor: 'var(--color-secondary, #06b6d4)',
            boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)'
          }}
        />

        {/* Inner Pulsing Brand Icon */}
        <div 
          className="airgate-pulse-logo"
          style={{
            width: isCompact ? '36px' : '48px',
            height: isCompact ? '36px' : '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(6, 182, 212, 0.25))',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            backdropFilter: 'blur(4px)'
          }}
        >
          <FiZap size={isCompact ? 18 : 24} style={{ color: '#06b6d4' }} />
        </div>
      </div>

      {/* Shimmer Text */}
      <p 
        className="airgate-shimmer-text"
        style={{
          color: 'var(--text-secondary, #cbd5e1)',
          fontSize: isCompact ? '0.82rem' : '0.92rem',
          fontWeight: 600,
          margin: 0,
          letterSpacing: '0.02em'
        }}
      >
        {text}
      </p>
    </div>
  );
}
