import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_CONFIG from '../config/api';

export default function TermsOfService() {
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

        <h1 style={{ fontSize: '2rem', marginBottom: '8px', background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Terms & Conditions
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '28px' }}>
          Effective Date: January 1, 2026 | Last Updated: July 26, 2026
        </p>

        <div style={{ fontSize: '0.95rem', lineHeight: '1.7', color: '#cbd5e1' }}>
          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>1. Acceptance of Terms</h3>
          <p>By accessing or using <strong>AIRGATE Platform</strong>, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, please discontinue using the platform.</p>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>2. Fair Use & Account Integrity</h3>
          <p>AIRGATE provides GATE Previous Year Questions, AI-generated practice questions, and step-by-step solutions for personal learning. Users agree not to:</p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Scrape or mass-extract platform question data or solution content via automated scripts.</li>
            <li>Share login credentials with unauthorized individuals or attempt to bypass rate limits.</li>
            <li>Misuse AI Tutor features for non-educational activities.</li>
          </ul>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>3. Intellectual Property Rights</h3>
          <p>Official GATE examination question text belongs to respective organizing institutes (IITs / IISc). Explanations, AI solution prompts, UI design elements, logo graphics, and proprietary rank analytics belong to AIRGATE.</p>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>4. Disclaimer of Warranties</h3>
          <p>AIRGATE strives for maximum accuracy in answer keys and GATE score predictions. However, AIRGATE is an independent EdTech platform and is not officially affiliated with or endorsed by any IIT or GATE Organizing Committee.</p>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>5. Account Termination & Changes</h3>
          <p>We reserve the right to suspend or terminate accounts that violate security or fair use policies. Terms may be updated periodically to align with regulatory requirements.</p>

          <h3 style={{ color: '#f8fafc', marginTop: '24px' }}>6. Support & Inquiries</h3>
          <p>For questions or assistance regarding these terms, reach us at:</p>
          <p style={{ color: '#38bdf8', fontWeight: 700 }}>📧 {supportEmail}</p>
        </div>
      </div>
    </div>
  );
}
