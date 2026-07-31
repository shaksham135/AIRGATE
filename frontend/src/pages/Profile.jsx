import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AuthService from '../services/AuthService';
import CacheService from '../services/CacheService';
import API_CONFIG from '../config/api';
import AIRGATELoader from '../components/AIRGATELoader';
import { FiUser, FiMail, FiShield, FiLock, FiTrash2, FiActivity, FiCheckCircle, FiAward, FiBookOpen } from 'react-icons/fi';

export default function Profile() {
  const currentUser = AuthService.getCurrentUser();
  const [stats, setStats] = useState({
    totalSolved: 0,
    correctCount: 0,
    incorrectCount: 0,
    bookmarkedCount: 0,
    accuracy: 0.0
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loadingStats, setLoadingStats] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    if (!currentUser) return;
    const cacheKey = `user_solve_stats_${currentUser.id || currentUser.username}`;
    const cached = CacheService.get(cacheKey);
    if (cached) {
      setStats(cached);
      setLoadingStats(false);
    } else {
      setLoadingStats(true);
    }

    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/solve/stats`, {
        headers: AuthService.getAuthHeader()
      });
      setStats(response.data);
      CacheService.set(cacheKey, response.data, 120000); // 2 mins TTL
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match!');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long!');
      return;
    }

    setPasswordLoading(true);
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/auth/change-password`, 
        { currentPassword, newPassword },
        { headers: AuthService.getAuthHeader() }
      );
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to change password. Make sure current password is correct.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleResetStats = async () => {
    setResetError('');
    setResetSuccess('');

    const confirmReset = window.confirm("Are you sure you want to completely reset your solving progress? This action is permanent and cannot be undone!");
    if (!confirmReset) return;

    setResetLoading(true);
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/api/questions/solve/reset`, {
        headers: AuthService.getAuthHeader()
      });
      setResetSuccess('Your solving progress has been fully reset.');
      fetchStats();
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset solve history.');
    } finally {
      setResetLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', width: '100%' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Please log in to view your profile settings.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px' }}>
        Profile Settings
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Manage your user credentials, view academic progress, or reset your practice solver history.
      </p>

      {/* Grid of Profile Info and Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        
        {/* Account Details Card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiUser style={{ color: 'var(--color-primary)' }} /> Account Details
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '10px', borderRadius: '8px', color: 'var(--color-primary)', display: 'flex' }}>
                <FiUser size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Username</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser.username}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', padding: '10px', borderRadius: '8px', color: 'var(--color-secondary)', display: 'flex' }}>
                <FiMail size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email Address</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser.email}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '10px', borderRadius: '8px', color: 'var(--color-primary)', display: 'flex' }}>
                <FiAward size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aspirant Plan</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {AuthService.isPremium() ? 'Aspirant Pro (Active)' : 'Standard (Not Active)'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Practice Stats Summary Card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiActivity style={{ color: 'var(--color-secondary)' }} /> Solver Metrics
          </h3>

          {loadingStats ? (
            <AIRGATELoader text="Loading Solver Metrics..." size="small" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <FiBookOpen size={12} /> Solved Count
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.totalSolved}</div>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <FiAward size={12} /> Accuracy
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-secondary)' }}>{stats.accuracy}%</div>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <FiCheckCircle size={12} style={{ color: 'var(--color-success)' }} /> Correct
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.correctCount}</div>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <FiBookOpen size={12} style={{ color: 'var(--color-error)' }} /> Incorrect
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.incorrectCount}</div>
              </div>
            </div>
          )}
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* Change Password Card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiLock style={{ color: 'var(--color-primary)' }} /> Change Credentials
          </h3>

          {passwordSuccess && (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              {passwordSuccess}
            </div>
          )}

          {passwordError && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordChange}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Current Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">New Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Confirm New Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Verify new password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={passwordLoading}>
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Maintenance Options Card */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-error)' }}>
            <FiTrash2 /> Dangerous Operations
          </h3>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '24px' }}>
            If you wish to reset your solving statistics, bookmark folders, and speed analytics back to zero to start preparation fresh, you can clean your solve data here.
          </p>

          {resetSuccess && (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              {resetSuccess}
            </div>
          )}

          {resetError && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {resetError}
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <button 
              type="button" 
              className="btn"
              onClick={handleResetStats}
              disabled={resetLoading}
              style={{
                width: '100%',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                color: 'var(--color-error)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <FiTrash2 size={16} /> {resetLoading ? 'Resetting Data...' : 'Reset Solver Progress'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
