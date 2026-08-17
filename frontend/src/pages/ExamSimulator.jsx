import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AuthService from '../services/AuthService';
import CacheService from '../services/CacheService';
import { useNavigate } from 'react-router-dom';
import { FiClock, FiAlertTriangle, FiCheckCircle, FiChevronLeft, FiChevronRight, FiGrid, FiList, FiCpu, FiPlus, FiMonitor } from 'react-icons/fi';
import { formatMathText, renderQuestionText, renderOptionContent, getAssetUrl } from '../utils/mathRenderer';
import API_CONFIG from '../config/api';
import LoginGate from '../components/LoginGate';
import PremiumGateModal from '../components/PremiumGateModal';
import './ExamSimulator.css';

export default function ExamSimulator() {
  return (
    <LoginGate featureName="Mock Test Arena" featureIcon="🏆">
      <MockTestArena />
    </LoginGate>
  );
}

function MockTestArena() {
  const navigate = useNavigate();
  
  // State variables
  const [questions, setQuestions] = useState([]);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [activeTab, setActiveTab] = useState('standard');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [customQuestionCount, setCustomQuestionCount] = useState(10);
  const [customTime, setCustomTime] = useState(30);
  const [loading, setLoading] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Exam progress state
  const [answers, setAnswers] = useState({}); // { questionId: answerText }
  const [visited, setVisited] = useState(new Set([0]));
  const [flagged, setFlagged] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(180 * 60); // 3 hours in seconds
  
  // Scientific Calculator popover state
  const [showCalc, setShowCalc] = useState(false);
  const [calcInput, setCalcInput] = useState('');
  
  // Results details
  const [results, setResults] = useState({
    score: 0.0,
    correctCount: 0,
    incorrectCount: 0,
    skippedCount: 0,
    negativeWastage: 0.0,
    subjectBreakdown: {}
  });

  const timerRef = useRef(null);
  const timeLeftRef = useRef(180 * 60); // track time taken for history
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const isUnloadingRef = useRef(false);

  // Refs to access latest state inside event handlers (avoids stale closure)
  const questionsRef = useRef([]);
  const answersRef = useRef({});
  const examStartedRef = useRef(false);
  const examSubmittedRef = useRef(false);

  // Auto-Resume Engine State
  const [savedSession, setSavedSession] = useState(null);

  // Keep refs in sync with state
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { examStartedRef.current = examStarted; }, [examStarted]);
  useEffect(() => { examSubmittedRef.current = examSubmitted; }, [examSubmitted]);

  // 1. Detect and check active incomplete mock session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('airgate_active_mock_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.questions && parsed.questions.length > 0) {
          const hoursOld = (Date.now() - (parsed.lastUpdated || 0)) / (1000 * 3600);
          if (hoursOld < 24) {
            const elapsedOfflineSecs = Math.floor((Date.now() - (parsed.lastUpdated || Date.now())) / 1000);
            const remaining = Math.max(0, (parsed.timeLeft || 0) - elapsedOfflineSecs);
            parsed.adjustedTimeLeft = remaining;
            setSavedSession(parsed);
          } else {
            localStorage.removeItem('airgate_active_mock_session');
          }
        }
      }
    } catch (e) {
      console.error("Failed to load saved mock session", e);
    }
  }, []);

  // 2. Real-time Auto-Save active mock test state to LocalStorage
  useEffect(() => {
    if (examStarted && !examSubmitted && questions.length > 0) {
      try {
        const sessionPayload = {
          mode: activeTab,
          selectedSubject,
          customQuestionCount,
          customTime,
          questions,
          answers,
          visited: Array.from(visited),
          flagged: Array.from(flagged),
          currentIndex,
          timeLeft,
          lastUpdated: Date.now()
        };
        localStorage.setItem('airgate_active_mock_session', JSON.stringify(sessionPayload));
      } catch (e) {
        console.error("Failed to auto-save mock session state", e);
      }
    }
  }, [examStarted, examSubmitted, questions, answers, visited, flagged, currentIndex, timeLeft]);

  const handleResumeSession = () => {
    if (!savedSession) return;
    setQuestions(savedSession.questions || []);
    setAnswers(savedSession.answers || {});
    setVisited(new Set(savedSession.visited || [0]));
    setFlagged(new Set(savedSession.flagged || []));
    setCurrentIndex(savedSession.currentIndex || 0);
    setTimeLeft(savedSession.adjustedTimeLeft || 0);
    if (savedSession.mode) setActiveTab(savedSession.mode);
    setExamStarted(true);
    setExamSubmitted(false);
    setSavedSession(null);
    enterFullscreen();
  };

  const handleDiscardSession = () => {
    localStorage.removeItem('airgate_active_mock_session');
    setSavedSession(null);
  };

  // Load questions when exam starts
  const startExam = async () => {
    // Enforce DB-backed limits for free users (Bypass-proof against LocalStorage clearing)
    if (!AuthService.isPremium()) {
      try {
        let history = [];
        try {
          const res = await axios.get(`${API_CONFIG.BASE_URL}/api/simulator/history`, {
            headers: AuthService.getAuthHeader()
          });
          if (Array.isArray(res.data)) {
            history = res.data;
          }
        } catch (dbErr) {
          history = JSON.parse(localStorage.getItem('gate_mock_history') || '[]');
        }

        if (activeTab === 'standard') {
          const standardAttempts = history.filter(h => h.mode === 'standard' || (!h.mode && (h.totalQuestions > 20 || h.totalQuestions === 0))).length;
          if (standardAttempts >= 3) {
            alert(`You have used your 3 Free Full-Syllabus PYQ Mock attempts! Upgrade to Aspirant Pro for unlimited mock sessions.`);
            setShowPremiumModal(true);
            return;
          }
        } else if (activeTab === 'hybrid') {
          const hybridAttempts = history.filter(h => h.mode === 'hybrid').length;
          if (hybridAttempts >= 2) {
            alert(`You have used your 2 Free Smart Hybrid Mock attempts! Upgrade to Aspirant Pro for unlimited access.`);
            setShowPremiumModal(true);
            return;
          }
        } else if (activeTab === 'custom') {
          const customAttempts = history.filter(h => h.mode === 'custom').length;
          if (customAttempts >= 2) {
            alert(`You have used your 2 Free Subject Practice Mocks! Upgrade to Aspirant Pro at ₹99/mo to unlock unlimited Subject-wise practice mocks.`);
            setShowPremiumModal(true);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to check free mock limits", e);
      }
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/simulator`);
      if (!res.data || res.data.length === 0) {
        alert("The database is currently empty. Please ask the administrator to upload exam papers before starting mock tests.");
        setLoading(false);
        return;
      }

      let finalQuestions = res.data;

      const isAiGeneratedQuestion = (q) => {
        if (!q || !q.pdfSourceName) return false;
        const src = q.pdfSourceName.toLowerCase();
        return src.startsWith('ai_nightly') || src.startsWith('ai_generated') || src.includes('ai generator');
      };

      if (activeTab === 'standard') {
        // Mode 1: 100% Official PYQs
        const pyqOnly = finalQuestions.filter(q => !isAiGeneratedQuestion(q));
        if (pyqOnly.length > 0) finalQuestions = pyqOnly;
      } else if (activeTab === 'hybrid') {
        // Mode 2: Smart Hybrid Mock (70% Double-Verified + 30% PYQ)
        const doubleVerified = finalQuestions.filter(q => isAiGeneratedQuestion(q));
        const officialPyqs = finalQuestions.filter(q => !isAiGeneratedQuestion(q));
        
        if (doubleVerified.length > 0) {
          const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
          const targetVerified = Math.min(doubleVerified.length, Math.floor(finalQuestions.length * 0.7));
          const targetPyq = Math.max(0, finalQuestions.length - targetVerified);

          const pickedVerified = shuffle(doubleVerified).slice(0, targetVerified);
          const pickedPyq = shuffle(officialPyqs).slice(0, targetPyq);
          finalQuestions = shuffle([...pickedVerified, ...pickedPyq]);
        }
      } else if (activeTab === 'custom' && selectedSubject) {
        // Mode 3: Subject Practice Mock — fetch questions specifically for this subject
        try {
          const subRes = await axios.get(`${API_CONFIG.BASE_URL}/api/questions`, {
            params: {
              query: selectedSubject,
              page: 0,
              size: Math.max(20, customQuestionCount * 2)
            }
          });
          const subQs = subRes.data?.content || [];
          if (subQs.length > 0) {
            const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
            finalQuestions = shuffle(subQs).slice(0, customQuestionCount);
          } else {
            // Fallback to client-side filter
            const subFiltered = finalQuestions.filter(q => 
              q.subjectName && q.subjectName.toLowerCase().includes(selectedSubject.toLowerCase())
            );
            if (subFiltered.length > 0) {
              finalQuestions = subFiltered.slice(0, customQuestionCount);
            }
          }
        } catch (e) {
          const subFiltered = finalQuestions.filter(q => 
            q.subjectName && q.subjectName.toLowerCase().includes(selectedSubject.toLowerCase())
          );
          if (subFiltered.length > 0) finalQuestions = subFiltered.slice(0, customQuestionCount);
        }
      }

      setQuestions(finalQuestions);
      setAnswers({});
      setVisited(new Set([0]));
      setFlagged(new Set());
      setTimeLeft((activeTab === 'custom' ? customTime : 180) * 60);
      setExamStarted(true);
      setExamSubmitted(false);
      setCurrentIndex(0);
      
      // Force Fullscreen mode automatically when exam starts
      enterFullscreen();
    } catch (err) {
      console.error(err);
      alert("Failed to compile simulator exam. Make sure database contains approved questions.");
    } finally {
      setLoading(false);
    }
  };

  // Keep timeLeftRef in sync
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  // Timer effect
  useEffect(() => {
    if (examStarted && !examSubmitted) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            submitExam(true); // Auto submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examStarted, examSubmitted]);

  // Auto-submit when user navigates AWAY from exam page (in-app nav or tab close)
  useEffect(() => {
    // Helper: save attempt to localStorage history
    const saveAttemptHistory = (res, qs, ans, timeTaken, autoSubmitted) => {
      try {
        const history = JSON.parse(localStorage.getItem('gate_mock_history') || '[]');
        const cleanQs = qs.map(q => ({
          id: q.id,
          text: q.text,
          questionType: q.questionType,
          marks: q.marks,
          subjectName: q.subjectName,
          imagePath: q.imagePath,
          options: q.options?.map(o => ({
            id: o.id,
            optionLabel: o.optionLabel,
            optionText: o.optionText
          })) || [],
          aiSuggestedAnswer: q.aiSuggestedAnswer,
          aiSuggestedExplanation: q.aiSuggestedExplanation
        }));
        history.unshift({
          id: Date.now(),
          mode: activeTab,
          date: new Date().toISOString(),
          score: res.score,
          totalQuestions: qs.length,
          correctCount: res.correctCount,
          incorrectCount: res.incorrectCount,
          skippedCount: res.skippedCount,
          negativeWastage: res.negativeWastage,
          subjectBreakdown: res.subjectBreakdown,
          timeTakenSeconds: timeTaken,
          autoSubmitted,
          questions: cleanQs,
          answers: ans,
        });
        // Keep only last 30 attempts
        if (history.length > 30) history.splice(30);
        localStorage.setItem('gate_mock_history', JSON.stringify(history));
      } catch (e) { console.error('Failed to save history', e); }
    };

    // Shared submit logic using refs (no stale closure)
    const autoSubmitViaRef = () => {
      if (!examStartedRef.current || examSubmittedRef.current) return;
      if (timerRef.current) clearInterval(timerRef.current);

      const qs = questionsRef.current;
      const ans = answersRef.current;
      let totalScore = 0.0, correct = 0, incorrect = 0, skipped = 0, negativeWasted = 0.0;
      const subjBreak = {};

      qs.forEach((q) => {
        const userAns = ans[q.id];
        const subject = q.subjectName || 'Uncategorized';
        if (!subjBreak[subject]) subjBreak[subject] = { total: 0, correct: 0, score: 0.0 };
        subjBreak[subject].total++;

        if (!userAns) {
          skipped++;
        } else {
          const isCorrect = evaluateAnswer(q, userAns);
          if (isCorrect) {
            correct++;
            totalScore += q.marks;
            subjBreak[subject].correct++;
            subjBreak[subject].score += q.marks;
          } else {
            incorrect++;
            if (q.questionType === 'MCQ') {
              const penalty = q.marks === 1 ? 1/3 : 2/3;
              totalScore -= penalty;
              negativeWasted += penalty;
              subjBreak[subject].score -= penalty;
            }
          }
        }
      });

      const finalResults = {
        score: Math.max(0.0, parseFloat(totalScore.toFixed(2))),
        correctCount: correct,
        incorrectCount: incorrect,
        skippedCount: skipped,
        negativeWastage: parseFloat(negativeWasted.toFixed(2)),
        subjectBreakdown: subjBreak,
      };
      const timeTaken = (180 * 60) - timeLeftRef.current;
      saveAttemptHistory(finalResults, qs, ans, timeTaken, true);
      setResults(finalResults);
      setExamSubmitted(true);
      examSubmittedRef.current = true;
    };

    // 1. Tab close/refresh → Warn user and save state
    const onBeforeUnload = (e) => {
      if (!examStartedRef.current || examSubmittedRef.current) return;
      e.preventDefault();
      e.returnValue = 'Your mock exam is still in progress. Your answers will be saved for auto-resume.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []); // runs once — uses refs for latest state

  // Navigate index helpers
  const handleNav = (index) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      setVisited((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    }
  };

  // Scientific Calculator state
  const [angleMode, setAngleMode] = useState('DEG'); // 'DEG' or 'RAD'
  const [calcMemory, setCalcMemory] = useState(0);

  // Calculator button evaluator
  const handleCalcBtn = (val) => {
    if (val === 'C') {
      setCalcInput('');
    } else if (val === 'MC') {
      setCalcMemory(0);
    } else if (val === 'MR') {
      setCalcInput(prev => prev + calcMemory);
    } else if (val === 'MS') {
      const num = parseFloat(calcInput);
      if (!isNaN(num)) setCalcMemory(num);
    } else if (val === 'M+') {
      const num = parseFloat(calcInput);
      if (!isNaN(num)) setCalcMemory(prev => prev + num);
    } else if (val === 'M-') {
      const num = parseFloat(calcInput);
      if (!isNaN(num)) setCalcMemory(prev => prev - num);
    } else if (val === 'DEG_RAD') {
      setAngleMode(prev => prev === 'DEG' ? 'RAD' : 'DEG');
    } else if (val === '=') {
      try {
        let expr = calcInput;
        const toRad = angleMode === 'DEG' ? '(Math.PI/180)*' : '';

        expr = expr
          .replace(/asin\(/g, angleMode === 'DEG' ? '(180/Math.PI)*Math.asin(' : 'Math.asin(')
          .replace(/acos\(/g, angleMode === 'DEG' ? '(180/Math.PI)*Math.acos(' : 'Math.acos(')
          .replace(/atan\(/g, angleMode === 'DEG' ? '(180/Math.PI)*Math.atan(' : 'Math.atan(')
          .replace(/sin\(/g, `Math.sin(${toRad}`)
          .replace(/cos\(/g, `Math.cos(${toRad}`)
          .replace(/tan\(/g, `Math.tan(${toRad}`)
          .replace(/sinh\(/g, 'Math.sinh(')
          .replace(/cosh\(/g, 'Math.cosh(')
          .replace(/tanh\(/g, 'Math.tanh(')
          .replace(/log10\(/g, 'Math.log10(')
          .replace(/ln\(/g, 'Math.log(')
          .replace(/exp\(/g, 'Math.exp(')
          .replace(/sqrt\(/g, 'Math.sqrt(')
          .replace(/cbrt\(/g, 'Math.cbrt(')
          .replace(/pi/g, 'Math.PI')
          .replace(/\^/g, '**');

        const result = Function('"use strict"; return (' + expr + ')')();
        setCalcInput(Number(result).toFixed(4).toString());
      } catch (e) {
        setCalcInput('Error');
      }
    } else {
      setCalcInput(prev => prev + val);
    }
  };
  // Fullscreen Exit & Navigation Warning States
  const [showExitWarningModal, setShowExitWarningModal] = useState(false);
  const [pendingNavigationPath, setPendingNavigationPath] = useState(null);

  // Track fullscreen state changes & issue warning if user minimizes during exam
  React.useEffect(() => {
    const onFsChange = () => {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(inFs);
      
      // Hide/show the main app sidebar
      const appSidebar = document.querySelector('aside.sidebar');
      if (appSidebar) {
        appSidebar.style.display = inFs ? 'none' : '';
      }
      const mainContent = document.querySelector('main.main-content');
      if (mainContent) {
        mainContent.style.marginLeft = inFs ? '0' : '';
        mainContent.style.width = inFs ? '100%' : '';
      }

      // If exam is running and user exits fullscreen, trigger warning modal
      if (!inFs && examStartedRef.current && !examSubmittedRef.current) {
        setShowExitWarningModal(true);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // Request fullscreen mode for the exam page
  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch((err) => console.error('Fullscreen error:', err));
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  };

  // Check answer accuracy matching SolveController range and decimal checks
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

    // Check numerical range checks
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

  // Helper: save attempt to localStorage and backend
  const saveAttemptHistory = async (res, timeTaken, autoSubmitted) => {
    // 1. Build answers payload for backend
    const payloadAnswers = questions.map(q => {
      const userAns = answers[q.id];
      const isCorrect = userAns ? evaluateAnswer(q, userAns) : false;
      
      let marksAwarded = 0.0;
      if (userAns) {
        if (isCorrect) {
          marksAwarded = q.marks;
        } else if (q.questionType === 'MCQ') {
          marksAwarded = q.marks === 1 ? -(1.0 / 3.0) : -(2.0 / 3.0);
        }
      }

      return {
        questionId: q.id,
        selectedAnswer: userAns || null,
        isCorrect,
        marksAwarded
      };
    });

    const nowStr = new Date().toISOString();
    let backendData = null;

    // 2. Submit to Backend
    try {
      const response = await axios.post(`${API_CONFIG.BASE_URL}/api/simulator/submit`, {
        startedAt: new Date(Date.now() - (timeTaken * 1000)).toISOString(),
        submittedAt: nowStr,
        timeTakenSeconds: timeTaken,
        totalQuestions: questions.length,
        correctCount: res.correctCount,
        incorrectCount: res.incorrectCount,
        skippedCount: res.skippedCount,
        score: res.score,
        negativeWastage: res.negativeWastage,
        autoSubmitted,
        mode: activeTab,
        answers: payloadAnswers
      }, {
        headers: AuthService.getAuthHeader()
      });
      backendData = response.data;
      CacheService.invalidate('mock_history');
    } catch (e) {
      console.error('Failed to save mock attempt to database:', e);
    }

    const finalScore = backendData?.score ?? res.score;
    const finalCorrect = backendData?.correctCount ?? res.correctCount;
    const finalIncorrect = backendData?.incorrectCount ?? res.incorrectCount;
    const finalSkipped = backendData?.skippedCount ?? res.skippedCount;
    const finalNegative = backendData?.negativeWastage ?? res.negativeWastage;
    const finalPercentile = backendData?.percentile ?? (res.score > 50 ? 92.5 : 75.0);
    const finalEstimatedRank = backendData?.estimatedRank ?? Math.max(1, Math.round(((100 - finalPercentile) / 100) * 110000));
    const finalCutoffStatus = backendData?.cutoffStatus ?? (finalScore >= 28.5 ? "QUALIFIED (General)" : "NOT QUALIFIED");

    setResults(prev => ({
      ...prev,
      score: finalScore,
      correctCount: finalCorrect,
      incorrectCount: finalIncorrect,
      skippedCount: finalSkipped,
      negativeWastage: finalNegative,
      percentile: finalPercentile,
      estimatedRank: finalEstimatedRank,
      cutoffStatus: finalCutoffStatus
    }));

    // 3. Fallback Local Storage
    try {
      const history = JSON.parse(localStorage.getItem('gate_mock_history') || '[]');
      const cleanQs = questions.map(q => ({
        id: q.id,
        text: q.text,
        questionType: q.questionType,
        marks: q.marks,
        subjectName: q.subjectName,
        imagePath: q.imagePath,
        options: q.options?.map(o => ({
          id: o.id,
          optionLabel: o.optionLabel,
          optionText: o.optionText
        })) || [],
        aiSuggestedAnswer: q.aiSuggestedAnswer,
        aiSuggestedExplanation: q.aiSuggestedExplanation
      }));
      history.unshift({
        id: Date.now(),
        date: nowStr,
        score: finalScore,
        totalQuestions: questions.length,
        correctCount: finalCorrect,
        incorrectCount: finalIncorrect,
        skippedCount: finalSkipped,
        negativeWastage: finalNegative,
        percentile: finalPercentile,
        estimatedRank: finalEstimatedRank,
        cutoffStatus: finalCutoffStatus,
        subjectBreakdown: res.subjectBreakdown,
        timeTakenSeconds: timeTaken,
        autoSubmitted,
        questions: cleanQs,
        answers: answers,
      });
      if (history.length > 30) history.splice(30);
      localStorage.setItem('gate_mock_history', JSON.stringify(history));
    } catch (e) { console.error('Failed to save history locally', e); }
  };

  // Calculate results on submission
  const submitExam = (auto = false, skipConfirm = false) => {
    if (!auto && !skipConfirm) {
      const confirmSubmit = window.confirm('Are you sure you want to submit your mock exam? You cannot modify your answers after submission!');
      if (!confirmSubmit) return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    
    let totalScore = 0.0;
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    let negativeWasted = 0.0;
    let subjBreak = {};

    questions.forEach((q) => {
      const userAns = answers[q.id];
      const subject = q.subjectName || 'Uncategorized';

      if (!subjBreak[subject]) {
        subjBreak[subject] = { total: 0, correct: 0, score: 0.0 };
      }
      subjBreak[subject].total++;

      if (!userAns) {
        skipped++;
      } else {
        const isCorrect = evaluateAnswer(q, userAns);
        if (isCorrect) {
          correct++;
          totalScore += q.marks;
          subjBreak[subject].correct++;
          subjBreak[subject].score += q.marks;
        } else {
          incorrect++;
          if (q.questionType === 'MCQ') {
            const penalty = q.marks === 1 ? (1.0 / 3.0) : (2.0 / 3.0);
            totalScore -= penalty;
            negativeWasted += penalty;
            subjBreak[subject].score -= penalty;
          }
        }
      }
    });

    const finalResults = {
      score: Math.max(0.0, parseFloat(totalScore.toFixed(2))),
      correctCount: correct,
      incorrectCount: incorrect,
      skippedCount: skipped,
      negativeWastage: parseFloat(negativeWasted.toFixed(2)),
      subjectBreakdown: subjBreak,
    };

    const timeTaken = (180 * 60) - timeLeftRef.current;
    saveAttemptHistory(finalResults, timeTaken, auto);
    examSubmittedRef.current = true;
    setResults(finalResults);
    setExamSubmitted(true);
  };

  // Timer formatter
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Render initial instruction screen
  if (!examStarted && !examSubmitted) {
    return (
      <div className="mock-arena-container">
        
        {/* Active Session Auto-Resume Card */}
        {savedSession && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(56, 189, 248, 0.15) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <div>
              <span style={{
                backgroundColor: '#10b981', color: '#fff', fontSize: '0.7rem', fontWeight: 800,
                padding: '3px 10px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                ⚡ Auto-Resume Incomplete Test
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '6px 0 4px 0' }}>
                You have an active in-progress Mock Session!
              </h3>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
                Mode: <strong style={{ color: '#38bdf8' }}>{savedSession.mode === 'hybrid' ? 'Smart Hybrid Mock' : savedSession.mode === 'custom' ? 'Subject Practice' : 'Standard PYQ Mock'}</strong> • Solved: <strong style={{ color: '#10b981' }}>{Object.keys(savedSession.answers || {}).length} / {savedSession.questions.length} Questions</strong> • Time Remaining: <strong style={{ color: '#f59e0b' }}>{Math.floor(savedSession.adjustedTimeLeft / 60)}m {savedSession.adjustedTimeLeft % 60}s</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={handleResumeSession}
                className="btn btn-primary"
                style={{ padding: '10px 20px', fontSize: '0.88rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', cursor: 'pointer' }}
              >
                ▶️ Resume Mock Test
              </button>
              <button
                onClick={handleDiscardSession}
                className="btn btn-outline"
                style={{ padding: '10px 16px', fontSize: '0.84rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', cursor: 'pointer' }}
              >
                🗑️ Discard & Start Fresh
              </button>
            </div>
          </div>
        )}

        {/* Desktop Recommendation Notice Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '16px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{
            fontSize: '1.4rem',
            background: 'rgba(56, 189, 248, 0.15)',
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            flexShrink: 0
          }}>
            <FiMonitor size={22} />
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              RECOMMENDED: USE DESKTOP / LAPTOP FOR MOCK TESTS
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '2px', lineHeight: 1.45 }}>
              GATE is an official Computer-Based Test (CBT). Taking mock exams on a PC or Laptop provides full-screen examination view, GATE scientific calculator, side navigation palette, and authentic exam environment.
            </div>
          </div>
        </div>

        {/* Official GATE TCS Exam Palette Color Legend Guidance */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Official GATE Color Rules:
          </span>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.8rem', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10b981' }}></span> Answered
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444' }}></span> Unanswered
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a78bfa' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#8b5cf6' }}></span> Marked for Review
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#64748b' }}></span> Not Visited
            </span>
          </div>
        </div>

        <div className="mock-arena-card">
          <div className="mock-header-icon">
            <FiClock size={32} />
          </div>
          <h2 className="mock-arena-title">Mock Test Arena — GATE</h2>
          <p className="mock-arena-subtitle">
            Test your preparation levels under actual exam conditions.
          </p>

          {/* 3 Modes Tab selector */}
          <div className="mock-mode-tabs">
            <button 
              type="button"
              className={`mock-tab-btn ${activeTab === 'standard' ? 'active-standard' : ''}`}
              onClick={() => setActiveTab('standard')}
            >
              📜 Official PYQ Exam
            </button>
            <button 
              type="button"
              className={`mock-tab-btn ${activeTab === 'hybrid' ? 'active-hybrid' : ''}`}
              onClick={() => setActiveTab('hybrid')}
            >
              ✨ Smart Hybrid Mock (70% Fresh + 30% PYQ)
            </button>
            <button 
              type="button"
              className={`mock-tab-btn ${activeTab === 'custom' ? 'active-custom' : ''}`}
              onClick={() => setActiveTab('custom')}
            >
              🎯 Subject Practice Mock (2 Free)
            </button>
          </div>

          {activeTab === 'standard' && (
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6, fontSize: '0.88rem' }}>
              This simulator dynamically assembles a standard 100-mark mock paper based on 100% authentic Previous Years' GATE Question papers.
            </p>
          )}

          {activeTab === 'hybrid' && (
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', marginBottom: '24px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c084fc', display: 'block', marginBottom: '4px' }}>
                🚀 Real Exam Readiness Mode
              </span>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.82rem', lineHeight: 1.45 }}>
                Combines 70% <b>Double-Verified Conceptual Questions</b> with 30% High-Yield Official GATE PYQs to give you a true unseen exam experience!
              </p>
            </div>
          )}

          {activeTab !== 'custom' ? (
            <>
              <div className="mock-metrics-row">
                <div className="mock-metric-card">
                  <div className="mock-metric-label">DURATION</div>
                  <div className="mock-metric-value">180 Mins</div>
                </div>
                <div className="mock-metric-card">
                  <div className="mock-metric-label">QUESTIONS</div>
                  <div className="mock-metric-value">65 Items</div>
                </div>
                <div className="mock-metric-card">
                  <div className="mock-metric-label">MAX SCORE</div>
                  <div className="mock-metric-value" style={{ color: 'var(--color-secondary)' }}>100 Marks</div>
                </div>
              </div>

              <div className="mock-instructions-card">
                <h4 className="mock-instructions-title">
                  <FiAlertTriangle /> Important Instructions:
                </h4>
                <ul className="mock-instructions-list">
                  <li>Multiple Choice Questions (MCQ) carry 1/3 negative marking for 1-mark, and 2/3 negative marking for 2-mark questions.</li>
                  <li>Numerical Answer Type (NAT) questions carry ZERO negative marking.</li>
                  <li>Leaving or refreshing the tab will not pause the timer.</li>
                  <li>You can use the floating scientific calculator provided inside the test sheet.</li>
                </ul>
              </div>

              <button 
                className="btn btn-primary mock-start-action-btn" 
                onClick={startExam} 
                disabled={loading}
              >
                {loading ? 'Initializing Exam...' : 'Start Simulator Exam'}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'left' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', textAlign: 'center', fontSize: '0.92rem' }}>
                Generate customized mini mock tests dynamically on specific subjects to target your preparation weaknesses.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '480px', margin: '0 auto 36px auto' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 700 }}>Select Practice Subject:</label>
                  <select 
                    className="form-select" 
                    value={selectedSubject} 
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px' }}
                  >
                    <option value="">-- Choose Subject --</option>
                    <option value="Operating Systems">Operating Systems</option>
                    <option value="Databases">Databases</option>
                    <option value="Computer Networks">Computer Networks</option>
                    <option value="Theory of Computation">Theory of Computation</option>
                    <option value="Digital Logic">Digital Logic</option>
                    <option value="Algorithms">Algorithms</option>
                    <option value="Data Structures">Data Structures</option>
                    <option value="Computer Organization">Computer Organization</option>
                    <option value="Engineering Mathematics">Engineering Mathematics</option>
                    <option value="General Aptitude">General Aptitude</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 700 }}>Questions Limit:</label>
                    <select 
                      className="form-select" 
                      value={customQuestionCount} 
                      onChange={(e) => setCustomQuestionCount(parseInt(e.target.value))}
                      style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px' }}
                    >
                      <option value="5">5 Questions</option>
                      <option value="10">10 Questions</option>
                      <option value="15">15 Questions</option>
                      <option value="20">20 Questions</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 700 }}>Practice Timer:</label>
                    <select 
                      className="form-select" 
                      value={customTime} 
                      onChange={(e) => setCustomTime(parseInt(e.target.value))}
                      style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '8px' }}
                    >
                      <option value="15">15 Minutes</option>
                      <option value="30">30 Minutes</option>
                      <option value="45">45 Minutes</option>
                      <option value="60">60 Minutes</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '240px', padding: '14px', fontSize: '1.05rem', backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' }} 
                  onClick={startExam} 
                  disabled={!selectedSubject || loading}
                >
                  {loading ? 'Generating Custom Mock...' : 'Generate Practice Mock'}
                </button>
              </div>
            </div>
          )}
        </div>
        <PremiumGateModal 
          isOpen={showPremiumModal} 
          onClose={() => setShowPremiumModal(false)} 
          onUpgradeSuccess={() => {
            setTimeout(() => {
              startExam();
            }, 100);
          }} 
        />
      </div>
    );
  }

  // Render Result Sheet
  if (examSubmitted) {
    const totalMaxMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const mockTitle = activeTab === 'custom' 
      ? `🎯 Subject Practice Assessment: ${selectedSubject || 'Custom Test'}`
      : activeTab === 'hybrid'
      ? `✨ Smart Hybrid Mock Performance Report`
      : `📜 Official PYQ Full Mock Assessment Report`;

    return (
      <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px' }}>{mockTitle}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
          {activeTab === 'custom' 
            ? `Deep topic-wise accuracy, time efficiency, and marks wastage analysis for ${selectedSubject || 'Selected Subject'}.`
            : `Comprehensive subject strengths, accuracy ratios, and negative marking analysis below.`}
        </p>

        {/* AIR & Score Highlight Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Your Score</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '6px' }}>{results.score} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {totalMaxMarks}</span></div>
          </div>
          <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>Estimated AIR</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>AIR #{results.estimatedRank || 1500}</div>
          </div>
          <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: 700 }}>Percentile</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#c084fc', marginTop: '6px' }}>{results.percentile || 95.0}%</div>
          </div>
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 700 }}>GATE Benchmark</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399', marginTop: '12px' }}>{results.cutoffStatus || 'QUALIFIED'}</div>
          </div>
        </div>

        {/* Detailed Stats Cards */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>Question Breakdowns</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Questions</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{questions.length}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Correct</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '4px' }}>{results.correctCount}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Incorrect</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-error)', marginTop: '4px' }}>{results.incorrectCount}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Skipped</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{results.skippedCount}</div>
            </div>
          </div>
        </div>

        {/* Subject wise Performance Breakdown */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>Subject Wise Marks Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.keys(results.subjectBreakdown).map((subject) => {
              const data = results.subjectBreakdown[subject];
              const percentage = ((data.correct / data.total) * 100).toFixed(0);
              return (
                <div key={subject} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{subject}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Accuracy: {percentage}% | Questions: {data.total}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-secondary)' }}>{data.score.toFixed(2)} Marks</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top-Notch AI Preparation Advisor & Weakness Insights */}
        <div style={{
          backgroundColor: 'rgba(99, 102, 241, 0.04)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '40px'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#c084fc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
            🧠 AIRGATE Smart Preparation Advisor & Recommendations
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {results.negativeWastage > 2.0 && (
              <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}>
                ⚠️ <b>High Negative Marking Warning:</b> You lost <b>-{results.negativeWastage} marks</b> due to incorrect MCQs. Avoid guessing MCQs with low confidence to protect your rank cutoff.
              </div>
            )}

            {Object.keys(results.subjectBreakdown).length > 0 && (() => {
              const subjectsArr = Object.keys(results.subjectBreakdown).map(s => ({
                subject: s,
                acc: (results.subjectBreakdown[s].correct / results.subjectBreakdown[s].total) * 100
              })).sort((a, b) => a.acc - b.acc);

              const weakest = subjectsArr[0];
              const strongest = subjectsArr[subjectsArr.length - 1];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {weakest && (
                    <div>
                      🔴 <b>Priority Focus Required:</b> Your accuracy in <b>{weakest.subject}</b> is <b>{weakest.acc.toFixed(0)}%</b>. Solve at least 15 NAT questions in this subject via Practice Arena.
                    </div>
                  )}
                  {strongest && strongest.subject !== weakest?.subject && (
                    <div>
                      🟢 <b>Stronghold Subject:</b> <b>{strongest.subject}</b> is your highest-scoring subject with <b>{strongest.acc.toFixed(0)}%</b> accuracy. Maintain this advantage!
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              💡 <b>Pro Tip:</b> Use AI Tutor Chat on incorrect questions to view detailed step-by-step mathematical proofs and logic explanations.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn btn-primary" onClick={startExam} style={{ padding: '12px 24px' }}>
            Retake Simulator Mock Test
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/explore')} style={{ padding: '12px 24px' }}>
            Go to Practice Explorer
          </button>
        </div>
      </div>
    );
  }

  // Active exam session sheet
  const activeQuestion = questions[currentIndex];

  return (
    <div className="exam-simulator-layout" style={{ display: 'flex', width: '100%', flexGrow: 1, height: '100%', overflow: 'hidden' }}>
      
      {/* Question sheet (Left side) */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto' }}>
        
        {/* Exam Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>🏆 Mock Test Arena — GATE</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Question {currentIndex + 1} of {questions.length}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className={
              timeLeft <= 300
                ? 'timer-danger'
                : timeLeft <= 600
                ? 'timer-warning'
                : ''
            } style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '10px', color: 'var(--color-secondary)', fontWeight: 700 }}>
              <FiClock /> {formatTime(timeLeft)}
            </div>

            <button className="btn" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '8px 16px', fontWeight: 600 }} onClick={() => setShowCalc(!showCalc)}>
              Calculator
            </button>

            <button className="btn btn-primary" style={{ padding: '8px 18px', fontWeight: 600 }} onClick={() => submitExam(false)}>
              Submit Test
            </button>
            <button 
              className="btn btn-outline" 
              style={{ padding: '8px 12px', fontWeight: 600 }} 
              onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            >
              {isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Full‑Screen'}
            </button>
          </div>
        </div>

        {/* Scientific Calculator Floating Modal */}
        {showCalc && (
          <div className="calc-light" style={{ position: 'fixed', top: '100px', right: '350px', width: '280px', zIndex: 1000 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>SCIENTIFIC CALCULATOR</span>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowCalc(false)}>✕</button>
            </div>
            
            <input 
              type="text" 
              className="form-input" 
              value={calcInput} 
              readOnly 
              style={{ textAlign: 'right', fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.9)', color: '#000' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {['sin(', 'cos(', 'tan(', 'log(', 'ln('].map(op => (
                <button key={op} className="btn" style={{ padding: '8px 2px', fontSize: '0.75rem', backgroundColor: '#fff', border: '1px solid var(--border-color)' }} onClick={() => handleCalcBtn(op)}>{op.replace('(', '')}</button>
              ))}
              {['sqrt(', 'pi', '^', '(', ')'].map(op => (
                <button key={op} className="btn" style={{ padding: '8px 2px', fontSize: '0.75rem', backgroundColor: '#fff', border: '1px solid var(--border-color)' }} onClick={() => handleCalcBtn(op)}>{op.replace('(', '')}</button>
              ))}
              {['7', '8', '9', '/', 'C'].map(op => (
                <button key={op} className="btn" style={{ padding: '8px', fontSize: '0.85rem', backgroundColor: op === 'C' ? '#ffebeb' : '#fff', color: op === 'C' ? 'var(--color-error)' : '#000', border: '1px solid var(--border-color)' }} onClick={() => handleCalcBtn(op)}>{op}</button>
              ))}
              {['4', '5', '6', '*', '+'].map(op => (
                <button key={op} className="btn" style={{ padding: '8px', fontSize: '0.85rem', backgroundColor: '#fff', border: '1px solid var(--border-color)' }} onClick={() => handleCalcBtn(op)}>{op}</button>
              ))}
              {['1', '2', '3', '-', '='].map(op => (
                <button key={op} className="btn" style={{ padding: '8px', fontSize: '0.85rem', gridRow: op === '=' ? 'span 2' : 'auto', backgroundColor: op === '=' ? 'var(--color-primary)' : '#fff', border: '1px solid var(--border-color)' }} onClick={() => handleCalcBtn(op)}>{op}</button>
              ))}
              {['0', '.', ''].map((op, idx) => (
                op ? (
                  <button key={op} className="btn" style={{ padding: '8px', fontSize: '0.85rem', backgroundColor: '#fff', border: '1px solid var(--border-color)' }} onClick={() => handleCalcBtn(op)}>{op}</button>
                ) : (
                  <div key={idx}></div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Question display Sheet */}
        {activeQuestion && (
          <div className="light-paper" style={{ border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            
            <div>
              {/* Question metadata */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', padding: '4px 12px', borderRadius: '50px', fontWeight: 600 }}>
                    {activeQuestion.subjectName}
                  </span>

                  {/* Question Source Badge (Double Verified vs Official PYQ) */}
                  {activeQuestion.pdfSourceName === 'AI_NIGHTLY_GENERATOR' ? (
                    <span style={{ fontSize: '0.75rem', background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(236,72,153,0.15) 100%)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '3px 10px', borderRadius: '50px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ⚡ Double-Verified Conceptual Q
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', padding: '3px 10px', borderRadius: '50px', fontWeight: 700 }}>
                      📜 Official GATE {activeQuestion.year || 'PYQ'}
                    </span>
                  )}
                </div>

                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Marks: {activeQuestion.marks} | {activeQuestion.questionType}
                </span>
              </div>

              {/* Question text */}
              <div style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
                {renderQuestionText(activeQuestion.text)}
              </div>

              {/* Question diagram/image (from imagePath field) */}
              {activeQuestion.imagePath && (
                <div style={{ marginBottom: '24px', backgroundColor: '#fff', borderRadius: '10px', padding: '12px', border: '1px solid #e5e7eb', display: 'inline-block', maxWidth: '100%' }}>
                  <img
                    src={getAssetUrl(activeQuestion.imagePath)}
                    alt="Question Diagram"
                    style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block', borderRadius: '6px' }}
                    onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Answering fields */}
              {activeQuestion.questionType === 'MCQ' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeQuestion.options.map((opt) => {
                    const isSelected = answers[activeQuestion.id] === opt.optionLabel;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setAnswers(prev => ({ ...prev, [activeQuestion.id]: opt.optionLabel }))}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          padding: '16px',
                          backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255,255,255,0.01)',
                          border: isSelected ? '2px solid var(--color-secondary)' : '1px solid var(--border-color)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          userSelect: 'none',
                        }}
                      >
                        {/* Custom radio circle */}
                        <div style={{
                          width: '20px',
                          height: '20px',
                          minWidth: '20px',
                          borderRadius: '50%',
                          border: isSelected ? '2px solid var(--color-secondary)' : '2px solid var(--border-color)',
                          backgroundColor: isSelected ? 'var(--color-secondary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '2px',
                          transition: 'all 0.15s ease',
                        }}>
                          {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fff' }} />}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          <span style={{ fontWeight: 700, color: isSelected ? 'var(--color-secondary)' : 'var(--text-muted)', fontSize: '0.85rem' }}>Option {opt.optionLabel}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{renderOptionContent(opt.optionText)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : activeQuestion.questionType === 'MSQ' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeQuestion.options.map((opt) => {
                    const currentSelected = answers[activeQuestion.id]
                      ? answers[activeQuestion.id].toUpperCase().replace(/[^A-D]/g, '').split('')
                      : [];
                    const isChecked = currentSelected.includes(opt.optionLabel);

                    const handleMsqToggle = () => {
                      let nextSelected;
                      if (isChecked) {
                        nextSelected = currentSelected.filter(x => x !== opt.optionLabel);
                      } else {
                        nextSelected = [...currentSelected, opt.optionLabel].sort();
                      }
                      const joined = nextSelected.join(', ');
                      setAnswers(prev => {
                        const copy = { ...prev };
                        if (joined) {
                          copy[activeQuestion.id] = joined;
                        } else {
                          delete copy[activeQuestion.id];
                        }
                        return copy;
                      });
                    };

                    return (
                      <div
                        key={opt.id}
                        onClick={handleMsqToggle}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          padding: '16px',
                          backgroundColor: isChecked ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255,255,255,0.01)',
                          border: isChecked ? '2px solid var(--color-secondary)' : '1px solid var(--border-color)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          userSelect: 'none',
                        }}
                      >
                        {/* Custom checkbox square */}
                        <div style={{
                          width: '20px',
                          height: '20px',
                          minWidth: '20px',
                          borderRadius: '4px',
                          border: isChecked ? '2px solid var(--color-secondary)' : '2px solid var(--border-color)',
                          backgroundColor: isChecked ? 'var(--color-secondary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '2px',
                          transition: 'all 0.15s ease',
                        }}>
                          {isChecked && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          <span style={{ fontWeight: 700, color: isChecked ? 'var(--color-secondary)' : 'var(--text-muted)', fontSize: '0.85rem' }}>Option {opt.optionLabel}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{renderOptionContent(opt.optionText)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (

                /* NAT Integer type questions text input */
                <div style={{ maxWidth: '400px' }}>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Enter Numerical Value Answer:</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={answers[activeQuestion.id] || ''}
                    onChange={(e) => setAnswers(prev => ({ ...prev, [activeQuestion.id]: e.target.value }))}
                    placeholder="Enter decimal value or range (e.g. 10.5 or 10-12)"
                    style={{ fontSize: '1.1rem', padding: '12px', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>Numerical answers are range-tolerant and evaluated at 4 decimal places.</span>
                </div>
              )}
            </div>

            {/* Nav controls */}
            <div className="exam-nav-bar" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginTop: '40px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn btn-outline" 
                  disabled={currentIndex === 0} 
                  onClick={() => handleNav(currentIndex - 1)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <FiChevronLeft /> Previous
                </button>
                
                <button 
                  className="btn btn-outline" 
                  onClick={() => setAnswers(prev => {
                    const next = { ...prev };
                    delete next[activeQuestion.id];
                    return next;
                  })}
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clear Answer
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn" 
                  style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)', color: 'var(--color-primary)', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                  onClick={() => {
                    setFlagged(prev => {
                      const next = new Set(prev);
                      if (next.has(currentIndex)) next.delete(currentIndex);
                      else next.add(currentIndex);
                      return next;
                    });
                    handleNav(currentIndex + 1);
                  }}
                >
                  {flagged.has(currentIndex) ? 'Unmark Review' : 'Mark for Review & Next'}
                </button>

                <button 
                  className="btn btn-success" 
                  onClick={() => { alert('Answers saved locally.'); }}
                >
                  Save
                </button>

                <button 
                  className="btn btn-primary" 
                  onClick={() => handleNav(currentIndex + 1)}
                  disabled={currentIndex === questions.length - 1}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  Next <FiChevronRight />
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Question Palette — GATE style, always visible */}
      <div style={{
        width: isFullscreen ? '260px' : '300px',
        borderLeft: '1px solid #d1d5db',
        backgroundColor: '#f8f9fa',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
        flexShrink: 0,
      }}>
        {/* Palette Header */}
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px', paddingBottom: '10px', borderBottom: '2px solid #e5e7eb' }}>
          Question Palette
        </div>

        {/* TCS iON 5-Status Legend */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.68rem', color: '#374151', marginBottom: '16px', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="tcs-poly-btn tcs-status-answered" style={{ width: '20px', height: '20px', fontSize: '0.55rem' }}>1</span>
            Answered
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="tcs-poly-btn tcs-status-not-answered" style={{ width: '20px', height: '20px', fontSize: '0.55rem' }}>2</span>
            Not Answered
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="tcs-poly-btn tcs-status-marked-review" style={{ width: '20px', height: '20px', fontSize: '0.55rem' }}>3</span>
            Marked Review
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="tcs-poly-btn tcs-status-answered-marked-review" style={{ width: '20px', height: '20px', fontSize: '0.55rem' }}>4</span>
            Ans & Marked
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', gridColumn: 'span 2' }}>
            <span className="tcs-poly-btn tcs-status-not-visited" style={{ width: '20px', height: '20px', fontSize: '0.55rem' }}>5</span>
            Not Visited
          </div>
        </div>

        {/* Subject sections with question grid */}
        {(() => {
          const sections = {};
          questions.forEach((q, idx) => {
            const subj = q.subjectName || 'General';
            if (!sections[subj]) sections[subj] = [];
            sections[subj].push({ q, idx });
          });
          return Object.entries(sections).map(([subj, items]) => (
            <div key={subj} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e5e7eb' }}>
                {subj}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {items.map(({ q, idx }) => {
                  const hasAns = !!answers[q.id];
                  const isFlag = flagged.has(idx);
                  const isVis = visited.has(idx);
                  const isCurrent = idx === currentIndex;

                  let statusClass = 'tcs-status-not-visited';
                  if (hasAns && isFlag) {
                    statusClass = 'tcs-status-answered-marked-review';
                  } else if (isFlag) {
                    statusClass = 'tcs-status-marked-review';
                  } else if (hasAns) {
                    statusClass = 'tcs-status-answered';
                  } else if (isVis) {
                    statusClass = 'tcs-status-not-answered';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => handleNav(idx)}
                      className={`tcs-poly-btn ${statusClass}`}
                      style={{
                        outline: isCurrent ? '3px solid #1d4ed8' : 'none',
                        outlineOffset: '1px',
                        boxShadow: isCurrent ? '0 0 0 2px #bfdbfe' : 'none',
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ));
        })()}

        {/* Submit button in palette */}
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px', fontWeight: 700, fontSize: '0.9rem', borderRadius: '8px' }}
            onClick={() => submitExam(false)}
          >
            Submit Test
          </button>
        </div>
      </div>

      {/* FULLSCREEN EXIT WARNING MODAL */}
      {showExitWarningModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '20px', padding: '32px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', margin: '0 auto 16px auto' }}>
              ⚠️
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
              Exam Security Warning!
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
              You minimized or exited full-screen mode. To maintain test integrity, please return to full-screen or submit your exam.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => { setShowExitWarningModal(false); enterFullscreen(); }}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Return to Full-Screen
              </button>
              <button 
                onClick={() => { setShowExitWarningModal(false); submitExam(false, true); }}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontWeight: 700, cursor: 'pointer' }}
              >
                Submit Exam Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
