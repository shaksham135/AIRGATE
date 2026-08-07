import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { formatMathText } from '../utils/mathRenderer';
import { getQuestionUrl } from '../utils/urlUtils';
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
  const [activeSubjectModal, setActiveSubjectModal] = useState(null);
  
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

  // Custom Generator Trigger state
  const [genDifficulty, setGenDifficulty] = useState('MIXED');
  const [genType, setGenType] = useState('MIXED');
  const [genSubjectId, setGenSubjectId] = useState('');
  const [genCount, setGenCount] = useState(5);

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

  // Subject Summaries State
  const [subjectSummaries, setSubjectSummaries] = useState([]);

  const fetchSubjectSummaries = async () => {
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/generator/subject-summary`, {
        headers: AuthService.getAuthHeader()
      });
      setSubjectSummaries(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load subject summary", err);
    }
  };

  // AI Batches State
  const [aiBatches, setAiBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  const fetchAiBatches = async (showLoading = false) => {
    try {
      if (showLoading || aiBatches.length === 0) setBatchesLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/admin/ai-batches`, {
        headers: AuthService.getAuthHeader()
      });
      setAiBatches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load AI batches", err);
    } finally {
      setBatchesLoading(false);
    }
  };

  const handlePurgeBatch = (batchName, totalQs) => {
    setConfirmModal({
      isOpen: true,
      title: `Purge Nightly Batch "${batchName}"?`,
      message: `Are you sure you want to PERMANENTLY PURGE all ${totalQs} questions generated in batch "${batchName}"? This action cannot be undone!`,
      confirmText: "Purge Entire Batch",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          const res = await axios.delete(`${API_CONFIG.BASE_URL}/api/questions/admin/ai-batches/${encodeURIComponent(batchName)}`, {
            headers: AuthService.getAuthHeader()
          });
          setActionMsg(`✅ ${res.data?.message || 'Batch purged successfully'}`);
          fetchAiBatches();
          fetchGeneratedQuestions(page);
        } catch (e) {
          console.error('Failed to purge batch', e);
          setActionMsg('❌ Failed to purge batch: ' + (e.response?.data?.message || e.message));
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const fetchLedgerHistory = async (p = 0, showLoading = false) => {
    try {
      if (showLoading || ledgerList.length === 0) setLedgerLoading(true);
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

  const handleTriggerCustomBatch = async () => {
    try {
      setActionMsg("🚀 Triggering AI Generator batch...");
      const params = {
        difficulty: genDifficulty,
        type: genType,
        count: genCount
      };
      if (genSubjectId) params.subjectId = genSubjectId;

      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/admin/generator/test-run`, null, {
        params,
        headers: AuthService.getAuthHeader()
      });
      if (res.data && res.data.message) {
        setActionMsg(`⚡ ${res.data.message}`);
        setTimeout(() => fetchAiGenStatus(), 2000);
      }
    } catch (err) {
      alert("Failed to trigger batch: " + (err.response?.data?.message || err.message));
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
    fetchAiBatches();
    fetchSubjectSummaries();

    const interval = setInterval(() => {
      fetchAiGenStatus();
      fetchLedgerHistory(ledgerPage);
      fetchReportHistory();
      fetchAiBatches();
      fetchSubjectSummaries();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
    const subName = (q.subjectName || q.subject?.name || 'General CS').trim();
    const topName = q.topicName || q.topic?.name || '';
    const qText = q.text || q.questionText || '';

    const matchesSubject = selectedSubjectFilter === 'ALL' || (subName.toLowerCase() === selectedSubjectFilter.trim().toLowerCase());
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Difficulty Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>DIFFICULTY</label>
                  <select 
                    value={genDifficulty}
                    onChange={e => setGenDifficulty(e.target.value)}
                    style={{ padding: '6px 10px', background: '#111726', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    <option value="MIXED">🎯 MIXED (GATE Standard)</option>
                    <option value="EASY">🟢 EASY (1-Mark Concept)</option>
                    <option value="MEDIUM">🟡 MEDIUM (1-Mark/2-Mark)</option>
                    <option value="HARD">🔥 HARD (Tricky 2-Mark)</option>
                  </select>
                </div>

                {/* Question Type Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>QUESTION TYPE</label>
                  <select 
                    value={genType}
                    onChange={e => setGenType(e.target.value)}
                    style={{ padding: '6px 10px', background: '#111726', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    <option value="MIXED">⚡ MIXED (MCQ/MSQ/NAT)</option>
                    <option value="MCQ">📝 MCQ (Single Correct)</option>
                    <option value="MSQ">☑️ MSQ (Multiple Select)</option>
                    <option value="NAT">🔢 NAT (Numerical Answer)</option>
                  </select>
                </div>

                {/* Subject Filter */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TARGET SUBJECT</label>
                  <select 
                    value={genSubjectId}
                    onChange={e => setGenSubjectId(e.target.value)}
                    style={{ padding: '6px 10px', background: '#111726', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    <option value="">🌐 ALL Subjects (Balanced)</option>
                    {subjectsList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Batch Count */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>BATCH SIZE</label>
                  <select 
                    value={genCount}
                    onChange={e => setGenCount(Number(e.target.value))}
                    style={{ padding: '6px 10px', background: '#111726', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                    <option value={20}>20 Questions</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                {/* Emergency Pause / Resume Switch */}
                <button
                  onClick={() => handleToggleAiGen(!aiGenStatus.enabled)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: aiGenStatus.enabled 
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff'
                  }}
                >
                  {aiGenStatus.enabled ? <><FiPause size={14} /> PAUSE Generator</> : <><FiPlay size={14} /> RESUME Generator</>}
                </button>

                {/* Custom Batch Trigger Button */}
                <button
                  onClick={handleTriggerCustomBatch}
                  disabled={aiGenStatus.running}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-primary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  <FiRefreshCw className={aiGenStatus.running ? "spin" : ""} size={14} /> Generate Custom Batch
                </button>
              </div>
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

        {/* Subject-Wise AI Questions Stats Cards Grid */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', boxShadow: 'var(--shadow-sm)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#fff', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
                📚 Subject Question Inventories ({subjectNamesList.length} GATE Subjects)
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Click any subject card to inspect, filter, or bulk-manage its generated questions
              </span>
            </div>
            {selectedSubjectFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedSubjectFilter('ALL')}
                style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid #8b5cf6', color: '#c4b5fd', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                Reset Subject Filter
              </button>
            )}
          </div>

          {/* Grid of Subject Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {subjectNamesList.map((subName, i) => {
              const summary = subjectSummaries.find(s => s.subjectName === subName);
              const subQuestions = subjectsMap[subName] || [];
              const totalCount = summary ? summary.totalCount : subQuestions.length;
              const pendingCount = summary ? summary.pendingCount : subQuestions.filter(q => q.status === 'PENDING_REVIEW' || q.status === 'PENDING').length;
              const approvedCount = summary ? summary.approvedCount : subQuestions.filter(q => q.status === 'APPROVED' || q.isCommunityVerified).length;

              const colors = [
                { bg: 'rgba(56, 189, 248, 0.08)', border: 'rgba(56, 189, 248, 0.3)', text: '#38bdf8' },
                { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.3)', text: '#a855f7' },
                { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
                { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' },
                { bg: 'rgba(236, 72, 153, 0.08)', border: 'rgba(236, 72, 153, 0.3)', text: '#ec4899' },
                { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.3)', text: '#6366f1' }
              ];
              const theme = colors[i % colors.length];

              return (
                <div
                  key={subName}
                  onClick={() => {
                    setSelectedSubjectFilter(subName);
                    setActiveSubjectModal(subName);
                    setPageSize(500);
                    setPage(0);
                  }}
                  style={{
                    background: theme.bg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '14px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>{subName}</span>
                    <span style={{ background: theme.border, color: theme.text, fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                      {totalCount} Qs
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase' }}>Pending</span>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b' }}>{pendingCount}</span>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase' }}>Approved</span>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>{approvedCount}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '0.78rem', color: theme.text, fontWeight: 700 }}>Inspect Questions</span>
                    <span style={{ color: theme.text, fontSize: '0.9rem' }}>➔</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive Subject Questions Modal */}
        {activeSubjectModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', width: '100%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
              
              {/* Modal Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 800 }}>
                    📚 {activeSubjectModal} — AI Generated Questions ({filteredQuestions.length})
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Manage or purge AI generated questions for this subject</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleBatchDelete('SUBJECT')}
                    style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                  >
                    🗑️ Purge All In {activeSubjectModal}
                  </button>
                  <button
                    onClick={() => setActiveSubjectModal(null)}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '1.5rem', cursor: 'pointer', padding: '4px' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body: Question List */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <FiSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} size={14} />
                    <input
                      type="text"
                      placeholder="Search questions in this subject..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredQuestions.length > 0 ? (
                    filteredQuestions.map((q) => {
                      const topName = q.topicName || q.topic?.name || 'General';
                      const qPreviewText = q.text || q.questionText || '';
                      const diff = q.difficulty || 'MEDIUM';

                      return (
                        <div key={q.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ color: '#a855f7', fontWeight: 800, fontSize: '0.85rem' }}>#{q.id}</span>
                              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>• {topName}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                                {q.questionType}
                              </span>
                              <span style={{ 
                                background: diff === 'EASY' ? 'rgba(16,185,129,0.15)' : diff === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                color: diff === 'EASY' ? '#10b981' : diff === 'MEDIUM' ? '#f59e0b' : '#ef4444',
                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 
                              }}>
                                {diff}
                              </span>
                            </div>
                          </div>

                          <div style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            {formatMathText(qPreviewText)}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <button
                              onClick={() => navigate(getQuestionUrl(q))}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              View Details ➔
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id, qPreviewText)}
                              style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                              Delete Question
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                      No AI questions found for {activeSubjectModal}.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Nightly Generation Batches & Purge Manager */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', boxShadow: 'var(--shadow-sm)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📦 Nightly Generation Batches ({aiBatches.length} Batches Tracked)
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                View and purge entire nightly AI generation sessions in one click
              </span>
            </div>
            <button 
              onClick={fetchAiBatches}
              style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FiRefreshCw size={14} /> Refresh Batches
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px' }}>Batch Identifier</th>
                  <th style={{ padding: '12px' }}>Total Questions</th>
                  <th style={{ padding: '12px' }}>Pending Review</th>
                  <th style={{ padding: '12px' }}>Approved</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batchesLoading ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading AI generation batches...</td>
                  </tr>
                ) : aiBatches && aiBatches.length > 0 ? (
                  aiBatches.map((b) => (
                    <tr key={b.batchName} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#c4b5fd', fontFamily: 'monospace' }}>
                        {b.batchName}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#fff' }}>{b.totalQuestions}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {b.pendingCount} Pending
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {b.approvedCount} Approved
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          onClick={() => handlePurgeBatch(b.batchName, b.totalQuestions)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <FiTrash2 size={13} /> Purge Batch
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No AI generation batches found yet. Nightly batches will appear here as they run!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                            onClick={() => navigate(getQuestionUrl({ id: rep.questionId }))}
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
