import React from 'react';
import { FiTool, FiAlertTriangle } from 'react-icons/fi';

export default function Maintenance() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#0b0f19',
      backgroundImage: 'radial-gradient(circle at top right, rgba(168, 85, 247, 0.1), transparent), radial-gradient(circle at bottom left, rgba(6, 182, 212, 0.1), transparent)',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'rgba(30, 41, 59, 0.4)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '48px 32px',
        maxWidth: '550px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(168, 85, 247, 0.15)'
      }}>
        {/* Glowing Indicator Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0 auto 28px auto',
          boxShadow: '0 0 30px rgba(6, 182, 212, 0.4)',
          position: 'relative'
        }}>
          <FiTool size={36} color="#ffffff" style={{ animation: 'pulse 2s infinite' }} />
          <style>{`
            @keyframes pulse {
              0% { transform: scale(1); }
              50% { transform: scale(1.08); }
              100% { transform: scale(1); }
            }
          `}</style>
        </div>

        <h1 style={{
          fontSize: '2.2rem',
          fontWeight: 800,
          marginBottom: '16px',
          background: 'linear-gradient(to right, #f8fafc, #cbd5e1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em'
        }}>
          System Maintenance
        </h1>

        <p style={{
          color: '#94a3b8',
          fontSize: '1rem',
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          GATE PYQ Intel is currently undergoing scheduled system updates to enhance performance and security. We'll be back shortly!
        </p>

        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: '24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          color: '#fbbf24',
          fontSize: '0.88rem',
          fontWeight: 600
        }}>
          <FiAlertTriangle />
          <span>Aspirant servers will resume shortly. Thank you for your patience!</span>
        </div>
      </div>
    </div>
  );
}
