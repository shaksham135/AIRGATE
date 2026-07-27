import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import CacheService from '../services/CacheService';
import API_CONFIG from '../config/api';
import { getAssetUrl, renderQuestionText, checkAnswerCorrect, renderMentorAnalysis } from '../utils/mathRenderer';
import { 
  FiSearch, FiBookOpen, FiLayers, FiAlertTriangle, FiCheckCircle, 
  FiBookmark, FiMessageSquare, FiFilter, FiLoader, FiLock, FiClock, FiCheckSquare, FiRotateCcw, FiZap,
  FiExternalLink, FiX, FiShare2, FiCheck
} from 'react-icons/fi';
import PremiumGateModal from '../components/PremiumGateModal';
import LoginGate from '../components/LoginGate';

export default function PracticeArena() {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Daily Quota State
  const [quota, setQuota] = useState({ usedToday: 0, limitToday: 30, isPremium: false, remainingToday: 30 });
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showLoginGateModal, setShowLoginGateModal] = useState(false);

  // Share State
  const [copiedShareId, setCopiedShareId] = useState(null);

  const handleShareQuestion = async (e, q) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/questions/${q.id}`;
    const shareTitle = `GATE CSE ${q.year || ''} - ${q.topicName || 'Question'} | AIRGATE`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Check out this GATE question on AIRGATE:`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareId(q.id);
      setTimeout(() => setCopiedShareId(null), 2500);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedShareId(q.id);
      setTimeout(() => setCopiedShareId(null), 2500);
    }
  };

  // Report Question Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportQuestionId, setReportQuestionId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDesc, setReportDesc] = useState('');

  const handleSendReport = async () => {
    if (!currentUser) {
      setShowLoginGateModal(true);
      return;
    }
    if (!reportQuestionId || !reportReason) return;
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${reportQuestionId}/report`, {
        reason: reportReason,
        description: reportDesc
      }, {
        headers: AuthService.getAuthHeader()
      });
      alert("Thank you! Your report has been submitted to the administrator for review.");
      setShowReportModal(false);
      setReportQuestionId(null);
      setReportReason('');
      setReportDesc('');
    } catch (err) {
      alert("Failed to submit report. Please try again.");
    }
  };

  // Interactive Question States
  const [selectedOptions, setSelectedOptions] = useState({});
  const [tempMsqSelections, setTempMsqSelections] = useState({});
  const [natInputs, setNatInputs] = useState({});
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [resetCounts, setResetCounts] = useState({});

  const currentUser = AuthService.getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    AuthService.checkAndRefreshUserStatus(true).then(() => {
      fetchDailyQuota();
    });
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      fetchTopics(selectedSubjectId);
    } else {
      setTopics([]);
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    fetchPracticeQuestions(page);
  }, [page, pageSize, selectedSubjectId, selectedTopicId, selectedDifficulty, selectedType, activeSearchQuery]);

  const fetchDailyQuota = async () => {
    if (!currentUser) return;
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/practice/quota`, {
        headers: AuthService.getAuthHeader()
      });
      setQuota(response.data);
    } catch (err) {
      console.error("Failed to load practice quota", err);
    }
  };

  const fetchSubjects = async () => {
    const cached = CacheService.get('subjects');
    if (cached) setSubjects(cached);
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects`);
      const data = Array.isArray(response.data) ? response.data : [];
      setSubjects(data);
      CacheService.set('subjects', data, 600000); // 10 mins TTL
    } catch (err) {
      console.error('Failed to load subjects', err);
    }
  };

  const fetchTopics = async (subjectId) => {
    const cached = CacheService.get(`topics_${subjectId}`);
    if (cached) setTopics(cached);
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects/${subjectId}/topics`);
      const data = Array.isArray(response.data) ? response.data : [];
      setTopics(data);
      CacheService.set(`topics_${subjectId}`, data, 600000);
    } catch (err) {
      console.error('Failed to load topics', err);
    }
  };

  const fetchPracticeQuestions = async (pageNumber = 0) => {
    const params = {
      page: pageNumber,
      size: pageSize
    };
    if (selectedSubjectId) params.subjectId = selectedSubjectId;
    if (selectedTopicId) params.topicId = selectedTopicId;
    if (selectedDifficulty && selectedDifficulty !== 'ALL') params.difficulty = selectedDifficulty;
    if (selectedType && selectedType !== 'ALL') params.type = selectedType;
    if (activeSearchQuery && activeSearchQuery.trim()) params.query = activeSearchQuery.trim();

    const cacheKey = `practice_feed_${JSON.stringify(params)}`;
    const cached = CacheService.get(cacheKey);

    if (cached) {
      setQuestions(cached.content || []);
      setTotalPages(cached.totalPages || 0);
      setTotalElements(cached.totalElements || 0);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/practice/questions`, {
        params,
        headers: AuthService.getAuthHeader()
      });

      if (response.data && response.data.content) {
        setQuestions(response.data.content);
        setTotalPages(response.data.totalPages || 0);
        setTotalElements(response.data.totalElements || 0);
        CacheService.set(cacheKey, response.data, 180000); // 3 mins TTL
      } else {
        setQuestions([]);
      }
    } catch (err) {
      console.error('Failed to fetch practice questions', err);
      if (!cached) setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    setActiveSearchQuery(searchQuery);
  };

  const handleSelectOption = (questionId, label, isMsq = false) => {
    if (isMsq) {
      setTempMsqSelections(prev => {
        const current = prev[questionId] || [];
        const exists = current.includes(label);
        return {
          ...prev,
          [questionId]: exists ? current.filter(l => l !== label) : [...current, label].sort()
        };
      });
    } else {
      setSelectedOptions(prev => ({ ...prev, [questionId]: label }));
    }
  };

  const handleNatInputChange = (questionId, value) => {
    setNatInputs(prev => ({ ...prev, [questionId]: value }));
  };

  const handleLockAndVerifyAnswer = async (question) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Quota Check
    if (!quota.isPremium && quota.usedToday >= quota.limitToday) {
      setShowQuotaModal(true);
      return;
    }

    let finalSelection = '';
    if (question.questionType === 'MSQ') {
      const selections = tempMsqSelections[question.id] || [];
      if (selections.length === 0) {
        alert('Please select at least one option for MSQ!');
        return;
      }
      finalSelection = selections.join(',');
    } else if (question.questionType === 'NAT') {
      const input = natInputs[question.id];
      if (!input || !input.trim()) {
        alert('Please enter your numerical answer!');
        return;
      }
      finalSelection = input.trim();
    } else {
      finalSelection = selectedOptions[question.id];
      if (!finalSelection) {
        alert('Please select an option first!');
        return;
      }
    }

    if (!currentUser) {
      setShowLoginGateModal(true);
      return;
    }

    try {
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${question.id}/solve`, {
        selectedOption: finalSelection,
        timeTaken: "30"
      }, {
        headers: AuthService.getAuthHeader()
      });

      if (response.data) {
        setRevealedAnswers(prev => ({ ...prev, [question.id]: true }));
        fetchDailyQuota(); // Update remaining count live
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setShowLoginGateModal(true);
      } else if (err.response?.status === 429 || err.response?.data?.error === 'QUOTA_EXCEEDED') {
        setShowQuotaModal(true);
      } else {
        alert(err.response?.data?.message || 'Failed to submit answer.');
      }
    }
  };

  const handleResetAnswer = (questionId) => {
    const currentCount = resetCounts[questionId] || 0;
    if (currentCount >= 3) return;
    setResetCounts(prev => ({ ...prev, [questionId]: currentCount + 1 }));
    setRevealedAnswers(prev => ({ ...prev, [questionId]: false }));
  };

  return (
    <div className="practice-arena-container" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', color: 'var(--text-primary)' }}>
      
      {/* ── TOP BANNER: SLEEK & COMPACT CONCEPTUAL PRACTICE & DAILY QUOTA ────────── */}
      <div className="practice-top-banner" style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: '16px',
        padding: '10px 16px',
        marginBottom: '12px',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
              width: '28px', height: '28px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
              flexShrink: 0
            }}>
              <FiZap size={14} style={{ color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.01em' }}>
              Conceptual Practice Arena
            </h1>
          </div>

          {/* Daily Quota Counter Badge - Ultra Sleek Mini Progress */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              QUOTA: <span style={{ color: quota.isPremium ? '#10b981' : quota.usedToday >= quota.limitToday ? '#ef4444' : '#818cf8', fontWeight: 800 }}>
                {quota.isPremium ? 'UNLIMITED 👑' : `${quota.usedToday}/${quota.limitToday}`}
              </span>
            </div>
            {!quota.isPremium && (
              <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (quota.usedToday / quota.limitToday) * 100)}%`,
                  background: quota.usedToday >= quota.limitToday ? '#ef4444' : 'linear-gradient(90deg, #6366f1, #a855f7)',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── COMPACT FILTERS BAR WITH COLLAPSE TOGGLE ───────────── */}
      <div className="practice-filters-box" style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: isFiltersCollapsed ? '8px 14px' : '12px 16px',
        marginBottom: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transition: 'all 0.2s ease'
      }}>
        {/* Top Controls: Search + Collapse Toggle */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }} />
              <input
                type="text"
                placeholder="Search practice questions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '6px 10px 6px 32px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.82rem'
                }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 14px', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem' }}>
              Search
            </button>
          </form>

          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)} 
            style={{ height: '36px', padding: '0 12px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <FiFilter /> {isFiltersCollapsed ? 'Show Filters' : 'Collapse'}
          </button>
        </div>

        {/* Dropdown Filters Grid - Collapsible */}
        {!isFiltersCollapsed && (
          <div className="practice-select-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            <select
              value={selectedSubjectId || ''}
              onChange={e => {
                setSelectedSubjectId(e.target.value ? Number(e.target.value) : null);
                setSelectedTopicId(null);
                setPage(0);
              }}
              style={{ height: '36px', padding: '6px 10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.82rem' }}
            >
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select
              value={selectedTopicId || ''}
              onChange={e => { setSelectedTopicId(e.target.value ? Number(e.target.value) : null); setPage(0); }}
              disabled={!selectedSubjectId}
              style={{ height: '36px', padding: '6px 10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.82rem', opacity: !selectedSubjectId ? 0.5 : 1 }}
            >
              <option value="">All Topics</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <select
              value={selectedDifficulty}
              onChange={e => { setSelectedDifficulty(e.target.value); setPage(0); }}
              style={{ height: '36px', padding: '6px 10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.82rem' }}
            >
              <option value="ALL">All Difficulties</option>
              <option value="EASY">🟢 Easy</option>
              <option value="MEDIUM">🟡 Medium</option>
              <option value="HARD">🔴 Hard</option>
            </select>

            <select
              value={selectedType}
              onChange={e => { setSelectedType(e.target.value); setPage(0); }}
              style={{ height: '36px', padding: '6px 10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.82rem' }}
            >
              <option value="ALL">All Question Types</option>
              <option value="MCQ">MCQ (Single Choice)</option>
              <option value="MSQ">MSQ (Multiple Select)</option>
              <option value="NAT">NAT (Numerical)</option>
            </select>
          </div>
        )}
      </div>

      {/* ── QUESTION FEED ─────────────────────────────────────────────────── */}
      <div id="practice-questions-start"></div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <FiLoader size={36} className="spin-animation" />
          <p style={{ marginTop: '12px' }}>Loading Conceptual Practice Questions...</p>
        </div>
      ) : questions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <h3>No Conceptual Questions Found</h3>
          <p style={{ color: 'var(--text-muted)' }}>Try resetting your subject/topic or difficulty filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {questions.map((q, index) => {
            const isRevealed = revealedAnswers[q.id];
            const retryCount = resetCounts[q.id] || 0;

            return (
              <div key={q.id} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {/* Header Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 10px', background: 'rgba(99, 102, 241, 0.2)', color: '#c4b5fd', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800 }}>
                      PRACTICE Q{page * pageSize + index + 1}
                    </span>
                    <span style={{ padding: '4px 10px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', borderRadius: '6px', fontSize: '0.78rem' }}>
                      {q.subjectName} • {q.topicName}
                    </span>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: q.difficulty === 'HARD' ? 'rgba(239, 68, 68, 0.2)' : q.difficulty === 'EASY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: q.difficulty === 'HARD' ? '#ef4444' : q.difficulty === 'EASY' ? '#10b981' : '#f59e0b'
                    }}>
                      {q.difficulty || 'MEDIUM'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{q.questionType}</span>

                    {/* View Details Page Link */}
                    <button
                      type="button"
                      onClick={() => navigate(`/questions/${q.id}`)}
                      title="View Detailed Question Page"
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '6px',
                        color: '#818cf8',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <FiExternalLink size={12} /> Details
                    </button>

                    {/* Share Question Button */}
                    <button
                      type="button"
                      onClick={(e) => handleShareQuestion(e, q)}
                      title="Share Direct Question Link"
                      style={{
                        padding: '4px 10px',
                        background: copiedShareId === q.id ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                        border: `1px solid ${copiedShareId === q.id ? '#22c55e' : 'var(--border-color)'}`,
                        borderRadius: '6px',
                        color: copiedShareId === q.id ? '#22c55e' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {copiedShareId === q.id ? <FiCheck size={12} /> : <FiShare2 size={12} />}
                      {copiedShareId === q.id ? 'Copied!' : 'Share'}
                    </button>

                    {/* Report Question Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setReportQuestionId(q.id);
                        setShowReportModal(true);
                      }}
                      title="Report an error in this question"
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <FiAlertTriangle size={12} /> Report
                    </button>
                  </div>
                </div>

                {/* Question Stem (Clickable to view detailed page) */}
                <div 
                  onClick={() => navigate(`/questions/${q.id}`)}
                  style={{ fontSize: '1rem', lineHeight: '1.6', marginBottom: '20px', color: '#fff', cursor: 'pointer' }}
                  title="Click to view detailed question page with explanation"
                >
                  {renderQuestionText(q.text)}
                </div>

                {/* Options List */}
                {q.options && q.options.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '20px' }}>
                    {q.options.map(opt => {
                      const isMsq = q.questionType === 'MSQ';
                      const isSelected = isMsq 
                        ? (tempMsqSelections[q.id] || []).includes(opt.optionLabel)
                        : selectedOptions[q.id] === opt.optionLabel;

                      return (
                        <div
                          key={opt.id}
                          onClick={() => !isRevealed && handleSelectOption(q.id, opt.optionLabel, isMsq)}
                          style={{
                            padding: '14px 18px',
                            borderRadius: '10px',
                            background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-main)',
                            border: `1px solid ${isSelected ? '#6366f1' : 'var(--border-color)'}`,
                            cursor: isRevealed ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            background: isSelected ? '#6366f1' : 'rgba(255,255,255,0.06)',
                            color: isSelected ? '#fff' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.82rem'
                          }}>
                            {opt.optionLabel}
                          </span>
                          <div style={{ fontSize: '0.92rem', color: '#e2e8f0' }}>
                            {renderQuestionText(opt.optionText)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* NAT Input */
                  <div style={{ marginBottom: '20px' }}>
                    <input
                      type="number"
                      placeholder="Enter numerical answer..."
                      value={natInputs[q.id] || ''}
                      onChange={e => handleNatInputChange(q.id, e.target.value)}
                      disabled={isRevealed}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-main)',
                        color: '#fff',
                        fontSize: '0.95rem',
                        width: '260px'
                      }}
                    />
                  </div>
                )}

                {/* Actions Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  {!isRevealed ? (
                    <button
                      onClick={() => handleLockAndVerifyAnswer(q)}
                      className="btn btn-primary"
                      style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 700 }}
                    >
                      Lock & Check Answer
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>✓ Answer Saved</span>
                      {retryCount < 3 ? (
                        <button
                          onClick={() => handleResetAnswer(q.id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            color: '#c4b5fd',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <FiRotateCcw size={14} /> Mark Unsolved ({3 - retryCount} retry left)
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>🔒 Max 3 resets used</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Revealed Answer & Explanation Block */}
                {isRevealed && (
                  <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ fontWeight: 800, color: '#10b981', marginBottom: '6px', fontSize: '0.9rem' }}>
                      Correct Answer: {q.aiSuggestedAnswer || 'See Explanation'}
                    </div>
                    {q.aiSuggestedExplanation && (
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        {renderMentorAnalysis(q.aiSuggestedExplanation)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PAGINATION CONTROLS ────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justify: 'center',
          alignItems: 'center',
          gap: '12px',
          marginTop: '32px',
          marginBottom: '32px'
        }}>
          <button
            onClick={() => {
              setPage(p => Math.max(0, p - 1));
              const feedEl = document.getElementById('practice-questions-start');
              if (feedEl) feedEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            disabled={page === 0}
            className="btn btn-outline"
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', opacity: page === 0 ? 0.5 : 1 }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            Page {page + 1} of {totalPages} ({totalElements} Total Questions)
          </span>
          <button
            onClick={() => {
              setPage(p => Math.min(totalPages - 1, p + 1));
              const feedEl = document.getElementById('practice-questions-start');
              if (feedEl) feedEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            disabled={page >= totalPages - 1}
            className="btn btn-outline"
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', opacity: page >= totalPages - 1 ? 0.5 : 1 }}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── DAILY 30-LIMIT EXCEEDED MODAL ──────────────────────────────────── */}
      {showQuotaModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '24px',
            padding: '36px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🛑</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
              Daily Practice Limit Reached!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
              You have completed your free quota of <strong>30 conceptual practice questions</strong> for today. Take rest to process what you learned, or upgrade to <strong>Aspirant Pro</strong> for unlimited daily practice!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => { setShowQuotaModal(false); navigate('/premium'); }}
                className="btn btn-primary"
                style={{ padding: '14px', borderRadius: '12px', fontWeight: 800, fontSize: '0.95rem' }}
              >
                👑 Upgrade to Aspirant Pro (Unlimited Solves)
              </button>
              <button
                onClick={() => setShowQuotaModal(false)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Question Modal */}
      {showReportModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '20px', padding: '28px', maxWidth: '480px', width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiAlertTriangle style={{ color: '#ef4444' }} /> Report Question Error
              </h3>
              <button onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <FiX size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reason for Report:</label>
              <select
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                style={{ width: '100%', padding: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
              >
                <option value="">Select a reason...</option>
                <option value="Incorrect Answer Key">Wrong Correct Answer</option>
                <option value="Typo / Formatting Error">Typo or LaTeX Formatting Error</option>
                <option value="Missing Image / Text">Missing Image or Incomplete Text</option>
                <option value="Duplicate Question">Duplicate Question</option>
                <option value="Other">Other Reason</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Additional Details (Optional):</label>
              <textarea
                value={reportDesc}
                onChange={e => setReportDesc(e.target.value)}
                placeholder="Explain the error briefly..."
                rows={3}
                style={{ width: '100%', padding: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowReportModal(false)}
                style={{ padding: '8px 16px', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendReport}
                disabled={!reportReason}
                style={{ padding: '8px 18px', borderRadius: '8px', opacity: !reportReason ? 0.5 : 1 }}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      <LoginGate
        isOpen={showLoginGateModal}
        onClose={() => setShowLoginGateModal(false)}
        title="Sign in to Submit & Track Progress"
        message="Practice questions are completely free to view! Sign in or create a free account to lock your answers and track your Prep Analyst statistics."
      />
    </div>
  );
}
