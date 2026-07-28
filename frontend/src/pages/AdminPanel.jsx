import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { FiGrid, FiFolderPlus, FiPlusCircle, FiFileText, FiActivity, FiLayers, FiAlertTriangle, FiCheck, FiExternalLink, FiUsers, FiArrowRight, FiSettings, FiInbox, FiAlertOctagon, FiLock, FiDatabase, FiDownload, FiCpu, FiPlay, FiPause, FiRefreshCw, FiMail, FiSend } from 'react-icons/fi';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AdminPanel() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalApproved: 0,
    totalPending: 0,
    totalQuestions: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const [bgStats, setBgStats] = useState({
    pendingSolutions: 0,
    completedSolutions: 0,
    fallbackSolutions: 0,
    totalSolutions: 0
  });
  const [bgStatsLoading, setBgStatsLoading] = useState(true);


  // Subject list and form states
  const [subjects, setSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState('');
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [subjectSuccess, setSubjectSuccess] = useState('');
  const [subjectError, setSubjectError] = useState('');

  // Topic form states
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [parentTopicId, setParentTopicId] = useState('');
  const [topicName, setTopicName] = useState('');
  const [flatTopics, setFlatTopics] = useState([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicSuccess, setTopicSuccess] = useState('');
  const [topicError, setTopicError] = useState('');

  // Question reports states
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('metrics');
  const [groqUsage, setGroqUsage] = useState({ usedTokens: 0, limit: 10000000 });
  const [groqUsageLoading, setGroqUsageLoading] = useState(true);

  // Nightly AI Generator Control Hub State
  const [aiGenStatus, setAiGenStatus] = useState({
    enabled: true,
    running: false,
    startHour: 0,
    endHour: 4,
    totalAccepted: 0,
    totalRejected: 0,
    ledger: []
  });
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const [aiGenActionMsg, setAiGenActionMsg] = useState('');

  // Admin Dashboard Business & Usage Metrics
  const [adminMetrics, setAdminMetrics] = useState({
    totalUsers: 0,
    newSignupsToday: 0,
    dau: 0,
    mau: 0,
    retentionIndex: 0.0,
    aiRequestsToday: 0,
    questionsSolvedToday: 0,
    mockTestsAttempted: 0,
    totalRevenue: 0.0,
    revenueToday: 0.0,
    dailyTrends: []
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  // System Settings state
  const [settings, setSettings] = useState({
    premiumPriceInr: 99.0,
    premiumDurationMonths: 1,
    aiDailyLimitPremium: 50,
    isMaintenanceMode: false
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Email Broadcast Hub state
  const [emailSegment, setEmailSegment] = useState('ALL');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBodyHtml, setEmailBodyHtml] = useState('');
  const [customSingleEmail, setCustomSingleEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailLogs, setEmailLogs] = useState([]);

  // Bug Reports state
  const [bugs, setBugs] = useState([]);
  const [bugsLoading, setBugsLoading] = useState(false);

  const fetchEmailLogs = async () => {
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/email/logs`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) setEmailLogs(res.data);
    } catch (err) {
      console.error("Failed to load email logs", err);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailBodyHtml.trim()) return;
    try {
      setEmailLoading(true);
      setEmailMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/email/broadcast`, {
        targetSegment: emailSegment,
        subject: emailSubject,
        bodyHtml: emailBodyHtml,
        customSingleEmail
      }, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data && res.data.success) {
        setEmailMsg('✅ ' + res.data.message);
        setEmailSubject('');
        setEmailBodyHtml('');
        setCustomSingleEmail('');
        setTimeout(() => fetchEmailLogs(), 2000);
      }
    } catch (err) {
      alert("Failed to trigger email broadcast: " + (err.response?.data?.error || err.message));
    } finally {
      setEmailLoading(false);
    }
  };

  // Secure Database Backup Vault state (PIN Protected)
  const [backupPinInput, setBackupPinInput] = useState('');
  const [isBackupUnlocked, setIsBackupUnlocked] = useState(false);
  const [unlockedPin, setUnlockedPin] = useState('');
  const [backupFiles, setBackupFiles] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupMessage, setBackupMessage] = useState('');

  const handleUnlockBackupVault = async (pinToVerify) => {
    const pin = pinToVerify || backupPinInput;
    if (!pin.trim()) return;
    try {
      setBackupsLoading(true);
      setBackupError('');
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/backups/list`, { pin }, {
        headers: AuthService.getAuthHeader()
      });
      if (response.data && response.data.success) {
        setIsBackupUnlocked(true);
        setUnlockedPin(pin);
        setBackupFiles(response.data.backups || []);
        setBackupError('');
      }
    } catch (err) {
      setBackupError(err.response?.data?.error || "Invalid Security PIN! Access Denied.");
      setIsBackupUnlocked(false);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    if (!unlockedPin) return;
    try {
      setBackupsLoading(true);
      setBackupMessage('');
      setBackupError('');
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/backups/create`, { pin: unlockedPin }, {
        headers: AuthService.getAuthHeader()
      });
      if (response.data && response.data.success) {
        setBackupMessage('✅ Instant database backup created successfully!');
        handleUnlockBackupVault(unlockedPin);
      }
    } catch (err) {
      setBackupError(err.response?.data?.error || "Backup failed.");
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleDownloadBackup = async (filename) => {
    if (!unlockedPin) return;
    try {
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/backups/download`, 
        { pin: unlockedPin, filename }, 
        {
          headers: AuthService.getAuthHeader(),
          responseType: 'blob'
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Failed to download backup file.");
    }
  };



  // Load stats and subjects
  const fetchAiGenStatus = async () => {
    try {
      setAiGenLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/generator/status`, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data) {
        setAiGenStatus(res.data);
      }
    } catch (err) {
      console.error("Failed to load AI Generator status", err);
    } finally {
      setAiGenLoading(false);
    }
  };

  const handleToggleAiGen = async (enabled) => {
    try {
      setAiGenActionMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/generator/toggle?enabled=${enabled}`, {}, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data && res.data.success) {
        setAiGenActionMsg(res.data.message);
        fetchAiGenStatus();
      }
    } catch (err) {
      alert("Failed to toggle AI generator status.");
    }
  };

  const handleTriggerTestBatch = async () => {
    try {
      setAiGenActionMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/generator/test-run`, {}, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data && res.data.success) {
        setAiGenActionMsg(res.data.message);
        setTimeout(() => fetchAiGenStatus(), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to trigger test batch.");
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/stats`, {
        headers: AuthService.getAuthHeader()
      });
      setStats(response.data);
    } catch (err) {
      console.error("Failed to load statistics:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects`);
      setSubjects(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to load subjects:", err);
      setSubjects([]);
    }
  };

  const fetchReports = async () => {
    try {
      setReportsLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/reports`, {
        headers: AuthService.getAuthHeader()
      });
      setReports(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to load reports:", err);
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  };

  const handleResolveReport = async (reportId) => {
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/admin/reports/${reportId}/resolve`, {}, {
        headers: AuthService.getAuthHeader()
      });
      setReports(prev => prev.filter(r => r.id !== reportId));
      alert("Report marked as resolved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to resolve report.");
    }
  };

  const fetchBgStats = async () => {
    try {
      setBgStatsLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/background-stats`, {
        headers: AuthService.getAuthHeader()
      });
      setBgStats(response.data);
    } catch (err) {
      console.error("Failed to load background stats:", err);
    } finally {
      setBgStatsLoading(false);
    }
  };

  const fetchGroqUsage = async () => {
    try {
      setGroqUsageLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/groq-usage`, {
        headers: AuthService.getAuthHeader()
      });
      setGroqUsage(response.data || { usedTokens: 0, limit: 10000000 });
    } catch (err) {
      console.error("Failed to load Groq usage stats:", err);
    } finally {
      setGroqUsageLoading(false);
    }
  };

  const fetchAdminMetrics = async () => {
    const user = AuthService.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      setMetricsLoading(false);
      return;
    }
    try {
      setMetricsLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/analytics/dashboard`, {
        headers: AuthService.getAuthHeader()
      });
      setAdminMetrics(response.data || {
        totalUsers: 0,
        newSignupsToday: 0,
        dau: 0,
        mau: 0,
        retentionIndex: 0.0,
        aiRequestsToday: 0,
        questionsSolvedToday: 0,
        mockTestsAttempted: 0,
        totalRevenue: 0.0,
        revenueToday: 0.0,
        dailyTrends: []
      });
    } catch (err) {
      console.error("Failed to load admin metrics:", err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/settings`, {
        headers: AuthService.getAuthHeader()
      });
      setSettings(response.data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateSettings = async (e) => {
    if (e) e.preventDefault();
    try {
      setSettingsLoading(true);
      setSettingsSuccess('');
      const response = await axios.put(`${API_CONFIG.BASE_URL}/api/admin/settings`, settings, {
        headers: AuthService.getAuthHeader()
      });
      setSettings(response.data);
      setSettingsSuccess('Settings updated successfully!');
    } catch (err) {
      alert("Failed to update settings: " + (err.response?.data?.message || err.message));
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchBugs = async () => {
    try {
      setBugsLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/bugs`, {
        headers: AuthService.getAuthHeader()
      });
      setBugs(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to load bugs:", err);
    } finally {
      setBugsLoading(false);
    }
  };

  const handleResolveBug = async (bugId) => {
    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/admin/bugs/${bugId}/resolve`, {}, {
        headers: AuthService.getAuthHeader()
      });
      fetchBugs();
      alert("Bug report marked as RESOLVED!");
    } catch (err) {
      alert("Failed to resolve bug: " + (err.response?.data?.message || err.message));
    }
  };

  useEffect(() => {
    if (!AuthService.isAdminOrEditor()) {
      navigate('/explore');
      return;
    }
    fetchStats();
    fetchSubjects();
    fetchReports();
    fetchBgStats();
    fetchGroqUsage();
    fetchAdminMetrics();
    fetchSettings();
    fetchBugs();

    // Poll background stats every 30 seconds for real-time progress tracking
    const interval = setInterval(() => {
      fetchBgStats();
      fetchGroqUsage();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab) {
      setActiveTab(tab);
      if (tab === 'aigen') fetchAiGenStatus();
      if (tab === 'email') fetchEmailLogs();
    }
  }, [location.search]);



  // Fetch topics of selected subject to choose parent
  useEffect(() => {
    if (!selectedSubjectId) {
      setFlatTopics([]);
      setParentTopicId('');
      return;
    }

    const fetchTopics = async () => {
      try {
        const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects/${selectedSubjectId}/topics`);
        // Flatten nested TopicNode tree
        const flattened = flattenTopics(response.data);
        setFlatTopics(flattened);
      } catch (err) {
        console.error("Failed to load topics:", err);
        setFlatTopics([]);
      }
    };

    fetchTopics();
  }, [selectedSubjectId]);

  // Recursive tree flattener
  const flattenTopics = (nodes, prefix = '') => {
    let list = [];
    nodes.forEach(node => {
      list.push({
        id: node.id,
        name: prefix ? `${prefix} ➔ ${node.name}` : node.name
      });
      if (node.children && node.children.length > 0) {
        list = list.concat(flattenTopics(node.children, prefix ? `${prefix} ➔ ${node.name}` : node.name));
      }
    });
    return list;
  };

  // Submit handlers
  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!subjectName.trim()) return;

    try {
      setSubjectLoading(true);
      setSubjectSuccess('');
      setSubjectError('');

      await axios.post(`${API_CONFIG.BASE_URL}/api/subjects`, 
        { name: subjectName.trim() },
        { headers: AuthService.getAuthHeader() }
      );

      setSubjectSuccess(`Subject "${subjectName}" created successfully!`);
      setSubjectName('');
      fetchSubjects(); // Refresh subjects dropdown list
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to create subject.";
      setSubjectError(errMsg);
    } finally {
      setSubjectLoading(false);
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!selectedSubjectId || !topicName.trim()) return;

    try {
      setTopicLoading(true);
      setTopicSuccess('');
      setTopicError('');

      const payload = {
        name: topicName.trim(),
        parentTopicId: parentTopicId ? parseInt(parentTopicId, 10) : null
      };

      await axios.post(`${API_CONFIG.BASE_URL}/api/subjects/${selectedSubjectId}/topics`, 
        payload,
        { headers: AuthService.getAuthHeader() }
      );

      setTopicSuccess(`Topic "${topicName}" created successfully!`);
      setTopicName('');
      setParentTopicId('');
      
      // Refresh subtopics list
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects/${selectedSubjectId}/topics`);
      setFlatTopics(flattenTopics(response.data));
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to create topic.";
      setTopicError(errMsg);
    } finally {
      setTopicLoading(false);
    }
  };

  return (
    <div style={{ padding: '0', width: '100%', maxWidth: '100%', margin: '0 auto' }}>

      {/* ── Premium Sticky Admin Header ─────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'linear-gradient(135deg, rgba(15,18,30,0.98) 0%, rgba(20,24,40,0.98) 100%)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
        padding: '0 32px',
      }}>

        {/* Top Row: Branding + Actions */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 0 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Icon Badge */}
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99,102,241,0.35)'
            }}>
              <FiGrid size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{
                fontSize: '1.25rem', fontWeight: 800, color: '#fff',
                margin: 0, letterSpacing: '-0.02em',
                background: 'linear-gradient(90deg, #fff 0%, #94a3b8 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}>
                Admin Control Panel
              </h1>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', marginTop: '1px' }}>
                AIRGATE Platform Management
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/explore')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '10px', fontWeight: 600,
              fontSize: '0.82rem', cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            <FiExternalLink size={13} /> Go to Website
          </button>
        </div>

        {/* Bottom Row: Navigation Tabs */}
        <div style={{
          display: 'flex', gap: '2px', padding: '8px 0',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {[
            { key: 'metrics',  icon: <FiActivity size={14}/>,      label: 'Metrics',       accent: '#10b981' },
            { key: 'backups',  icon: <FiDatabase size={14}/>,      label: 'DB Vault',      accent: '#6366f1', suffix: '🔒' },
            { key: 'settings', icon: <FiSettings size={14}/>,      label: 'Settings',      accent: '#a855f7' },
            { key: 'bugs',     icon: <FiInbox size={14}/>,         label: 'User Bugs',     accent: '#ec4899', count: bugs.length },
            { key: 'email',    icon: <FiMail size={14}/>,          label: 'Email Hub',     accent: '#0ea5e9', onClick: fetchEmailLogs },
            { key: 'subjects', icon: <FiLayers size={14}/>,        label: 'Subjects',      accent: '#f59e0b' },
            { key: 'reports',  icon: <FiAlertTriangle size={14}/>, label: 'Reports',       accent: '#ef4444', count: reports.length },
            { key: 'overview', icon: <FiGrid size={14}/>,          label: 'Overview',      accent: '#38bdf8' },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); tab.onClick && tab.onClick(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px',
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.18s ease',
                  position: 'relative',
                  background: isActive
                    ? `linear-gradient(135deg, ${tab.accent}22, ${tab.accent}15)`
                    : 'transparent',
                  color: isActive ? tab.accent : '#64748b',
                  boxShadow: isActive ? `inset 0 0 0 1px ${tab.accent}40` : 'none',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#cbd5e1'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; } }}
              >
                <span style={{ opacity: isActive ? 1 : 0.7 }}>{tab.icon}</span>
                {tab.label}
                {tab.suffix && <span style={{ fontSize: '11px', marginLeft: '2px' }}>{tab.suffix}</span>}
                {tab.count > 0 && (
                  <span style={{
                    background: tab.accent, color: '#fff',
                    borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800,
                    padding: '1px 6px', marginLeft: '2px', lineHeight: '1.6',
                    minWidth: '18px', textAlign: 'center'
                  }}>
                    {tab.count}
                  </span>
                )}
                {/* Active underline indicator */}
                {isActive && (
                  <span style={{
                    position: 'absolute', bottom: '-8px', left: '50%',
                    transform: 'translateX(-50%)',
                    width: '60%', height: '2px',
                    background: tab.accent,
                    borderRadius: '2px 2px 0 0',
                    boxShadow: `0 0 8px ${tab.accent}`
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Page Content with proper padding */}
      <div style={{ padding: '28px 32px', maxWidth: '1200px', margin: '0 auto' }}>






      {/* EMAIL BROADCAST HUB TAB */}
      {activeTab === 'email' && (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          
          {/* Header Card */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px 28px',
            marginBottom: '28px',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
              <FiMail style={{ color: '#0ea5e9' }} /> Targeted Email Broadcast Engine
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Dispatch announcements, study tips, or promo updates to specific aspirant segments asynchronously in the background.
            </p>
          </div>

          {/* Form + Preset Templates Split Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '28px', marginBottom: '32px' }}>
            
            {/* Left: Broadcast Composer Form */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '24px',
              backdropFilter: 'blur(10px)'
            }}>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '20px', fontWeight: 700 }}>
                ✍️ Compose Broadcast Message
              </h3>

              <form onSubmit={handleSendBroadcast}>
                
                {/* Target Audience Segment */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Target Audience Segment
                  </label>
                  <select 
                    value={emailSegment}
                    onChange={e => setEmailSegment(e.target.value)}
                    style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                  >
                    <option value="ALL">👥 All Registered Aspirants</option>
                    <option value="FREE">🆓 Free Tier Users Only (Upgrade Nudge)</option>
                    <option value="PREMIUM">⭐ Aspirant Pro Members Only (Exclusive Updates)</option>
                    <option value="SINGLE">🎯 Specific Single User Email</option>
                  </select>
                </div>

                {emailSegment === 'SINGLE' && (
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Recipient Email Address
                    </label>
                    <input 
                      type="email"
                      placeholder="student@example.com"
                      value={customSingleEmail}
                      onChange={e => setCustomSingleEmail(e.target.value)}
                      style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                      required
                    />
                  </div>
                )}

                {/* Email Subject Line */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Email Subject Line
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. 🚨 New GATE CSE Mock Test Released for Operating Systems!"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                    required
                  />
                </div>

                {/* Email Body HTML */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Email Content (Supports Standard HTML & Paragraphs)
                  </label>
                  <textarea 
                    rows={8}
                    placeholder="Enter your message paragraphs here..."
                    value={emailBodyHtml}
                    onChange={e => setEmailBodyHtml(e.target.value)}
                    style={{ width: '100%', padding: '14px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', lineHeight: '1.6' }}
                    required
                  />
                </div>

                {emailMsg && (
                  <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981', fontSize: '0.85rem', marginBottom: '20px', fontWeight: 600 }}>
                    {emailMsg}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={emailLoading || !emailSubject.trim() || !emailBodyHtml.trim()}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <FiSend /> {emailLoading ? 'Dispatching Broadcast...' : 'Dispatch Email Broadcast'}
                </button>
              </form>
            </div>

            {/* Right: Quick Template Selector Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px',
                backdropFilter: 'blur(10px)'
              }}>
                <h3 style={{ fontSize: '1rem', color: '#fff', marginTop: 0, marginBottom: '16px', fontWeight: 700 }}>
                  ⚡ Quick Template Presets
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    type="button"
                    onClick={() => {
                      setEmailSubject('🎯 New Full-Length GATE CSE Mock Test is Live!');
                      setEmailBodyHtml('<p>We have released a brand new Smart Hybrid Mock Test containing 70% fresh double-verified questions + 30% high-yield GATE PYQs.</p><p>Practice under exact GATE interface conditions now!</p>');
                    }}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                  >
                    🚀 Preset: New Mock Release
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      setEmailSubject('✨ Unlock Unlimited AI Tutor & Full Proofs with Aspirant Pro');
                      setEmailBodyHtml('<p>Stuck on complex GATE CS proofs? Upgrade to <strong>Aspirant Pro</strong> to get 50 daily AI Tutor queries and step-by-step math breakdowns.</p>');
                    }}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                  >
                    ⭐ Preset: Pro Membership Offer
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      setEmailSubject('📢 Important System Maintenance Notice');
                      setEmailBodyHtml('<p>AIRGATE platform will undergo a quick 15-minute maintenance update tonight at 2:00 AM IST. All mock history will remain secure.</p>');
                    }}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                  >
                    📢 Preset: System Announcement
                  </button>
                </div>
              </div>

              <div style={{ padding: '18px', borderRadius: '14px', backgroundColor: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.2)', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>
                💡 <strong>Deliverability Tip:</strong> Bulk broadcast emails run in background threads with 100ms throttle between dispatches to maintain 100% inbox delivery rate.
              </div>
            </div>
          </div>

          {/* Email Audit Log History Table */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: 0, marginBottom: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📜 Sent Email Logs (Top 50 Recent)</span>
              <button onClick={fetchEmailLogs} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: '0.78rem' }}><FiRefreshCw /> Refresh Logs</button>
            </h3>

            {emailLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No email dispatch logs recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Recipient</th>
                      <th style={{ padding: '10px' }}>Subject</th>
                      <th style={{ padding: '10px' }}>Type</th>
                      <th style={{ padding: '10px' }}>Status</th>
                      <th style={{ padding: '10px' }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{log.recipientEmail}</td>
                        <td style={{ padding: '10px' }}>{log.subject}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}>
                            {log.emailType}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: log.status === 'SENT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: log.status === 'SENT' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(log.sentAt).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Cards Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
            
            {/* Approved Stats Card */}
            <div style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '16px', 
              padding: '24px', 
              boxShadow: 'var(--shadow-neon)',
              backdropFilter: 'blur(10px)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--color-primary)', opacity: 0.15 }}>
                <FiActivity size={48} />
              </div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', marginBottom: '8px' }}>
                Approved PYQ Questions
              </h3>
              <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-title)' }}>
                {statsLoading ? '...' : stats.totalApproved}
              </p>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Live official PYQs in database
              </div>
            </div>

            {/* Pending Stats Card */}
            <div style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '16px', 
              padding: '24px', 
              boxShadow: 'var(--shadow-cyan)',
              backdropFilter: 'blur(10px)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--color-secondary)', opacity: 0.15 }}>
                <FiFileText size={48} />
              </div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', marginBottom: '8px' }}>
                Pending Review PYQs
              </h3>
              <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-secondary)', fontFamily: 'var(--font-title)' }}>
                {statsLoading ? '...' : stats.totalPending}
              </p>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Awaiting administrator evaluation
              </div>
            </div>

            {/* Total Questions Card */}
            <div style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '16px', 
              padding: '24px', 
              boxShadow: 'var(--shadow-sm)',
              backdropFilter: 'blur(10px)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--text-primary)', opacity: 0.15 }}>
                <FiLayers size={48} />
              </div>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', marginBottom: '8px' }}>
                Total Official PYQs
              </h3>
              <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}>
                {statsLoading ? '...' : stats.totalQuestions}
              </p>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                PDF Ingestion dataset size (Excludes AI generated Qs)
              </div>
            </div>

          </div>

          {/* Quick Actions Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>

            {/* Manage Users Card - Links to separate page */}
            <div 
              onClick={() => navigate('/admin/users')}
              style={{ 
                background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(56,189,248,0.08))', 
                border: '1px solid rgba(168,85,247,0.2)', 
                borderRadius: '16px', padding: '28px', cursor: 'pointer',
                transition: 'all 0.3s', boxShadow: 'var(--shadow-sm)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#a855f7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(168,85,247,0.2)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <FiUsers size={22} style={{ color: '#a855f7' }} />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>User Management</h3>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                    View all users, toggle premium, ban/unban, delete accounts
                  </p>
                </div>
                <FiArrowRight size={20} style={{ color: '#a855f7' }} />
              </div>
            </div>

            {/* Review Queue Card */}
            <div 
              onClick={() => navigate('/admin/review-queue')}
              style={{ 
                background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(16,185,129,0.08))', 
                border: '1px solid rgba(245,158,11,0.2)', 
                borderRadius: '16px', padding: '28px', cursor: 'pointer',
                transition: 'all 0.3s', boxShadow: 'var(--shadow-sm)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#f59e0b'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <FiFileText size={22} style={{ color: '#f59e0b' }} />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Review Queue</h3>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                    {stats.totalPending} questions awaiting your approval
                  </p>
                </div>
                <FiArrowRight size={20} style={{ color: '#f59e0b' }} />
              </div>
            </div>

            {/* Upload PDFs Card */}
            <div 
              onClick={() => navigate('/uploads')}
              style={{ 
                background: 'linear-gradient(135deg, rgba(56,189,248,0.08), rgba(16,185,129,0.08))', 
                border: '1px solid rgba(56,189,248,0.2)', 
                borderRadius: '16px', padding: '28px', cursor: 'pointer',
                transition: 'all 0.3s', boxShadow: 'var(--shadow-sm)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#38bdf8'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.2)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <FiLayers size={22} style={{ color: '#38bdf8' }} />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Upload PDFs</h3>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
                    Bulk import question papers via AI-powered parsing
                  </p>
                </div>
                <FiArrowRight size={20} style={{ color: '#38bdf8' }} />
              </div>
            </div>

          </div>

          {/* Analytics Graphs Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
            
            {/* Question Distribution Donut Chart */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📊 Question Distribution
              </h3>
              {(() => {
                const approved = stats.totalApproved || 0;
                const pending = stats.totalPending || 0;
                const rejected = Math.max(0, (stats.totalQuestions || 0) - approved - pending);
                const total = stats.totalQuestions || 1;
                const approvedPct = (approved / total) * 100;
                const pendingPct = (pending / total) * 100;
                const rejectedPct = (rejected / total) * 100;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div style={{ position: 'relative', width: '140px', height: '140px', flexShrink: 0 }}>
                      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#10b981" strokeWidth="3"
                          strokeDasharray={`${approvedPct} ${100 - approvedPct}`} strokeDashoffset="0" strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f59e0b" strokeWidth="3"
                          strokeDasharray={`${pendingPct} ${100 - pendingPct}`} strokeDashoffset={`${-approvedPct}`} strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#ef4444" strokeWidth="3"
                          strokeDasharray={`${rejectedPct} ${100 - rejectedPct}`} strokeDashoffset={`${-(approvedPct + pendingPct)}`} strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{total}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Approved: <strong style={{ color: '#10b981' }}>{approved}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f59e0b', display: 'inline-block' }}></span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Pending: <strong style={{ color: '#f59e0b' }}>{pending}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Rejected: <strong style={{ color: '#ef4444' }}>{rejected}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Approval Rate Gauge */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✅ Approval Rate
              </h3>
              {(() => {
                const rate = stats.totalQuestions > 0 ? Math.round((stats.totalApproved / stats.totalQuestions) * 100) : 0;
                return (
                  <div>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <span style={{ fontSize: '3.5rem', fontWeight: 800, color: rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444', fontFamily: 'var(--font-title)' }}>
                        {rate}%
                      </span>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {rate >= 70 ? 'Excellent quality pipeline' : rate >= 40 ? 'Review queue needs attention' : 'Most questions need review'}
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '12px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${rate}%`, height: '100%', borderRadius: '6px', background: rate >= 70 ? 'linear-gradient(90deg, #10b981, #34d399)' : rate >= 40 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)', transition: 'width 0.8s ease' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      <span>0%</span><span>50%</span><span>100%</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* SUBJECTS & TOPICS TAB */}
      {activeTab === 'subjects' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '32px' }}>
          
          {/* Subject Form Card */}
          <div style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '32px',
            boxShadow: 'var(--shadow-sm)',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiFolderPlus style={{ color: 'var(--color-primary)' }} /> Create New Subject
            </h2>
            
            <form onSubmit={handleCreateSubject}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Subject Name
                </label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. Computer Networks, Compiler Design"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    backgroundColor: 'var(--bg-main)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                  required 
                />
              </div>

              {subjectSuccess && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid var(--color-success)' }}>
                  {subjectSuccess}
                </div>
              )}

              {subjectError && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid var(--color-error)' }}>
                  {subjectError}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={subjectLoading}
                style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                {subjectLoading ? 'Creating...' : <>Create Subject</>}
              </button>
            </form>
          </div>

          {/* Topic Form Card */}
          <div style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '32px',
            boxShadow: 'var(--shadow-sm)',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiPlusCircle style={{ color: 'var(--color-secondary)' }} /> Create New Topic
            </h2>
            
            <form onSubmit={handleCreateTopic}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Select Parent Subject
                </label>
                <select 
                  className="form-control"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    backgroundColor: 'var(--bg-main)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                  required
                >
                  <option value="">-- Choose Subject --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Parent Topic (Optional - Leave empty to create a Root Topic)
                </label>
                <select 
                  className="form-control"
                  value={parentTopicId}
                  onChange={(e) => setParentTopicId(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    backgroundColor: 'var(--bg-main)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                  disabled={!selectedSubjectId}
                >
                  <option value="">-- None (Root Topic) --</option>
                  {flatTopics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Topic / Subtopic Name
                </label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. IP Addressing, Subnetting, B-Trees"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    backgroundColor: 'var(--bg-main)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                  disabled={!selectedSubjectId}
                  required 
                />
              </div>

              {topicSuccess && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid var(--color-success)' }}>
                  {topicSuccess}
                </div>
              )}

              {topicError && (
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', fontSize: '0.85rem', marginBottom: '20px', border: '1px solid var(--color-error)' }}>
                  {topicError}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={topicLoading || !selectedSubjectId}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  display: 'flex', 
                  justify: 'center', 
                  alignItems: 'center', 
                  gap: '8px',
                  backgroundColor: 'var(--color-secondary)',
                  borderColor: 'var(--color-secondary)'
                }}
              >
                {topicLoading ? 'Creating...' : <>Create Topic</>}
              </button>
            </form>
          </div>

        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '16px', 
          padding: '32px',
          boxShadow: 'var(--shadow-sm)',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiAlertTriangle style={{ color: 'var(--color-error)' }} /> Question Error Reports
          </h2>

          {reportsLoading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading active reports...</div>
          ) : reports.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', padding: '16px 0' }}>
              No active error reports. The question pool is verified and clean!
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 8px' }}>Subject</th>
                    <th style={{ padding: '12px 8px' }}>Question Preview</th>
                    <th style={{ padding: '12px 8px' }}>Reporter</th>
                    <th style={{ padding: '12px 8px' }}>Reason</th>
                    <th style={{ padding: '12px 8px' }}>Detail Description</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'top' }}>
                      <td style={{ padding: '16px 8px', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {report.subjectName}
                      </td>
                      <td style={{ padding: '16px 8px', maxWidth: '300px' }}>
                        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginBottom: '6px' }}>
                          {report.questionText}
                        </div>
                        <a 
                          href={`/questions/${report.questionId}`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ color: 'var(--color-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          Inspect Question <FiExternalLink size={12} />
                        </a>
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-primary)' }}>
                        @{report.reportedBy}
                      </td>
                      <td style={{ padding: '16px 8px' }}>
                        <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {report.reason}
                        </span>
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-secondary)', maxWidth: '250px', wordBreak: 'break-word' }}>
                        {report.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None provided</span>}
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                        <button 
                          className="btn btn-outline"
                          onClick={() => handleResolveReport(report.id)}
                          style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'var(--color-success)', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FiCheck size={14} /> Resolve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* METRICS & PIPELINE TAB */}
      {activeTab === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Business & Activity Metrics (Only visible to ADMIN) */}
          {AuthService.getCurrentUser()?.role === 'ADMIN' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.4rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontWeight: 800 }}>
                  📊 Business & Usage Dashboard
                </h2>
                {metricsLoading && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Refreshing metrics...</span>
                )}
              </div>

              {/* Metrics Row 1: Users & Active */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Users</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-title)' }}>{adminMetrics.totalUsers.toLocaleString()}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>+{adminMetrics.newSignupsToday} registered today</span>
                </div>

                <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Active Users (DAU)</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-secondary)', fontFamily: 'var(--font-title)' }}>{adminMetrics.dau.toLocaleString()}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Users active today</span>
                </div>

                <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Active Users (MAU)</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-title)' }}>{adminMetrics.mau.toLocaleString()}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Last 30 days active</span>
                </div>

                <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Retention Index</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'var(--font-title)' }}>{adminMetrics.retentionIndex.toFixed(1)}%</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>DAU / MAU ratio</span>
                </div>
              </div>

              {/* Metrics Row 2: Solves, AI and Business */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue (Total)</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'var(--font-title)' }}>₹{adminMetrics.totalRevenue.toLocaleString()}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>+₹{adminMetrics.revenueToday} collected today</span>
                </div>

                <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Questions Solved Today</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-title)' }}>{adminMetrics.questionsSolvedToday.toLocaleString()}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Total solving attempts today</span>
                </div>

                <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Requests Today</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ec4899', fontFamily: 'var(--font-title)' }}>{adminMetrics.aiRequestsToday.toLocaleString()}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Tutor queries processed</span>
                </div>

                <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mock Exams Attempted</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#06b6d4', fontFamily: 'var(--font-title)' }}>{adminMetrics.mockTestsAttempted.toLocaleString()}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Dynamic mock generator runs</span>
                </div>

                <div style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revision PDFs Generated 📄</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#8b5cf6', fontFamily: 'var(--font-title)' }}>{(adminMetrics.pdfCompilationsTotal || 0).toLocaleString()}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Pro PDF downloads count</span>
                </div>
              </div>

              {/* Visual Graphs / Chart trends (Last 7 days) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
                
                {/* Interactive Chart 1: Daily User Signups & Revenue */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
                    📈 Daily Signups & Revenue (Last 7 Days)
                  </h3>

                  <div style={{ height: '260px', width: '100%' }}>
                    {adminMetrics.dailyTrends && adminMetrics.dailyTrends.length > 0 ? (
                      <Line 
                        data={{
                          labels: adminMetrics.dailyTrends.map(t => t.date.split('-').slice(1).reverse().join('/')),
                          datasets: [
                            {
                              label: 'New Signups',
                              data: adminMetrics.dailyTrends.map(t => t.signups),
                              borderColor: '#8b5cf6',
                              backgroundColor: 'rgba(139, 92, 246, 0.15)',
                              fill: true,
                              tension: 0.4,
                              pointRadius: 5,
                              pointHoverRadius: 7,
                              yAxisID: 'y'
                            },
                            {
                              label: 'Revenue (INR ₹)',
                              data: adminMetrics.dailyTrends.map(t => t.revenue),
                              borderColor: '#10b981',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              fill: true,
                              tension: 0.4,
                              pointRadius: 5,
                              pointHoverRadius: 7,
                              yAxisID: 'y1'
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          interaction: { mode: 'index', intersect: false },
                          plugins: {
                            legend: { labels: { color: '#e2e8f0', font: { size: 12 } } },
                            tooltip: {
                              backgroundColor: 'rgba(15, 23, 42, 0.9)',
                              titleColor: '#fff',
                              bodyColor: '#cbd5e1',
                              borderColor: 'rgba(255,255,255,0.1)',
                              borderWidth: 1
                            }
                          },
                          scales: {
                            x: {
                              grid: { color: 'rgba(255,255,255,0.05)' },
                              ticks: { color: '#94a3b8', font: { size: 11 } }
                            },
                            y: {
                              type: 'linear',
                              display: true,
                              position: 'left',
                              title: { display: true, text: 'Signups', color: '#8b5cf6' },
                              grid: { color: 'rgba(255,255,255,0.05)' },
                              ticks: { color: '#94a3b8', precision: 0 }
                            },
                            y1: {
                              type: 'linear',
                              display: true,
                              position: 'right',
                              title: { display: true, text: 'Revenue (₹)', color: '#10b981' },
                              grid: { drawOnChartArea: false },
                              ticks: { color: '#94a3b8' }
                            }
                          }
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        No trend data available
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Chart 2: AI Token Usage & Cost */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 0 }}>
                    <span>⚡ Groq AI Cost & Token Activity ($)</span>
                    <span style={{ color: '#ec4899', fontSize: '0.85rem', fontWeight: 'bold' }}>Total 7-Day: ${adminMetrics.aiCost7Days?.toFixed(4)}</span>
                  </h3>

                  <div style={{ height: '260px', width: '100%' }}>
                    {adminMetrics.dailyAiCosts && adminMetrics.dailyAiCosts.length > 0 ? (
                      <Bar 
                        data={{
                          labels: adminMetrics.dailyAiCosts.map(d => d.date.split('-').slice(1).reverse().join('/')),
                          datasets: [
                            {
                              label: 'AI Cost ($ USD)',
                              data: adminMetrics.dailyAiCosts.map(d => d.cost),
                              backgroundColor: 'rgba(236, 72, 153, 0.85)',
                              borderColor: '#ec4899',
                              borderWidth: 1,
                              borderRadius: 6
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { labels: { color: '#e2e8f0', font: { size: 12 } } },
                            tooltip: {
                              callbacks: {
                                label: (context) => `Cost: $${context.raw.toFixed(5)}`
                              }
                            }
                          },
                          scales: {
                            x: {
                              grid: { color: 'rgba(255,255,255,0.05)' },
                              ticks: { color: '#94a3b8', font: { size: 11 } }
                            },
                            y: {
                              grid: { color: 'rgba(255,255,255,0.05)' },
                              ticks: { 
                                color: '#94a3b8',
                                callback: (value) => `$${value}`
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        No AI cost data available
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Popular Topics & Subject rankings */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '16px', marginTop: 0 }}>
                  🔥 Top Topics & Subjects
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: '#fbbf24', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Most Asked AI</h4>
                    {adminMetrics.mostAskedTopics && adminMetrics.mostAskedTopics.length > 0 ? (
                      <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        {adminMetrics.mostAskedTopics.map((t, idx) => (
                          <li key={idx}><strong>{t.topic}</strong> ({t.count})</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No topics requested yet.</span>
                    )}
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: '#10b981', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Popular Subjects</h4>
                    {adminMetrics.popularSubjects && adminMetrics.popularSubjects.length > 0 ? (
                      <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        {adminMetrics.popularSubjects.map((s, idx) => (
                          <li key={idx}><strong>{s.subject}</strong> ({s.count})</li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No questions solved yet.</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Groq Token Usage Section */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.4rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <FiActivity style={{ color: 'var(--color-primary)' }} />
                Groq API Token Monitor
              </h2>
              {groqUsage.usedTokens > groqUsage.limit * 0.8 ? (
                <span style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-error)', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                  ⚠️ Warning: High Usage
                </span>
              ) : (
                <span style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--color-success)', border: '1px solid rgba(16,185,129,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                  ✅ Safe Tier Limit
                </span>
              )}
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Tracks monthly token consumption for PDF parsing and full explanation completions. Resets automatically on the first day of each month.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '24px', alignItems: 'center' }}>
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                    <span>Monthly Token Consumption</span>
                    <span>{groqUsageLoading ? '...' : groqUsage.usedTokens.toLocaleString()} / {groqUsageLoading ? '...' : groqUsage.limit.toLocaleString()} ({groqUsage.limit > 0 ? Math.round((groqUsage.usedTokens / groqUsage.limit) * 100) : 0}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${groqUsage.limit > 0 ? Math.min(100, Math.round((groqUsage.usedTokens / groqUsage.limit) * 100)) : 0}%`,
                      height: '100%',
                      backgroundColor: groqUsage.usedTokens > groqUsage.limit * 0.8 ? 'var(--color-error)' : 'var(--color-primary)',
                      borderRadius: '5px',
                      transition: 'width 0.5s ease-in-out'
                    }}></div>
                  </div>
                </div>
                
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong>💡 Pro-tip:</strong> Swapping to smaller models like <code>llama-3.3-70b-versatile</code> for first-pass classification reduces token consumption by up to 50% compared to heavy vision models.
                </div>
              </div>

              {/* Doughnut Gauge */}
              <div style={{ height: '150px', position: 'relative' }}>
                <Doughnut 
                  data={{
                    labels: ['Used Tokens', 'Remaining Quota'],
                    datasets: [
                      {
                        data: [groqUsage.usedTokens || 0, Math.max(0, (groqUsage.limit || 10000000) - (groqUsage.usedTokens || 0))],
                        backgroundColor: ['#8b5cf6', 'rgba(255,255,255,0.06)'],
                        borderColor: ['#7c3aed', 'rgba(255,255,255,0.1)'],
                        borderWidth: 1
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '72%',
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${ctx.label}: ${ctx.raw.toLocaleString()} tokens`
                        }
                      }
                    }
                  }}
                />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                    {groqUsage.limit > 0 ? Math.round((groqUsage.usedTokens / groqUsage.limit) * 100) : 0}%
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Used</div>
                </div>
              </div>
            </div>
          </div>

          {/* Background Processing Progress Bar Dashboard */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.4rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <FiActivity style={{ color: bgStats.pendingSolutions > 0 ? 'var(--color-success)' : 'var(--text-muted)' }} /> 
                AI Solution Pipeline Monitor
              </h2>
              <span className={`badge ${bgStats.pendingSolutions > 0 ? 'badge-success' : 'badge-dark'}`} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                {bgStats.pendingSolutions > 0 ? '⚡ Processing Queue' : '💤 Idle / Completed'}
              </span>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Real-time tracking of the background worker generating detailed math and concept proofs (rate-limited at 1 question/30 seconds to preserve Groq API limits).
            </p>

            {/* Progress Bar */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                <span>Comprehensive Solutions Progress</span>
                <span>{bgStats.completedSolutions} / {bgStats.totalSolutions} ({bgStats.totalSolutions > 0 ? Math.round((bgStats.completedSolutions / bgStats.totalSolutions) * 100) : 0}%)</span>
              </div>
              <div style={{ width: '100%', height: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{
                  width: `${bgStats.totalSolutions > 0 ? Math.round((bgStats.completedSolutions / bgStats.totalSolutions) * 100) : 0}%`,
                  height: '100%',
                  backgroundColor: 'var(--color-success)',
                  borderRadius: '5px',
                  transition: 'width 0.5s ease-in-out'
                }}></div>
              </div>
            </div>

            {/* Sub metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Queued (Pending solution)</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: bgStats.pendingSolutions > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>{bgStats.pendingSolutions} Qs</span>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Fallback (Manual check needed)</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: bgStats.fallbackSolutions > 0 ? 'var(--color-error)' : 'var(--text-primary)' }}>{bgStats.fallbackSolutions} Qs</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header Bar */}
          <div style={{ 
            display: 'flex', 
            justify: 'space-between', 
            alignItems: 'center', 
            marginBottom: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '20px 28px',
            backdropFilter: 'blur(10px)'
          }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
                <FiSettings style={{ color: '#a855f7' }} /> Customizable System Settings
              </h2>
              <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Configure multi-tier subscription pricing, AI daily usage quotas, and emergency system toggles.
              </p>
            </div>
            {settingsSuccess && (
              <div style={{ 
                padding: '8px 16px', 
                borderRadius: '8px', 
                backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                color: 'var(--color-success)', 
                fontSize: '0.85rem', 
                border: '1px solid var(--color-success)',
                fontWeight: 600
              }}>
                ✓ {settingsSuccess}
              </div>
            )}
          </div>

          <form onSubmit={handleUpdateSettings}>
            {/* SECTION 1: Horizontal 3-Column Pricing Tiers Grid */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '24px 28px',
              marginBottom: '24px',
              backdropFilter: 'blur(10px)'
            }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                💎 Premium Pricing Packages (3 Tier Horizontal Layout)
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {/* Tier 1 Box */}
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: 'var(--color-primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    📦 Tier 1: Monthly Plan
                  </h4>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Price (INR)</label>
                    <input 
                      type="number"
                      value={settings.tier1PriceInr || 0}
                      onChange={e => setSettings(prev => ({ ...prev, tier1PriceInr: parseFloat(e.target.value) || 0 }))}
                      style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Duration (Months)</label>
                    <input 
                      type="number"
                      value={settings.tier1DurationMonths || 1}
                      onChange={e => setSettings(prev => ({ ...prev, tier1DurationMonths: parseInt(e.target.value) || 1 }))}
                      style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Badge / Offer Text</label>
                    <input 
                      type="text"
                      value={settings.tier1SpecialOffer || ''}
                      onChange={e => setSettings(prev => ({ ...prev, tier1SpecialOffer: e.target.value }))}
                      placeholder="e.g. Starter Pack"
                      style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                {/* Tier 2 Box */}
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: 'var(--color-secondary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    📦 Tier 2: Quarterly Plan
                  </h4>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Price (INR)</label>
                    <input 
                      type="number"
                      value={settings.tier2PriceInr || 0}
                      onChange={e => setSettings(prev => ({ ...prev, tier2PriceInr: parseFloat(e.target.value) || 0 }))}
                      style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Duration (Months)</label>
                    <input 
                      type="number"
                      value={settings.tier2DurationMonths || 3}
                      onChange={e => setSettings(prev => ({ ...prev, tier2DurationMonths: parseInt(e.target.value) || 3 }))}
                      style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Badge / Offer Text</label>
                    <input 
                      type="text"
                      value={settings.tier2SpecialOffer || ''}
                      onChange={e => setSettings(prev => ({ ...prev, tier2SpecialOffer: e.target.value }))}
                      placeholder="e.g. Save 15%"
                      style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>

                {/* Tier 3 Box */}
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: 'var(--color-success)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    📦 Tier 3: Half-Yearly Plan
                  </h4>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Price (INR)</label>
                    <input 
                      type="number"
                      value={settings.tier3PriceInr || 0}
                      onChange={e => setSettings(prev => ({ ...prev, tier3PriceInr: parseFloat(e.target.value) || 0 }))}
                      style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Duration (Months)</label>
                    <input 
                      type="number"
                      value={settings.tier3DurationMonths || 6}
                      onChange={e => setSettings(prev => ({ ...prev, tier3DurationMonths: parseInt(e.target.value) || 6 }))}
                      style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Badge / Offer Text</label>
                    <input 
                      type="text"
                      value={settings.tier3SpecialOffer || ''}
                      onChange={e => setSettings(prev => ({ ...prev, tier3SpecialOffer: e.target.value }))}
                      placeholder="e.g. Best Value 25% Off"
                      style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Horizontal 2-Column Grid (System Limits + Emergency Maintenance) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              {/* Quotas Box */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px 28px',
                backdropFilter: 'blur(10px)'
              }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: 0, marginBottom: '16px', fontWeight: 700 }}>
                  🤖 AI Limits & Quotas
                </h3>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                  AI Tutor Daily Request Limit (Per Premium User)
                </label>
                <input 
                  type="number"
                  value={settings.aiDailyLimitPremium}
                  onChange={e => setSettings(prev => ({ ...prev, aiDailyLimitPremium: parseInt(e.target.value) || 50 }))}
                  style={{ 
                    width: '100%', padding: '12px', 
                    backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', 
                    borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.95rem'
                  }}
                  min="1"
                  required
                />
              </div>

              {/* Maintenance Control Box */}
              <div style={{ 
                border: '1px solid rgba(239, 68, 68, 0.3)', 
                borderRadius: '16px', padding: '24px 28px', backgroundColor: 'rgba(239, 68, 68, 0.03)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700 }}>
                    <FiAlertOctagon /> Emergency Maintenance
                  </h3>
                  <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: '1.4' }}>
                    Enabling maintenance mode locks student access immediately while retaining full access for Admins and Editors.
                  </p>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const newMode = !settings.isMaintenanceMode;
                        const confirmMsg = settings.isMaintenanceMode 
                          ? "Disable Maintenance Mode and bring the platform live?"
                          : "Warning: Enable Maintenance Mode? Regular users will be blocked immediately!";
                        if (window.confirm(confirmMsg)) {
                          const updatedSettings = { ...settings, isMaintenanceMode: newMode };
                          setSettings(updatedSettings);
                          try {
                            setSettingsLoading(true);
                            setSettingsSuccess('');
                            const response = await axios.put(`${API_CONFIG.BASE_URL}/api/admin/settings`, updatedSettings, {
                              headers: AuthService.getAuthHeader()
                            });
                            setSettings(response.data);
                            setSettingsSuccess(newMode ? 'Maintenance Mode Enabled!' : 'Maintenance Mode Disabled!');
                          } catch (err) {
                            alert("Failed to update maintenance settings: " + (err.response?.data?.message || err.message));
                          } finally {
                            setSettingsLoading(false);
                          }
                        }
                      }}
                      style={{
                        padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
                        backgroundColor: settings.isMaintenanceMode ? '#10b981' : '#ef4444',
                        border: 'none', color: '#fff', fontSize: '0.85rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {settings.isMaintenanceMode ? "✓ Disable Maintenance" : "⚠️ Enable Maintenance"}
                    </button>
                  </div>
                </div>
              </div>

            {/* SECTION 3: Dynamic SEO & Search Engine Optimization Card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '24px 28px',
              marginBottom: '24px',
              backdropFilter: 'blur(10px)'
            }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                🔍 Dynamic SEO & Google Search Console Settings
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Global Website Title (Meta Title)
                  </label>
                  <input 
                    type="text"
                    value={settings.seoSiteTitle || ''}
                    onChange={e => setSettings(prev => ({ ...prev, seoSiteTitle: e.target.value }))}
                    placeholder="e.g. AIRGATE – Gateway to All India Rank | GATE PYQs & AI Tutor"
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                    Google Search Console Verification Token
                  </label>
                  <input 
                    type="text"
                    value={settings.googleSiteVerification || ''}
                    onChange={e => setSettings(prev => ({ ...prev, googleSiteVerification: e.target.value }))}
                    placeholder="e.g. google-site-verification=abc123xyz"
                    style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                    Umami Analytics Website ID
                  </label>
                  <input 
                    type="text"
                    value={settings.umamiWebsiteId || ''}
                    onChange={e => setSettings(prev => ({ ...prev, umamiWebsiteId: e.target.value }))}
                    placeholder="e.g. 9b8c7d6e-5f4a-3b2c-1d0e-9f8e7d6c5b4a"
                    style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px', marginTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Search Engine Meta Description (Shown in Google Search Results)
                </label>
                <textarea 
                  rows={2}
                  value={settings.seoMetaDescription || ''}
                  onChange={e => setSettings(prev => ({ ...prev, seoMetaDescription: e.target.value }))}
                  placeholder="Summarize your website in 140-160 characters for Google snippet previews..."
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>

            {/* SECTION 4: Customer Support & Contact Info Control Card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '24px 28px',
              marginBottom: '24px',
              backdropFilter: 'blur(10px)'
            }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                📬 Customer Support & Help Desk Contact Info
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Support Email Address (Shown in Contact Us Modal)
                  </label>
                  <input 
                    type="email"
                    value={settings.supportEmail || ''}
                    onChange={e => setSettings(prev => ({ ...prev, supportEmail: e.target.value }))}
                    placeholder="e.g. support@airgate.in"
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Help Line / Phone Number (Shown in Contact Us Modal)
                  </label>
                  <input 
                    type="text"
                    value={settings.supportPhone || ''}
                    onChange={e => setSettings(prev => ({ ...prev, supportPhone: e.target.value }))}
                    placeholder="e.g. +91 (800) AIR-GATE"
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Target Keywords (Comma Separated)
                </label>
                <input 
                  type="text"
                  value={settings.seoKeywords || ''}
                  onChange={e => setSettings(prev => ({ ...prev, seoKeywords: e.target.value }))}
                  placeholder="e.g. GATE 2026, AIRGATE, GATE CS PYQ, Operating Systems GATE, Mock Test"
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                />
              </div>
            </div>


            {/* Submit Action Footer Bar */}
            <div style={{ 
              display: 'flex', justifyContent: 'flex-end', 
              background: 'var(--bg-card)', border: '1px solid var(--border-color)', 
              borderRadius: '16px', padding: '20px 28px', backdropFilter: 'blur(10px)'
            }}>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={settingsLoading}
                style={{ padding: '12px 36px', fontSize: '1rem', fontWeight: 700 }}
              >
                {settingsLoading ? 'Saving Settings...' : 'Save All Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DATABASE VAULT (PIN PROTECTED BACKUPS TAB) */}
      {activeTab === 'backups' && (
        <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
          {!isBackupUnlocked ? (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '20px',
              padding: '40px 32px',
              textAlign: 'center',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <FiLock size={32} style={{ color: '#3b82f6' }} />
              </div>
              <h2 style={{ fontSize: '1.6rem', color: '#fff', margin: '0 0 8px 0', fontWeight: 800 }}>
                Encrypted Database Vault 🔒
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 28px auto' }}>
                Access to database snapshots, instant manual backup triggers, and SQL downloads requires the Master Admin Security PIN.
              </p>

              <form onSubmit={(e) => { e.preventDefault(); handleUnlockBackupVault(); }} style={{ maxWidth: '360px', margin: '0 auto' }}>
                <div style={{ marginBottom: '16px' }}>
                  <input 
                    type="password"
                    value={backupPinInput}
                    onChange={e => setBackupPinInput(e.target.value)}
                    placeholder="Enter Security PIN (Default: 9988)"
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '1.1rem',
                      textAlign: 'center',
                      letterSpacing: '4px'
                    }}
                    required
                  />
                </div>

                {backupError && (
                  <div style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 600 }}>
                    ⚠️ {backupError}
                  </div>
                )}

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={backupsLoading}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', fontSize: '1rem', fontWeight: 700 }}
                >
                  {backupsLoading ? 'Verifying PIN...' : 'Unlock Database Vault 🔓'}
                </button>
              </form>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
                    <FiDatabase style={{ color: '#3b82f6' }} /> Database Snapshots & Backups
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                    Trigger instant manual MySQL dumps or download existing compressed backup archives.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={handleTriggerBackup} 
                    disabled={backupsLoading}
                    className="btn btn-success"
                    style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <FiPlusCircle /> {backupsLoading ? 'Creating Backup...' : 'Create Instant Backup'}
                  </button>

                  <button 
                    onClick={() => { setIsBackupUnlocked(false); setUnlockedPin(''); setBackupPinInput(''); }}
                    className="btn btn-outline"
                    style={{ padding: '10px 16px', borderRadius: '10px' }}
                  >
                    Lock Vault 🔒
                  </button>
                </div>
              </div>

              {backupMessage && (
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '14px 18px', borderRadius: '12px', fontSize: '0.9rem', marginBottom: '20px', fontWeight: 600 }}>
                  {backupMessage}
                </div>
              )}

              {backupError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '14px 18px', borderRadius: '12px', fontSize: '0.9rem', marginBottom: '20px', fontWeight: 600 }}>
                  {backupError}
                </div>
              )}

              {backupFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-main)', borderRadius: '14px', border: '1px dashed var(--border-color)' }}>
                  No backup archives found in local storage. Click <strong>"Create Instant Backup"</strong> above to generate a snapshot.
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '12px' }}>File Name</th>
                        <th style={{ padding: '12px' }}>Size</th>
                        <th style={{ padding: '12px' }}>Created Date</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backupFiles.map((file, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '14px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{file.filename}</td>
                          <td style={{ padding: '14px 12px', color: 'var(--text-secondary)' }}>{file.sizeMb}</td>
                          <td style={{ padding: '14px 12px', color: 'var(--text-muted)' }}>{file.lastModified}</td>
                          <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                            <button 
                              onClick={() => handleDownloadBackup(file.filename)}
                              className="btn btn-outline"
                              style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <FiDownload /> Download SQL
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* BUG REPORTS TAB */}
      {activeTab === 'bugs' && (
        <div style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '16px', 
          padding: '32px',
          boxShadow: 'var(--shadow-sm)',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiInbox style={{ color: '#ec4899' }} /> Platform Bug Reports
          </h2>

          {bugsLoading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading bug reports...</div>
          ) : bugs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', padding: '16px 0' }}>
              No bug reports. The platform is running perfectly!
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 8px' }}>User</th>
                    <th style={{ padding: '12px 8px' }}>Bug Title</th>
                    <th style={{ padding: '12px 8px' }}>Page URL</th>
                    <th style={{ padding: '12px 8px' }}>Details</th>
                    <th style={{ padding: '12px 8px' }}>Date</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bugs.map((bug) => (
                    <tr key={bug.id} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'top', opacity: bug.status === 'RESOLVED' ? 0.6 : 1 }}>
                      <td style={{ padding: '16px 8px', fontWeight: 600 }}>
                        {bug.reportedBy ? `@${bug.reportedBy}` : 'Anonymous'}
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-primary)', fontWeight: 700 }}>
                        {bug.title}
                      </td>
                      <td style={{ padding: '16px 8px', fontSize: '0.8rem', color: 'var(--color-primary)', wordBreak: 'break-word', maxWidth: '150px' }}>
                        {bug.pageUrl || '—'}
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-secondary)', maxWidth: '250px', wordBreak: 'break-word' }}>
                        {bug.description}
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {new Date(bug.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                        <span style={{ 
                          backgroundColor: bug.status === 'OPEN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                          color: bug.status === 'OPEN' ? '#ef4444' : '#10b981', 
                          border: bug.status === 'OPEN' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 
                        }}>
                          {bug.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                        {bug.status === 'OPEN' ? (
                          <button 
                            className="btn btn-outline"
                            onClick={() => handleResolveBug(bug.id)}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'var(--color-success)', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <FiCheck size={14} /> Resolve
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Resolved ✅</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      </div> {/* end page content wrapper */}
    </div>
  );
}

