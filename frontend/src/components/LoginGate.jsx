import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../services/AuthService';

/**
 * LoginGate — wraps any page that requires authentication or renders as a modal popup.
 * If user is logged in → renders children.
 * If not → shows a marketing / login-required view or modal.
 */
export default function LoginGate({ children, featureName = 'this feature', featureIcon = '🚀', isOpen, onClose, title, message }) {
  const user = AuthService.getCurrentUser();
  const navigate = useNavigate();

  // If modal mode (isOpen provided)
  if (isOpen !== undefined) {
    if (!isOpen) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card, #1e293b)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          textAlign: 'center',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px', right: '16px',
              background: 'none', border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>

          <div style={{
            width: '64px', height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.15))',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
            margin: '0 auto 20px auto'
          }}>
            🚀
          </div>

          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '10px' }}>
            {title || 'Sign In Required'}
          </h3>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '28px' }}>
            {message || 'Sign in or create a free AIRGATE account to submit answers and track your Prep Analyst statistics!'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => { onClose && onClose(); navigate('/login'); }}
              className="btn btn-primary"
              style={{ padding: '12px', borderRadius: '12px', fontWeight: 800 }}
            >
              Sign In to Your Account
            </button>
            <button
              onClick={() => { onClose && onClose(); navigate('/register'); }}
              className="btn btn-outline"
              style={{ padding: '12px', borderRadius: '12px', fontWeight: 700 }}
            >
              Create Free Account 🎓
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user) return children;

  const features = [
    {
      icon: '📊',
      title: 'Mock Test Arena',
      desc: 'Simulate real GATE exam conditions with 65 questions, 180-minute timer, auto-submit, and detailed score analytics.',
    },
    {
      icon: '🔖',
      title: 'Smart Bookmarks',
      desc: 'Bookmark tough questions for focused revision. Track your weak subjects and revisit them anytime.',
    },
    {
      icon: '📈',
      title: 'Prep Analytics',
      desc: 'Visualise your subject-wise accuracy, attempt frequency, and improvement trend over time.',
    },
    {
      icon: '🧠',
      title: 'AI-Powered Explanations',
      desc: 'Get step-by-step AI explanations for every question — understand the concept, not just the answer.',
    },
    {
      icon: '🏆',
      title: 'Attempt History',
      desc: 'Every mock you give is saved. Review past attempts question-by-question to pinpoint mistakes.',
    },
    {
      icon: '⚡',
      title: 'Instant Answer Check',
      desc: 'Select any option and instantly see if it\'s correct or wrong — with the right answer highlighted.',
    },
  ];

  return (
    <div style={{
      minHeight: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '40px 24px',
      overflowY: 'auto',
      background: 'radial-gradient(ellipse at 20% 20%, rgba(139,92,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.06) 0%, transparent 60%)',
    }}>

      {/* Lock Hero */}
      <div style={{
        textAlign: 'center',
        marginBottom: '48px',
        maxWidth: '560px',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.15))',
          border: '1px solid rgba(139,92,246,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.2rem',
          margin: '0 auto 24px auto',
          boxShadow: '0 0 40px rgba(139,92,246,0.2)',
        }}>
          {featureIcon}
        </div>

        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(90deg, rgba(139,92,246,0.15), rgba(6,182,212,0.15))',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: '50px',
          padding: '4px 16px',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--color-primary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}>
          Login Required
        </div>

        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '16px',
          lineHeight: 1.2,
        }}>
          {featureName} is for<br />
          <span style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>GATE Serious Aspirants</span>
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          lineHeight: 1.7,
          marginBottom: '32px',
        }}>
          India's most comprehensive GATE CSE question bank — 10,000+ PYQs, AI explanations, 
          full-length mock tests, and deep prep analytics. Create a free account in 30 seconds.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '12px 32px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 30px rgba(139,92,246,0.45)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 20px rgba(139,92,246,0.3)'; }}
          >
            🎓 Create Free Account
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 28px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'background 0.15s, border 0.15s',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.04)'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            Already have an account? Login →
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        gap: '0',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        overflow: 'hidden',
        marginBottom: '48px',
        width: '100%',
        maxWidth: '640px',
      }}>
        {[
          { value: '10,000+', label: 'PYQ Questions' },
          { value: '2000-2024', label: 'Years Covered' },
          { value: '15+ Topics', label: 'CSE Subjects' },
          { value: 'Free', label: 'Forever' },
        ].map((stat, i, arr) => (
          <div key={i} style={{
            flex: 1,
            padding: '16px 12px',
            textAlign: 'center',
            borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-secondary)', fontFamily: 'var(--font-title)' }}>{stat.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Features Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        width: '100%',
        maxWidth: '860px',
        marginBottom: '48px',
      }}>
        {features.map((f, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            padding: '20px',
            transition: 'border-color 0.2s, background 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.background = 'rgba(139,92,246,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '6px' }}>{f.title}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div style={{
        textAlign: 'center',
        padding: '32px',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(6,182,212,0.06))',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: '20px',
        maxWidth: '520px',
        width: '100%',
      }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Ready to crack GATE? 🎯
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Join thousands of aspirants already using GATE PYQ Intel for their preparation.
          It's 100% free — no credit card needed.
        </div>
        <button
          onClick={() => navigate('/register')}
          style={{
            padding: '12px 36px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
            fontFamily: 'var(--font-body)',
            width: '100%',
          }}
        >
          Get Started — It's Free
        </button>
      </div>

    </div>
  );
}
