import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AIRGATE React ErrorBoundary caught an exception:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#090d16',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            maxWidth: '500px',
            backgroundColor: '#111726',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            padding: '36px 28px',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
              Something Went Wrong
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '24px' }}>
              An unexpected interface error occurred. Don't worry, your practice session and bookmarks are safely saved.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                backgroundColor: '#38bdf8',
                color: '#090d16',
                border: 'none',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🔄 Refresh & Return to AIRGATE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
