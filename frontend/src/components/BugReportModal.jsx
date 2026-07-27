import React, { useState } from 'react';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { FiAlertTriangle } from 'react-icons/fi';

export default function BugReportModal({ isOpen, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      setLoading(true);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        pageUrl: window.location.href
      };

      await axios.post(`${API_CONFIG.BASE_URL}/api/bugs`, payload, {
        headers: AuthService.getAuthHeader()
      });

      setSuccess(true);
      setTitle('');
      setDescription('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      alert("Failed to submit bug report: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '28px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', position: 'relative'
      }}>
        {/* Close */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
            fontSize: '1.4rem', cursor: 'pointer'
          }}
        >
          &times;
        </button>

        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiAlertTriangle style={{ color: '#ef4444' }} /> Report a Platform Bug
        </h3>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Encountered a problem or issue? Tell us what went wrong, and our engineers will investigate immediately.
        </p>

        {success ? (
          <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
            🎉 Bug report submitted successfully!
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
                Title
              </label>
              <input 
                type="text"
                placeholder="e.g. Solution loading error on page 3"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px',
                  backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
                Details
              </label>
              <textarea 
                placeholder="Please describe what actions led to the bug and any error messages seen..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', minHeight: '100px', resize: 'vertical',
                  backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
                  fontFamily: 'inherit'
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={onClose}
                className="btn btn-outline"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading}
                style={{ padding: '8px 16px', fontSize: '0.85rem', backgroundColor: '#ef4444', borderColor: '#ef4444' }}
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
