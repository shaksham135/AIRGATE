import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import AuthService from '../services/AuthService';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await AuthService.register(username, email, password, 'STUDENT');
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register account!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* AIRGATE Brand Logo Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="42" height="42" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 12px rgba(56, 189, 248, 0.7))' }}>
              <defs>
                <linearGradient id="regGradFinal" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d2ff" />
                  <stop offset="50%" stopColor="#3a7bd5" />
                  <stop offset="100%" stopColor="#928dab" />
                </linearGradient>
                <linearGradient id="regABody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00c6ff" />
                  <stop offset="50%" stopColor="#0072ff" />
                  <stop offset="100%" stopColor="#7a22ff" />
                </linearGradient>
                <linearGradient id="regGBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f2fe" />
                  <stop offset="100%" stopColor="#4facfe" />
                </linearGradient>
              </defs>
              <path d="M 16,74 A 48,48 0 1,1 104,74" stroke="url(#regGradFinal)" strokeWidth="2.8" fill="none" opacity="0.9" />
              <circle cx="60" cy="12" r="4" fill="#00f2fe" />
              <path d="M 60,16 L 102,94 L 86,94 L 60,45 L 34,94 L 18,94 Z" fill="url(#regABody)" />
              <path d="M 72,55 C 72,42 48,40 48,56 C 48,70 72,68 72,60 L 58,60" stroke="url(#regGBody)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <rect x="54" y="80" width="12" height="14" fill="#00f2fe" rx="2" />
              <rect x="57" y="83" width="6" height="11" fill="#ffffff" rx="1" />
            </svg>
            <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AIR</span>
              <span style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GATE</span>
            </span>
          </div>
        </div>

        <h2 style={{ marginBottom: '8px', fontSize: '1.6rem', fontWeight: 800, textAlign: 'center' }}>
          Create Account
        </h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>
          Join the GATE PYQ Platform
        </p>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-error)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--color-success)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Create username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ paddingRight: '42px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••• (min 6 characters)"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  zIndex: 2
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-secondary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
