import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';

// Step constants for forgot password flow
const STEP_IDLE = 'idle';       // no modal
const STEP_EMAIL = 'email';     // enter email
const STEP_OTP = 'otp';         // enter OTP
const STEP_NEW_PW = 'new_pw';   // set new password
const STEP_DONE = 'done';       // success

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Forgot Password state
  const [fpStep, setFpStep] = useState(STEP_IDLE);
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPw, setFpNewPw] = useState('');
  const [fpConfirmPw, setFpConfirmPw] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpSuccess, setFpSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await AuthService.login(username, password);
      navigate('/explore');
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid username or password!');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Steps ─────────────────────────────────────────────────

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setFpError('');
    setFpSuccess('');
    if (!fpEmail.trim()) { setFpError('Please enter your registered email.'); return; }
    setFpLoading(true);
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/auth/forgot-password`, { email: fpEmail.trim() });
      setFpSuccess('OTP sent! Check your inbox (and spam folder).');
      setFpStep(STEP_OTP);
      startResendTimer();
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setFpError('');
    if (!fpOtp.trim()) { setFpError('Please enter the OTP.'); return; }
    setFpLoading(true);
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/auth/verify-otp`, { email: fpEmail.trim(), otp: fpOtp.trim() });
      setFpError('');
      setFpStep(STEP_NEW_PW);
    } catch (err) {
      setFpError(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setFpLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setFpError('');
    if (fpNewPw.length < 6) { setFpError('Password must be at least 6 characters.'); return; }
    if (fpNewPw !== fpConfirmPw) { setFpError('Passwords do not match!'); return; }
    setFpLoading(true);
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/auth/reset-password`, {
        email: fpEmail.trim(),
        otp: fpOtp.trim(),
        newPassword: fpNewPw
      });
      setFpStep(STEP_DONE);
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to reset password. Please start over.');
    } finally {
      setFpLoading(false);
    }
  };

  const closeFpModal = () => {
    setFpStep(STEP_IDLE);
    setFpEmail(''); setFpOtp(''); setFpNewPw(''); setFpConfirmPw('');
    setFpError(''); setFpSuccess(''); setFpLoading(false);
  };

  // ── Shared Modal Styles ───────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 99999, padding: '20px'
  };
  const card = {
    backgroundColor: 'var(--bg-card, #1e293b)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '24px', padding: '36px',
    maxWidth: '440px', width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    position: 'relative'
  };
  const inputStyle = {
    width: '100%', padding: '12px 14px',
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px', color: '#fff',
    fontSize: '0.95rem', outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-body, inherit)'
  };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' };

  // ── Render Forgot Password Modal Content ──────────────────────────────────
  const renderFpModal = () => {
    if (fpStep === STEP_IDLE) return null;

    return (
      <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) closeFpModal(); }}>
        <div style={card}>
          {/* Close button */}
          <button onClick={closeFpModal} style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1
          }}>✕</button>

          {/* Step 1: Enter Email */}
          {fpStep === STEP_EMAIL && (
            <form onSubmit={handleSendOtp}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🔑</div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Forgot Password?</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Enter your registered email and we&apos;ll send a 6-digit OTP.
                </p>
              </div>
              {fpError && <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.2)' }}>{fpError}</div>}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Registered Email</label>
                <input
                  type="email" required autoFocus
                  style={inputStyle}
                  placeholder="you@example.com"
                  value={fpEmail}
                  onChange={e => setFpEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 700 }} disabled={fpLoading}>
                {fpLoading ? 'Sending OTP...' : 'Send OTP →'}
              </button>
            </form>
          )}

          {/* Step 2: Enter OTP */}
          {fpStep === STEP_OTP && (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '8px' }}>📬</div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Check Your Email</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  We sent a 6-digit OTP to <strong style={{ color: '#38bdf8' }}>{fpEmail}</strong>.<br />
                  Valid for 10 minutes.
                </p>
              </div>
              {fpSuccess && <div style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(16,185,129,0.2)' }}>{fpSuccess}</div>}
              {fpError && <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.2)' }}>{fpError}</div>}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>6-Digit OTP</label>
                <input
                  type="text" required autoFocus maxLength={6}
                  style={{ ...inputStyle, fontSize: '1.8rem', textAlign: 'center', letterSpacing: '12px', fontWeight: 800, fontFamily: 'monospace' }}
                  placeholder="------"
                  value={fpOtp}
                  onChange={e => setFpOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 700, marginBottom: '12px' }} disabled={fpLoading}>
                {fpLoading ? 'Verifying...' : 'Verify OTP →'}
              </button>
              <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Didn&apos;t receive it?{' '}
                {resendTimer > 0
                  ? <span>Resend in {resendTimer}s</span>
                  : <span
                      onClick={() => { setFpStep(STEP_EMAIL); setFpSuccess(''); setFpError(''); setFpOtp(''); }}
                      style={{ color: 'var(--color-secondary)', cursor: 'pointer', fontWeight: 600 }}
                    >Resend OTP</span>
                }
              </div>
            </form>
          )}

          {/* Step 3: Set New Password */}
          {fpStep === STEP_NEW_PW && (
            <form onSubmit={handleResetPassword}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🔐</div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Set New Password</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>OTP verified! Choose a strong new password.</p>
              </div>
              {fpError && <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(239,68,68,0.2)' }}>{fpError}</div>}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password" required autoFocus
                  style={inputStyle}
                  placeholder="Min. 6 characters"
                  value={fpNewPw}
                  onChange={e => setFpNewPw(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  type="password" required
                  style={{ ...inputStyle, borderColor: fpConfirmPw && fpNewPw !== fpConfirmPw ? '#ef4444' : 'rgba(255,255,255,0.12)' }}
                  placeholder="Repeat password"
                  value={fpConfirmPw}
                  onChange={e => setFpConfirmPw(e.target.value)}
                />
                {fpConfirmPw && fpNewPw !== fpConfirmPw && (
                  <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '4px' }}>Passwords do not match</div>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 700 }} disabled={fpLoading}>
                {fpLoading ? 'Resetting...' : 'Reset Password ✓'}
              </button>
            </form>
          )}

          {/* Step 4: Done */}
          {fpStep === STEP_DONE && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginBottom: '10px' }}>Password Reset!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
                Your password has been changed successfully. Sign in with your new password.
              </p>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontWeight: 700 }}
                onClick={() => { closeFpModal(); }}
              >
                Sign In Now →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* AIRGATE Brand Logo Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="42" height="42" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 12px rgba(56, 189, 248, 0.7))' }}>
              <defs>
                <linearGradient id="loginGradFinal" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d2ff" />
                  <stop offset="50%" stopColor="#3a7bd5" />
                  <stop offset="100%" stopColor="#928dab" />
                </linearGradient>
                <linearGradient id="loginABody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00c6ff" />
                  <stop offset="50%" stopColor="#0072ff" />
                  <stop offset="100%" stopColor="#7a22ff" />
                </linearGradient>
                <linearGradient id="loginGBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f2fe" />
                  <stop offset="100%" stopColor="#4facfe" />
                </linearGradient>
              </defs>
              <path d="M 16,74 A 48,48 0 1,1 104,74" stroke="url(#loginGradFinal)" strokeWidth="2.8" fill="none" opacity="0.9" />
              <circle cx="60" cy="12" r="4" fill="#00f2fe" />
              <path d="M 60,16 L 102,94 L 86,94 L 60,45 L 34,94 L 18,94 Z" fill="url(#loginABody)" />
              <path d="M 72,55 C 72,42 48,40 48,56 C 48,70 72,68 72,60 L 58,60" stroke="url(#loginGBody)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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
          Welcome Back
        </h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>
          Access your GATE PYQ Dashboard
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

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
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
                placeholder="••••••••"
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px', marginBottom: '16px' }}>
            <span
              onClick={() => { setFpStep(STEP_EMAIL); setFpError(''); setFpSuccess(''); }}
              style={{ fontSize: '0.8rem', color: 'var(--color-secondary)', cursor: 'pointer', fontWeight: 600 }}
            >
              Forgot Password?
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '4px', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: 'var(--color-secondary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign Up
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {renderFpModal()}
    </div>
  );
}
