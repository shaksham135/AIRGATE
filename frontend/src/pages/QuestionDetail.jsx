import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import CacheService from '../services/CacheService';
import { formatMathText, renderQuestionText, getAssetUrl, renderMentorAnalysis, checkAnswerCorrect, renderAiChatText } from '../utils/mathRenderer';
import API_CONFIG from '../config/api';
import PremiumGateModal from '../components/PremiumGateModal';
import { 
  FiBookmark, FiCheckCircle, FiXCircle, FiMessageSquare, FiActivity, 
  FiArrowLeft, FiThumbsUp, FiThumbsDown, FiClock, FiPlus, FiCornerDownRight, FiAlertTriangle, FiLoader, FiX, FiMaximize2, FiMinimize2,
  FiShare2, FiCheck
} from 'react-icons/fi';


export default function QuestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = AuthService.getCurrentUser();

  const [question, setQuestion] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [tempSelectedMsq, setTempSelectedMsq] = useState([]);
  const [natInput, setNatInput] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShareQuestion = async () => {
    const shareUrl = `${window.location.origin}/questions/${id}`;
    const shareTitle = question ? `GATE CSE ${question.year || ''} - ${question.topicName || 'Question'} | AIRGATE` : 'AIRGATE Question';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Check out this GATE question on AIRGATE:`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // Fallback to clipboard if share dismissed
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  const [startTime] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AI answer reveal
  const [showAnswer, setShowAnswer] = useState(false);
  const [showDetailedSolution, setShowDetailedSolution] = useState(false);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState('');
  const [suggestedNextQuestion, setSuggestedNextQuestion] = useState(null);

  // AI Tutor & Motivation Dialog State
  const [motivationDialog, setMotivationDialog] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isAiTutorOpen, setIsAiTutorOpen] = useState(false);
  const [isAiFullscreen, setIsAiFullscreen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState([]);
  const [aiChatQuestionId, setAiChatQuestionId] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [resetCount, setResetCount] = useState(0);

  // Discussion state
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyCommentText, setReplyCommentText] = useState({}); // { commentId: '' }
  const [activeReplyId, setActiveReplyId] = useState(null);

  useEffect(() => {
    loadQuestionData();
  }, [id]);

  const loadQuestionData = async () => {
    // 1. Instant RAM Cache Check (0ms response on back/forth navigation)
    const cachedQ = CacheService.get(`qd_${id}`);
    const cachedSimilar = CacheService.get(`similar_${id}`);

    if (cachedQ) {
      setQuestion(cachedQ);
      document.title = `GATE CSE ${cachedQ.year || ''} - ${cachedQ.topicName || ''} | AIRGATE`;
      if (cachedSimilar) setSuggestedNextQuestion(cachedSimilar);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError('');
    try {
      const qRes = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${id}`);
      setQuestion(qRes.data);
      CacheService.set(`qd_${id}`, qRes.data, 300000); // 5 minutes TTL
      document.title = `GATE CSE ${qRes.data.year || ''} - ${qRes.data.topicName || ''} | AIRGATE`;

      try {
        const similarRes = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${id}/similar`);
        if (similarRes.data && similarRes.data.length > 0) {
          setSuggestedNextQuestion(similarRes.data[0]);
          CacheService.set(`similar_${id}`, similarRes.data[0], 300000);
        } else {
          setSuggestedNextQuestion(null);
        }
      } catch (e) {
        console.error('Failed to load similar suggestions', e);
      }

      if (currentUser) {
        const headers = AuthService.getAuthHeader();
        try {
          const statusRes = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${id}/user-status`, { headers });
          const { isBookmarked: bm, isSolved: sol, selectedOption: opt } = statusRes.data || {};
          setIsBookmarked(!!bm);
          if (sol && opt) {
            setSelectedOption(opt);
            setNatInput(opt);
            if (qRes.data.questionType === 'MSQ') {
              const letters = opt.toUpperCase().replace(/[^A-D]/g, '').split('');
              setTempSelectedMsq(letters);
            }
          }
        } catch (e) {
          console.error('Failed to load user question status', e);
        }
      }


      // Load comments
      loadComments();
    } catch (e) {
      console.error('Failed to load question details', e);
      setError('Question not found or server is unreachable.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!window.confirm('WARNING: Are you sure you want to permanently delete this question? This action will cascade-delete all options, solves, comments, bookmarks, and explanation revisions. It cannot be undone.')) {
      return;
    }
    
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/api/questions/${id}`, {
        headers: AuthService.getAuthHeader()
      });
      alert('Question deleted successfully.');
      navigate('/explore');
    } catch (err) {
      console.error('Failed to delete question:', err);
      alert(err.response?.data?.message || 'Failed to delete question. Make sure you have admin/editor permissions.');
    }
  };

  const handleBack = () => {
    const hasHistory = window.history.length > 1 && window.history.state && window.history.state.idx > 0;
    if (hasHistory) {
      navigate(-1);
    } else if (AuthService.isAdminOrEditor()) {
      if (window.opener) {
        window.close();
      } else {
        navigate('/admin/panel');
      }
    } else {
      navigate('/explore');
    }
  };

  const loadComments = async () => {
    try {
      const headers = currentUser ? AuthService.getAuthHeader() : {};
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${id}/comments`, { headers });
      setComments(response.data);
    } catch (e) {
      console.error('Failed to load comments', e);
    }
  };

  const triggerGetExplanation = async () => {
    setGeneratingExplanation(true);
    setExplanationError('');
    setShowDetailedSolution(true);
    try {
      const headers = currentUser ? AuthService.getAuthHeader() : {};
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${id}/explanations`, {}, { headers });
      if (response.data.message === 'GENERATING' || response.status === 202) {
        startExplanationPolling(3000);
      } else {
        setQuestion(response.data);
        setGeneratingExplanation(false);
      }
    } catch (e) {
      console.error('Failed to trigger explanation', e);
      setExplanationError('AI API Limit hit. Could not generate explanation.');
      setGeneratingExplanation(false);
    }
  };

  const startExplanationPolling = (delay) => {
    setTimeout(async () => {
      try {
        const headers = currentUser ? AuthService.getAuthHeader() : {};
        const response = await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${id}/explanations`, {}, { headers });
        if (response.data.message === 'GENERATING' || response.status === 202) {
          const nextDelay = delay === 3000 ? 5000 : (delay === 5000 ? 8000 : 15000);
          startExplanationPolling(nextDelay);
        } else {
          setQuestion(response.data);
          setGeneratingExplanation(false);
        }
      } catch (e) {
        console.error('Polling error', e);
        setGeneratingExplanation(false);
      }
    }, delay);
  };

  const handleVoteExplanation = async (voteType) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    try {
      const headers = AuthService.getAuthHeader();
      await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${id}/explanations/vote?type=${voteType}`, {}, { headers });
      const qRes = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${id}`);
      setQuestion(qRes.data);
    } catch (e) {
      console.error('Failed to vote', e);
    }
  };

  const handleBookmarkToggle = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    try {
      const headers = AuthService.getAuthHeader();
      if (isBookmarked) {
        await axios.delete(`${API_CONFIG.BASE_URL}/api/questions/${id}/bookmark`, { headers });
        setIsBookmarked(false);
      } else {
        await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${id}/bookmark`, {}, { headers });
        setIsBookmarked(true);
      }
    } catch (e) {
      console.error('Failed to update bookmark', e);
    }
  };

  const handleOptionClick = async (optionLabel) => {
    if (selectedOption) return; // Locked!

    if (question && question.questionType === 'MSQ') {
      setTempSelectedMsq(prev => {
        if (prev.includes(optionLabel)) {
          return prev.filter(x => x !== optionLabel);
        } else {
          return [...prev, optionLabel].sort();
        }
      });
      return;
    }

    setSelectedOption(optionLabel);

    if (currentUser) {
      try {
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${id}/solve`, {
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

  const handleSubmitMsq = async () => {
    if (selectedOption || tempSelectedMsq.length === 0) return;

    const selectedStr = tempSelectedMsq.join(', ');
    setSelectedOption(selectedStr);

    if (currentUser) {
      try {
        const timeTaken = Math.round((Date.now() - startTime) / 1000);
        await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${id}/solve`, {
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
    if (!reportReason) return;
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${id}/report`, {
        reason: reportReason,
        description: reportDesc
      }, {
        headers: AuthService.getAuthHeader()
      });
      alert("Thank you! Your report has been submitted to the administrator for review.");
      setShowReportModal(false);
      setReportReason('');
      setReportDesc('');
    } catch (e) {
      console.error(e);
      alert("Failed to submit report. Please try again.");
    }
  };

  const handleAskAITutor = () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    setIsAiTutorOpen(true);
    // Keep history if opening for same question; reset if new question
    if (aiChatQuestionId !== question.id || aiChatMessages.length === 0) {
      setAiChatQuestionId(question.id);
      setAiChatMessages([
        {
          role: 'assistant',
          text: `Hello! I am your GATE CSE AI Tutor. I have indexed this question from subject **${question.subjectName || 'Uncategorized'}**.\n\nHow can I help you understand the solution, derivations, or underlying concept today?${!AuthService.isPremium() ? ' *(Free Tier: 3 queries/day)*' : ''}`
        }
      ]);
    }
  };

  const handleSendAiChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput;
    const currentMessages = [...aiChatMessages];
    setAiChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const headers = AuthService.getAuthHeader();
      
      const optionsStr = (question.options && question.options.length > 0) 
        ? question.options.map(o => `${o.optionLabel}: ${o.optionText}`).join('\n') 
        : "N/A";
        
      const payload = {
        message: userText,
        questionText: question.text || "N/A",
        optionsText: optionsStr,
        questionType: question.questionType || "MCQ",
        subjectName: question.subjectName || "GATE CSE",
        topicName: question.topicName || "General",
        suggestedAnswer: question.aiSuggestedAnswer || "N/A",
        imagePath: question.imagePath,
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

  // Comments Actions
  const handlePostComment = async (parentCommentId = null) => {
    const textVal = parentCommentId ? replyCommentText[parentCommentId] : newCommentText;
    if (!textVal || textVal.trim() === '') return;

    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/questions/${id}/comments`, {
        commentText: textVal,
        parentCommentId
      }, { headers: AuthService.getAuthHeader() });

      if (parentCommentId) {
        setReplyCommentText(prev => ({ ...prev, [parentCommentId]: '' }));
        setActiveReplyId(null);
      } else {
        setNewCommentText('');
      }
      loadComments();
    } catch (e) {
      alert('Failed to post comment.');
    }
  };

  const handleVoteComment = async (commentId, type) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/comments/${commentId}/vote?type=${type}`, {}, {
        headers: AuthService.getAuthHeader()
      });
      loadComments();
    } catch (e) {
      console.error('Failed to vote comment', e);
    }
  };

  const renderCommentItem = (comment) => {
    return (
      <div key={comment.id} style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px', marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-secondary)' }}>@{comment.username}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(comment.createdAt).toLocaleDateString()}</span>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: '6px 0', whiteSpace: 'pre-line' }}>{comment.commentText}</p>
        
        {/* Comment actions (Voting & reply triggers) */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', alignItems: 'center' }}>
          <button 
            style={{ background: 'none', border: 'none', color: comment.voteStatus === 'UPVOTE' ? 'var(--color-success)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => handleVoteComment(comment.id, 'UPVOTE')}
          >
            <FiThumbsUp /> {comment.upvotes}
          </button>
          <button 
            style={{ background: 'none', border: 'none', color: comment.voteStatus === 'DOWNVOTE' ? 'var(--color-error)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => handleVoteComment(comment.id, 'DOWNVOTE')}
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
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Type reply..." 
              value={replyCommentText[comment.id] || ''}
              onChange={(e) => setReplyCommentText({ ...replyCommentText, [comment.id]: e.target.value })}
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            />
            <button className="btn btn-primary" onClick={() => handlePostComment(comment.id)} style={{ padding: '6px 16px', fontSize: '0.85rem' }}>Post</button>
          </div>
        )}

        {/* Render child comments nested */}
        {comment.replies && comment.replies.map(reply => (
          <div key={reply.id} style={{ display: 'flex', gap: '8px' }}>
            <FiCornerDownRight size={16} style={{ color: 'var(--text-muted)', marginTop: '20px' }} />
            <div style={{ flexGrow: 1 }}>
              {renderCommentItem(reply)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-secondary)', textAlign: 'center' }}>Loading question details...</div>;
  }

  if (error || !question) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-error)', marginBottom: '16px' }}>Error</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{error || 'Question details could not be loaded.'}</p>
        <button className="btn btn-primary" onClick={() => navigate('/explore')}>Back to Explorer</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Back Button and Admin Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <button 
          className="btn btn-outline" 
          onClick={handleBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <FiArrowLeft /> Back
        </button>

        {AuthService.isAdminOrEditor() && question && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate(`/admin/questions/${question.id}/edit`)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-primary)',
                background: 'rgba(139, 92, 246, 0.1)',
                color: 'var(--color-primary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ✏️ Edit Question
            </button>
            <button
              onClick={handleDeleteQuestion}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-error)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-error)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🗑️ Delete Question
            </button>
          </div>
        )}
      </div>

      {/* Detail Card Container */}
      <div className="question-card">
        
        {/* Meta Header */}
        <div className="question-meta">
          <span className="badge badge-info">GATE CSE {question.year}</span>
          <span className="badge badge-dark">{question.questionType}</span>
          <span className="badge badge-dark">{question.marks} Mark{question.marks > 1 ? 's' : ''}</span>
          {question.negativeMarks !== 0 && (
            <span className="badge badge-dark" style={{ color: 'var(--color-error)' }}>
              -{Math.abs(question.negativeMarks)} Negative
            </span>
          )}
          <span className="badge badge-dark">{question.subjectName}</span>
          <span className="badge badge-dark">{question.topicName}</span>

          {/* Bookmark Button */}
          <button 
            style={{ background: 'none', border: 'none', color: isBookmarked ? 'var(--color-warning)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}
            onClick={handleBookmarkToggle}
            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
          >
            <FiBookmark size={20} fill={isBookmarked ? 'var(--color-warning)' : 'none'} />
          </button>

          {/* Share Button */}
          <button 
            style={{ 
              background: copiedShare ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
              border: `1px solid ${copiedShare ? '#22c55e' : 'var(--border-color)'}`, 
              color: copiedShare ? '#22c55e' : 'var(--text-secondary)', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              marginLeft: '12px',
              transition: 'all 0.2s ease'
            }}
            onClick={handleShareQuestion}
            title="Share Direct Question Link"
          >
            {copiedShare ? <FiCheck size={16} /> : <FiShare2 size={16} />}
            <span>{copiedShare ? 'Link Copied!' : 'Share'}</span>
          </button>

          {/* Report Button */}
          <button 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}
            onClick={() => setShowReportModal(true)}
            title="Report an error in this question"
          >
            <FiAlertTriangle size={20} />
            <span style={{ fontSize: '0.8rem' }}>Report</span>
          </button>

        </div>

        {/* Text */}
        <div className="question-text" style={{ fontSize: '1.15rem', marginTop: '16px' }}>
          {renderQuestionText(question.text)}
        </div>

        {/* Diagram Image */}
        {question.imagePath && (
          <div style={{ margin: '24px 0', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', backgroundColor: '#fff', textAlign: 'center', display: 'inline-block', maxWidth: '400px' }}>
            <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '8px', fontWeight: 'bold' }}>Question Reference Diagram</p>
            <img src={getAssetUrl(question.imagePath)} alt="Question Diagram" style={{ maxWidth: '100%', maxHeight: '250px', display: 'block' }} />
          </div>
        )}

        {/* Options */}
        {question.options && question.options.length > 0 && (
          <div>
            <div className="options-grid" style={{ margin: '24px 0' }}>
              {question.options.map(opt => {
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

                const isSelected = question.questionType === 'MSQ'
                  ? (selectedOption 
                      ? isLetterInSelectedAnswer(opt.optionLabel, selectedOption)
                      : tempSelectedMsq.includes(opt.optionLabel))
                  : (selectedOption === opt.optionLabel);
                  
                const isCorrectAnswer = question.questionType === 'MSQ'
                  ? isLetterInCorrectAnswer(opt.optionLabel, question.aiSuggestedAnswer)
                  : (question.aiSuggestedAnswer && question.aiSuggestedAnswer.trim().toUpperCase() === opt.optionLabel.toUpperCase());

                let btnClass = 'option-btn';
                if (selectedOption) {
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
                    onClick={() => handleOptionClick(opt.optionLabel)}
                    style={{
                      ...(isImageOption ? { padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minHeight: '120px' } : {}),
                      cursor: selectedOption ? 'default' : 'pointer',
                      pointerEvents: selectedOption ? 'none' : 'auto',
                      ...(isSelected && !selectedOption ? { borderColor: 'var(--color-secondary)', backgroundColor: 'rgba(6, 182, 212, 0.05)' } : {})
                    }}
                  >
                    <span className="option-label" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {opt.optionLabel}
                    </span>
                    {isImageOption ? (
                      <img 
                        src={getAssetUrl(opt.optionText)} 
                        alt={`Option ${opt.optionLabel}`} 
                        style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain', borderRadius: '4px', backgroundColor: '#fff', padding: '4px' }} 
                      />
                    ) : (
                      formatMathText(opt.optionText)
                    )}
                  </button>
                );
              })}
            </div>
            {question.questionType === 'MSQ' && !selectedOption && (
              <div style={{ margin: '16px 0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSubmitMsq}
                  disabled={tempSelectedMsq.length === 0}
                  style={{ padding: '10px 24px', height: '42px', borderRadius: '8px' }}
                >
                  Submit MSQ Answer
                </button>
                {tempSelectedMsq.length > 0 && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Selected: {tempSelectedMsq.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>
        )}


        {(question.questionType === 'NAT' || !question.options || question.options.length === 0) && (
          <div style={{ margin: '24px 0', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '350px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Numerical Answer (NAT):</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                placeholder={selectedOption ? `Submitted: ${selectedOption}` : "Type your numeric answer..."}
                value={natInput}
                onChange={(e) => setNatInput(e.target.value)}
                disabled={!!selectedOption}
                className="form-input"
                style={{ flexGrow: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              {!selectedOption && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    if (natInput && natInput.trim() !== '') {
                      handleOptionClick(natInput.trim());
                    }
                  }}
                  style={{ padding: '0 20px', height: '44px', borderRadius: '8px' }}
                >
                  Submit
                </button>
              )}
            </div>
            {selectedOption && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', marginTop: '6px', fontWeight: 'bold' }}>
                {checkAnswerCorrect(question.aiSuggestedAnswer, selectedOption) ? (
                  <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiCheckCircle /> Correct Answer
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiXCircle /> Incorrect (Correct: {question.aiSuggestedAnswer})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', color: 'var(--text-muted)', fontSize: '0.85rem', flexWrap: 'wrap', gap: '10px' }}>
          <span>Traceability: {question.pdfSourceName} (Page {question.pdfPageNumber})</span>
          {selectedOption && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>Answer Saved</span>
              {(() => {
                const remaining = 3 - resetCount;
                if (remaining > 0) {
                  return (
                    <button
                      onClick={() => {
                        if (window.confirm(`Reset your answer for this question? You have ${remaining} retry attempt(s) remaining.`)) {
                          setSelectedOption(null);
                          setTempSelectedMsq([]);
                          setNatInput('');
                          setShowAnswer(false);
                          setShowDetailedSolution(false);
                          setResetCount(prev => prev + 1);
                        }
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.78rem',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      title={`${remaining} reset attempt(s) remaining`}
                    >
                      🔄 Reset Answer ({remaining} retry left)
                    </button>
                  );
                } else {
                  return (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      🔒 Locked (Max 3 Retries Used)
                    </span>
                  );
                }
              })()}
            </div>
          )}
        </div>
      </div>

      {/* AI Solution Panel — two-tier: quick by default, detailed on demand */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', marginTop: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiActivity style={{ color: 'var(--color-primary)' }} /> AI Solution
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-outline" 
              onClick={() => {
                if (!selectedOption) return;
                if (showAnswer) {
                  setShowAnswer(false);
                  setShowDetailedSolution(false);
                } else {
                  if (!checkAnswerCorrect(question.aiSuggestedAnswer, selectedOption)) {
                    setMotivationDialog(true);
                  } else {
                    setShowAnswer(true);
                  }
                }
              }}
              style={{ opacity: !selectedOption ? 0.5 : 1, cursor: !selectedOption ? 'not-allowed' : 'pointer' }}
              disabled={!selectedOption}
              title={!selectedOption ? "Submit an answer first to unlock" : ""}
            >
              {showAnswer ? 'Hide Solution' : (!selectedOption ? '🔒 Reveal Solution' : 'Reveal Solution')}
            </button>

            <button 
              className="btn btn-outline" 
              onClick={handleAskAITutor} 
              disabled={!selectedOption}
              style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, opacity: !selectedOption ? 0.5 : 1, cursor: !selectedOption ? 'not-allowed' : 'pointer' }}
              title={!selectedOption ? "Submit an answer first to unlock" : ""}
            >
              {!selectedOption ? '🔒 Ask AI Tutor' : '🤖 Ask AI Tutor' + (!AuthService.isPremium() ? ' (3 Free/day)' : '')}
            </button>
          </div>
        </div>

        {showAnswer && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '16px' }}>
            {/* Answer badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px 16px', backgroundColor: 'rgba(16,185,129,0.06)', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.15)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>AI Suggested Answer</span>
              <span className="badge badge-success" style={{ fontSize: '1.1rem', padding: '4px 16px' }}>
                {question.questionType === 'NAT' ? '' : 'Option '}{question.aiSuggestedAnswer || '—'}
              </span>
            </div>

            {!showDetailedSolution ? (
              /* Short solution view */
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>⚡ Quick Solution</span>
                <div style={{ marginTop: '10px', color: 'var(--text-primary)', lineHeight: '1.75', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
                  {question.aiMentorInsights
                    ? renderQuestionText(question.aiMentorInsights)
                    : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Quick solution generating in background… check back shortly.</span>
                  }
                </div>
                <button
                  onClick={triggerGetExplanation}
                  style={{
                    marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '9px 20px', borderRadius: '8px', border: '1px solid var(--color-primary)',
                    background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer',
                    fontSize: '0.9rem', fontWeight: 600
                  }}
                >
                  📖 Get Detailed Step-by-Step Solution
                </button>
              </div>
            ) : (
              /* Full detailed solution view */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📝 Step-by-Step Solution</span>
                  <button
                    onClick={() => setShowDetailedSolution(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    ← Back to Quick View
                  </button>
                </div>

                {generatingExplanation ? (
                  /* Loading Shimmer Skeletons */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '24px', backgroundColor: 'var(--bg-sidebar)', borderRadius: '12px', border: '1px solid var(--border-color)', animation: 'pulse 1.5s infinite' }}>
                    <div style={{ height: '16px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', width: '40%' }}></div>
                    <div style={{ height: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', width: '90%' }}></div>
                    <div style={{ height: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', width: '85%' }}></div>
                    <div style={{ height: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', width: '70%' }}></div>
                    <style>{`@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }`}</style>
                  </div>
                ) : explanationError ? (
                  <div style={{ color: 'var(--color-error)', fontSize: '0.9rem' }}>{explanationError}</div>
                ) : (
                  <div>
                    {question.aiSuggestedExplanation
                      ? renderMentorAnalysis(question.aiSuggestedExplanation)
                      : <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Detailed solution is generating. Check back in a few seconds...</p>
                    }

                    {/* Voting Feedback loop */}
                    {question.aiSuggestedExplanation && !question.aiSuggestedExplanation.startsWith("### Detailed Solution\n*(Generation failed") && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Was this explanation helpful?</span>
                        <button 
                          onClick={() => handleVoteExplanation('UPVOTE')}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '20px', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
                        >
                          👍 Helpful ({question.helpfulVotes || 0})
                        </button>
                        <button 
                          onClick={() => handleVoteExplanation('DOWNVOTE')}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '20px', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
                        >
                          👎 Not Helpful ({question.notHelpfulVotes || 0})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Next Suggested Question Recommendation Card */}
      {suggestedNextQuestion && (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', marginTop: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>🚀 Next Recommended Question</span>
            <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 500, color: 'var(--text-primary)', lineHeight: '1.5' }}>
              {renderQuestionText(suggestedNextQuestion.text.length > 200 ? suggestedNextQuestion.text.substring(0, 200) + '...' : suggestedNextQuestion.text)}
            </h4>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate(`/questions/${suggestedNextQuestion.id}`)}
            style={{ padding: '10px 24px', borderRadius: '8px', whiteSpace: 'nowrap' }}
          >
            Practice Next →
          </button>
        </div>
      )}

      {/* Comments / Discussion Thread */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '28px', marginTop: '28px' }}>
        <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiMessageSquare style={{ color: 'var(--color-secondary)' }} /> Community Discussion ({comments.length})
        </h3>

        {/* Comment input form */}
        {currentUser ? (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <textarea 
                className="form-input" 
                rows="3" 
                placeholder="Share your logic, ask a doubt, or discuss answers..." 
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                style={{ resize: 'vertical', flexGrow: 1 }}
              />
              <button 
                className="btn btn-primary" 
                onClick={() => handlePostComment(null)}
                style={{ padding: '0 24px', height: '42px', marginTop: 'auto' }}
              >
                Post
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', marginBottom: '32px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Please <span style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/login')}>Sign In</span> to participate in the discussion thread.
          </div>
        )}

        {/* Comments List */}
        {comments.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
            No comments yet. Be the first to start the discussion!
          </div>
        ) : (
          <div>
            {comments.map(comment => renderCommentItem(comment))}
          </div>
        )}
      </div>

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
          zIndex: 1000
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

      {/* Motivation Dialog */}
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
                  setSelectedOption(null);
                  setTempSelectedMsq([]);
                  setNatInput('');
                  setMotivationDialog(false);
                }}
                style={{ padding: '8px 20px', fontWeight: 600 }}
              >
                Try Again
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => {
                  if (!showAnswer) {
                    setShowAnswer(true);
                  }
                  setMotivationDialog(false);
                }}
              >
                Show Answer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Tutor Drawer */}
      {isAiTutorOpen && (
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
                onClick={() => { setIsAiTutorOpen(false); setIsAiFullscreen(false); }}
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

      <PremiumGateModal 
        isOpen={showPremiumModal} 
        onClose={() => setShowPremiumModal(false)} 
      />
    </div>
  );
}

