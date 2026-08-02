import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { formatMathText } from '../utils/mathRenderer';
import { FiCpu, FiPlay, FiPause, FiRefreshCw, FiExternalLink, FiLayers, FiTrash2, FiEye, FiSearch, FiFilter } from 'react-icons/fi';
import ConfirmModal from '../components/ConfirmModal';

export default function AiGeneratorHub() {
  const navigate = useNavigate();

  const [aiGenStatus, setAiGenStatus] = useState({
    enabled: true,
    running: false,
    startHour: 0,
    endHour: 4,
    totalAccepted: 0,
    totalRejected: 0,
    totalTokensUsed: 0,
    ledger: []
  });
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // Custom ConfirmModal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: () => {}
  });

  // Generated Questions Management state
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  
  // Pagination & Sorting state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState('desc');
  const [subjectsList, setSubjectsList] = useState([]);

  const [startHourInput, setStartHourInput] = useState(0);
  const [endHourInput, setEndHourInput] = useState(4);
  const [timingMsg, setTimingMsg] = useState('');

  // Report History state
  const [reportHistory, setReportHistory] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Ledger History Pagination state
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerTotalElements, setLedgerTotalElements] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerList, setLedgerList] = useState([]);

  const fetchLedgerHistory = async (p = 0) => {
    try {
      setLedgerLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/generator/ledger`, {
        params: { page: p, size: ledgerPageSize },
        headers: AuthService.getAuthHeader()
      });
      if (res.data) {
        setLedgerList(res.data.content || []);
        setLedgerPage(res.data.pageNo || 0);
        setLedgerTotalPages(res.data.totalPages || 1);
        setLedgerTotalElements(res.data.totalElements || 0);
      }
    } catch (err) {
      console.error("Failed to load ledger history", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchReportHistory = async () => {
    try {
      setReportsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/reports/history`, {
        headers: AuthService.getAuthHeader()
      });
      if (Array.isArray(res.data)) {
        setReportHistory(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch report history", err);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchAiGenStatus = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/generator/status`, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data) {
        setAiGenStatus(res.data);
        if (res.data.startHour != null) setStartHourInput(res.data.startHour);
        if (res.data.endHour != null) setEndHourInput(res.data.endHour);
      }
    } catch (err) {
      console.error("Failed to load AI Generator status", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTiming = async (e) => {
    e.preventDefault();
    try {
      setTimingMsg('');
      const res = await axios.put(`${API_CONFIG.BASE_URL}/api/admin/settings`, {
        aiGeneratorStartHour: Number(startHourInput),
        aiGeneratorEndHour: Number(endHourInput)
      }, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data) {
        setTimingMsg('✅ Nightly batch execution window updated successfully!');
        fetchAiGenStatus();
      }
    } catch (err) {
      alert("Failed to update execution timing window.");
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects`);
      if (Array.isArray(res.data)) setSubjectsList(res.data);
    } catch (err) {
      console.error("Failed to load subjects", err);
    }
  };

  const fetchAiGeneratedQuestions = async () => {
    try {
      setQuestionsLoading(true);
      const params = {
        page,
        size: pageSize,
        sortBy,
        sortDir
      };
      if (selectedSubjectFilter !== 'ALL') {
        const sub = subjectsList.find(s => s.name === selectedSubjectFilter);
        if (sub) params.subjectId = sub.id;
      }
      if (searchTerm && searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/generator/questions`, {
        params,
        headers: AuthService.getAuthHeader()
      });
      if (res.data) {
        setQuestions(res.data.content || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalElements(res.data.totalElements || 0);
      }
    } catch (err) {
      console.error("Failed to load AI questions", err);
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  const handleDeleteQuestion = (id, questionTitle) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete AI Question",
      message: `Are you sure you want to delete Question #${id}? This action cannot be undone.`,
      confirmText: "Delete Question",
      type: "danger",
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await axios.delete(`${API_CONFIG.BASE_URL}/api/questions/${id}`, {
            headers: AuthService.getAuthHeader()
          });
          setQuestions(prev => prev.filter(q => q.id !== id));
          setActionMsg(`🗑️ Question #${id} deleted successfully!`);
          fetchAiGenStatus();
        } catch (err) {
          alert("Failed to delete question: " + (err.response?.data?.message || err.message));
        }
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedQuestionIds.length === questions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(questions.map(q => q.id));
    }
  };

  const toggleSelectQuestion = (id) => {
    setSelectedQuestionIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async (type = 'SELECTED') => {
    let confirmTitle = 'Batch Delete Questions';
    let confirmMsg = '';
    let url = `${API_CONFIG.BASE_URL}/api/admin/generator/batch-delete`;

    if (type === 'SELECTED') {
      if (selectedQuestionIds.length === 0) return alert("Please select questions using checkboxes first!");
      confirmMsg = `Are you sure you want to delete ${selectedQuestionIds.length} selected questions?`;
    } else if (type === 'SUBJECT') {
      if (selectedSubjectFilter === 'ALL') return alert("Please select a specific subject filter pill first!");
      const targetSubObj = questions.find(q => (q.subjectName || q.subject?.name) === selectedSubjectFilter);
      const subId = targetSubObj?.subjectId || targetSubObj?.subject?.id;
      if (!subId) return alert("Subject ID not found.");
      confirmMsg = `Are you sure you want to delete ALL AI questions under '${selectedSubjectFilter}'?`;
      url += `?subjectId=${subId}`;
    } else if (type === 'ALL') {
      confirmTitle = '⚠️ DELETE ALL QUESTIONS';
      confirmMsg = `Are you sure you want to DELETE ALL AI GENERATED QUESTIONS across all subjects? This action is permanent!`;
    }

    setConfirmModal({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      confirmText: "Execute Batch Delete",
      type: "danger",
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const config = { headers: AuthService.getAuthHeader() };
          let res;
          if (type === 'SELECTED') {
            res = await axios.delete(url, { ...config, data: selectedQuestionIds });
          } else {
            res = await axios.delete(url, config);
          }

          setActionMsg(`🗑️ ${res.data?.message || "Batch delete successful!"}`);
          setSelectedQuestionIds([]);
          fetchAiGenStatus();
          fetchAiGeneratedQuestions();
        } catch (err) {
          alert("Failed to execute batch delete: " + (err.response?.data?.message || err.message));
        }
      }
    });
  };

  const handleClearLedgerHistory = () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear Ledger History",
      message: "Are you sure you want to reset and clear all AI Generator logging ledger history?",
      confirmText: "Clear Ledger",
      type: "warning",
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await axios.delete(`${API_CONFIG.BASE_URL}/api/admin/generator/clear-ledger`, {
            headers: AuthService.getAuthHeader()
          });
          setActionMsg("🧹 AI Generator history ledger cleared successfully!");
          fetchAiGenStatus();
        } catch (err) {
          alert("Failed to clear ledger history.");
        }
      }
    });
  };

  const handleToggleAiGen = async (enabled) => {
    try {
      setActionMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/generator/toggle?enabled=${enabled}`, {}, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data && res.data.success) {
        setActionMsg(res.data.message);
        fetchAiGenStatus();
      }
    } catch (err) {
      alert("Failed to toggle AI generator status.");
    }
  };

  const handleTriggerTestBatch = async () => {
    try {
      setActionMsg('');
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/generator/test-run`, {}, {
        headers: AuthService.getAuthHeader()
      });
      if (res.data && res.data.success) {
        setActionMsg(res.data.message);
        setTimeout(() => {
          fetchAiGenStatus();
          fetchAiGeneratedQuestions();
        }, 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to trigger test batch.");
    }
  };

  useEffect(() => {
    if (!AuthService.isAdminOrEditor()) {
      navigate('/explore');
      return;
    }
    fetchAiGenStatus();
    fetchLedgerHistory(0);
    fetchSubjects();
    fetchReportHistory();

    const interval = setInterval(() => {
      fetchAiGenStatus();
      fetchLedgerHistory(ledgerPage);
      fetchReportHistory();
    }, 15000);
    return () => clearInterval(interval);
  }, [ledgerPage]);

  const handleResolveReport = async (reportId) => {
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/admin/reports/${reportId}/resolve`, {}, {
        headers: AuthService.getAuthHeader()
      });
      setActionMsg(`✅ Report #${reportId} resolved successfully!`);
      fetchReportHistory();
    } catch (err) {
      alert("Failed to resolve report.");
    }
  };

  const handlePurgeReportedQuestion = (reportId) => {
    setConfirmModal({
      isOpen: true,
      title: "Purge Reported Question",
      message: `Are you sure you want to PURGE this reported question (Report #${reportId}) completely from the database?`,
      confirmText: "Purge Question",
      type: "danger",
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await axios.post(`${API_CONFIG.BASE_URL}/api/admin/reports/${reportId}/purge-question`, {}, {
            headers: AuthService.getAuthHeader()
          });
          setActionMsg(`🗑️ Question reported in #${reportId} purged completely!`);
          fetchReportHistory();
          fetchAiGeneratedQuestions();
        } catch (err) {
          alert("Failed to purge question.");
        }
      }
    });
  };

  useEffect(() => {
    fetchAiGeneratedQuestions();
  }, [page, pageSize, sortBy, sortDir, selectedSubjectFilter, searchTerm]);

  // Group questions by subject
  const subjectsMap = {};
  questions.forEach(q => {
    const subName = q.subjectName || q.subject?.name || 'General CS';
    if (!subjectsMap[subName]) subjectsMap[subName] = [];
    subjectsMap[subName].push(q);
  });

  const subjectNamesList = Object.keys(subjectsMap);

  const filteredQuestions = questions.filter(q => {
    const subName = q.subjectName || q.subject?.name || 'General CS';
    const topName = q.topicName || q.topic?.name || '';
    const qText = q.text || q.questionText || '';

    const matchesSubject = selectedSubjectFilter === 'ALL' || (subName === selectedSubjectFilter);
    const matchesSearch = !searchTerm || qText.toLowerCase().includes(searchTerm.toLowerCase()) || topName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="ai-gen-hub-container">
      
      {/* Page Header */}
      <div className="ai-gen-header">
        <div>
          <h1 className="ai-gen-title">
            <FiCpu style={{ color: '#8b5cf6' }} /> AI Question Generator Hub 🤖
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
            Autonomous Nightly AI Question Generation, Dual-AI Verification & Question Access Control.
          </p>
        </div>
        <button 
          className="btn btn-outline" 
          onClick={() => navigate('/admin/panel')}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, height: '38px', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
        >
          Open Admin Panel <FiExternalLink size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Action Message Alert */}
        {actionMsg && (
          <div style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#c4b5fd', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            ⚡ {actionMsg}
          </div>
        )}

        {/* Master Control Card */}
        <div className="ai-gen-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  🤖
                </div>
                <div>
                  <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: 0, fontWeight: 800 }}>
                    Nightly AI Engine Status
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    Current Configured Execution Window: <strong>{String(startHourInput).padStart(2, '0')}:00 – {String(endHourInput).padStart(2, '0')}:00 IST</strong>
                  </span>
                </div>
              </div>

              {/* Dynamic Execution Timing Configurator */}
              <form onSubmit={handleUpdateTiming} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>⏰ Execution Time Window (IST):</span>
                <select 
                  value={startHourInput} 
                  onChange={e => setStartHourInput(Number(e.target.value))}
                  style={{ padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h} style={{ background: '#111726' }}>
                      {String(h).padStart(2, '0')}:00 {h < 12 ? 'AM' : 'PM'}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
                <select 
                  value={endHourInput} 
                  onChange={e => setEndHourInput(Number(e.target.value))}
                  style={{ padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h} style={{ background: '#111726' }}>
                      {String(h).padStart(2, '0')}:00 {h < 12 ? 'AM' : 'PM'}
                    </option>
                  ))}
                </select>
                <button 
                  type="submit" 
                  style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Window
                </button>
                {timingMsg && <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>{timingMsg}</span>}
              </form>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Emergency Pause / Resume Switch */}
              <button
                onClick={() => handleToggleAiGen(!aiGenStatus.enabled)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: aiGenStatus.enabled 
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                {aiGenStatus.enabled ? <><FiPause size={18} /> PAUSE Nightly Generator</> : <><FiPlay size={18} /> RESUME Nightly Generator</>}
              </button>

              {/* Manual Sample Test Trigger Button */}
              <button
                onClick={handleTriggerTestBatch}
                disabled={aiGenStatus.running}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                <FiRefreshCw className={aiGenStatus.running ? "spin" : ""} size={16} /> Test Sample Batch (5 Qs)
              </button>
            </div>
          </div>

          {/* Live Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '32px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Master Status</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: aiGenStatus.enabled ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: aiGenStatus.enabled ? '#10b981' : '#ef4444', display: 'inline-block' }} />
                {aiGenStatus.enabled ? 'ACTIVE (Scheduled)' : 'PAUSED'}
              </span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Live Batch Execution</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: aiGenStatus.running ? '#a855f7' : '#94a3b8' }}>
                {aiGenStatus.running ? '⚡ Running Batch...' : '💤 Idle (Waiting for 12 AM)'}
              </span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Verified Accepted Qs</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
                {aiGenStatus.totalAccepted ? aiGenStatus.totalAccepted.toLocaleString() : 0}
              </span>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' }}>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Dual-AI Accuracy Pass Rate</span>
              {(() => {
                const acc = aiGenStatus.totalAccepted || 0;
                const rej = aiGenStatus.totalRejected || 0;
                const total = acc + rej;
                const rate = total > 0 ? Math.round((acc / total) * 100) : 100;
                return (
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: rate >= 70 ? '#8b5cf6' : '#f59e0b' }}>
                    {rate}% <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>({rej} rejected)</span>
                  </span>
                );
              })()}
            </div>

            <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '14px', padding: '20px' }}>
              <span style={{ fontSize: '0.78rem', color: '#c4b5fd', textTransform: 'uppercase', display: 'block', marginBottom: '6px', fontWeight: 700 }}>⚡ Generator Token Ledger</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a855f7' }}>
                {aiGenStatus.totalTokensUsed ? aiGenStatus.totalTokensUsed.toLocaleString() : 0} <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>tokens (Separate)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Subject-Wise AI Question Access & Batch Delete Control Section */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📚 Subject-Wise AI Generated Questions ({filteredQuestions.length})
              </h3>
              {selectedQuestionIds.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 600 }}>
                  ✓ {selectedQuestionIds.length} questions selected for batch action
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Batch Action Buttons */}
              {selectedQuestionIds.length > 0 && (
                <button
                  onClick={() => handleBatchDelete('SELECTED')}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiTrash2 size={14} /> Delete Selected ({selectedQuestionIds.length})
                </button>
              )}

              {selectedSubjectFilter !== 'ALL' && (
                <button
                  onClick={() => handleBatchDelete('SUBJECT')}
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Delete All In {selectedSubjectFilter}
                </button>
              )}

              <button
                onClick={() => handleBatchDelete('ALL')}
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Delete ALL AI Questions
              </button>

              {/* Subject Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                <button
                  onClick={() => setSelectedSubjectFilter('ALL')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: selectedSubjectFilter === 'ALL' ? '#8b5cf6' : 'transparent',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  All Subjects
                </button>
                {subjectNamesList.map((sub, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSubjectFilter(sub)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: selectedSubjectFilter === sub ? '#8b5cf6' : 'transparent',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {sub} ({subjectsMap[sub]?.length || 0})
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} size={14} />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    padding: '6px 12px 6px 32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    width: '170px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Questions Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px', width: '40px' }}>
                    <input 
                      type="checkbox" 
                      checked={questions.length > 0 && selectedQuestionIds.length === questions.length} 
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th onClick={() => handleSort('id')} style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}>
                    ID {sortBy === 'id' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('subject.name')} style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}>
                    Subject {sortBy === 'subject.name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('topic.name')} style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}>
                    Topic {sortBy === 'topic.name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th style={{ padding: '12px', width: '38%' }}>Question Preview</th>
                  <th onClick={() => handleSort('questionType')} style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}>
                    Type {sortBy === 'questionType' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('difficulty')} style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}>
                    Difficulty {sortBy === 'difficulty' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questionsLoading ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading AI questions...
                    </td>
                  </tr>
                ) : questions.length > 0 ? (
                  questions.map((q) => {
                    const subName = q.subjectName || q.subject?.name || 'General CS';
                    const topName = q.topicName || q.topic?.name || 'General';
                    const qPreviewText = q.text || q.questionText || '';
                    const diff = q.difficulty || 'MEDIUM';

                    return (
                      <tr key={q.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedQuestionIds.includes(q.id)} 
                            onChange={() => toggleSelectQuestion(q.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#8b5cf6' }}>#{q.id}</td>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#fff' }}>{subName}</td>
                        <td style={{ padding: '12px' }}>{topName}</td>
                        <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                          <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formatMathText(qPreviewText)}
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {q.questionType}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            background: diff === 'EASY' ? 'rgba(16,185,129,0.15)' : diff === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                            color: diff === 'EASY' ? '#10b981' : diff === 'MEDIUM' ? '#f59e0b' : '#ef4444',
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 
                          }}>
                            {diff}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>

                            <button
                              onClick={() => navigate(`/questions/${q.id}`)}
                              title="View Question"
                              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', cursor: 'pointer' }}
                            >
                              <FiEye size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id, qPreviewText)}
                              title="Delete Question"
                              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', cursor: 'pointer' }}
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No AI Generated questions found. Click "Test Sample Batch" to generate questions!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing {questions.length} of <strong>{totalElements}</strong> total AI questions (Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <span>Rows per page:</span>
                <select 
                  value={pageSize} 
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  style={{ padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  disabled={page === 0} 
                  onClick={() => setPage(0)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: '0.8rem', fontWeight: 600 }}
                >
                  « First
                </button>
                <button 
                  disabled={page === 0} 
                  onClick={() => setPage(prev => Math.max(0, prev - 1))}
                  style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#fff', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: '0.8rem', fontWeight: 600 }}
                >
                  ◀ Prev
                </button>
                <button 
                  disabled={page >= totalPages - 1} 
                  onClick={() => setPage(prev => Math.min(totalPages - 1, prev + 1))}
                  style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#fff', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1, fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Next ▶
                </button>
                <button 
                  disabled={page >= totalPages - 1} 
                  onClick={() => setPage(totalPages - 1)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#fff', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1, fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Last »
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Subject & Topic Question Distribution Ledger */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', boxShadow: 'var(--shadow-sm)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📊 Dynamic Balancing Ledger ({ledgerTotalElements} Topics Tracked)
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Paginated ledger history sorted by last generated date
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={handleClearLedgerHistory}
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FiTrash2 size={14} /> Reset Ledger History
              </button>
              <button 
                onClick={() => { fetchAiGenStatus(); fetchLedgerHistory(ledgerPage); }}
                style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FiRefreshCw size={14} /> Refresh Table
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px' }}>Subject</th>
                  <th style={{ padding: '12px' }}>Topic</th>
                  <th style={{ padding: '12px' }}>Type</th>
                  <th style={{ padding: '12px' }}>Difficulty</th>
                  <th style={{ padding: '12px' }}>Generated</th>
                  <th style={{ padding: '12px' }}>Verified Accepted</th>
                  <th style={{ padding: '12px' }}>Rejected</th>
                  <th style={{ padding: '12px' }}>Last Generated</th>
                </tr>
              </thead>
              <tbody>
                {ledgerLoading ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading ledger history...</td>
                  </tr>
                ) : ledgerList && ledgerList.length > 0 ? (
                  ledgerList.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#fff' }}>{item.subject?.name}</td>
                      <td style={{ padding: '12px' }}>{item.topic?.name}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {item.questionType}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          background: item.difficulty === 'EASY' ? 'rgba(16,185,129,0.15)' : item.difficulty === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: item.difficulty === 'EASY' ? '#10b981' : item.difficulty === 'MEDIUM' ? '#f59e0b' : '#ef4444',
                          padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 
                        }}>
                          {item.difficulty}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>{item.totalGenerated}</td>
                      <td style={{ padding: '12px', color: '#10b981', fontWeight: 700 }}>{item.totalAccepted}</td>
                      <td style={{ padding: '12px', color: '#ef4444' }}>{item.totalRejected}</td>
                      <td style={{ padding: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {item.lastGeneratedAt ? new Date(item.lastGeneratedAt).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No ledger history yet. Click "Test Sample Batch" to generate first batch!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Ledger Pagination Bar */}
          {ledgerTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Page <strong style={{ color: '#fff' }}>{ledgerPage + 1}</strong> of <strong style={{ color: '#fff' }}>{ledgerTotalPages}</strong> ({ledgerTotalElements} items)
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  disabled={ledgerPage === 0}
                  onClick={() => fetchLedgerHistory(0)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#fff', cursor: ledgerPage === 0 ? 'not-allowed' : 'pointer', opacity: ledgerPage === 0 ? 0.4 : 1, fontSize: '0.8rem', fontWeight: 600 }}
                >
                  « First
                </button>
                <button 
                  disabled={ledgerPage === 0}
                  onClick={() => fetchLedgerHistory(ledgerPage - 1)}
                  style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#fff', cursor: ledgerPage === 0 ? 'not-allowed' : 'pointer', opacity: ledgerPage === 0 ? 0.4 : 1, fontSize: '0.8rem', fontWeight: 600 }}
                >
                  ◀ Prev
                </button>
                <button 
                  disabled={ledgerPage >= ledgerTotalPages - 1}
                  onClick={() => fetchLedgerHistory(ledgerPage + 1)}
                  style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#fff', cursor: ledgerPage >= ledgerTotalPages - 1 ? 'not-allowed' : 'pointer', opacity: ledgerPage >= ledgerTotalPages - 1 ? 0.4 : 1, fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Next ▶
                </button>
                <button 
                  disabled={ledgerPage >= ledgerTotalPages - 1}
                  onClick={() => fetchLedgerHistory(ledgerTotalPages - 1)}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: '#fff', cursor: ledgerPage >= ledgerTotalPages - 1 ? 'not-allowed' : 'pointer', opacity: ledgerPage >= ledgerTotalPages - 1 ? 0.4 : 1, fontSize: '0.8rem', fontWeight: 600 }}
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── USER REPORTED QUESTIONS AUDIT & HISTORY PANEL ──────────────────── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🚩 Reported Questions History & AI Audit Queue ({reportHistory.length})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Sunday Automated AI Auditor runs every 7 days to clean up flagged questions
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px' }}>ID</th>
                  <th style={{ padding: '12px' }}>Question ID</th>
                  <th style={{ padding: '12px' }}>Subject</th>
                  <th style={{ padding: '12px' }}>Reported By</th>
                  <th style={{ padding: '12px' }}>Reason</th>
                  <th style={{ padding: '12px', width: '25%' }}>Description</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Reported At</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reportsLoading ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading report history...</td>
                  </tr>
                ) : reportHistory.length > 0 ? (
                  reportHistory.map((rep) => (
                    <tr key={rep.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>#{rep.id}</td>
                      <td style={{ padding: '12px', color: '#c4b5fd', fontWeight: 700 }}>Q#{rep.questionId}</td>
                      <td style={{ padding: '12px' }}>{rep.subjectName}</td>
                      <td style={{ padding: '12px' }}>{rep.reportedBy}</td>
                      <td style={{ padding: '12px', color: '#f87171', fontWeight: 600 }}>{rep.reason}</td>
                      <td style={{ padding: '12px', fontSize: '0.82rem' }}>{rep.description || 'No description provided'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: rep.status === 'RESOLVED' ? 'rgba(16,185,129,0.15)' : rep.status === 'QUESTION_PURGED' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)',
                          color: rep.status === 'RESOLVED' ? '#10b981' : rep.status === 'QUESTION_PURGED' ? '#ef4444' : '#f59e0b'
                        }}>
                          {rep.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {rep.createdAt ? new Date(rep.createdAt).toLocaleString() : 'N/A'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {rep.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleResolveReport(rep.id)}
                                style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Mark Resolved
                              </button>
                              <button
                                onClick={() => handlePurgeReportedQuestion(rep.id)}
                                style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Purge Question
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => navigate(`/questions/${rep.questionId}`)}
                            style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                            title="Inspect Question"
                          >
                            <FiEye size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No reported questions found. All questions are clean!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
      />
    </div>
  );
}
