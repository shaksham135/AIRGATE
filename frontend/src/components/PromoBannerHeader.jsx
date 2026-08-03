import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_CONFIG from '../config/api';
import { FiGift, FiX, FiArrowRight } from 'react-icons/fi';

import CacheService from '../services/CacheService';

export default function PromoBannerHeader({ onApplyCoupon }) {
  const navigate = useNavigate();
  const [banner, setBanner] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchActiveBanners = async () => {
      const cached = CacheService.get('active_banners');
      let bannerData = null;
      if (cached && Array.isArray(cached) && cached.length > 0) {
        bannerData = cached[0];
      } else {
        try {
          const response = await axios.get(`${API_CONFIG.BASE_URL}/api/banners/active`);
          const data = Array.isArray(response.data) ? response.data : [];
          if (data.length > 0) bannerData = data[0];
          CacheService.set('active_banners', data, 600000); // 10 mins TTL
        } catch (err) {
          // Silent catch
        }
      }

      if (bannerData) {
        // Frequency Capping: Check if dismissed within the last 24 hours
        const dismissedKey = `banner_dismissed_${bannerData.id || 'default'}`;
        const lastDismissed = localStorage.getItem(dismissedKey);
        if (lastDismissed) {
          const hoursSinceDismissed = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60);
          if (hoursSinceDismissed < 24) {
            setDismissed(true);
          }
        }
        setBanner(bannerData);
      }
    };
    fetchActiveBanners();
  }, []);

  const handleDismiss = () => {
    if (banner) {
      const dismissedKey = `banner_dismissed_${banner.id || 'default'}`;
      localStorage.setItem(dismissedKey, Date.now().toString());
    }
    setDismissed(true);
  };

  if (!banner || dismissed) return null;

  return (
    <div 
      style={{
        background: banner.bgColor || 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
        color: banner.textColor || '#ffffff',
        padding: '10px 16px',
        fontSize: '0.88rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        position: 'relative',
        zIndex: 1000,
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        textAlign: 'center',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FiGift style={{ fontSize: '1.1rem', flexShrink: 0 }} />
        <span><strong>{banner.title}:</strong> {banner.message}</span>
      </div>

      {banner.couponCode && (
        <span 
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontWeight: 700,
            letterSpacing: '0.05em',
            border: '1px dashed rgba(255, 255, 255, 0.5)'
          }}
        >
          CODE: {banner.couponCode}
        </span>
      )}

      {banner.ctaText && (
        <a 
          href={banner.ctaLink || '/pricing'} 
          onClick={(e) => {
            e.preventDefault();
            if (onApplyCoupon) {
              onApplyCoupon(banner.couponCode);
            } else {
              navigate(banner.ctaLink || '/pricing');
            }
          }}
          style={{
            color: '#fff',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '4px 14px',
            borderRadius: '20px',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.25)'}
        >
          {banner.ctaText} <FiArrowRight size={12} />
        </a>
      )}

      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          right: '12px',
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          opacity: 0.8,
          padding: '4px',
          display: 'flex',
          alignItems: 'center'
        }}
        title="Dismiss announcement"
      >
        <FiX size={16} />
      </button>
    </div>
  );
}
