import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_CONFIG from '../config/api';
import AuthService from '../services/AuthService';
import CacheService from '../services/CacheService';
import LoginGate from '../components/LoginGate';
import AIRGATELoader from '../components/AIRGATELoader';
import { FiClock, FiCheckCircle, FiXCircle, FiMinus, FiTrash2, FiBarChart2, FiCpu, FiAlertCircle, FiLoader } from 'react-icons/fi';
import { renderQuestionText, renderOptionContent, getAssetUrl } from '../utils/mathRenderer';

export default function MockHistory() {
  return (
    <LoginGate featureName="Mock Test History" featureIcon="📋">
      <MockHistoryContent />
    </LoginGate>
  );
}

function fmt(secs) {
  if (!secs && secs !== 0) return '--';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function MockHistoryContent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      const cached = CacheService.get('mock_history');
      if (cached) {
        setHistory(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const res = await axios.get(`${API_CONFIG.BASE_URL}/api/simulator/history`, {
          headers: AuthService.getAuthHeader()
        });

        const mapped = res.data.map(item => {
          const questionsList = [];
          const answersObj = {};
          const subjBreak = {};

          if (item.answers) {
            item.answers.forEach(ans => {
              const q = ans.question;
              if (q) {
                if (!q.subjectName && q.subject) {
                  q.subjectName = q.subject.name;
                }
                questionsList.push(q);
                answersObj[q.id] = ans.selectedAnswer;

                const subject = q.subjectName || 'Uncategorized';
                if (!subjBreak[subject]) {
                  subjBreak[subject] = { total: 0, correct: 0, score: 0.0 };
                }
                subjBreak[subject].total++;
                if (ans.isCorrect) {
                  subjBreak[subject].correct++;
                  subjBreak[subject].score += q.marks;
                } else if (q.questionType === 'MCQ' && ans.selectedAnswer) {
                  const penalty = q.marks === 1 ? (1.0 / 3.0) : (2.0 / 3.0);
                  subjBreak[subject].score -= penalty;
                }
              }
            });
          }

          Object.keys(subjBreak).forEach(k => {
            subjBreak[k].score = parseFloat(subjBreak[k].score.toFixed(2));
          });

          return {
            ...item,
            date: item.submittedAt,
            questions: questionsList,
            answers: answersObj,
            subjectBreakdown: subjBreak
          };
        });

        setHistory(mapped);
        CacheService.set('mock_history', mapped, 300000); // 5 mins TTL
      } catch (err) {
        console.error("Failed to load history from backend, falling back to localStorage", err);
        try {
          const raw = localStorage.getItem('gate_mock_history');
          setHistory(raw ? JSON.parse(raw) : []);
        } catch { if (!cached) setHistory([]); }
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const clearHistory = async () => {
    if (!window.confirm('Clear all mock history? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/api/simulator/history`, {
        headers: AuthService.getAuthHeader()
      });
    } catch (err) {
      console.error("Failed to delete history from backend:", err);
    }
    localStorage.removeItem('gate_mock_history');
    setHistory([]);
  };

  if (loading) {
    return <AIRGATELoader text="Loading Attempt Performance Records..." />;
  }

  if (history.length === 0) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
          No Mock Tests Yet
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '28px' }}>
          Your mock exam attempts will appear here after you complete or submit a test.
        </p>
        <button
          onClick={() => navigate('/simulator')}
          style={{
            padding: '12px 32px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          🏆 Start a Mock Test
        </button>
      </div>
    );
  }

  // Overall stats across all attempts
  const totalAttempts = history.length;
  const bestScore = Math.max(...history.map(a => a.score));
  const avgScore = (history.reduce((sum, a) => sum + a.score, 0) / totalAttempts).toFixed(1);
  const avgAccuracy = (
    history.reduce((sum, a) => sum + (a.correctCount / Math.max(a.totalQuestions, 1)) * 100, 0) / totalAttempts
  ).toFixed(1);

  return (
    <div style={{ padding: '32px 24px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            📋 Mock Test History
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {totalAttempts} attempt{totalAttempts !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/simulator')}
            style={{
              padding: '10px 20px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            New Test
          </button>
          <button
            onClick={clearHistory}
            style={{
              padding: '10px 16px', borderRadius: '10px',
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.05)',
              color: 'var(--color-error)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-body)',
            }}
          >
            <FiTrash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Attempts', value: totalAttempts, icon: '🎯', color: 'var(--color-primary)' },
          { label: 'Best Score', value: `${bestScore} / 100`, icon: '🏆', color: '#f59e0b' },
          { label: 'Avg Score', value: `${avgScore} / 100`, icon: '📊', color: 'var(--color-secondary)' },
          { label: 'Avg Accuracy', value: `${avgAccuracy}%`, icon: '✅', color: 'var(--color-success)' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
            padding: '16px',
          }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '8px' }}>{s.icon}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-title)' }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Attempt List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {history.map((attempt, i) => {
          const accuracy = attempt.totalQuestions > 0
            ? ((attempt.correctCount / attempt.totalQuestions) * 100).toFixed(1)
            : 0;
          const isExpanded = expanded === attempt.id;

          return (
            <div key={attempt.id} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px',
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}>
              {/* Attempt header row */}
              <div
                onClick={() => setExpanded(isExpanded ? null : attempt.id)}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                }}
              >
                {/* Attempt number */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: '0.85rem',
                }}>
                  #{totalAttempts - i}
                </div>

                {/* Date + mode badge */}
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{fmtDate(attempt.date)}</span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                      background: attempt.mode === 'custom' ? 'rgba(6, 182, 212, 0.12)' : attempt.mode === 'hybrid' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                      color: attempt.mode === 'custom' ? 'var(--color-secondary)' : attempt.mode === 'hybrid' ? '#c084fc' : 'var(--color-primary)',
                      border: `1px solid ${attempt.mode === 'custom' ? 'rgba(6, 182, 212, 0.2)' : attempt.mode === 'hybrid' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`
                    }}>
                      {attempt.mode === 'custom' ? '🎯 Subject Practice' : attempt.mode === 'hybrid' ? '✨ Smart Hybrid' : '📜 PYQ Full Mock'}
                    </span>
                  </div>
                  {attempt.autoSubmitted && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px',
                      borderRadius: '50px', background: 'rgba(239,68,68,0.1)',
                      color: 'var(--color-error)', border: '1px solid rgba(239,68,68,0.2)',
                      marginTop: '3px', display: 'inline-block',
                    }}>
                      Auto-Submitted
                    </span>
                  )}
                </div>

                {/* Score */}
                <div style={{ textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: attempt.score >= 50 ? 'var(--color-success)' : attempt.score >= 25 ? '#f59e0b' : 'var(--color-error)', fontFamily: 'var(--font-title)' }}>
                    {attempt.score}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>/ {attempt.questions?.reduce((acc, q) => acc + (q.marks || 1), 0) || 100} marks</div>
                </div>

                {/* Stats mini row */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--color-success)' }}>
                    <FiCheckCircle size={14} /> {attempt.correctCount}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--color-error)' }}>
                    <FiXCircle size={14} /> {attempt.incorrectCount}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <FiMinus size={14} /> {attempt.skippedCount}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <FiClock size={14} /> {fmt(attempt.timeTakenSeconds)}
                  </div>
                </div>

                {/* Accuracy bar */}
                <div style={{ minWidth: '100px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{accuracy}% accuracy</div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${accuracy}%`,
                      borderRadius: '3px',
                      background: accuracy >= 60 ? 'var(--color-success)' : accuracy >= 35 ? '#f59e0b' : 'var(--color-error)',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{isExpanded ? '▲' : '▼'}</div>
              </div>

              {/* Expanded attempt details (breakdown + question review) */}
              {isExpanded && (
                <AttemptDetailPanel attempt={attempt} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttemptDetailPanel({ attempt }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showExp, setShowExp] = useState(false);

  const qs = attempt.questions || [];
  const ans = attempt.answers || {};
  const activeQuestion = qs[activeIndex];

  // Helper: check correctness
  const evaluateAnswer = (q, selected) => {
    if (!selected) return false;
    const correct = q.aiSuggestedAnswer;
    if (!correct) return false;

    let c = correct.trim().toLowerCase().replace(/^(option\s+)/i, '');
    let s = selected.trim().toLowerCase().replace(/^(option\s+)/i, '');
    
    if (c === s) return true;

    // Robust check for MSQ answers
    if (q.questionType === 'MSQ') {
      const cLetters = c.toUpperCase().replace(/[^A-D]/g, '').split('').sort().join('');
      const sLetters = s.toUpperCase().replace(/[^A-D]/g, '').split('').sort().join('');
      return cLetters === sLetters && cLetters.length > 0;
    }

    try {
      const sVal = parseFloat(s);
      if (!isNaN(sVal)) {
        const rangePattern = /[-:to]+/;
        const parts = c.split(rangePattern);
        if (parts.length === 2) {
          const min = parseFloat(parts[0].trim());
          const max = parseFloat(parts[1].trim());
          return sVal >= min && sVal <= max;
        } else if (parts.length === 1) {
          const cVal = parseFloat(c);
          return Math.abs(cVal - sVal) < 1e-4;
        }
      }
    } catch (e) {}
    return false;
  };

  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '20px',
      background: 'rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* 1. Subject Breakdown Card section */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FiBarChart2 size={13} /> Subject-wise Breakdown
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
          {attempt.subjectBreakdown && Object.entries(attempt.subjectBreakdown).map(([subj, data]) => {
            const subAccuracy = data.total > 0 ? ((data.correct / data.total) * 100).toFixed(0) : 0;
            return (
              <div key={subj} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '10px',
                padding: '12px',
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {subj}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>{data.correct}/{data.total} correct</span>
                  <span style={{ color: data.score >= 0 ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 700 }}>
                    {data.score >= 0 ? '+' : ''}{typeof data.score === 'number' ? data.score.toFixed(1) : data.score}
                  </span>
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px',
                    width: `${subAccuracy}%`,
                    background: subAccuracy >= 60 ? 'var(--color-success)' : subAccuracy >= 35 ? '#f59e0b' : 'var(--color-error)',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {attempt.negativeWastage > 0 && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '-10px' }}>
          ⚠️ Negative marking cost: <strong>−{attempt.negativeWastage.toFixed(2)} marks</strong>
        </div>
      )}

      {/* 2. Question-by-Question Review Section */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>
          📝 Question-by-Question Review
        </div>

        {qs.length === 0 ? (
          <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', backgroundColor: 'rgba(255,255,255,0.01)', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiAlertCircle /> Full question-by-question review is only available for tests completed after this update.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap' }}>
            
            {/* Left side: Grid of questions */}
            <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Select question to review:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '12px', borderRadius: '12px' }}>
                {qs.map((q, idx) => {
                  const userAns = ans[q.id];
                  const isCorrect = evaluateAnswer(q, userAns);
                  const isSkipped = !userAns;

                  let btnBg = 'rgba(255,255,255,0.05)';
                  let btnColor = 'var(--text-secondary)';
                  let border = idx === activeIndex ? '2px solid var(--color-secondary)' : '1px solid rgba(255,255,255,0.08)';

                  if (isSkipped) {
                    btnBg = 'rgba(255,255,255,0.02)';
                    btnColor = 'var(--text-muted)';
                  } else if (isCorrect) {
                    btnBg = 'rgba(34, 197, 94, 0.15)';
                    btnColor = 'var(--color-success)';
                  } else {
                    btnBg = 'rgba(239, 68, 68, 0.15)';
                    btnColor = 'var(--color-error)';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => { setActiveIndex(idx); setShowExp(false); }}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: '50%',
                        backgroundColor: btnBg,
                        color: btnColor,
                        border: border,
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Mini Legend */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.2)', border: '1px solid var(--color-success)' }} /> Correct
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--color-error)' }} /> Incorrect
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }} /> Skipped
                </div>
              </div>
            </div>

            {/* Right side: Selected question review */}
            {activeQuestion && (
              <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-secondary)' }}>
                      Question {activeIndex + 1}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '50px', backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {activeQuestion.questionType}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {activeQuestion.marks} Mark{activeQuestion.marks !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Subject Name badge */}
                <div style={{ display: 'flex' }}>
                  <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(139,92,246,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(139,92,246,0.15)', padding: '2px 10px', borderRadius: '50px', fontWeight: 700 }}>
                    {activeQuestion.subjectName}
                  </span>
                </div>

                {/* Question Text */}
                <div className="review-question-text" style={{ fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {renderQuestionText(activeQuestion.text)}
                </div>

                {/* Question Image */}
                {activeQuestion.imagePath && (
                  <div style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: '8px', padding: '8px', border: '1px solid #e5e7eb' }}>
                    <img
                      src={getAssetUrl(activeQuestion.imagePath)}
                      alt="Question diagram"
                      style={{ maxWidth: '100%', maxHeight: '200px', display: 'block', objectFit: 'contain' }}
                      onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'none'; }}
                    />
                  </div>
                )}

                {/* Answering fields */}
                {activeQuestion.questionType === 'MCQ' || activeQuestion.questionType === 'MSQ' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeQuestion.options?.map((opt) => {
                      const userAns = ans[activeQuestion.id] || '';
                      const correctAns = activeQuestion.aiSuggestedAnswer || '';

                      const userLetters = userAns.toUpperCase().replace(/[^A-D]/g, '').split('');
                      const correctLetters = correctAns.toUpperCase().replace(/[^A-D]/g, '').split('');

                      const isSelected = userLetters.includes(opt.optionLabel);
                      const isCorrect = correctLetters.includes(opt.optionLabel);

                      let cardBg = 'rgba(255,255,255,0.01)';
                      let cardBorder = '1px solid rgba(255,255,255,0.04)';
                      let badge = null;

                      if (isSelected && isCorrect) {
                        cardBg = 'rgba(34, 197, 94, 0.08)';
                        cardBorder = '2px solid var(--color-success)';
                        badge = <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--color-success)', color: '#fff', fontWeight: 800 }}>Your Correct Option</span>;
                      } else if (isSelected && !isCorrect) {
                        cardBg = 'rgba(239, 68, 68, 0.08)';
                        cardBorder = '2px solid var(--color-error)';
                        badge = <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--color-error)', color: '#fff', fontWeight: 800 }}>Your Choice (Incorrect)</span>;
                      } else if (!isSelected && isCorrect) {
                        cardBg = 'rgba(34, 197, 94, 0.03)';
                        cardBorder = '2px dashed rgba(34, 197, 94, 0.4)';
                        badge = <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(34,197,94,0.15)', color: 'var(--color-success)', border: '1px solid rgba(34,197,94,0.2)', fontWeight: 700 }}>Correct Option</span>;
                      }

                      return (
                        <div key={opt.id} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '12px 16px',
                          backgroundColor: cardBg,
                          border: cardBorder,
                          borderRadius: '10px',
                          fontSize: '0.88rem',
                        }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-secondary)', fontSize: '0.85rem', marginTop: '1px' }}>
                            ({opt.optionLabel})
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ color: 'var(--text-primary)' }}>
                              {renderOptionContent(opt.optionText)}
                            </div>
                            {badge && <div style={{ display: 'flex', marginTop: '2px' }}>{badge}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* NAT details */
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const userVal = ans[activeQuestion.id];
                      const correctVal = activeQuestion.aiSuggestedAnswer;
                      const isCorrect = evaluateAnswer(activeQuestion, userVal);

                      return (
                        <>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Your Submitted Answer:</span>
                            {userVal ? (
                              <strong style={{ fontSize: '0.9rem', color: isCorrect ? 'var(--color-success)' : 'var(--color-error)' }}>
                                {userVal} {isCorrect ? '✅ (Correct)' : '❌ (Incorrect)'}
                              </strong>
                            ) : (
                              <em style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Skipped</em>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Correct Answer Value/Range:</span>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--color-success)' }}>
                              {correctVal}
                            </strong>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* AI Explanation collapsible */}
                {activeQuestion.aiSuggestedExplanation && (
                  <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                    <button
                      onClick={() => setShowExp(!showExp)}
                      style={{
                        background: 'rgba(139,92,246,0.05)',
                        border: '1px solid rgba(139,92,246,0.15)',
                        color: 'var(--color-primary)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <FiCpu /> {showExp ? 'Hide AI Explanation' : 'View Step-by-Step AI Explanation'}
                    </button>

                    {showExp && (
                      <div className="math-renderer" style={{
                        marginTop: '12px',
                        padding: '16px',
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        lineHeight: 1.6,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {renderQuestionText(activeQuestion.aiSuggestedExplanation)}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
}
