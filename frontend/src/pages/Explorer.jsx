import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import CacheService from '../services/CacheService';
import apiClient from '../services/apiClient';
import { 
  FiSearch, FiBookOpen, FiLayers, FiTag, FiCalendar, FiPlus, 
  FiEdit, FiTrash, FiAlertTriangle, FiCheckCircle, FiChevronRight,
  FiBookmark, FiMessageSquare, FiTrendingUp, FiThumbsUp, FiThumbsDown, FiCornerDownRight,
  FiX, FiFilter, FiLoader, FiMaximize2, FiMinimize2, FiShare2, FiCheck
} from 'react-icons/fi';

import { getAssetUrl, formatMathText, renderQuestionText, checkAnswerCorrect, renderMentorAnalysis, renderAiChatText } from '../utils/mathRenderer';
import API_CONFIG from '../config/api';
import PremiumGateModal from '../components/PremiumGateModal';
import ConfirmModal from '../components/ConfirmModal';

export default function Explorer() {
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]); // List of bookmarked question IDs
  const [loading, setLoading] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(true);

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: () => {}
  });
  
  // Search parameters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [selectedSolvedStatus, setSelectedSolvedStatus] = useState('');
  const [selectedBookmarked, setSelectedBookmarked] = useState(false);

  // Pagination states
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Selected options map for practice mode { questionId: selectedOptionLabel }
  const [selectedOptions, setSelectedOptions] = useState({});
  const [tempMsqSelections, setTempMsqSelections] = useState({});
  const [tempMcqSelections, setTempMcqSelections] = useState({});
  const [natInputs, setNatInputs] = useState({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportQuestionId, setReportQuestionId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDesc, setReportDesc] = useState('');

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


  // Exposed answers map { questionId: boolean }
  const [revealedAnswers, setRevealedAnswers] = useState({});
  // Track reset/retry answer count per question { questionId: number } (Max 3 limit)
  const [resetCounts, setResetCounts] = useState({});
  // Sub-tabs in reveal answer box { questionId: 'analysis' | 'diagnostics' }
  const [revealSubTabs, setRevealSubTabs] = useState({});
  const [startTime] = useState(Date.now());
  
  // Topic frequency data
  const [topicFrequency, setTopicFrequency] = useState([]);

  // Expandable sections per question { questionId: 'explanations' | 'discussions' | 'similar' | null }
  const [expandedSection, setExpandedSection] = useState({});
  const [hoveredImgId, setHoveredImgId] = useState(null);
  const [selectedZoomImage, setSelectedZoomImage] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
  const [activeSections, setActiveSections] = useState({});
  const [questionExplanations, setQuestionExplanations] = useState({}); // { questionId: [...] }
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [activeAiTutorQuestion, setActiveAiTutorQuestion] = useState(null);
  const [isAiFullscreen, setIsAiFullscreen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [motivationDialog, setMotivationDialog] = useState(null);
  const [questionComments, setQuestionComments] = useState({}); // { questionId: [...] }
  const [similarQuestions, setSimilarQuestions] = useState({}); // { questionId: [...] }

  // Form input states
  const [newExplanationText, setNewExplanationText] = useState('');
  const [newExplanationGuess, setNewExplanationGuess] = useState('');
  const [newCommentText, setNewCommentText] = useState({}); // { questionId: '' }
  const [replyCommentText, setReplyCommentText] = useState({}); // { commentId: '' }
  const [activeReplyId, setActiveReplyId] = useState(null); // commentId currently replying to

  const currentUser = AuthService.getCurrentUser();
  const navigate = useNavigate();

  // Load Subjects, years and default questions
  useEffect(() => {
    fetchSubjects();
    fetchAvailableYears();
    if (currentUser) {
      // Stagger background user state calls so main question feed gets 100% DB pool bandwidth
      setTimeout(() => {
        fetchBookmarks();
        fetchSolvedHistory();
      }, 60);
    }
  }, []);

  // Fetch topics when subject selection changes
  useEffect(() => {
    if (selectedSubjectId) {
      fetchTopics(selectedSubjectId);
    } else {
      setTopics([]);
    }
  }, [selectedSubjectId]);

  // Fetch topic frequency if a topic is selected
  useEffect(() => {
    if (selectedTopicId) {
      fetchTopicFrequency(selectedTopicId);
    } else {
      setTopicFrequency([]);
    }
  }, [selectedTopicId]);

  // Query/Refetch questions whenever page, size, or filters change
  useEffect(() => {
    fetchQuestions(page);
  }, [page, pageSize, selectedSubjectId, selectedTopicId, selectedYear, selectedType, selectedTag, activeSearchQuery, selectedSolvedStatus, selectedBookmarked]);

  const fetchAvailableYears = async () => {
    const cacheKey = 'available_years';
    const cachedData = CacheService.get(cacheKey);
    if (cachedData) {
      setAvailableYears(cachedData);
      return;
    }
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/years`);
      setAvailableYears(Array.isArray(response.data) ? response.data : []);
      CacheService.set(cacheKey, response.data, 5 * 60000); // 5 minutes TTL
    } catch (e) {
      console.error('Failed to load available years', e);
      setAvailableYears([]);
    }
  };

  const fetchSolvedHistory = async () => {
    if (!currentUser) return;
    const cacheKey = `user_solved_${currentUser.id || currentUser.username}`;
    const cached = CacheService.get(cacheKey);
    if (cached) {
      setSelectedOptions(cached.solvedMap || {});
      setTempMsqSelections(cached.msqMap || {});
    }

    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/solved/map`, {
        headers: AuthService.getAuthHeader()
      });
      const solvedMap = response.data || {};
      const msqMap = {};
      Object.entries(solvedMap).forEach(([qId, selectedOpt]) => {
        if (selectedOpt) {
          const letters = selectedOpt.toUpperCase().replace(/[^A-D]/g, '').split('');
          if (letters.length > 0) msqMap[qId] = letters;
        }
      });
      setSelectedOptions(solvedMap);
      setTempMsqSelections(msqMap);
      CacheService.set(cacheKey, { solvedMap, msqMap }, 120000); // 2 mins TTL
    } catch (e) {
      console.error('Failed to load solved history', e);
    }
  };


  const fetchSubjects = async () => {
    const cacheKey = 'subjects';
    const cachedData = CacheService.get(cacheKey);
    if (cachedData) {
      setSubjects(cachedData);
      return;
    }
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects`);
      setSubjects(Array.isArray(response.data) ? response.data : []);
      CacheService.set(cacheKey, response.data, 5 * 60000); // 5 minutes TTL
    } catch (e) {
      console.error('Failed to load subjects', e);
      setSubjects([]);
    }
  };

  const fetchTopics = async (subjectId) => {
    const cacheKey = `topics_${subjectId}`;
    const cachedData = CacheService.get(cacheKey);
    if (cachedData) {
      setTopics(cachedData);
      return;
    }
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects/${subjectId}/topics`);
      const flat = [];
      const flatten = (nodes, level = 0) => {
        if (Array.isArray(nodes)) {
          nodes.forEach(n => {
            flat.push({ ...n, displayName: '\u00A0\u00A0'.repeat(level * 2) + (level > 0 ? '↳ ' : '') + n.name });
            if (n.children) flatten(n.children, level + 1);
          });
        }
      };
      if (Array.isArray(response.data)) {
        flatten(response.data);
      }
      setTopics(flat);
      CacheService.set(cacheKey, flat, 5 * 60000); // 5 minutes TTL
    } catch (e) {
      console.error('Failed to load topics', e);
      setTopics([]);
    }
  };

  const fetchQuestions = async (targetPage = page) => {
    const params = {};
    if (activeSearchQuery) params.query = activeSearchQuery;
    if (selectedSubjectId) params.subjectId = selectedSubjectId;
    if (selectedTopicId) params.topicId = selectedTopicId;
    if (selectedYear) params.year = selectedYear;
    if (selectedType) params.type = selectedType;
    if (selectedTag) params.tag = selectedTag;
    if (selectedSolvedStatus) params.solvedStatus = selectedSolvedStatus;
    if (selectedBookmarked) params.bookmarked = selectedBookmarked;
    params.page = targetPage;
    params.size = pageSize;

    const cacheKey = `questions_${JSON.stringify(params)}_${currentUser?.username || 'anonymous'}`;
    const cachedData = CacheService.get(cacheKey);
    if (cachedData) {
      setQuestions(cachedData.content || []);
      setTotalPages(cachedData.totalPages || 0);
      setTotalElements(cachedData.totalElements || 0);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions`, { 
        params,
        headers: currentUser ? AuthService.getAuthHeader() : {}
      });
      const data = response.data;
      setQuestions(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
      CacheService.set(cacheKey, data, 30000); // 30 seconds TTL for questions query
    } catch (e) {
      console.error('Failed to load questions', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookmarks = async () => {
    if (!currentUser) return;
    if (Array.isArray(currentUser.bookmarkedQuestionIds) && currentUser.bookmarkedQuestionIds.length > 0) {
      setBookmarks(currentUser.bookmarkedQuestionIds);
      return;
    }
    const cacheKey = `user_bookmarks_${currentUser.id || currentUser.username}`;
    const cached = CacheService.get(cacheKey);
    if (cached) {
      setBookmarks(cached);
    }
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/bookmarks/ids`, {
        headers: AuthService.getAuthHeader()
      });
      const bookmarkedIds = Array.isArray(response.data) ? response.data : [];
      setBookmarks(bookmarkedIds);
      CacheService.set(cacheKey, bookmarkedIds, 120000); // 2 mins TTL
    } catch (e) {
      console.error('Failed to load bookmarks', e);
    }
  };

  const fetchTopicFrequency = async (topicId) => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/analytics/topics/${topicId}/frequency`);
      setTopicFrequency(response.data);
    } catch (e) {
      console.error('Failed to load topic frequency', e);
    }
  };

  const changePage = (newPage) => {
    setPage(newPage);
    const feedEl = document.getElementById('pyq-questions-start');
    if (feedEl) {
      feedEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    setActiveSearchQuery(searchQuery);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
    setSelectedSubjectId(null);
    setSelectedTopicId(null);
    setSelectedYear('');
    setSelectedType('');
    setSelectedTag('');
    setSelectedSolvedStatus('');
    setSelectedBookmarked(false);
    setPage(0);
  };

  const handleDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Question",
      message: `Are you sure you want to delete Question #${id}? This action cannot be undone.`,
      confirmText: "Delete",
      type: "danger",
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await axios.delete(`${API_CONFIG.BASE_URL}/api/questions/${id}`, {
            headers: AuthService.getAuthHeader()
          });
          setQuestions(questions.filter(q => q.id !== id));
        } catch (e) {
          const errMsg = e.response?.data?.message || e.message || 'Failed to delete question!';
          alert(errMsg);
        }
      }
    });
  };

  const handleOptionClick = async (questionId, optionLabel, qType) => {
    if (selectedOptions[questionId]) return; // Answer locked!

    if (qType === 'MSQ') {
      const current = tempMsqSelections[questionId] || [];
      const updated = current.includes(optionLabel)
        ? current.filter(x => x !== optionLabel)
        : [...current, optionLabel].sort();
      setTempMsqSelections({
        ...tempMsqSelections,
        [questionId]: updated
      });
      return;
    }

    // MCQ: select option temporarily without submitting
    setTempMcqSelections({
      ...tempMcqSelections,
      [questionId]: optionLabel
    });
  };

  const handleSubmitMcq = async (questionId) => {
    if (selectedOptions[questionId]) return;
    const optionLabel = tempMcqSelections[questionId];
    if (!optionLabel) return;

    setSelectedOptions({
      ...selectedOptions,
      [questionId]: optionLabel
    });

    CacheService.clear();

    if (currentUser) {
      try {
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${questionId}/solve`, {
          selectedOption: optionLabel,
          timeTaken: String(timeTaken)
        }, {
          headers: AuthService.getAuthHeader()
        });
      } catch (e) {
        console.error('Failed to log solve history', e);
      }
    }
  };

  const handleSubmitMsq = async (questionId) => {
    if (selectedOptions[questionId]) return;
    const current = tempMsqSelections[questionId] || [];
    if (current.length === 0) return;

    const selectedStr = current.join(', ');
    setSelectedOptions({
      ...selectedOptions,
      [questionId]: selectedStr
    });

    CacheService.clear();

    if (currentUser) {
      try {
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${questionId}/solve`, {
          selectedOption: selectedStr,
          timeTaken: String(timeTaken)
        }, {
          headers: AuthService.getAuthHeader()
        });
      } catch (e) {
        console.error('Failed to log solve history', e);
      }
    }
  };

  const handleSendReport = async () => {
    if (!currentUser) {
      alert("Please Sign In to report question errors.");
      navigate('/login');
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
    } catch (e) {
      console.error(e);
      alert("Failed to submit report. Please try again.");
    }
  };



  const toggleRevealAnswer = (questionId) => {
    revealedAnswers[questionId] = !revealedAnswers[questionId];
    setRevealedAnswers({ ...revealedAnswers });
  };

  // Toggle Bookmarks
  const handleBookmarkToggle = async (questionId) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const isBookmarked = bookmarks.includes(questionId);
    try {
      if (isBookmarked) {
        await axios.delete(`${API_CONFIG.BASE_URL}/api/questions/${questionId}/bookmark`, {
          headers: AuthService.getAuthHeader()
        });
        setBookmarks(bookmarks.filter(id => id !== questionId));
      } else {
        await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${questionId}/bookmark`, {}, {
          headers: AuthService.getAuthHeader()
        });
        setBookmarks([...bookmarks, questionId]);
      }
    } catch (e) {
      console.error('Failed to update bookmark', e);
    }
  };

  // Toggle expandable sections and load data
  const handleSectionToggle = async (questionId, section) => {
    const current = expandedSection[questionId];
    const target = current === section ? null : section;
    
    setExpandedSection({ ...expandedSection, [questionId]: target });

    if (target === 'explanations') {
      loadExplanations(questionId);
    } else if (target === 'discussions') {
      loadComments(questionId);
    } else if (target === 'similar') {
      loadSimilarQuestions(questionId);
    }
  };

  const handleAskAITutor = (q) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    // Keep history if opening for same question; reset if new question
    if (activeAiTutorQuestion?.id !== q.id || aiChatMessages.length === 0) {
      setActiveAiTutorQuestion(q);
      setAiChatMessages([
        {
          role: 'assistant',
          text: `Hello! I am your GATE CSE AI Tutor. I have indexed this question from subject **${q.subjectName || 'Uncategorized'}**.\n\nHow can I help you understand the solution, derivations, or underlying concept today?${!AuthService.isPremium() ? ' *(Free Tier: 3 queries/day)*' : ''}`
        }
      ]);
    } else {
      setActiveAiTutorQuestion(q);
    }
  };

  const handleSendAiChatMessage = async (e) => {
    if (e) e.preventDefault();
    try {
        if (!chatInput.trim() || chatLoading) return;
        const userText = chatInput;
        const currentMessages = [...aiChatMessages];
        setAiChatMessages(prev => [...prev, { role: 'user', text: userText }]);
        setChatInput('');
        setChatLoading(true);
  
        if (!activeAiTutorQuestion) {
          setChatLoading(false);
          return;
        }
  
        const headers = currentUser ? AuthService.getAuthHeader() : {};
        
        const optionsStr = (activeAiTutorQuestion.options && activeAiTutorQuestion.options.length > 0) 
          ? activeAiTutorQuestion.options.map(o => `${o.optionLabel}: ${o.optionText}`).join('\n') 
          : "N/A";

        const payload = {
          message: userText,
          questionText: activeAiTutorQuestion.text || "N/A",
          optionsText: optionsStr,
          questionType: activeAiTutorQuestion.questionType || "MCQ",
          subjectName: activeAiTutorQuestion.subjectName || "GATE CSE",
          topicName: activeAiTutorQuestion.topicName || "General",
          suggestedAnswer: activeAiTutorQuestion.aiSuggestedAnswer || "N/A",
          imagePath: activeAiTutorQuestion.imagePath,
          history: currentMessages.map(msg => ({ role: msg.role, text: msg.text }))
        };

        const response = await axios.post(`${API_CONFIG.BASE_URL}/api/chat/tutor`, payload, { headers });
        
        setAiChatMessages(prev => [...prev, { role: 'assistant', text: response.data.reply }]);
    } catch (err) {
      console.error("AI Tutor chat processing error", err);
      const errMsg = err.response?.data?.error || "I encountered an error trying to formulate the explanation. Please try asking again.";
      setAiChatMessages(prev => [...prev, { role: 'assistant', text: errMsg }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Explanations CRUD & Voting
  const loadExplanations = async (questionId) => {
    try {
      const headers = currentUser ? AuthService.getAuthHeader() : {};
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${questionId}/answers`, { headers });
      setQuestionExplanations(prev => ({ ...prev, [questionId]: response.data }));
    } catch (e) {
      console.error(e);
    }
  };

  const submitExplanation = async (questionId) => {
    if (!newExplanationText || !newExplanationGuess) return;
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${questionId}/answers`, {
        submittedAnswer: newExplanationGuess,
        explanation: newExplanationText
      }, { headers: AuthService.getAuthHeader() });
      
      setNewExplanationText('');
      setNewExplanationGuess('');
      loadExplanations(questionId);
    } catch (e) {
      alert('Failed to submit explanation!');
    }
  };

  const voteExplanation = async (questionId, answerId, type) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/answers/${answerId}/vote?type=${type}`, {}, {
        headers: AuthService.getAuthHeader()
      });
      loadExplanations(questionId);
    } catch (e) {
      console.error(e);
    }
  };

  // Comments CRUD & Voting
  const loadComments = async (questionId) => {
    try {
      const headers = currentUser ? AuthService.getAuthHeader() : {};
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${questionId}/comments`, { headers });
      setQuestionComments(prev => ({ ...prev, [questionId]: response.data }));
    } catch (e) {
      console.error(e);
    }
  };

  const submitComment = async (questionId, parentCommentId = null) => {
    const textVal = parentCommentId ? replyCommentText[parentCommentId] : newCommentText[questionId];
    if (!textVal || textVal.trim() === '') return;

    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${questionId}/comments`, {
        commentText: textVal,
        parentCommentId
      }, { headers: AuthService.getAuthHeader() });

      if (parentCommentId) {
        setReplyCommentText(prev => ({ ...prev, [parentCommentId]: '' }));
        setActiveReplyId(null);
      } else {
        setNewCommentText(prev => ({ ...prev, [questionId]: '' }));
      }
      loadComments(questionId);
    } catch (e) {
      alert('Failed to post comment.');
    }
  };

  const voteComment = async (questionId, commentId, type) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/comments/${commentId}/vote?type=${type}`, {}, {
        headers: AuthService.getAuthHeader()
      });
      loadComments(questionId);
    } catch (e) {
      console.error(e);
    }
  };

  // Similar questions lookup
  const loadSimilarQuestions = async (questionId) => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${questionId}/similar`);
      setSimilarQuestions(prev => ({ ...prev, [questionId]: response.data }));
    } catch (e) {
      console.error(e);
    }
  };

  // Topic tree node renderer
  const renderTopicNode = (node) => {
    const isActive = selectedTopicId === node.id;
    return (
      <div key={node.id} style={{ marginLeft: '10px' }}>
        <div 
          className={`topic-tree-node ${isActive ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTopicId(isActive ? null : node.id);
          }}
        >
          <FiChevronRight style={{ marginRight: '4px', verticalAlign: 'middle', display: node.children?.length ? 'inline-block' : 'none' }} />
          {node.name}
        </div>
        {node.children && node.children.map(child => renderTopicNode(child))}
      </div>
    );
  };

  // Comments recursion renderer
  const renderComment = (comment, questionId) => {
    return (
      <div key={comment.id} style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px', marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-secondary)' }}>@{comment.username}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(comment.createdAt).toLocaleDateString()}</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '4px 0' }}>{comment.commentText}</p>
        
        {/* Comment actions (Voting & reply triggers) */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', alignItems: 'center' }}>
          <button 
            style={{ background: 'none', border: 'none', color: comment.voteStatus === 'UPVOTE' ? 'var(--color-success)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => voteComment(questionId, comment.id, 'UPVOTE')}
          >
            <FiThumbsUp /> {comment.upvotes}
          </button>
          <button 
            style={{ background: 'none', border: 'none', color: comment.voteStatus === 'DOWNVOTE' ? 'var(--color-error)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => voteComment(questionId, comment.id, 'DOWNVOTE')}
          >
            <FiThumbsDown /> {comment.downvotes}
          </button>
          
          {currentUser && (
            <button 
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer' }}
              onClick={() => setActiveReplyId(activeReplyId === comment.id ? null : comment.id)}
            >
              Reply
            </button>
          )}
        </div>

        {/* Reply form */}
        {activeReplyId === comment.id && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Type reply..." 
              value={replyCommentText[comment.id] || ''}
              onChange={(e) => setReplyCommentText({ ...replyCommentText, [comment.id]: e.target.value })}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            />
            <button className="btn btn-primary" onClick={() => submitComment(questionId, comment.id)} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>Post</button>
          </div>
        )}

        {/* Render child comments nested */}
        {comment.replies && comment.replies.map(reply => renderComment(reply, questionId))}
      </div>
    );
  };

  return (
    <div className="explorer-container" style={{ flexDirection: 'column', height: '100vh' }}>
      {/* Top filter dashboard bar */}
      {isFiltersCollapsed ? <div style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border-color)',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)',
          flexWrap: 'wrap'
        }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flexGrow: 1, maxWidth: '560px' }}>
            <div className="header-search-bar" style={{ width: '100%', height: '36px' }}>
              <FiSearch style={{ color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search PYQs by keyword (e.g. matrix, pipeline, tree)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ height: '36px', fontSize: '0.84rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 16px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
              Search
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeSearchQuery && (
              <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                "{activeSearchQuery}"
              </span>
            )}
            <button 
              type="button"
              className="btn btn-outline" 
              onClick={() => setIsFiltersCollapsed(false)}
              style={{ padding: '6px 14px', fontSize: '0.82rem', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <FiFilter /> Filters
            </button>
          </div>
        </div> : (
        <div style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border-color)',
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.3s ease'
        }}>
          {/* Row 0: Title Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '-2px' }}>
            <span style={{ fontSize: '1.1rem' }}>📜</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              Official GATE PYQs Archive
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '6px' }}>
              Authentic 20+ Years Past Exam Papers
            </span>
          </div>

          {/* Row 1: Search and actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flexGrow: 1, maxWidth: '500px' }}>
              <div className="header-search-bar" style={{ width: '100%', height: '36px' }}>
                <FiSearch style={{ color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search matrix inverse, binary search trees..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ height: '36px', fontSize: '0.82rem' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 16px', fontSize: '0.82rem' }}>Search</button>
            </form>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                type="button" 
                className="btn btn-outline mobile-filter-toggle" 
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                style={{ height: '36px', fontSize: '0.8rem' }}
              >
                <FiFilter /> {showMobileFilters ? 'Hide Filters' : 'Filters'}
              </button>

              <button className="btn btn-outline" onClick={clearFilters} style={{ height: '36px', fontSize: '0.8rem' }}>
                Reset
              </button>

              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setIsFiltersCollapsed(true)} 
                style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
              >
                <FiX /> Collapse
              </button>

              {AuthService.isAdminOrEditor() && (
                <button className="btn btn-primary" onClick={() => navigate('/admin/questions/new')}>
                  <FiPlus /> Add Question
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Select Filters */}
          <div className={`desktop-filters-row ${showMobileFilters ? 'mobile-show' : ''}`} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Subject Filter */}
            <div style={{ flex: '1 1 180px', minWidth: '150px' }}>
              <select 
                className="form-select" 
                value={selectedSubjectId || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSubjectId(val ? parseInt(val) : null);
                  setSelectedTopicId(null);
                  setPage(0);
                }}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Topic Filter */}
            <div style={{ flex: '1 1 180px', minWidth: '150px' }}>
              <select 
                className="form-select" 
                value={selectedTopicId || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTopicId(val ? parseInt(val) : null);
                  setPage(0);
                }}
                disabled={!selectedSubjectId}
              >
                <option value="">All Topics</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>{t.displayName || t.name}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div style={{ flex: '1 1 150px', minWidth: '130px' }}>
              <select className="form-select" value={selectedType} onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(0);
              }}>
                <option value="">All Types</option>
                <option value="MCQ">MCQ (Multiple Choice)</option>
                <option value="MSQ">MSQ (Multiple Select)</option>
                <option value="NAT">NAT (Numerical Answer)</option>
              </select>
            </div>

            {/* Year Filter */}
            <div style={{ flex: '1 1 120px', minWidth: '110px' }}>
              <select className="form-select" value={selectedYear} onChange={(e) => {
                setSelectedYear(e.target.value);
                setPage(0);
              }}>
                <option value="">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Tags Search */}
            <div style={{ flex: '2 1 200px', minWidth: '160px' }}>
              <div className="header-search-bar" style={{ width: '100%', height: '42px', padding: '8px 12px' }}>
                <FiTag style={{ color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search tags (e.g. matrix)" 
                  value={selectedTag}
                  onChange={(e) => {
                    setSelectedTag(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
            </div>

            {/* Solved Status Filter */}
            {currentUser && (
              <div style={{ flex: '1 1 150px', minWidth: '130px' }}>
                <select 
                  className="form-select" 
                  value={selectedSolvedStatus} 
                  onChange={(e) => {
                    setSelectedSolvedStatus(e.target.value);
                    setPage(0);
                  }}
                  style={{ height: '42px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="SOLVED">Solved</option>
                  <option value="UNSOLVED">Unsolved</option>
                  <option value="WRONG">Wrong Questions</option>
                </select>
              </div>
            )}

            {/* Bookmarked Filter */}
            {currentUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 120px', minWidth: '110px', padding: '0 8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedBookmarked} 
                    onChange={(e) => {
                      setSelectedBookmarked(e.target.checked);
                      setPage(0);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Bookmarked</span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="question-list-area" style={{ width: '100%', padding: '32px 40px' }}>
        {/* Topic Frequency trend widget */}
        {selectedTopicId && topicFrequency.length > 0 && (
          <div style={{
            backgroundColor: 'rgba(6, 182, 212, 0.05)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-secondary)', fontSize: '0.95rem', marginBottom: '8px' }}>
              <FiTrendingUp /> PYQ Topic Frequency Trend
            </h4>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {topicFrequency.map(stat => (
                <div key={stat.year} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem' }}>
                  <strong>{stat.year}</strong>: {stat.count} question{stat.count > 1 ? 's' : ''}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Total: {topicFrequency.reduce((acc, curr) => acc + curr.count, 0)} Appearances
              </div>
            </div>
          </div>
        )}


        {/* Questions lists */}
        <div id="pyq-questions-start"></div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Loading questions...</div>
        ) : questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
            No questions found.
          </div>
        ) : (
          questions.map(q => {
            const isRevealed = revealedAnswers[q.id];
            const selectedOpt = selectedOptions[q.id];
            const isBookmarked = bookmarks.includes(q.id);
            const activeSection = expandedSection[q.id];

            return (
              <div key={q.id} className="question-card">
                <div className="question-meta">
                  <span className="badge badge-info">GATE CSE {q.year}</span>
                  <span className="badge badge-dark">{q.questionType}</span>
                  <span className="badge badge-dark">{q.marks} Mark{q.marks > 1 ? 's' : ''}</span>
                  {q.negativeMarks !== 0 && (
                    <span className="badge badge-dark" style={{ color: 'var(--color-error)' }}>
                      -{Math.abs(q.negativeMarks)} Negative
                    </span>
                  )}
                  <span className="badge badge-dark">{q.subjectName}</span>
                  <span className="badge badge-dark">{q.topicName}</span>
                  


                  {/* Bookmark button */}
                  <button 
                    style={{ background: 'none', border: 'none', color: isBookmarked ? 'var(--color-warning)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    onClick={() => handleBookmarkToggle(q.id)}
                    title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                  >
                    <FiBookmark size={18} fill={isBookmarked ? 'var(--color-warning)' : 'none'} />
                  </button>

                  {/* Share button */}
                  <button 
                    style={{ 
                      background: copiedShareId === q.id ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                      border: `1px solid ${copiedShareId === q.id ? '#22c55e' : 'var(--border-color)'}`, 
                      color: copiedShareId === q.id ? '#22c55e' : 'var(--text-secondary)', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      marginLeft: '10px',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={(e) => handleShareQuestion(e, q)}
                    title="Share Direct Question Link"
                  >
                    {copiedShareId === q.id ? <FiCheck size={14} /> : <FiShare2 size={14} />}
                    <span>{copiedShareId === q.id ? 'Copied!' : 'Share'}</span>
                  </button>

                  {/* Report button */}
                  <button 
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '10px' }}
                    onClick={() => {
                      setReportQuestionId(q.id);
                      setShowReportModal(true);
                    }}
                    title="Report an error in this question"
                  >
                    <FiAlertTriangle size={18} />
                  </button>


                  {/* Editor actions */}
                  {AuthService.isAdminOrEditor() && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                      <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => navigate(`/admin/questions/${q.id}/edit`)}>
                        <FiEdit /> Edit
                      </button>
                      <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--color-error)' }} onClick={() => handleDelete(q.id)}>
                        <FiTrash /> Delete
                      </button>
                    </div>
                  )}
                </div>

                <div 
                  className="question-text" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/questions/${q.id}`)}
                  title="View full details and discussions"
                >
                  {renderQuestionText(q.text)}
                </div>

                {q.imagePath && (
                  <div style={{ marginBottom: '16px' }}>
                    <div 
                      onClick={() => {
                        setSelectedZoomImage(q.imagePath);
                        setIsImageModalOpen(true);
                      }}
                      onMouseEnter={() => setHoveredImgId(q.id)}
                      onMouseLeave={() => setHoveredImgId(null)}
                      style={{ 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px', 
                        overflow: 'hidden', 
                        padding: '12px', 
                        textAlign: 'center', 
                        backgroundColor: '#fff',
                        cursor: 'zoom-in',
                        transition: 'all 0.2s ease',
                        transform: hoveredImgId === q.id ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: hoveredImgId === q.id ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
                        display: 'inline-block',
                        maxWidth: '300px'
                      }}
                    >
                      <p style={{ fontSize: '0.7rem', color: '#666', marginBottom: '6px', fontWeight: '500' }}>Diagram (Click to enlarge)</p>
                      <img src={getAssetUrl(q.imagePath)} alt="Question Diagram" style={{ maxWidth: '100%', maxHeight: '150px', display: 'block' }} />
                    </div>
                  </div>
                )}

                 {q.options && q.options.length > 0 && (
                  <div>
                    <div className="options-grid">
                      {q.options.map(opt => {
                        const isLetterInCorrectAnswer = (letter, correctAns) => {
                          if (!correctAns) return false;
                          const normalized = correctAns.toUpperCase().replace(/[^A-D]/g, '');
                          return normalized.includes(letter.toUpperCase());
                        };

                        const isLetterInSelectedAnswer = (letter, selAns) => {
                          if (!selAns) return false;
                          const normalized = selAns.toUpperCase().replace(/[^A-D]/g, '');
                          return normalized.includes(letter.toUpperCase());
                        };

                        const isSelected = q.questionType === 'MSQ'
                          ? (selectedOpt 
                              ? isLetterInSelectedAnswer(opt.optionLabel, selectedOpt)
                              : (tempMsqSelections[q.id] || []).includes(opt.optionLabel))
                          : (selectedOpt 
                              ? (selectedOpt === opt.optionLabel)
                              : (tempMcqSelections[q.id] === opt.optionLabel));
                          
                        const isCorrectAnswer = q.questionType === 'MSQ'
                          ? isLetterInCorrectAnswer(opt.optionLabel, q.aiSuggestedAnswer)
                          : (q.aiSuggestedAnswer && q.aiSuggestedAnswer.trim().toUpperCase() === opt.optionLabel.toUpperCase());

                        let btnClass = 'option-btn';
                        if (selectedOpt) {
                          if (isSelected) {
                            btnClass += isCorrectAnswer ? ' correct' : ' incorrect';
                          } else if (isCorrectAnswer) {
                            btnClass += ' correct';
                          }
                        }
                        
                        const isImageOption = opt.optionText && (opt.optionText.startsWith('/uploads/') || opt.optionText.startsWith('http://') || opt.optionText.startsWith('https://'));
                        return (
                          <button 
                            key={opt.id} 
                            className={btnClass}
                            onClick={() => handleOptionClick(q.id, opt.optionLabel, q.questionType)}
                            style={{
                              ...(isImageOption ? { padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minHeight: '120px' } : {}),
                              cursor: selectedOpt ? 'default' : 'pointer',
                              pointerEvents: selectedOpt ? 'none' : 'auto',
                              ...(isSelected && !selectedOpt ? { borderColor: 'var(--color-secondary)', backgroundColor: 'rgba(6, 182, 212, 0.05)' } : {})
                            }}
                          >
                            <span className="option-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {q.questionType === 'MSQ' && (
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  readOnly
                                  style={{ accentColor: 'var(--color-secondary)', width: '16px', height: '16px', marginRight: '6px', pointerEvents: 'none' }}
                                />
                              )}
                              {opt.optionLabel}
                            </span>
                            {isImageOption ? (
                              <img 
                                src={getAssetUrl(opt.optionText)} 
                                alt={`Option ${opt.optionLabel}`} 
                                style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain', borderRadius: '4px', backgroundColor: '#fff', padding: '4px', border: '1px solid var(--border-color)' }} 
                              />
                            ) : (
                              formatMathText(opt.optionText)
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Explicit Submit Button for MCQ / MSQ */}
                    {!selectedOpt && (
                      <div style={{ margin: '14px 0 16px 0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {q.questionType === 'MSQ' ? (
                          <>
                            <button 
                              className="btn btn-primary" 
                              onClick={() => handleSubmitMsq(q.id)}
                              disabled={!(tempMsqSelections[q.id] && tempMsqSelections[q.id].length > 0)}
                              style={{ padding: '8px 22px', fontSize: '0.85rem', height: '38px', borderRadius: '8px', fontWeight: 700 }}
                            >
                              Submit MSQ Answer
                            </button>
                            {tempMsqSelections[q.id] && tempMsqSelections[q.id].length > 0 && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Selected: {tempMsqSelections[q.id].join(', ')}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <button 
                              className="btn btn-primary" 
                              onClick={() => handleSubmitMcq(q.id)}
                              disabled={!tempMcqSelections[q.id]}
                              style={{ padding: '8px 22px', fontSize: '0.85rem', height: '38px', borderRadius: '8px', fontWeight: 700 }}
                            >
                              Lock & Submit Answer
                            </button>
                            {tempMcqSelections[q.id] && (
                              <span style={{ fontSize: '0.82rem', color: '#c4b5fd', fontWeight: 600 }}>
                                Selected Option: <strong>({tempMcqSelections[q.id]})</strong>
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}


                {(q.questionType === 'NAT' || !q.options || q.options.length === 0) && (
                  <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Numerical Answer (NAT):</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder={selectedOpt ? `Submitted: ${selectedOpt}` : "Type your numeric answer..."}
                        value={natInputs[q.id] || ''}
                        onChange={(e) => setNatInputs({ ...natInputs, [q.id]: e.target.value })}
                        disabled={!!selectedOpt}
                        className="form-input"
                        style={{ flexGrow: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                      />
                      {!selectedOpt && (
                        <button 
                          className="btn btn-primary"
                          onClick={() => {
                            const val = natInputs[q.id];
                            if (val && val.trim() !== '') {
                              handleOptionClick(q.id, val.trim());
                            }
                          }}
                          style={{ padding: '0 16px', height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                        >
                          Submit
                        </button>
                      )}
                    </div>
                    {selectedOpt && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {checkAnswerCorrect(q.aiSuggestedAnswer, selectedOpt) ? (
                            <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FiCheckCircle /> Correct Answer
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FiXCircle /> Incorrect (Correct: {q.aiSuggestedAnswer})
                            </span>
                          )}
                        </div>

                        {/* Reset / Retry / Mark as Unsolved Button (Max 3 Retries Limit) */}
                        {(() => {
                          const retryCount = (resetCounts[q.id] || 0);
                          const remaining = 3 - retryCount;
                          if (remaining > 0) {
                            return (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Reset your answer for Question #${q.id}? You can re-solve this question (${remaining} retry attempt(s) remaining).`)) {
                                    const updatedOpts = { ...selectedOptions };
                                    delete updatedOpts[q.id];
                                    setSelectedOptions(updatedOpts);

                                    setResetCounts(prev => ({ ...prev, [q.id]: retryCount + 1 }));

                                    // Reset MSQ and NAT inputs
                                    setTempMsqSelections(prev => { const copy = { ...prev }; delete copy[q.id]; return copy; });
                                    setNatInputs(prev => { const copy = { ...prev }; delete copy[q.id]; return copy; });
                                    setRevealedAnswers(prev => { const copy = { ...prev }; delete copy[q.id]; return copy; });
                                  }
                                }}
                                style={{
                                  background: 'rgba(99, 102, 241, 0.15)',
                                  border: '1px solid rgba(99, 102, 241, 0.35)',
                                  color: '#c4b5fd',
                                  fontSize: '0.82rem',
                                  padding: '6px 14px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)'
                                }}
                                title={`${remaining} reset attempt(s) remaining`}
                              >
                                🔄 Mark Unsolved / Reset ({remaining} retry left)
                              </button>
                            );
                          } else {
                            return (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '6px' }}>
                                🔒 Answer Locked (Max 3 Retries Used)
                              </span>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {q.tags && q.tags.size > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {Array.from(q.tags).map((tag, idx) => (
                      <span key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Dynamic Actions Row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px', alignItems: 'center' }}>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => navigate(`/questions/${q.id}`)}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }}
                  >
                    View Details & Discuss ➔
                  </button>

                  {/* Always-Visible Mark Unsolved / Reset Button when an option is selected or locked */}
                  {(selectedOpt || tempMcqSelections[q.id] || (tempMsqSelections[q.id] && tempMsqSelections[q.id].length > 0) || natInputs[q.id]) && (
                    (() => {
                      const retryCount = (resetCounts[q.id] || 0);
                      const remaining = 3 - retryCount;
                      if (remaining > 0) {
                        return (
                          <button
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: "Reset & Mark Unsolved",
                                message: `Reset your answer for Question #${q.id}? You can re-solve this question (${remaining} retry attempt(s) remaining).`,
                                confirmText: "Reset Answer",
                                type: "warning",
                                onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                                onConfirm: () => {
                                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                  const updatedOpts = { ...selectedOptions };
                                  delete updatedOpts[q.id];
                                  setSelectedOptions(updatedOpts);

                                  setResetCounts(prev => ({ ...prev, [q.id]: retryCount + 1 }));

                                  // Reset temp selections and inputs
                                  setTempMcqSelections(prev => { const copy = { ...prev }; delete copy[q.id]; return copy; });
                                  setTempMsqSelections(prev => { const copy = { ...prev }; delete copy[q.id]; return copy; });
                                  setNatInputs(prev => { const copy = { ...prev }; delete copy[q.id]; return copy; });
                                  setRevealedAnswers(prev => { const copy = { ...prev }; delete copy[q.id]; return copy; });
                                }
                              });
                            }}
                            style={{
                              background: 'rgba(99, 102, 241, 0.15)',
                              border: '1px solid rgba(99, 102, 241, 0.35)',
                              color: '#c4b5fd',
                              fontSize: '0.8rem',
                              padding: '6px 14px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)'
                            }}
                            title={`${remaining} reset attempt(s) remaining`}
                          >
                            🔄 Mark Unsolved ({remaining} retry left)
                          </button>
                        );
                      } else {
                        return (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.04)', padding: '4px 10px', borderRadius: '6px' }}>
                            🔒 Answer Locked (Max 3 Used)
                          </span>
                        );
                      }
                    })()
                  )}

                  <button 
                    className="btn btn-outline" 
                    onClick={() => {
                      if (!selectedOpt) return;
                      if (isRevealed) {
                        toggleRevealAnswer(q.id);
                      } else {
                        if (!checkAnswerCorrect(q.aiSuggestedAnswer, selectedOpt)) {
                          setMotivationDialog(q);
                        } else {
                          toggleRevealAnswer(q.id);
                        }
                      }
                    }} 
                    style={{ fontSize: '0.8rem', padding: '6px 12px', opacity: !selectedOpt ? 0.5 : 1, cursor: !selectedOpt ? 'not-allowed' : 'pointer' }}
                    disabled={!selectedOpt}
                    title={!selectedOpt ? "Submit an answer first to unlock" : ""}
                  >
                    {isRevealed ? 'Hide Answer' : (!selectedOpt ? '🔒 Show Answer' : 'Show Answer')}
                  </button>

                  <button 
                    className="btn btn-outline" 
                    onClick={() => handleAskAITutor(q)} 
                    disabled={!selectedOpt}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', color: 'var(--color-primary)', borderColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, opacity: !selectedOpt ? 0.5 : 1, cursor: !selectedOpt ? 'not-allowed' : 'pointer' }}
                    title={!selectedOpt ? "Submit an answer first to unlock" : ""}
                  >
                    {!selectedOpt ? '🔒 Ask AI Tutor' : '🤖 Ask AI Tutor' + (!AuthService.isPremium() ? ' (3 Free/day)' : '')}
                  </button>

                  <button className={`btn ${activeSection === 'explanations' ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleSectionToggle(q.id, 'explanations')} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                    Explanations
                  </button>

                  <button className={`btn ${activeSection === 'discussions' ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleSectionToggle(q.id, 'discussions')} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                    <FiMessageSquare /> Discussion
                  </button>

                  <button className={`btn ${activeSection === 'similar' ? 'btn-primary' : 'btn-outline'}`} onClick={() => handleSectionToggle(q.id, 'similar')} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                    Similar
                  </button>

                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                    Traceability: {q.pdfSourceName} (Page {q.pdfPageNumber})
                  </span>
                </div>

                {/* AI Answer Reveal box — two-tier: short by default, detailed on expand */}
                {isRevealed && (() => {
                  const showDetailed = revealSubTabs[q.id] === 'detailed';
                  return (
                    <div style={{ marginTop: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.9rem', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>

                      {/* Answer badge header */}
                      <div style={{ padding: '12px 20px', backgroundColor: 'rgba(16, 185, 129, 0.06)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correct Answer</span>
                        <span className="badge badge-success" style={{ fontSize: '1rem', padding: '4px 14px', letterSpacing: '0.05em' }}>
                          {q.questionType === 'NAT' ? '' : 'Option '}{q.aiSuggestedAnswer || '—'}
                        </span>
                      </div>

                      {/* Short solution (default view) */}
                      {!showDetailed && (
                        <div style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚡ Solution Explanation</span>
                          </div>
                          <div style={{ color: 'var(--text-primary)', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                            {(q.aiSuggestedExplanation || q.aiMentorInsights)
                              ? renderQuestionText(q.aiSuggestedExplanation || q.aiMentorInsights)
                              : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Solution is being generated in background…</span>
                            }
                          </div>
                          <button
                            onClick={() => setRevealSubTabs(prev => ({ ...prev, [q.id]: 'detailed' }))}
                            style={{
                              marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--color-primary)',
                              background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer',
                              fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.target.style.background = 'var(--color-primary)'; e.target.style.color = '#fff'; }}
                            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--color-primary)'; }}
                          >
                            📖 Get Detailed Step-by-Step Solution
                          </button>
                        </div>
                      )}

                      {/* Detailed solution (expanded view) */}
                      {showDetailed && (
                        <div style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📝 Step-by-Step Solution</span>
                            <button
                              onClick={() => setRevealSubTabs(prev => ({ ...prev, [q.id]: undefined }))}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              ← Back to Quick View
                            </button>
                          </div>
                          {q.aiSuggestedExplanation
                            ? renderMentorAnalysis(q.aiSuggestedExplanation)
                            : <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Detailed solution is being generated in background (rate-limited). Check back shortly.</p>
                          }
                        </div>
                      )}
                    </div>
                  );
                })()}


                {/* Section #1: Explanations list & submit form */}
                {activeSection === 'explanations' && (
                  <div style={{ marginTop: '16px', padding: '20px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-sidebar)' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Community Explanations</h4>
                    
                    {/* List of answers */}
                    {questionExplanations[q.id]?.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>No community explanations submitted yet. Be the first!</p>
                    ) : (
                      questionExplanations[q.id]?.map(exp => (
                        <div key={exp.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span><strong>@{exp.username}</strong> suggested option <span className="badge badge-info">{exp.submittedAnswer}</span></span>
                            <span>Consensus: {(exp.confidenceScore * 100).toFixed(0)}%</span>
                          </div>
                          <p style={{ margin: '6px 0', fontSize: '0.85rem' }}>{exp.explanation}</p>
                          
                          {/* Explanation voting */}
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
                            <button 
                              style={{ background: 'none', border: 'none', color: exp.voteStatus === 'UPVOTE' ? 'var(--color-success)' : 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => voteExplanation(q.id, exp.id, 'UPVOTE')}
                            >
                              <FiThumbsUp /> {exp.upvotes} Up
                            </button>
                            <button 
                              style={{ background: 'none', border: 'none', color: exp.voteStatus === 'DOWNVOTE' ? 'var(--color-error)' : 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => voteExplanation(q.id, exp.id, 'DOWNVOTE')}
                            >
                              <FiThumbsDown /> {exp.downvotes} Down
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Explanations form */}
                    {currentUser ? (
                      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                          <div style={{ flexGrow: 1 }}>
                            <label className="form-label">Suggested Option / Value</label>
                            <input type="text" className="form-input" placeholder="e.g. B or 1480" value={newExplanationGuess} onChange={(e) => setNewExplanationGuess(e.target.value)} style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Step-by-step logic</label>
                          <textarea className="form-input" rows="3" placeholder="Explain your answer..." value={newExplanationText} onChange={(e) => setNewExplanationText(e.target.value)} style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
                        </div>
                        <button className="btn btn-primary" onClick={() => submitExplanation(q.id)} style={{ padding: '6px 16px', fontSize: '0.8rem' }}>Submit Logic</button>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Login to submit answers and upvote/downvote community explanations.</p>
                    )}
                  </div>
                )}

                {/* Section #2: Forum threads */}
                {activeSection === 'discussions' && (
                  <div style={{ marginTop: '16px', padding: '20px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-sidebar)' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '16px' }}>GateOverflow Discussion Threads</h4>
                    
                    {/* List root comments */}
                    {questionComments[q.id]?.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No discussion entries. Ask a question or start a thread!</p>
                    ) : (
                      questionComments[q.id]?.map(comment => renderComment(comment, q.id))
                    )}

                    {/* Root comment input form */}
                    {currentUser ? (
                      <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Type comment or query..." 
                          value={newCommentText[q.id] || ''}
                          onChange={(e) => setNewCommentText({ ...newCommentText, [q.id]: e.target.value })}
                        />
                        <button className="btn btn-primary" onClick={() => submitComment(q.id)}>Post Comment</button>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px' }}>Login to reply or post comments.</p>
                    )}
                  </div>
                )}

                {/* Section #3: Related questions recommendation lookups */}
                {activeSection === 'similar' && (
                  <div style={{ marginTop: '16px', padding: '20px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-sidebar)' }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '12px' }}>Similar Concepts Appeared In:</h4>
                    {similarQuestions[q.id]?.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No similar concept questions mapped.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {similarQuestions[q.id]?.map(sim => (
                          <div key={sim.id} style={{ display: 'flex', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <FiCornerDownRight style={{ marginTop: '3px' }} />
                            <span>
                              <strong>GATE CSE {sim.year} ({sim.marks}M)</strong> - {sim.text.substring(0, 100)}...
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{page * pageSize + 1}</strong> - <strong style={{ color: 'var(--text-primary)' }}>{Math.min((page + 1) * pageSize, totalElements)}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{totalElements}</strong> questions
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Previous page */}
              <button
                className="btn btn-outline"
                onClick={() => changePage(Math.max(0, page - 1))}
                disabled={page === 0}
                style={{
                  padding: '8px 16px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                  opacity: page === 0 ? 0.5 : 1
                }}
              >
                ◀ Prev
              </button>

              {/* Page numbers */}
              {(() => {
                const pages = [];
                const maxVisible = 5;
                let startPage = Math.max(0, page - Math.floor(maxVisible / 2));
                let endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);
                
                if (endPage - startPage + 1 < maxVisible) {
                  startPage = Math.max(0, endPage - maxVisible + 1);
                }

                if (startPage > 0) {
                  pages.push(
                    <button
                      key={0}
                      className="btn btn-outline"
                      onClick={() => changePage(0)}
                      style={{
                        padding: '8px 12px',
                        height: '38px',
                        minWidth: '38px',
                        borderColor: page === 0 ? 'var(--color-primary)' : 'var(--border-color)',
                        backgroundColor: page === 0 ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                        color: page === 0 ? 'var(--color-primary)' : 'var(--text-primary)'
                      }}
                    >
                      1
                    </button>
                  );
                  if (startPage > 1) {
                    pages.push(<span key="dots-start" style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>);
                  }
                }

                for (let i = startPage; i <= endPage; i++) {
                  const isActive = page === i;
                  pages.push(
                    <button
                      key={i}
                      className="btn btn-outline"
                      onClick={() => changePage(i)}
                      style={{
                        padding: '8px 12px',
                        height: '38px',
                        minWidth: '38px',
                        borderColor: isActive ? 'var(--color-primary)' : 'var(--border-color)',
                        backgroundColor: isActive ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                        color: isActive ? 'var(--color-primary)' : 'var(--text-primary)',
                        fontWeight: isActive ? 'bold' : 'normal'
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                }

                if (endPage < totalPages - 1) {
                  if (endPage < totalPages - 2) {
                    pages.push(<span key="dots-end" style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>);
                  }
                  pages.push(
                    <button
                      key={totalPages - 1}
                      className="btn btn-outline"
                      onClick={() => changePage(totalPages - 1)}
                      style={{
                        padding: '8px 12px',
                        height: '38px',
                        minWidth: '38px',
                        borderColor: page === totalPages - 1 ? 'var(--color-primary)' : 'var(--border-color)',
                        backgroundColor: page === totalPages - 1 ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                        color: page === totalPages - 1 ? 'var(--color-primary)' : 'var(--text-primary)'
                      }}
                    >
                      {totalPages}
                    </button>
                  );
                }

                return pages;
              })()}

              {/* Next page */}
              <button
                className="btn btn-outline"
                onClick={() => changePage(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                style={{
                  padding: '8px 16px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages - 1 ? 0.5 : 1
                }}
              >
                Next ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Diagram Zoom */}
      {isImageModalOpen && selectedZoomImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}
          onClick={() => {
            setIsImageModalOpen(false);
            setSelectedZoomImage(null);
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={(e) => e.stopPropagation()}>
            <button 
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#fff',
                fontSize: '20px',
                cursor: 'pointer',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
              onClick={() => {
                setIsImageModalOpen(false);
                setSelectedZoomImage(null);
              }}
            >
              <FiX />
            </button>
            <img 
              src={getAssetUrl(selectedZoomImage)} 
              alt="Diagram Zoom" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '85vh', 
                borderRadius: '8px', 
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                border: '3px solid rgba(255,255,255,0.1)'
              }} 
            />
          </div>
        </div>
      )}
      {/* Report Question Modal */}
      {showReportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(5, 7, 12, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '450px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiAlertTriangle style={{ color: 'var(--color-error)' }} /> Report Question Error
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Reason for Report:</label>
              <select 
                className="form-select" 
                value={reportReason} 
                onChange={(e) => setReportReason(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">-- Select a Reason --</option>
                <option value="Incorrect Option / Answer">Incorrect Option / Answer</option>
                <option value="Typo / Math Equation Error">Typo / Math Equation Error</option>
                <option value="Wrong Subject / Topic Tag">Wrong Subject / Topic Tag</option>
                <option value="Blurry or Missing Image Diagram">Blurry or Missing Image Diagram</option>
                <option value="Incomplete / Cut-off Text">Incomplete / Cut-off Text</option>
                <option value="Other">Other (Describe below)</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Optional Description:</label>
              <textarea 
                className="form-input" 
                rows="4" 
                placeholder="Provide detailed logs or links to corrections if possible..."
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => {
                  setShowReportModal(false);
                  setReportQuestionId(null);
                  setReportReason('');
                  setReportDesc('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSendReport}
                disabled={!reportReason}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI TUTOR CHAT DRAWER */}
      {activeAiTutorQuestion && (
        <div className="ai-tutor-drawer-open" style={{
          position: 'fixed',
          bottom: isAiFullscreen ? '0' : '24px',
          right: isAiFullscreen ? '0' : '24px',
          top: isAiFullscreen ? '0' : 'auto',
          left: isAiFullscreen ? '0' : 'auto',
          width: isAiFullscreen ? '100vw' : '420px',
          height: isAiFullscreen ? '100vh' : 'min(560px, calc(100vh - 100px))',
          maxHeight: isAiFullscreen ? '100vh' : 'calc(100vh - 100px)',
          backgroundColor: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(20px)',
          borderRadius: isAiFullscreen ? '0' : '20px',
          boxShadow: isAiFullscreen ? 'none' : '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          border: isAiFullscreen ? 'none' : '1px solid rgba(139, 92, 246, 0.35)',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Header */}
          <div style={{ padding: isAiFullscreen ? '16px 32px' : '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.18) 0%, rgba(6, 182, 212, 0.12) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)' }}>
                ⚡
              </div>
              <div>
                <h4 style={{ fontSize: isAiFullscreen ? '1.1rem' : '0.98rem', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  GATE AI Tutor
                  <span style={{ fontSize: '0.65rem', background: 'rgba(139, 92, 246, 0.25)', color: '#c4b5fd', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PRO</span>
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', display: 'block', marginTop: '2px' }}>
                  {AuthService.isPremium() ? '✨ Aspirant Pro Active' : '⚡ 3 Free Queries / Day'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Fullscreen / Minimize Toggle Button */}
              <button 
                onClick={() => setIsAiFullscreen(!isAiFullscreen)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                title={isAiFullscreen ? "Minimize Chat Window" : "Fullscreen Chat Window"}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
              >
                {isAiFullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
              </button>

              {/* Close Button */}
              <button 
                onClick={() => { setActiveAiTutorQuestion(null); setIsAiFullscreen(false); }}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                title="Close AI Tutor"
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
              >
                <FiX size={16} />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div style={{ flex: 1, padding: isAiFullscreen ? '32px 10%' : '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {aiChatMessages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                display: 'flex',
                gap: '12px',
                maxWidth: isAiFullscreen ? '75%' : '88%',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
              }}>
                {/* Avatar icon */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)' : 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                  {msg.role === 'user' ? 'U' : '🤖'}
                </div>

                {/* Message Bubble */}
                <div style={{
                  background: msg.role === 'user' 
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' 
                    : 'rgba(30, 41, 59, 0.75)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  borderRadius: msg.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                  padding: '14px 20px',
                  fontSize: '0.9rem',
                  lineHeight: '1.65',
                  boxShadow: msg.role === 'user' ? '0 4px 15px rgba(139, 92, 246, 0.35)' : '0 4px 15px rgba(0,0,0,0.25)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.09)'
                }}>
                  {msg.role === 'assistant' ? renderAiChatText(msg.text) : msg.text}
                </div>
              </div>
            ))}
            
            {chatLoading && (
              <div style={{
                alignSelf: 'flex-start',
                display: 'flex',
                gap: '12px',
                maxWidth: '85%'
              }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                  🤖
                </div>
                <div style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.75)',
                  borderRadius: '18px 18px 18px 2px',
                  padding: '14px 20px',
                  fontSize: '0.88rem',
                  color: '#c4b5fd',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.25)'
                }}>
                  <FiLoader className="spin" style={{ color: '#8b5cf6' }} /> Thinking & formulating solution...
                </div>
              </div>
            )}
          </div>

          {/* Footer Form */}
          <form onSubmit={handleSendAiChatMessage} style={{ padding: isAiFullscreen ? '20px 10%' : '16px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(15, 23, 42, 0.85)' }}>
            
            {/* Quick Prompt Tags */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {[
                { label: '💡 Explain Step-by-Step', text: 'Please explain this question step-by-step in detail.' },
                { label: '❓ Why is this option correct?', text: 'Why is the correct option right and others wrong?' },
                { label: '📊 Show Diagram / Flowchart', text: 'Can you show a flowchart or diagram to explain this concept?' },
                { label: '⚡ Shortcut / Trick', text: 'Is there any quick shortcut, formula, or trick for this question?' }
              ].map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { setChatInput(tag.text); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(139, 92, 246, 0.12)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    color: '#c4b5fd',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.25)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.12)'; e.currentTarget.style.color = '#c4b5fd'; }}
                >
                  {tag.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ask a doubt about this question..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
                style={{ 
                  flex: 1, 
                  padding: '14px 18px', 
                  fontSize: '0.9rem', 
                  borderRadius: '14px',
                  backgroundColor: 'rgba(30, 41, 59, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff'
                }}
              />
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={!chatInput.trim() || chatLoading}
                style={{ 
                  padding: '14px 24px', 
                  fontSize: '0.9rem', 
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none',
                  fontWeight: 700,
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.35)'
                }}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {motivationDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(5, 7, 12, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'var(--bg-sidebar)',
            padding: '30px',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🤔</div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '12px', color: 'var(--text-primary)' }}>Give it one more try!</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: '1.5' }}>
              You'll learn more by solving it yourself. Want to give it another shot?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  const newOpts = { ...selectedOptions };
                  delete newOpts[motivationDialog.id];
                  setSelectedOptions(newOpts);
                  
                  if (motivationDialog.questionType === 'MSQ') {
                    const newMsq = { ...tempMsqSelections };
                    delete newMsq[motivationDialog.id];
                    setTempMsqSelections(newMsq);
                  } else if (motivationDialog.questionType === 'NAT') {
                    const newNat = { ...natInputs };
                    delete newNat[motivationDialog.id];
                    setNatInputs(newNat);
                  }
                  
                  setMotivationDialog(null);
                }}
                style={{ padding: '8px 20px', fontWeight: 600 }}
              >
                Try Again
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => {
                  if (!revealedAnswers[motivationDialog.id]) {
                    toggleRevealAnswer(motivationDialog.id);
                  }
                  setMotivationDialog(null);
                }}
              >
                Show Answer
              </button>
            </div>
          </div>
        </div>
      )}

      <PremiumGateModal 
        isOpen={showPremiumModal} 
        onClose={() => setShowPremiumModal(false)} 
        onUpgradeSuccess={() => window.location.reload()} 
      />

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

