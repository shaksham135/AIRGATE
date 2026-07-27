import React from 'react';
import { FiAlertTriangle, FiCheck, FiX } from 'react-icons/fi';

export default function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger", // 'danger' | 'warning' | 'info'
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  const getAccentColor = () => {
    switch (type) {
      case 'danger': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': default: return '#6366f1';
    }
  };

  const accentColor = getAccentColor();

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #1e293b)',
        border: `1px solid ${accentColor}40`,
        borderRadius: '20px',
        padding: '28px',
        maxWidth: '440px',
        width: '100%',
        boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 20px ${accentColor}20`,
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Icon Header */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: `${accentColor}18`,
          color: accentColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          border: `1px solid ${accentColor}30`
        }}>
          <FiAlertTriangle size={28} />
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 800,
          color: '#fff',
          marginBottom: '10px'
        }}>
          {title}
        </h3>

        {/* Message */}
        <p style={{
          fontSize: '0.9rem',
          color: 'var(--text-secondary, #94a3b8)',
          lineHeight: '1.5',
          marginBottom: '28px'
        }}>
          {message}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-primary, #e2e8f0)',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <FiX size={16} /> {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: accentColor,
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: `0 4px 14px ${accentColor}40`,
              transition: 'all 0.2s ease'
            }}
          >
            <FiCheck size={16} /> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
