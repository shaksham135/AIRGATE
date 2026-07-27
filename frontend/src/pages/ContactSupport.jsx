import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_CONFIG from '../config/api';

export default function ContactSupport() {
  const navigate = useNavigate();
  const [supportInfo, setSupportInfo] = useState({
    email: 'support@airgate.in',
    phone: '+91 (800) AIR-GATE'
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    axios.get(`${API_CONFIG.BASE_URL}/api/admin/settings/public-meta`)
      .then(res => {
        if (res.data) {
          setSupportInfo({
            email: res.data.supportEmail || 'support@airgate.in',
            phone: res.data.supportPhone || '+91 (800) AIR-GATE'
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', padding: '40px 20px', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#111726', border: '1px solid #1e293b', borderRadius: '16px', padding: '36px', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
        
        <button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid #1e293b', color: '#38bdf8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', marginBottom: '24px', fontWeight: 600 }}>
          ← Back to AIRGATE Home
        </button>

        <h1 style={{ fontSize: '2rem', marginBottom: '8px', background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Contact Support & Help Desk
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '32px' }}>
          Have questions about GATE preparation, AIR GATE subscription, or technical issues? We are here to help!
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
          <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>📧</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#f8fafc' }}>Email Support</h3>
            <p style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '0.85rem' }}>Direct email response within 24 hours</p>
            <a href={`mailto:${supportInfo.email}`} style={{ color: '#38bdf8', fontWeight: 700, fontSize: '1rem', textDecoration: 'none' }}>
              {supportInfo.email}
            </a>
          </div>

          <div style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '12px' }}>📞</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#f8fafc' }}>Helpline & Support</h3>
            <p style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '0.85rem' }}>Monday - Saturday (9:00 AM - 8:00 PM IST)</p>
            <a href={`tel:${supportInfo.phone}`} style={{ color: '#10b981', fontWeight: 700, fontSize: '1rem', textDecoration: 'none' }}>
              {supportInfo.phone}
            </a>
          </div>
        </div>

        <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', padding: '20px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8', fontSize: '1rem' }}>🌐 Official AIRGATE Platform Notice</h4>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.6' }}>
            AIRGATE is built for GATE aspirants seeking top AIR Ranks & PSU cutoffs with 20+ years of previous year question papers, AI Tutor explanation, and full exam simulations.
          </p>
        </div>
      </div>
    </div>
  );
}
