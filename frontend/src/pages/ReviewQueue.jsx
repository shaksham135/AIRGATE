import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { 
  FiCheck, FiX, FiFastForward, FiAlertCircle, FiSettings, 
  FiRotateCw, FiZoomIn, FiSun, FiEye, FiSliders, FiCornerUpLeft, FiEdit, FiTrash 
} from 'react-icons/fi';
import { formatMathText, renderQuestionText, getAssetUrl } from '../utils/mathRenderer';
import './ReviewQueue.css';

export default function ReviewQueue() {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Active question edit states
  const [text, setText] = useState('');
  const [questionType, setQuestionType] = useState('MCQ');
  const [marks, setMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(-0.33);
  const [year, setYear] = useState(2024);
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [tagString, setTagString] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [imagePath, setImagePath] = useState('');
  const [aiSuggestedAnswer, setAiSuggestedAnswer] = useState('');
  const [aiSuggestedExplanation, setAiSuggestedExplanation] = useState('');
  const [pageImageSrc, setPageImageSrc] = useState('');
  const [loadingPageImage, setLoadingPageImage] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isPageModalOpen, setIsPageModalOpen] = useState(false);
  const [modalViewMode, setModalViewMode] = useState('image'); // 'image' | 'text'
  const [pageText, setPageText] = useState('');
  const [loadingPageText, setLoadingPageText] = useState(false);

  // Tab State: 'form' | 'ocr' | 'json'
  const [activeTab, setActiveTab] = useState('form');

  // Slider image adjustment states
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  // Dropdown options
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);

  // Session Productivity States
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0);
  const [startTime] = useState(Date.now());
  const [avgTimePerQuestion, setAvgTimePerQuestion] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [aiBatches, setAiBatches] = useState([]);

  // 10-Second Undo States
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoQuestionId, setUndoQuestionId] = useState(null);
  const [undoTimer, setUndoTimer] = useState(10);
  const undoIntervalRef = useRef(null);

  // Load baseline values (Prioritizing main pending review queue FIRST)
  useEffect(() => {
    if (!AuthService.isAdminOrEditor()) {
      navigate('/explore');
      return;
    }

    // 🚀 Priority #1: Fetch pending questions feed FIRST!
    fetchPendingQuestions();

    const timer = setTimeout(() => {
      fetchSubjects();
      fetchAnalyticsDashboard();
      fetchAiBatches();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Sync state with current question in queue
  useEffect(() => {
    if (questions.length > 0 && currentIndex < questions.length) {
      const q = questions[currentIndex];
      setText(q.text);

      // 🚀 Smart Auto-Detect Question Type (MCQ vs MSQ vs NAT)
      let detectedType = q.questionType || 'MCQ';
      const ans = (q.aiSuggestedAnswer || '').trim();
      const txt = (q.text || '').toLowerCase();
      const optCount = q.options ? q.options.length : 0;

      if (ans.match(/.*[A-Da-d].*[,\\s]+.*[A-Da-d].*/)) {
        detectedType = 'MSQ';
      } else if (optCount === 0 || txt.includes('numerical') || (txt.includes('nat') && !txt.includes('native'))) {
        detectedType = 'NAT';
      } else if (txt.includes('is/are') || txt.includes('statement(s)') || txt.includes('are true') || txt.includes('are correct') || txt.includes('select all') || txt.includes('msq')) {
        detectedType = 'MSQ';
      }

      setQuestionType(detectedType);
      setMarks(q.marks || 1);

      if (detectedType === 'MSQ' || detectedType === 'NAT') {
        setNegativeMarks(0.0);
      } else {
        setNegativeMarks(q.negativeMarks !== undefined ? q.negativeMarks : ((q.marks || 1) === 2 ? -0.66 : -0.33));
      }

      setYear(q.year || 2024);
      setImagePath(q.imagePath || '');
      setAiSuggestedAnswer(q.aiSuggestedAnswer || 'A');
      setAiSuggestedExplanation(q.aiSuggestedExplanation || '');
      
      // Reset CSS controls
      setZoom(1.0);
      setRotation(0);
      setBrightness(100);
      setContrast(100);

      const currentSubjectId = q.subjectId || '';
      setSubjectId(currentSubjectId);
      
      if (currentSubjectId) {
        fetchTopics(currentSubjectId).then((loadedTopics) => {
          if (q.topicId && loadedTopics.some(t => t.id === q.topicId)) {
            setTopicId(q.topicId);
          } else {
            setTopicId('');
          }
        });
      } else {
        setTopics([]);
        setTopicId('');
      }
      
      if (q.options && q.options.length > 0) {
        const sortedOpts = [...q.options].sort((a, b) => a.optionLabel.localeCompare(b.optionLabel));
        setOptions(sortedOpts.map(o => o.optionText));
      } else {
        setOptions(['', '', '', '']);
      }

      if (q.tags) {
        setTagString(Array.from(q.tags).join(', '));
      }
    }
  }, [questions, currentIndex]);

  // Keyboard review shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore shortcuts if admin is focused inside a text input/textarea
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        // Save draft shortcut (Ctrl + S) inside input
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSaveDraft();
        }
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'a') {
        e.preventDefault();
        triggerApprove();
      } else if (key === 'r') {
        e.preventDefault();
        triggerReject();
      } else if (key === 's') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [questions, currentIndex, text, questionType, marks, negativeMarks, year, subjectId, topicId, tagString, options, imagePath, aiSuggestedAnswer, aiSuggestedExplanation]);

  // Track session timer average speed
  useEffect(() => {
    if (sessionReviewedCount > 0) {
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      setAvgTimePerQuestion(Math.round(elapsedSeconds / sessionReviewedCount));
    }
  }, [sessionReviewedCount]);

  const fetchSubjects = async () => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects`);
      setSubjects(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      console.error('Failed to load subjects', e);
      setSubjects([]);
    }
  };

  const fetchAiBatches = async () => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/admin/ai-batches`, {
        headers: AuthService.getAuthHeader()
      });
      setAiBatches(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      console.error('Failed to load AI batches', e);
    }
  };

  const handlePurgeBatch = async (batchName) => {
    if (!window.confirm(`⚠️ CRITICAL ADMIN ACTION:\nAre you sure you want to PERMANENTLY PURGE all questions in batch "${batchName}"?\n\nThis will instantly delete all questions generated in this nightly batch.`)) {
      return;
    }
    try {
      const response = await axios.delete(`${API_CONFIG.BASE_URL}/api/questions/admin/ai-batches/${encodeURIComponent(batchName)}`, {
        headers: AuthService.getAuthHeader()
      });
      alert(`✅ ${response.data?.message || 'Batch purged successfully'}`);
      fetchPendingQuestions();
      fetchAiBatches();
    } catch (e) {
      console.error('Failed to purge batch', e);
      alert('❌ Failed to purge batch: ' + (e.response?.data?.message || e.message));
    }
  };

  const fetchTopics = async (subjId) => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects/${subjId}/topics`);
      const flat = [];
      const flatten = (nodes, prefix = '') => {
        if (Array.isArray(nodes)) {
          nodes.forEach(n => {
            flat.push({
              id: n.id,
              name: prefix ? `${prefix} ➔ ${n.name}` : n.name
            });
            if (n.children) flatten(n.children, prefix ? `${prefix} ➔ ${n.name}` : n.name);
          });
        }
      };
      if (Array.isArray(response.data)) {
        flatten(response.data);
      }
      setTopics(flat);
      return flat;
    } catch (e) {
      console.error('Failed to load topics', e);
      setTopics([]);
      return [];
    }
  };

  const handleSubjectChange = (newSubjectId) => {
    setSubjectId(newSubjectId);
    setTopicId('');
    if (newSubjectId) {
      fetchTopics(newSubjectId);
    } else {
      setTopics([]);
    }
  };

  const fetchPendingQuestions = async () => {
    setLoading(true);
    try {
      let response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions?status=PENDING_REVIEW&size=100`, {
        headers: AuthService.getAuthHeader()
      });
      let fetched = response.data && Array.isArray(response.data.content) ? response.data.content : [];
      if (fetched.length === 0) {
        response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions?status=PENDING&size=100`, {
          headers: AuthService.getAuthHeader()
        });
        fetched = response.data && Array.isArray(response.data.content) ? response.data.content : [];
      }
      setQuestions(fetched);
      setCurrentIndex(0);
    } catch (e) {
      setError('Failed to fetch pending questions queue!');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalyticsDashboard = async () => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/analytics/dashboard`, {
        headers: AuthService.getAuthHeader()
      });
      setPendingTotal(response.data.pendingReviewCount || 0);
    } catch (e) {
      console.error('Failed to load analytics counters', e);
    }
  };

  const triggerApprove = async () => {
    if (isSubmitting) return;
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    const q = questions[currentIndex];

    let finalOptions = [];
    if (questionType !== 'NAT') {
      if (options.some(opt => !opt.trim())) {
        setError('Please fill in all option fields.');
        setIsSubmitting(false);
        return;
      }
      finalOptions = options;
    }

    const tags = tagString.split(',').map(t => t.trim()).filter(t => t !== '');
    const payload = {
      text,
      questionType,
      marks: parseInt(marks) || 1,
      negativeMarks: Math.abs(parseFloat(negativeMarks)) || 0,
      year: parseInt(year) || 2026,
      subjectId: parseInt(subjectId),
      topicId: parseInt(topicId),
      pdfSourceName: q.pdfSourceName || "Manual Entry",
      pdfSourcePath: q.pdfSourcePath || "Manual Entry",
      pdfPageNumber: parseInt(q.pdfPageNumber) || 1,
      imagePath: imagePath,
      status: 'APPROVED',
      options: finalOptions,
      tags,
      aiSuggestedAnswer,
      aiSuggestedExplanation,
    };

    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/questions/${q.id}`, payload, {
        headers: AuthService.getAuthHeader()
      });
      setSuccess('Question approved successfully!');
      setSessionReviewedCount(prev => prev + 1);
      
      // Start 10-second undo trigger window
      startUndoTimer(q.id);

      setTimeout(() => {
        setSuccess('');
        setCurrentIndex(currentIndex + 1);
      }, 1000);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve question!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerReject = async () => {
    if (isSubmitting) return;
    const q = questions[currentIndex];
    if (!window.confirm('Archive/reject this question block? It will be soft-deleted.')) return;

    setIsSubmitting(true);
    try {
      // Soft-delete to ARCHIVED state
      const payload = {
        text,
        questionType,
        marks,
        negativeMarks,
        year,
        subjectId: parseInt(subjectId),
        topicId: parseInt(topicId),
        status: 'ARCHIVED',
        options: questionType === 'NAT' ? [] : options,
        tags: tagString.split(',').map(t => t.trim()).filter(t => t !== ''),
        aiSuggestedAnswer,
        aiSuggestedExplanation,
      };

      await axios.put(`${API_CONFIG.BASE_URL}/api/questions/${q.id}`, payload, {
        headers: AuthService.getAuthHeader()
      });
      setSuccess('Question moved to archive.');
      setSessionReviewedCount(prev => prev + 1);

      startUndoTimer(q.id);

      setTimeout(() => {
        setSuccess('');
        setCurrentIndex(currentIndex + 1);
      }, 1000);
    } catch (e) {
      setError('Failed to archive/reject question.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setError('');
    setSuccess('');
    const q = questions[currentIndex];

    const tags = tagString.split(',').map(t => t.trim()).filter(t => t !== '');
    const payload = {
      text,
      questionType,
      marks: parseInt(marks),
      negativeMarks: Math.abs(parseFloat(negativeMarks)) || 0,
      year: parseInt(year),
      subjectId: parseInt(subjectId),
      topicId: parseInt(topicId),
      pdfSourceName: q.pdfSourceName,
      pdfSourcePath: q.pdfSourcePath,
      pdfPageNumber: q.pdfPageNumber,
      imagePath: imagePath,
      status: 'PENDING', // Keep in pending queue
      options: questionType === 'NAT' ? [] : options,
      tags,
      aiSuggestedAnswer,
      aiSuggestedExplanation,
    };

    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/questions/${q.id}`, payload, {
        headers: AuthService.getAuthHeader()
      });
      setSuccess('Draft updates saved!');
      setTimeout(() => setSuccess(''), 1500);
    } catch (err) {
      setError('Failed to save draft!');
    }
  };

  const handleSkip = () => {
    setCurrentIndex(currentIndex + 1);
  };

  const handleOptionChange = (idx, value) => {
    const newOptions = [...options];
    newOptions[idx] = value;
    setOptions(newOptions);
  };

  const insertMathTemplate = (elementId, template, type, optionIndex = null) => {
    const el = document.getElementById(elementId);
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentVal = el.value;
    const newVal = currentVal.substring(0, start) + template + currentVal.substring(end);
    
    if (type === 'question') {
      setText(newVal);
    } else if (type === 'option') {
      handleOptionChange(optionIndex, newVal);
    }

    // Restore cursor position inside or after template
    setTimeout(() => {
      el.focus();
      const newCursorPos = start + template.length;
      let targetPos = newCursorPos;
      if (template.includes('{}')) {
        targetPos = start + template.indexOf('{') + 1;
      } else if (template.includes('$ $')) {
        targetPos = start + 2;
      } else if (template.includes('$$ $$')) {
        targetPos = start + 3;
      }
      el.setSelectionRange(targetPos, targetPos);
    }, 50);
  };

  // 10-Second Undo Handler
  const startUndoTimer = (qId) => {
    clearInterval(undoIntervalRef.current);
    setUndoQuestionId(qId);
    setUndoTimer(10);
    setShowUndoToast(true);

    undoIntervalRef.current = setInterval(() => {
      setUndoTimer(prev => {
        if (prev <= 1) {
          clearInterval(undoIntervalRef.current);
          setShowUndoToast(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerUndo = async () => {
    clearInterval(undoIntervalRef.current);
    setShowUndoToast(false);

    if (!undoQuestionId) return;

    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${undoQuestionId}/undo-review`, {}, {
        headers: AuthService.getAuthHeader()
      });
      setSuccess('Action undone successfully! Reloading...');
      
      // Decrement counter and move index back to restore view
      setSessionReviewedCount(prev => Math.max(0, prev - 1));
      fetchPendingQuestions();
      setTimeout(() => setSuccess(''), 1500);
    } catch (e) {
      setError('Failed to undo review action!');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      setError('');
      const q = questions[currentIndex];
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${q.id}/image`, formData, {
        headers: {
          ...AuthService.getAuthHeader(),
          'Content-Type': 'multipart/form-data'
        }
      });
      setImagePath(response.data.message);
    } catch (err) {
      setError('Failed to upload diagram image.');
    }
  };

  const handleOptionImageUpload = async (idx, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setError('');
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/questions/upload-image`, formData, {
        headers: {
          ...AuthService.getAuthHeader(),
          'Content-Type': 'multipart/form-data'
        }
      });
      const uploadedPath = response.data.message; 
      handleOptionChange(idx, uploadedPath);
    } catch (err) {
      setError('Failed to upload option image: ' + (err.response?.data?.message || err.message));
    }
  };

  const loadPageImage = async (qId) => {
    if (!qId) return;
    setLoadingPageImage(true);
    setPageImageSrc('');
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${qId}/page-image`, {
        headers: AuthService.getAuthHeader(),
        responseType: 'blob'
      });
      const blobUrl = URL.createObjectURL(response.data);
      setPageImageSrc(blobUrl);
    } catch (e) {
      console.error('Failed to load PDF page image', e);
    } finally {
      setLoadingPageImage(false);
    }
  };

  const loadPageText = async (qId) => {
    if (!qId) return;
    setLoadingPageText(true);
    setPageText('');
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${qId}/page-text`, {
        headers: AuthService.getAuthHeader()
      });
      setPageText(response.data);
    } catch (e) {
      console.error('Failed to load PDF page text', e);
      setPageText('Failed to load PDF page text.');
    } finally {
      setLoadingPageText(false);
    }
  };

  useEffect(() => {
    const currentQ = questions[currentIndex];
    if (isPageModalOpen && currentQ) {
      loadPageImage(currentQ.id);
      loadPageText(currentQ.id);
    }
  }, [isPageModalOpen, currentIndex, questions]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ border: '4px solid rgba(56,189,248,0.1)', borderTop: '4px solid #38bdf8', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
          <div>Syncing Queue...</div>
        </div>
      </div>
    );
  }

  const isQueueEmpty = questions.length === 0 || currentIndex >= questions.length;
  if (isQueueEmpty) {
    return (
      <div style={{ padding: '60px 40px', maxWidth: '500px', margin: '0 auto', textAlign: 'center', color: 'var(--text-primary)' }}>
        <FiCheck style={{ fontSize: '64px', color: 'var(--color-success)', marginBottom: '20px' }} />
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '12px' }}>Inbox Reached!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: '1.6' }}>All AI-parsed questions have been approved and published to students.</p>
        <button className="btn btn-primary" onClick={() => navigate('/explore')} style={{ padding: '12px 32px' }}>Return to Explorer</button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  // Part-level confidence warnings
  const lowQuestionConf = currentQ.questionConfidence !== null && currentQ.questionConfidence < 0.70;
  const lowOptionsConf = currentQ.optionsConfidence !== null && currentQ.optionsConfidence < 0.70;
  const lowAnswerConf = currentQ.answerConfidence !== null && currentQ.answerConfidence < 0.70;
  const hasConfidenceWarnings = lowQuestionConf || lowOptionsConf || lowAnswerConf;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', backgroundColor: '#0b0f19' }}>
      
      {/* Productivity Stats Dashboard Bar */}
      <div className="review-top-stats-bar">
        <div className="stats-badges-group">
          <span>Pending in Queue: <strong style={{ color: '#f3f4f6' }}>{pendingTotal - sessionReviewedCount > 0 ? pendingTotal - sessionReviewedCount : questions.length - currentIndex}</strong></span>
          <span>Reviewed Today: <strong style={{ color: '#10b981' }}>{sessionReviewedCount}</strong></span>
          <span>Average Speed: <strong style={{ color: '#38bdf8' }}>{avgTimePerQuestion ? `${avgTimePerQuestion} sec/q` : '--'}</strong></span>
        </div>

        <div className="desktop-shortcuts-hint">
          <span style={{ fontSize: '0.75rem', backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px' }}>
            Shortcuts: <kbd style={{ color: '#38bdf8' }}>A</kbd> Approve | <kbd style={{ color: '#ef4444' }}>R</kbd> Reject | <kbd style={{ color: '#a855f7' }}>←/→</kbd> Navigate
          </span>
        </div>
      </div>

      <div className="review-split-layout">
        
        {/* Left Panel: Raw Source View with tabs */}
        <div className="review-left-panel">
          
          {/* Custom Tabs */}
          <div className="review-tabs-header">
            <button 
              onClick={() => setActiveTab('form')}
              style={{ padding: '8px 16px', border: 'none', borderBottom: activeTab === 'form' ? '2px solid #38bdf8' : 'none', backgroundColor: 'transparent', color: activeTab === 'form' ? '#38bdf8' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}
            >
              Question Form
            </button>
            <button 
              onClick={() => setActiveTab('ocr')}
              style={{ padding: '8px 16px', border: 'none', borderBottom: activeTab === 'ocr' ? '2px solid #38bdf8' : 'none', backgroundColor: 'transparent', color: activeTab === 'ocr' ? '#38bdf8' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}
            >
              Raw OCR Source
            </button>
            <button 
              onClick={() => setActiveTab('json')}
              style={{ padding: '8px 16px', border: 'none', borderBottom: activeTab === 'json' ? '2px solid #38bdf8' : 'none', backgroundColor: 'transparent', color: activeTab === 'json' ? '#38bdf8' : '#9ca3af', cursor: 'pointer', fontWeight: 600 }}
            >
              AI JSON Payload
            </button>
          </div>

          {activeTab === 'ocr' && (
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '20px', color: '#e2e8f0', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {currentQ.rawOcrText || 'No raw OCR block available.'}
            </div>
          )}

          {activeTab === 'json' && (
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '20px', color: '#38bdf8', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {currentQ.rawAiJson ? JSON.stringify(JSON.parse(currentQ.rawAiJson), null, 2) : 'No raw AI JSON log available.'}
            </div>
          )}

          {activeTab === 'form' && (
            <>
              {/* Question Text block */}
              <div style={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#9ca3af', marginBottom: '16px' }}>
                  <span>Source: {currentQ.pdfSourceName} (Page {currentQ.pdfPageNumber})</span>
                  <button 
                    type="button"
                    onClick={() => setIsPageModalOpen(true)}
                    style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    📄 View PDF Page
                  </button>
                </div>
                
                {/* Confidence warnings banner */}
                {hasConfidenceWarnings && (
                  <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#f87171', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <FiAlertCircle /> <span>Low Confidence Warning!</span>
                    </div>
                    {lowQuestionConf && <span>• Question text confidence: {Math.round((currentQ.questionConfidence || 0) * 100)}%</span>}
                    {lowOptionsConf && <span>• Options parsing confidence: {Math.round((currentQ.optionsConfidence || 0) * 100)}%</span>}
                    {lowAnswerConf && <span>• Answer deduction confidence: {Math.round((currentQ.answerConfidence || 0) * 100)}%</span>}
                  </div>
                )}

                <div className="question-text" style={{ fontSize: '#f3f4f6', fontSize: '0.95rem', color: '#e5e7eb' }}>
                  {renderQuestionText(currentQ.text)}
                </div>

                {/* Option text blocks */}
                {currentQ.options && currentQ.options.length > 0 && (
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentQ.options.map((opt, oIdx) => {
                      const isImageOption = opt.optionText && (opt.optionText.startsWith('/uploads/') || opt.optionText.startsWith('http://') || opt.optionText.startsWith('https://'));
                      return (
                        <div key={opt.id} style={{ display: 'flex', gap: '12px', padding: '10px 16px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#d1d5db', fontSize: '0.85rem', alignItems: 'center' }}>
                          <strong>{opt.optionLabel}.</strong>
                          {isImageOption ? (
                            <img src={getAssetUrl(opt.optionText)} alt={opt.optionLabel} style={{ maxHeight: '60px', borderRadius: '4px' }} />
                          ) : (
                            <span>{formatMathText(opt.optionText)}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Diagrams adjust sliders */}
              {imagePath && (
                <div className="review-diagram-container">
                  <div style={{ flex: 1, minWidth: 0, border: '1px solid #374151', borderRadius: '8px', padding: '10px', backgroundColor: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '160px', overflow: 'hidden' }}>
                    <img 
                      src={getAssetUrl(imagePath)} 
                      alt="Adjustable Diagram" 
                      style={{ 
                        maxHeight: '100%', 
                        maxWidth: '100%', 
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                        transition: 'transform 0.1s ease'
                      }} 
                    />
                  </div>
                  
                  {/* Adjustment Controls */}
                  <div className="review-diagram-controls">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Zoom</span> <span>{zoom.toFixed(1)}x</span>
                      </label>
                      <input type="range" min="0.5" max="2.5" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Rotate</span> <span>{rotation}°</span>
                      </label>
                      <input type="range" min="-180" max="180" step="5" value={rotation} onChange={(e) => setRotation(parseInt(e.target.value))} style={{ width: '100%' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Brightness</span> <span>{brightness}%</span>
                      </label>
                      <input type="range" min="50" max="200" step="5" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} style={{ width: '100%' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Contrast</span> <span>{contrast}%</span>
                      </label>
                      <input type="range" min="50" max="200" step="5" value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Right Panel: Editor Form */}
        <div className="review-right-panel">
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f3f4f6' }}>Metadata Editor</h3>
            <span className="badge badge-info" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>Question {currentIndex + 1} of {questions.length}</span>
          </div>

          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {success}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); triggerApprove(); }}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ color: '#9ca3af', margin: 0 }}>Question Text (Markdown/Code support)</label>
                {/* Math Toolbar Helper */}
                <div className="review-math-toolbar" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'xʸ (Power)', code: '^{}' },
                    { label: 'xᵧ (Sub)', code: '_{}' },
                    { label: '½ (Frac)', code: '\\frac{}{}' },
                    { label: '√ (Sqrt)', code: '\\sqrt{}' },
                    { label: '≠', code: '\\neq ' },
                    { label: 'π', code: '\\pi ' },
                    { label: '$ Inline', code: '$ $' },
                    { label: '$$ Block', code: '$$ $$' },
                  ].map((btn, bIdx) => (
                    <button
                      key={bIdx}
                      type="button"
                      onClick={() => insertMathTemplate('question-text-textarea', btn.code, 'question')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        color: '#38bdf8',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#334155'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1e293b'; }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id="question-text-textarea"
                className="form-input"
                rows="5"
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6', fontFamily: 'monospace' }}
                required
              />
              {/* Question Text Live Preview */}
              {text && (
                <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '8px', border: '1px dashed #334155', backgroundColor: 'rgba(30,41,59,0.5)', fontSize: '0.9rem', color: '#94a3b8' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>Live Render Preview:</div>
                  <div style={{ color: '#f1f5f9' }}>{renderQuestionText(text)}</div>
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af' }}>
                <span>Question Diagram / Photo</span>
                {imagePath && (
                  <button 
                    type="button" 
                    onClick={() => setImagePath('')} 
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Remove Diagram
                  </button>
                )}
              </label>
              {imagePath ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px' }}>
                  <img src={getAssetUrl(imagePath)} alt="Diagram Preview" style={{ width: '64px', height: '64px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #334155' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Diagram Attached</p>
                    <p style={{ fontSize: '0.7rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '2px 0 0 0' }}>{imagePath}</p>
                  </div>
                </div>
              ) : (
                <div style={{ border: '2px dashed #334155', borderRadius: '8px', padding: '16px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <input 
                    type="file" 
                    id="diagram-upload" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    style={{ display: 'none' }} 
                  />
                  <label htmlFor="diagram-upload" style={{ cursor: 'pointer', display: 'block' }}>
                    <span style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600 }}>Click to Upload Diagram Image</span>
                  </label>
                </div>
              )}
            </div>

            {/* MCQ/MSQ options editor */}
            {questionType !== 'NAT' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ color: '#9ca3af', marginBottom: 0 }}>Edit Options Text & Images</label>
                  {/* Options Mini Help */}
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Wrap math equations with <strong>$</strong> (e.g. <code>$P = Q = 0$</code>)</span>
                </div>
                {options.map((optText, oIdx) => (
                  <div key={oIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', backgroundColor: 'rgba(30,41,59,0.25)', border: '1px solid #1e293b', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <strong style={{ color: '#38bdf8', minWidth: '20px' }}>{String.fromCharCode(65 + oIdx)}.</strong>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                        <input 
                          id={`option-input-${oIdx}`}
                          type="text"
                          className="form-input"
                          value={optText}
                          onChange={(e) => handleOptionChange(oIdx, e.target.value)}
                          style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6', flex: 1 }}
                          placeholder={`Enter option ${String.fromCharCode(65 + oIdx)} text (e.g. $P = Q = 1$)`}
                        />
                        {/* Option Helper Buttons */}
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            type="button"
                            onClick={() => insertMathTemplate(`option-input-${oIdx}`, '^{}', 'option', oIdx)}
                            style={{ padding: '4px 6px', fontSize: '0.65rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#a855f7', borderRadius: '4px', cursor: 'pointer' }}
                            title="Power"
                          >
                            xʸ
                          </button>
                          <button
                            type="button"
                            onClick={() => insertMathTemplate(`option-input-${oIdx}`, '$ $', 'option', oIdx)}
                            style={{ padding: '4px 6px', fontSize: '0.65rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#10b981', borderRadius: '4px', cursor: 'pointer' }}
                            title="Math Mode"
                          >
                            $
                          </button>
                        </div>
                        <input 
                          type="file" 
                          id={`opt-upload-${oIdx}`}
                          accept="image/*"
                          onChange={(e) => handleOptionImageUpload(oIdx, e.target.files[0])}
                          style={{ display: 'none' }}
                        />
                        <label 
                          htmlFor={`opt-upload-${oIdx}`}
                          style={{ cursor: 'pointer', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', height: '42px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}
                          title="Upload Image for this Option"
                        >
                          📷
                        </label>
                      </div>
                    </div>
                    {/* Option Text Live Preview */}
                    {optText && (
                      <div style={{ paddingLeft: '32px', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Preview:</span>
                        <span style={{ color: '#f1f5f9' }}>
                          {optText.startsWith('/uploads/') || optText.startsWith('http') ? (
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>Image Option Attached</span>
                          ) : (
                            formatMathText(optText)
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: '#9ca3af' }}>Type</label>
                <select 
                  className="form-select" 
                  value={questionType} 
                  onChange={(e) => {
                    const newType = e.target.value;
                    setQuestionType(newType);
                    if (newType === 'MSQ' || newType === 'NAT') {
                      setNegativeMarks(0.0);
                    } else {
                      setNegativeMarks(marks === 2 ? -0.66 : -0.33);
                    }
                  }} 
                  style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6' }}
                >
                  <option value="MCQ">MCQ (Single Correct)</option>
                  <option value="MSQ">MSQ (Multiple Select)</option>
                  <option value="NAT">NAT (Numerical Answer)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: '#9ca3af' }}>Marks</label>
                <select 
                  className="form-select" 
                  value={marks} 
                  onChange={(e) => {
                    const m = parseInt(e.target.value);
                    setMarks(m);
                    if (questionType === 'MCQ') {
                      setNegativeMarks(m === 2 ? -0.66 : -0.33);
                    }
                  }} 
                  style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6' }}
                >
                  <option value={1}>1 Mark</option>
                  <option value={2}>2 Marks</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: '#9ca3af' }}>Negative Mark</label>
                <input type="number" step="0.01" className="form-input" value={negativeMarks} onChange={(e) => setNegativeMarks(parseFloat(e.target.value))} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6' }} required />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: '#9ca3af' }}>Year</label>
                <input type="number" className="form-input" value={year} onChange={(e) => setYear(parseInt(e.target.value))} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6' }} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: '#9ca3af' }}>Subject</label>
                <select className="form-select" value={subjectId} onChange={(e) => handleSubjectChange(e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6' }} required>
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: '#9ca3af' }}>Topic</label>
                <select className="form-select" value={topicId} onChange={(e) => setTopicId(e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6' }} required>
                  <option value="">Select Topic</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ color: '#9ca3af' }}>Tags (Comma-separated)</label>
              <input type="text" className="form-input" value={tagString} onChange={(e) => setTagString(e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6' }} placeholder="combinatorics, matrix multiplication, trees" />
            </div>

            <div style={{ borderTop: '1px solid #1f2937', paddingTop: '20px', marginTop: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f3f4f6' }}>🔑 Correct Answer & Solution</div>
                {aiSuggestedAnswer && (
                  <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    🤖 AI Auto-Selected: {aiSuggestedAnswer}
                  </span>
                )}
              </div>
              
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#9ca3af' }}>
                  {questionType === 'MSQ' ? 'Select All Correct Options (MSQ):' : 'Correct Answer / Value:'}
                </label>
                {questionType === 'MCQ' ? (
                  <select 
                    className="form-select" 
                    value={aiSuggestedAnswer} 
                    onChange={(e) => setAiSuggestedAnswer(e.target.value)}
                    style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6', fontWeight: 600 }}
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                ) : questionType === 'MSQ' ? (
                  <div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      {['A', 'B', 'C', 'D'].map(letter => {
                        const selected = (aiSuggestedAnswer || '').toUpperCase().includes(letter);
                        return (
                          <button
                            key={letter}
                            type="button"
                            onClick={() => {
                              let currentArr = (aiSuggestedAnswer || '').toUpperCase().split(/[\s,]+/).filter(x => ['A','B','C','D'].includes(x));
                              if (selected) {
                                currentArr = currentArr.filter(x => x !== letter);
                              } else {
                                currentArr.push(letter);
                              }
                              currentArr.sort();
                              setAiSuggestedAnswer(currentArr.join(', '));
                            }}
                            style={{
                              flex: 1,
                              padding: '10px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: selected ? '2px solid #10b981' : '1px solid #334155',
                              backgroundColor: selected ? 'rgba(16, 185, 129, 0.2)' : '#1e293b',
                              color: selected ? '#34d399' : '#94a3b8',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {selected ? `✓ Option ${letter}` : `Option ${letter}`}
                          </button>
                        );
                      })}
                    </div>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={aiSuggestedAnswer} 
                      onChange={(e) => setAiSuggestedAnswer(e.target.value)}
                      style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6', fontWeight: 600, fontSize: '0.85rem' }}
                      placeholder="e.g. A, B"
                    />
                  </div>
                ) : (
                  <input 
                    type="text" 
                    className="form-input" 
                    value={aiSuggestedAnswer} 
                    onChange={(e) => setAiSuggestedAnswer(e.target.value)}
                    style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6', fontWeight: 600 }}
                    placeholder="e.g. 10 or 4.5 or 10-12"
                    required
                  />
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#9ca3af' }}>Suggested Solution / Explanation (Markdown supported)</label>
                <textarea 
                  className="form-input" 
                  rows="6" 
                  value={aiSuggestedExplanation} 
                  onChange={(e) => setAiSuggestedExplanation(e.target.value)}
                  style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f3f4f6', fontFamily: 'monospace' }}
                  placeholder="Provide step-by-step mathematical reasoning..."
                />
              </div>
            </div>

            {/* Control buttons */}
            <div className="review-control-buttons">
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isSubmitting}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 24px', backgroundColor: isSubmitting ? '#059669' : '#10b981', border: 'none', fontWeight: 700, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {isSubmitting ? <FiRotateCw className="spin" /> : <FiCheck />} {isSubmitting ? 'Approving...' : 'Approve & Publish (A)'}
              </button>
              
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={handleSaveDraft} 
                disabled={isSubmitting}
                style={{ flex: 1, border: '1px solid #334155', color: '#e2e8f0', fontWeight: 600, opacity: isSubmitting ? 0.5 : 1 }}
              >
                Save Draft
              </button>

              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={triggerReject} 
                disabled={isSubmitting}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px solid #f87171', color: '#f87171', opacity: isSubmitting ? 0.5 : 1 }}
              >
                <FiTrash /> Reject (R)
              </button>

              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={handleSkip} 
                disabled={isSubmitting}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px solid #334155', color: '#9ca3af', opacity: isSubmitting ? 0.5 : 1 }}
              >
                Skip <FiFastForward />
              </button>
            </div>
          </form>

        </div>

      </div>

      {/* Floating 10-Second Undo Toast Notification */}
      {showUndoToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1f2937',
          border: '1px solid #10b981',
          borderRadius: '8px',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          color: '#f3f4f6',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
          zIndex: 99999
        }}>
          <span style={{ fontSize: '0.85rem' }}>Question reviewed. Reverting in <strong>{undoTimer}s</strong></span>
          <button 
            onClick={triggerUndo}
            style={{
              backgroundColor: '#10b981',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <FiCornerUpLeft /> Undo Review
          </button>
        </div>
      )}

      {/* Page Modal View */}
      {isPageModalOpen && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
          onClick={() => setIsPageModalOpen(false)}
        >
          <div style={{ position: 'relative', width: '85%', maxWidth: '850px', height: '90%', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', borderRadius: '8px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <button style={{ position: 'absolute', top: '-40px', right: '0px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsPageModalOpen(false)}>
              <FiX />
            </button>

            {/* Modal Modes Header */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0, marginRight: 'auto' }}>PDF Source Preview</h2>
              <button 
                type="button" 
                onClick={() => setModalViewMode('image')} 
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '6px', 
                  border: '1px solid #e2e8f0', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  backgroundColor: modalViewMode === 'image' ? '#38bdf8' : '#fff',
                  color: modalViewMode === 'image' ? '#fff' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                🖼️ Image View
              </button>
              <button 
                type="button" 
                onClick={() => setModalViewMode('text')} 
                style={{ 
                  padding: '6px 16px', 
                  borderRadius: '6px', 
                  border: '1px solid #e2e8f0', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  backgroundColor: modalViewMode === 'text' ? '#38bdf8' : '#fff',
                  color: modalViewMode === 'text' ? '#fff' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                🔤 Selectable Text
              </button>
            </div>

            {/* Modal Body Container */}
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: modalViewMode === 'text' ? '#0f172a' : '#fff', borderRadius: '6px', padding: '16px', border: '1px solid #e2e8f0' }}>
              {modalViewMode === 'image' ? (
                loadingPageImage ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#666' }}>Rendering PDF page...</div>
                ) : pageImageSrc ? (
                  <img src={pageImageSrc} alt="Full Page" style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#ef4444' }}>Failed to render PDF page.</div>
                )
              ) : (
                loadingPageText ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>Extracting page text...</div>
                ) : pageText ? (
                  <textarea 
                    readOnly
                    value={pageText}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      minHeight: '400px',
                      backgroundColor: 'transparent', 
                      border: 'none', 
                      color: '#f8fafc', 
                      fontFamily: 'monospace', 
                      fontSize: '0.9rem', 
                      resize: 'none',
                      outline: 'none',
                      lineHeight: '1.6'
                    }}
                    title="Select and Copy Text from this box"
                  />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#ef4444' }}>Failed to extract page text.</div>
                )
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
