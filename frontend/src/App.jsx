import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AuthService from './services/AuthService';
import API_CONFIG from './config/api';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Explorer = lazy(() => import('./pages/Explorer'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AdminQuestionEditor = lazy(() => import('./pages/AdminQuestionEditor'));
const UploadManager = lazy(() => import('./pages/UploadManager'));
const ReviewQueue = lazy(() => import('./pages/ReviewQueue'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AiGeneratorHub = lazy(() => import('./pages/AiGeneratorHub'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));
const QuestionDetail = lazy(() => import('./pages/QuestionDetail'));
const PracticeArena = lazy(() => import('./pages/PracticeArena'));
const Profile = lazy(() => import('./pages/Profile'));
const ExamSimulator = lazy(() => import('./pages/ExamSimulator'));
const MockHistory = lazy(() => import('./pages/MockHistory'));
const PremiumPage = lazy(() => import('./pages/PremiumPage'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const ContactSupport = lazy(() => import('./pages/ContactSupport'));
const NotFound = lazy(() => import('./pages/NotFound'));
import ErrorBoundary from './components/ErrorBoundary';
import { Analytics } from '@vercel/analytics/react';
import { FiHome, FiUpload, FiLock, FiLogOut, FiFolder, FiGrid, FiUser, FiCheckSquare, FiMenu, FiChevronLeft, FiChevronRight, FiClock, FiList, FiStar, FiCpu } from 'react-icons/fi';
import PremiumGateModal from './components/PremiumGateModal';
import BugReportModal from './components/BugReportModal';
import { FiAlertTriangle as FiBugAlert } from 'react-icons/fi';

// Route guard: redirects non-admin/editor users to /explore
function ProtectedAdminRoute({ children }) {
  if (!AuthService.isAdminOrEditor()) {
    return <Navigate to="/explore" replace />;
  }
  return children;
}



let publicMetaCache = null;

function DashboardLayout({ children }) {
  const currentUser = AuthService.getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [showPremiumModal, setShowPremiumModal] = React.useState(false);
  const [showBugModal, setShowBugModal] = React.useState(false);

  // Pre-fetch admin route chunks in background for zero-delay sidebar navigation
  React.useEffect(() => {
    if (AuthService.isAdminOrEditor()) {
      import('./pages/AdminPanel');
      import('./pages/AiGeneratorHub');
      import('./pages/ReviewQueue');
      import('./pages/UserManagement');
      import('./pages/UploadManager');
    }
  }, []);

  // Sync public SEO Meta Tags dynamically from backend System Settings (Cached per session)
  React.useEffect(() => {
    if (publicMetaCache) {
      applyPublicMeta(publicMetaCache);
      return;
    }
    fetch(`${API_CONFIG.BASE_URL}/api/admin/settings/public-meta`)
      .then(res => res.json())
      .then(meta => {
        publicMetaCache = meta;
        applyPublicMeta(meta);
      })
      .catch(() => {});
  }, []);

  const applyPublicMeta = (meta) => {
    if (meta.seoSiteTitle) {
      document.title = meta.seoSiteTitle;
    }
    if (meta.seoMetaDescription) {
      let descEl = document.querySelector('meta[name="description"]');
      if (!descEl) {
        descEl = document.createElement('meta');
        descEl.name = 'description';
        document.head.appendChild(descEl);
      }
      descEl.content = meta.seoMetaDescription;
    }
    if (meta.googleSiteVerification) {
      let googleEl = document.querySelector('meta[name="google-site-verification"]');
      if (!googleEl) {
        googleEl = document.createElement('meta');
        googleEl.name = 'google-site-verification';
        document.head.appendChild(googleEl);
      }
      googleEl.content = meta.googleSiteVerification;
    }
    if (meta.umamiWebsiteId) {
      let umamiScript = document.querySelector('script[data-website-id]');
      if (!umamiScript) {
        umamiScript = document.createElement('script');
        umamiScript.async = true;
        umamiScript.src = 'https://cloud.umami.is/script.js';
        document.head.appendChild(umamiScript);
      }
      umamiScript.setAttribute('data-website-id', meta.umamiWebsiteId);
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    navigate('/login');
    window.location.reload();
  };

  const handleSidebarNavClick = (e, path) => {
    setIsMobileOpen(false);
    if (location.pathname === '/simulator') {
      const isExamActive = document.querySelector('.exam-simulator-layout') !== null;
      if (isExamActive) {
        const confirmNav = window.confirm('⚠️ Your Mock Exam is currently in progress!\n\nNavigating away will automatically submit your exam. Are you sure you want to proceed?');
        if (!confirmNav) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  };

  React.useEffect(() => {
    if (currentUser) {
      AuthService.checkAndRefreshUserStatus(true)
        .then(updated => {
          if (updated && updated.isBanned) {
            handleLogout();
          }
        })
        .catch(err => {
          console.error("Failed to sync user status from dashboard layout:", err);
        });
    }
  }, [location.pathname]);

  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/uploads');

  return (
    <div className={`app-layout ${isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      {/* Mobile Top Bar */}
      <div className="mobile-top-bar">
        <button className="hamburger-btn" onClick={() => setIsMobileOpen(!isMobileOpen)}>
          <FiMenu />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <svg width="28" height="28" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.75))' }}>
            <defs>
              <linearGradient id="mobTopGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00d2ff" />
                <stop offset="50%" stopColor="#3a7bd5" />
                <stop offset="100%" stopColor="#928dab" />
              </linearGradient>
              <linearGradient id="mobTopABody" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00c6ff" />
                <stop offset="50%" stopColor="#0072ff" />
                <stop offset="100%" stopColor="#7a22ff" />
              </linearGradient>
              <linearGradient id="mobTopGBody" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#4facfe" />
              </linearGradient>
            </defs>
            <path d="M 16,74 A 48,48 0 1,1 104,74" stroke="url(#mobTopGrad)" strokeWidth="2.8" fill="none" opacity="0.9" />
            <circle cx="60" cy="12" r="4" fill="#00f2fe" />

            <g transform="translate(16, 46)">
              <circle cx="0" cy="0" r="12" fill="#090d16" stroke="#00f2fe" strokeWidth="2" />
              <path d="M -5,5 L -5,-1 M -2,5 L -2,-4 M 1,5 L 1,-2 M 4,5 L 4,-6" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" />
            </g>

            <g transform="translate(104, 46)">
              <circle cx="0" cy="0" r="12" fill="#090d16" stroke="#b537ff" strokeWidth="2" />
              <rect x="-5.5" y="-7" width="11" height="14" rx="2" stroke="#b537ff" strokeWidth="1.8" fill="none" />
              <path d="M -2.5,-1.5 L -0.5,1 L 3.5,-3" stroke="#b537ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <path d="M 60,16 L 102,94 L 86,94 L 60,45 L 34,94 L 18,94 Z" fill="url(#mobTopABody)" />
            <path d="M 72,55 C 72,42 48,40 48,56 C 48,70 72,68 72,60 L 58,60" stroke="url(#mobTopGBody)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            <rect x="44" y="74" width="3" height="20" fill="#00f2fe" opacity="0.8" rx="1" />
            <rect x="49" y="78" width="3" height="16" fill="#00f2fe" opacity="0.8" rx="1" />
            <rect x="68" y="78" width="3" height="16" fill="#00f2fe" opacity="0.8" rx="1" />
            <rect x="73" y="74" width="3" height="20" fill="#00f2fe" opacity="0.8" rx="1" />

            <rect x="54" y="80" width="12" height="14" fill="#00f2fe" rx="2" />
            <rect x="57" y="83" width="6" height="11" fill="#ffffff" rx="1" />
          </svg>
          <span style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
            {isAdminRoute ? (
              <span style={{ color: 'var(--color-success)' }}>AIRGATE <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>ADMIN</span></span>
            ) : (
              <span>
                <span style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AIR</span>
                <span style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GATE</span>
              </span>
            )}
          </span>
        </div>
        <div style={{ width: '40px' }}></div>
      </div>

      {/* Mobile Sidebar Backdrop Overlay */}
      <div 
        className={`sidebar-overlay ${isMobileOpen ? 'mobile-open' : ''}`} 
        onClick={() => setIsMobileOpen(false)}
      ></div>

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''} ${isAdminRoute ? 'sidebar-admin' : ''}`}>
        <div className="sidebar-logo" onClick={() => setIsCollapsed(!isCollapsed)} style={{ cursor: 'pointer' }} title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
          <svg width="38" height="38" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, filter: 'drop-shadow(0 0 12px rgba(56, 189, 248, 0.65))' }}>
            <defs>
              <linearGradient id="opt4GradSide" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00d2ff" />
                <stop offset="50%" stopColor="#3a7bd5" />
                <stop offset="100%" stopColor="#928dab" />
              </linearGradient>
              <linearGradient id="opt4ABodySide" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00c6ff" />
                <stop offset="50%" stopColor="#0072ff" />
                <stop offset="100%" stopColor="#7a22ff" />
              </linearGradient>
              <linearGradient id="opt4GBodySide" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#4facfe" />
              </linearGradient>
            </defs>

            <path d="M 16,74 A 48,48 0 1,1 104,74" stroke="url(#opt4GradSide)" strokeWidth="2.8" fill="none" opacity="0.9" />
            <circle cx="60" cy="12" r="4" fill="#00f2fe" />

            <g transform="translate(16, 46)">
              <circle cx="0" cy="0" r="12" fill="#090d16" stroke="#00f2fe" strokeWidth="2" />
              <path d="M -5,5 L -5,-1 M -2,5 L -2,-4 M 1,5 L 1,-2 M 4,5 L 4,-6" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" />
            </g>

            <g transform="translate(104, 46)">
              <circle cx="0" cy="0" r="12" fill="#090d16" stroke="#b537ff" strokeWidth="2" />
              <rect x="-5.5" y="-7" width="11" height="14" rx="2" stroke="#b537ff" strokeWidth="1.8" fill="none" />
              <path d="M -2.5,-1.5 L -0.5,1 L 3.5,-3" stroke="#b537ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            <path d="M 60,16 L 102,94 L 86,94 L 60,45 L 34,94 L 18,94 Z" fill="url(#opt4ABodySide)" />
            <path d="M 72,55 C 72,42 48,40 48,56 C 48,70 72,68 72,60 L 58,60" stroke="url(#opt4GBodySide)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

            <rect x="44" y="74" width="3" height="20" fill="#00f2fe" opacity="0.8" rx="1" />
            <rect x="49" y="78" width="3" height="16" fill="#00f2fe" opacity="0.8" rx="1" />
            <rect x="68" y="78" width="3" height="16" fill="#00f2fe" opacity="0.8" rx="1" />
            <rect x="73" y="74" width="3" height="20" fill="#00f2fe" opacity="0.8" rx="1" />

            <rect x="54" y="80" width="12" height="14" fill="#00f2fe" rx="2" />
            <rect x="57" y="83" width="6" height="11" fill="#ffffff" rx="1" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {isAdminRoute ? (
                <span style={{ color: 'var(--color-success)' }}>AIRGATE <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>ADMIN</span></span>
              ) : (
                <span>
                  <span style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AIR</span>
                  <span style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GATE</span>
                </span>
              )}
            </span>
            {!isCollapsed && !isAdminRoute && (
              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Practice · Analyze · Progress
              </span>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {isAdminRoute ? (
            /* Admin Route Navigation Suite */
            <div>
              {!isCollapsed && (
                <div className="sidebar-section-header">
                  Admin Operations
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Link to="/admin/panel" className={`sidebar-link ${location.pathname === '/admin/panel' ? 'active' : ''}`} onClick={() => setIsMobileOpen(false)} title="Admin Panel">
                  <FiLock size={18} /> <span>Admin Panel</span>
                </Link>
                <Link to="/admin/ai-generator" className={`sidebar-link ${location.pathname === '/admin/ai-generator' ? 'active' : ''}`} onClick={() => setIsMobileOpen(false)} style={{ color: '#c4b5fd', fontWeight: 600 }} title="AI Generator Hub">
                  <FiCpu size={18} style={{ color: '#8b5cf6' }} /> <span>AI Generator Hub 🤖</span>
                </Link>
                <Link to="/admin/review-queue" className={`sidebar-link ${location.pathname === '/admin/review-queue' ? 'active' : ''}`} onClick={() => setIsMobileOpen(false)} title="Review Queue">
                  <FiCheckSquare size={18} /> <span>Review Queue</span>
                </Link>
                <Link to="/admin/users" className={`sidebar-link ${location.pathname === '/admin/users' ? 'active' : ''}`} onClick={() => setIsMobileOpen(false)} title="User Management">
                  <FiUser size={18} /> <span>User Management</span>
                </Link>
                <Link to="/uploads" className={`sidebar-link ${location.pathname === '/uploads' ? 'active' : ''}`} onClick={() => setIsMobileOpen(false)} title="Upload PDF">
                  <FiUpload size={18} /> <span>Upload PDF</span>
                </Link>
                <Link to="/explore" className="sidebar-link" onClick={() => setIsMobileOpen(false)} style={{ color: 'var(--color-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px', paddingTop: '12px' }} title="Go to Website">
                  <FiChevronLeft size={18} /> <span>Go to Website</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Student / Aspirant Route Navigation Suite */
            <>
              <div>
                {!isCollapsed && (
                  <div className="sidebar-section-header">
                    Aspirant Suite
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Link to="/explore" className={`sidebar-link ${location.pathname === '/explore' ? 'active' : ''}`} onClick={(e) => handleSidebarNavClick(e, '/explore')} title="Official GATE PYQs">
                    <FiHome size={18} /> <span>Official PYQs</span>
                  </Link>

                  <Link to="/practice" className={`sidebar-link ${location.pathname === '/practice' ? 'active' : ''}`} onClick={(e) => handleSidebarNavClick(e, '/practice')} title="Conceptual Practice">
                    <FiCpu size={18} /> <span>Practice Arena</span>
                  </Link>
                  
                  <Link to="/bookmarks" className={`sidebar-link ${location.pathname === '/bookmarks' ? 'active' : ''}`} onClick={(e) => handleSidebarNavClick(e, '/bookmarks')} title="Prep Analyst">
                    <FiFolder size={18} /> <span>Prep Analyst</span>
                  </Link>

                  <Link to="/simulator" className={`sidebar-link ${location.pathname === '/simulator' ? 'active' : ''}`} onClick={(e) => handleSidebarNavClick(e, '/simulator')} title="Mock Test Arena">
                    <FiClock size={18} /> <span>Mock Test Arena</span>
                  </Link>

                  <Link to="/simulator/history" className={`sidebar-link ${location.pathname === '/simulator/history' ? 'active' : ''}`} onClick={(e) => handleSidebarNavClick(e, '/simulator/history')} style={{ paddingLeft: isCollapsed ? undefined : '24px', opacity: 0.85 }} title="Test History">
                    <FiList size={16} /> <span>Test History</span>
                  </Link>

                  <Link to="/premium" className={`sidebar-link ${location.pathname === '/premium' ? 'active' : ''}`} onClick={(e) => handleSidebarNavClick(e, '/premium')} title="Aspirant Pro">
                    <FiStar size={18} /> <span>Aspirant Pro</span>
                  </Link>
                </div>
              </div>

              {AuthService.isAdminOrEditor() && (
                <div>
                  {!isCollapsed && (
                    <div className="sidebar-section-header">
                      Admin Tools
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Link to="/admin/panel" className="sidebar-link" onClick={(e) => handleSidebarNavClick(e, '/admin/panel')} style={{ color: 'var(--color-success)' }} title="Admin Portal">
                      <FiLock size={18} /> <span>Admin Portal</span>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </nav>


        {/* Sidebar Footer User Section */}
        <div className="sidebar-footer">
          {currentUser ? (
            <div>
              <div 
                className="user-profile-card" 
                onClick={() => { navigate('/profile'); setIsMobileOpen(false); }}
                title="View Profile Settings"
              >
                <div className="user-avatar">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {currentUser.username} {AuthService.isPremium() && <span title="Pro Plan Active 👑" style={{ color: '#f59e0b', fontSize: '0.72rem', padding: '1px 6px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 800 }}>PRO 👑</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Plan: {AuthService.isPremium() ? 'Aspirant Pro 👑' : 'Standard'}
                  </div>
                </div>
              </div>

              <button 
                className="btn btn-outline" 
                onClick={handleLogout}
                style={{ width: '100%', padding: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                title="Log Out"
              >
                <FiLogOut /> <span>Log Out</span>
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-primary" 
              onClick={() => { navigate('/login'); setIsMobileOpen(false); }}
              style={{ width: '100%', padding: '10px' }}
              title="Sign In"
            >
              <FiUser /> <span>Sign In</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">

        {/* Child Router Content */}
        <div style={{ display: 'flex', flexGrow: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </main>

      <PremiumGateModal 
        isOpen={showPremiumModal} 
        onClose={() => setShowPremiumModal(false)} 
        onUpgradeSuccess={() => window.location.reload()} 
      />

      {/* Floating Bug Report Button (Hidden during AI Tutor chat or active fullscreen) */}
      {currentUser && !showBugModal && !document.querySelector('.ai-tutor-drawer-open') && (
        <button
          onClick={() => setShowBugModal(true)}
          className="bug-report-floating-btn"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
            zIndex: 999,
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
          title="Report a bug"
        >
          <FiBugAlert size={20} />
        </button>
      )}

      <BugReportModal 
        isOpen={showBugModal}
        onClose={() => setShowBugModal(false)}
      />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/maintenance" element={<Maintenance />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/contact" element={<ContactSupport />} />
      <Route path="/support" element={<ContactSupport />} />
      
      {/* Dashboard wrapped routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/explore" element={<DashboardLayout><Explorer /></DashboardLayout>} />
      <Route path="/practice" element={<DashboardLayout><PracticeArena /></DashboardLayout>} />
      <Route path="/admin/questions/new" element={<ProtectedAdminRoute><DashboardLayout><AdminQuestionEditor /></DashboardLayout></ProtectedAdminRoute>} />
      <Route path="/admin/questions/:id/edit" element={<ProtectedAdminRoute><DashboardLayout><AdminQuestionEditor /></DashboardLayout></ProtectedAdminRoute>} />
      <Route path="/admin/panel" element={<ProtectedAdminRoute><DashboardLayout><AdminPanel /></DashboardLayout></ProtectedAdminRoute>} />
      <Route path="/admin/ai-generator" element={<ProtectedAdminRoute><DashboardLayout><AiGeneratorHub /></DashboardLayout></ProtectedAdminRoute>} />
      <Route path="/admin/users" element={<ProtectedAdminRoute><DashboardLayout><UserManagement /></DashboardLayout></ProtectedAdminRoute>} />

      {/* Bookmarks & Solves Route */}
      <Route path="/bookmarks" element={<DashboardLayout><Bookmarks /></DashboardLayout>} />
      <Route path="/profile" element={<DashboardLayout><Profile /></DashboardLayout>} />
      <Route path="/simulator" element={<DashboardLayout><ExamSimulator /></DashboardLayout>} />
      <Route path="/simulator/history" element={<DashboardLayout><MockHistory /></DashboardLayout>} />
      <Route path="/questions/:id" element={<DashboardLayout><QuestionDetail /></DashboardLayout>} />
      <Route path="/premium" element={<DashboardLayout><PremiumPage /></DashboardLayout>} />

      <Route path="/uploads" element={<ProtectedAdminRoute><DashboardLayout><UploadManager /></DashboardLayout></ProtectedAdminRoute>} />
      <Route path="/admin/review-queue" element={<ProtectedAdminRoute><DashboardLayout><ReviewQueue /></DashboardLayout></ProtectedAdminRoute>} />

      {/* 404 Wildcard Catch-All Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#38bdf8', fontFamily: 'sans-serif' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ border: '4px solid rgba(56, 189, 248, 0.1)', borderTop: '4px solid #38bdf8', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }}></div>
              <div>Loading Platform...</div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        }>
          <AppRoutes />
          <Analytics />
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}
