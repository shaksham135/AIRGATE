import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/authService';
import { FiSend } from 'react-icons/fi';

export default function AdminBannersTab() {
  const [banners, setBanners] = useState([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerMessage, setBannerMessage] = useState('');
  const [bannerCtaText, setBannerCtaText] = useState('Claim Offer');
  const [bannerCtaLink, setBannerCtaLink] = useState('/pricing');
  const [bannerCouponCode, setBannerCouponCode] = useState('');
  const [bannerBgColor, setBannerBgColor] = useState('#8b5cf6');
  const [bannerTextColor, setBannerTextColor] = useState('#ffffff');
  const [bannerActionMsg, setBannerActionMsg] = useState('');

  const fetchBanners = async () => {
    try {
      setBannersLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/banners`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) {
        setBanners(res.data);
      }
    } catch (err) {
      console.error("Failed to load banners", err);
    } finally {
      setBannersLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handlePublishBanner = async (e) => {
    e.preventDefault();
    if (!bannerTitle.trim() || !bannerMessage.trim()) return;

    try {
      setBannerActionMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/banners`, {
        title: bannerTitle.trim(),
        message: bannerMessage.trim(),
        ctaText: bannerCtaText,
        ctaLink: bannerCtaLink,
        couponCode: bannerCouponCode,
        bgColor: bannerBgColor,
        textColor: bannerTextColor
      }, { headers: AuthService.getAuthHeader() });

      if (res.data) {
        setBannerActionMsg("📢 Ad Banner published successfully!");
        setBannerTitle('');
        setBannerMessage('');
        setBannerCouponCode('');
        fetchBanners();
      }
    } catch (err) {
      alert("Failed to publish banner.");
    }
  };

  const handleDeleteBanner = async (id) => {
    if (!window.confirm("Delete this banner?")) return;
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/api/admin/banners/${id}`, {
        headers: AuthService.getAuthHeader()
      });
      fetchBanners();
    } catch (err) {
      alert("Failed to delete banner.");
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="admin-header-card">
        <h2 className="admin-header-title">
          <FiSend style={{ color: '#8b5cf6' }} /> Dynamic Announcement Ad Banner Manager
        </h2>
        <p className="admin-header-desc">
          Publish top website alert banners, promotional announcements, and discount offers with custom colors and attached CTA coupons.
        </p>
      </div>

      <div className="admin-grid-split">
        
        {/* Left: Create Banner Form */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700 }}>
            📢 Publish New Ad Banner
          </h3>

          {bannerActionMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
              {bannerActionMsg}
            </div>
          )}

          <form onSubmit={handlePublishBanner} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Banner Title</label>
              <input 
                type="text" 
                placeholder="e.g. Early Bird Launch Sale" 
                value={bannerTitle}
                onChange={e => setBannerTitle(e.target.value)}
                className="admin-input"
                style={{ fontWeight: 600 }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Announcement Message</label>
              <textarea 
                placeholder="e.g. Get 50% OFF AIRGATE PRO Season Pass for the first 100 students!" 
                value={bannerMessage}
                onChange={e => setBannerMessage(e.target.value)}
                rows={2}
                className="admin-textarea"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>CTA Button Text</label>
                <input 
                  type="text" 
                  value={bannerCtaText} 
                  onChange={e => setBannerCtaText(e.target.value)}
                  className="admin-input"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Attached Coupon Code</label>
                <input 
                  type="text" 
                  placeholder="e.g. LAUNCH50" 
                  value={bannerCouponCode} 
                  onChange={e => setBannerCouponCode(e.target.value)}
                  className="admin-input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Background Color</label>
                <input 
                  type="color" 
                  value={bannerBgColor} 
                  onChange={e => setBannerBgColor(e.target.value)}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Text Color</label>
                <input 
                  type="color" 
                  value={bannerTextColor} 
                  onChange={e => setBannerTextColor(e.target.value)}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer' }}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ marginTop: '8px', padding: '12px', background: '#8b5cf6', borderColor: '#8b5cf6', fontWeight: 800 }}
            >
              Publish Announcement Banner
            </button>
          </form>
        </div>

        {/* Right: Active Banners List */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700 }}>
            📢 Active Website Banners ({banners.length})
          </h3>

          {bannersLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading banners...</p>
          ) : banners.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No ad banners published. Create your first announcement on the left!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {banners.map(b => (
                <div key={b.id} style={{ padding: '14px', borderRadius: '12px', background: b.bgColor || '#8b5cf6', color: b.textColor || '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{b.title}</div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>{b.message}</div>
                    {b.couponCode && <div style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 700, fontFamily: 'monospace' }}>CODE: {b.couponCode}</div>}
                  </div>
                  <button 
                    className="btn btn-outline"
                    onClick={() => handleDeleteBanner(b.id)}
                    style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', padding: '4px 10px', fontSize: '0.78rem', background: 'rgba(0,0,0,0.2)' }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
