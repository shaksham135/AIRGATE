import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'var(--font-body)',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '520px',
        backgroundColor: '#111726',
        border: '1px solid #1e293b',
        borderRadius: '20px',
        padding: '48px 32px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
      }}>
        <div style={{
          fontSize: '4.5rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          marginBottom: '16px'
        }}>
          404
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px', color: '#fff' }}>
          Page Not Found
        </h2>

        <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '32px' }}>
          The page or GATE resource you are looking for doesn't exist or has been moved to a new route.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              backgroundColor: '#8b5cf6',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.9rem',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)'
            }}
          >
            ← Back to Home
          </button>

          <button
            onClick={() => navigate('/explore')}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              backgroundColor: 'transparent',
              color: '#06b6d4',
              border: '1px solid #06b6d4',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Practice Arena ➔
          </button>
        </div>
      </div>
    </div>
  );
}
