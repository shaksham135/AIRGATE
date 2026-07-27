import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_CONFIG from '../config/api';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const [supportEmail, setSupportEmail] = useState('support@airgate.in');

  useEffect(() => {
    window.scrollTo(0, 0);
    axios.get(`${API_CONFIG.BASE_URL}/api/public/info`)
      .then(res => {
        if (res.data && res.data.supportEmail) {
          setSupportEmail(res.data.supportEmail);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', padding: '40px 20px', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#111726', border: '1px solid #1e293b', borderRadius: '16px', padding: '36px', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
        
        <button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid #1e293b', color: '#38bdf8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', marginBottom: '24px', fontWeight: 600 }}>
          ← Back to AIRGATE Home
        </button>

        <h1 style={{ fontSize: '2rem', marginBottom: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '28px' }}>
          Effective Date: January 1, 2026 | Last Updated: July 26, 2026
        </p>

        <div style={{ fontSize: '0.95rem', lineHeight: '1.7', color: '#cbd5e1' }}>
          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>1. Overview</h3>
          <p>At <strong>AIRGATE Platform</strong> ("we", "us", or "our"), accessible via our web application, protecting your privacy is our utmost priority. This Privacy Policy details how we collect, process, and safeguard personal information when you use our GATE Exam Preparation Platform.</p>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>2. Information We Collect</h3>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Account Data:</strong> Username, email address, and encrypted passwords (hashed via bcrypt) when you create an account.</li>
            <li><strong>Usage & Practice Analytics:</strong> Solve history, GATE mock exam scores, time taken per question, bookmarks, and AI Tutor query usage counts.</li>
            <li><strong>Technical Diagnostics:</strong> IP address, browser type, operating system, and session timestamps for security, login history auditing, and rate limiting.</li>
          </ul>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>3. How We Use Your Data</h3>
          <p>We use your information exclusively to:</p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Provide personalized analytics, All India Ranks (AIR) estimations, and subject-wise accuracy reports.</li>
            <li>Enable AI Tutor explanations and customized practice recommendations.</li>
            <li>Ensure security and prevent abuse or unauthorized API access.</li>
          </ul>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>4. Third-Party Analytics & Google Services</h3>
          <p>We integrate Google Search Console and privacy-compliant analytics (Umami Analytics) to understand aggregated site traffic. No personal identifiers or individual exam response data are sold to third parties.</p>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>5. Data Security & Storage</h3>
          <p>All sensitive authentication credentials are encrypted using industry-standard AES-256 and bcrypt protocols. Connections to AIRGATE are strictly enforced via TLS/HTTPS encryption.</p>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>6. Contact Us</h3>
          <p>If you have any questions or data deletion requests regarding this Privacy Policy, please contact our privacy compliance team at:</p>
          <p style={{ color: '#38bdf8', fontWeight: 700 }}>📧 {supportEmail}</p>
        </div>
      </div>
    </div>
  );
}
