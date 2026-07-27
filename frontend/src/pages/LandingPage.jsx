import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { 
  FiArrowRight, FiCpu, FiLayers, FiCheckCircle, FiSearch, 
  FiCode, FiUser, FiActivity, FiClock, FiBookOpen, FiShield, 
  FiZap, FiTarget, FiAward, FiHelpCircle, FiLock, FiMail, FiPhone
} from 'react-icons/fi';

export default function LandingPage() {
  const navigate = useNavigate();
  const currentUser = AuthService.getCurrentUser();
  
  const [stats, setStats] = useState({
    totalApproved: 124,
    totalPending: 8,
    totalQuestions: 132
  });
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'terms' | 'contact' | 'mockQuiz'
  const [supportInfo, setSupportInfo] = useState({
    email: 'support@airgate.in',
    phone: '+91 (800) AIR-GATE'
  });

  useEffect(() => {
    axios.get(`${API_CONFIG.BASE_URL}/api/admin/settings/public-meta`)
      .then(res => {
        if (res.data) {
          setSupportInfo({
            email: res.data.supportEmail || 'support@airgate.in',
            phone: res.data.supportPhone || '+91 (800) AIR-GATE'
          });
        }
      })
      .catch(() => {});
  }, []);

  // Interactive 10-Question GATE Exam Orientation Quiz
  const [quizState, setQuizState] = useState({
    currentStep: 0,
    score: 0,
    selectedOption: null,
    isCompleted: false
  });

  const gateQuizQuestions = [
    {
      question: "What is the official full form of the GATE Examination?",
      options: [
        "General Aptitude Test in Engineering",
        "Graduate Aptitude Test in Engineering",
        "Global Academic Assessment for Engineers",
        "Graduate Advanced Technical Evaluation"
      ],
      correct: 1,
      explanation: "GATE stands for Graduate Aptitude Test in Engineering, conducted jointly by IISc and 7 IITs."
    },
    {
      question: "For how many years is a valid GATE Scorecard official score valid for M.Tech admissions?",
      options: ["1 Year", "2 Years", "3 Years", "5 Years"],
      correct: 2,
      explanation: "A GATE scorecard is officially valid for 3 years from the date of result announcement."
    },
    {
      question: "In the official GATE exam pattern, how many total questions are asked in 3 hours?",
      options: ["50 Questions", "65 Questions", "75 Questions", "100 Questions"],
      correct: 1,
      explanation: "GATE exam has exactly 65 questions carrying a maximum of 100 marks."
    },
    {
      question: "What is the penalty deduction for an incorrect 1-Mark Multiple Choice Question (MCQ)?",
      options: ["-0.25 Marks", "-0.33 Marks", "-0.50 Marks", "Zero (No negative)"],
      correct: 1,
      explanation: "1-Mark MCQs incur a -1/3 (-0.33) deduction. Note: NAT & MSQ questions have NO negative marking!"
    },
    {
      question: "What is the weightage allocation for General Aptitude in the GATE Paper?",
      options: ["10 Marks", "15 Marks", "20 Marks", "25 Marks"],
      correct: 1,
      explanation: "General Aptitude carries 15 marks, Engineering Mathematics ~13-15 marks, and Core Subject ~70-72 marks."
    },
    {
      question: "Which of the following question types in GATE has ZERO negative marking for wrong answers?",
      options: [
        "MCQ (Multiple Choice Questions) only",
        "NAT (Numerical Answer Type) & MSQ (Multiple Select Questions)",
        "1-Mark MCQs only",
        "All questions carry negative marking"
      ],
      correct: 1,
      explanation: "Both NAT and MSQ questions carry ZERO negative marking. Attempting all NAT/MSQ questions is recommended."
    },
    {
      question: "Are physical scientific calculators allowed inside the GATE examination hall?",
      options: [
        "Yes, any non-programmable calculator",
        "No, only the official On-Screen Virtual Calculator is provided",
        "Yes, but only approved Casio models",
        "No calculators are allowed at all"
      ],
      correct: 1,
      explanation: "Physical calculators are strictly banned. Candidates must use the desktop On-Screen Virtual Calculator."
    },
    {
      question: "What is the ideal target attempt accuracy strategy recommended for securing a Top 500 AIR in GATE?",
      options: [
        "Guessing 100% questions even without solving",
        "85%+ High Accuracy on Core Technical + Full General Aptitude Solves",
        "Leaving all 2-mark questions unattempted",
        "Solving only Engineering Mathematics"
      ],
      correct: 1,
      explanation: "Top rankers combine high accuracy (85%+) with zero unforced negative penalties on 1-mark & 2-mark core technical questions."
    },
    {
      question: "Which organizing body conducts the GATE examination in India?",
      options: [
        "NTA (National Testing Agency)",
        "IISc Bangalore & 7 IITs (Bombay, Delhi, Guwahati, Kanpur, Kharagpur, Madras, Roorkee) on rotation",
        "UPSC (Union Public Service Commission)",
        "AICTE"
      ],
      correct: 1,
      explanation: "GATE is administered on a rotational basis by IISc Bangalore and 7 zonal IITs."
    },
    {
      question: "What is the best approach to handle 2-Mark NAT (Numerical Answer Type) questions during practice?",
      options: [
        "Rounding off values without checking constraints",
        "Verifying decimal bounds and re-calculating steps before clicking Lock",
        "Relying on option elimination shortcuts",
        "Skipping NAT questions completely"
      ],
      correct: 1,
      explanation: "NAT questions carry zero negative penalty. Double-checking decimal bounds ensures guaranteed full 2 marks!"
    }
  ];

  useEffect(() => {
    axios.get(`${API_CONFIG.BASE_URL}/api/questions/stats`)
      .then(res => { if (res.data) setStats(res.data); })
      .catch(() => {});
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#070a12',
      backgroundImage: `
        radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
        radial-gradient(circle at 85% 75%, rgba(6, 182, 212, 0.12) 0%, transparent 45%),
        radial-gradient(circle at 50% 50%, #070a12 0%, #030408 100%)
      `,
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      
      {/* Decorative Background Grid */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
        zIndex: 1
      }} />

      {/* Top Navbar Header */}
      <header style={{
        width: '100%',
        boxSizing: 'border-box',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(7, 10, 18, 0.85)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWdith: '1320px',
          maxWidth: '1320px',
          margin: '0 auto',
          padding: '16px 32px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          gap: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/')}>
            <svg width="52" height="52" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, filter: 'drop-shadow(0 0 15px rgba(56, 189, 248, 0.7))' }}>
              <defs>
                <linearGradient id="opt4GradFinal" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d2ff" />
                  <stop offset="50%" stopColor="#3a7bd5" />
                  <stop offset="100%" stopColor="#928dab" />
                </linearGradient>
                <linearGradient id="opt4ABody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00c6ff" />
                  <stop offset="50%" stopColor="#0072ff" />
                  <stop offset="100%" stopColor="#7a22ff" />
                </linearGradient>
                <linearGradient id="opt4GBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f2fe" />
                  <stop offset="100%" stopColor="#4facfe" />
                </linearGradient>
              </defs>

              {/* Complete Outer Orbital Arc Ring */}
              <path d="M 16,74 A 48,48 0 1,1 104,74" stroke="url(#opt4GradFinal)" strokeWidth="2.8" fill="none" opacity="0.9" />
              <circle cx="60" cy="12" r="4" fill="#00f2fe" />

              {/* Left Practice Icon Badge */}
              <g transform="translate(16, 46)">
                <circle cx="0" cy="0" r="12" fill="#090d16" stroke="#00f2fe" strokeWidth="2" />
                <path d="M -5,5 L -5,-1 M -2,5 L -2,-4 M 1,5 L 1,-2 M 4,5 L 4,-6" stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" />
                <path d="M -5,-1 L 4,-6" stroke="#00f2fe" strokeWidth="1.5" strokeLinecap="round" />
              </g>

              {/* Right Analyze Icon Badge */}
              <g transform="translate(104, 46)">
                <circle cx="0" cy="0" r="12" fill="#090d16" stroke="#b537ff" strokeWidth="2" />
                <rect x="-5.5" y="-7" width="11" height="14" rx="2" stroke="#b537ff" strokeWidth="1.8" fill="none" />
                <path d="M -2.5,-1.5 L -0.5,1 L 3.5,-3" stroke="#b537ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </g>

              {/* Main Outer Triangular 'A' Gateway */}
              <path d="M 60,16 L 102,94 L 86,94 L 60,45 L 34,94 L 18,94 Z" fill="url(#opt4ABody)" />

              {/* Central Stylized 'G' Lettermark */}
              <path d="M 72,55 C 72,42 48,40 48,56 C 48,70 72,68 72,60 L 58,60" stroke="url(#opt4GBody)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

              {/* Glowing Gateway Portal Corridor Vertical Bars at Base */}
              <rect x="44" y="74" width="3" height="20" fill="#00f2fe" opacity="0.8" rx="1" />
              <rect x="49" y="78" width="3" height="16" fill="#00f2fe" opacity="0.8" rx="1" />
              <rect x="68" y="78" width="3" height="16" fill="#00f2fe" opacity="0.8" rx="1" />
              <rect x="73" y="74" width="3" height="20" fill="#00f2fe" opacity="0.8" rx="1" />

              {/* Center Bright Portal Light Door */}
              <rect x="54" y="80" width="12" height="14" fill="#00f2fe" rx="2" />
              <rect x="57" y="83" width="6" height="11" fill="#ffffff" rx="1" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.03em', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AIR</span>
                <span style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GATE</span>
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Practice · Analyze · Progress
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <button 
              className="btn btn-outline" 
              onClick={() => navigate('/explore')}
              style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
            >
              Launch Practice Arena ➔
            </button>
            
            {currentUser ? (
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
                style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
              >
                <FiUser size={16} /> My Dashboard
              </button>
            ) : (
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/login')}
                style={{ padding: '9px 20px', borderRadius: '10px', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section: Focused on Results */}
      <section style={{
        padding: '100px 24px 80px 24px',
        textAlign: 'center',
        maxWidth: '1100px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 5
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '30px',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          color: '#c4b5fd',
          fontSize: '0.85rem',
          fontWeight: 700,
          marginBottom: '28px',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.2)'
        }}>
          <FiAward style={{ color: '#38bdf8' }} /> Built for GATE Aspirants Aiming for Top AIR Ranks & PSU Cutoffs
        </div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 5.5vw, 4.2rem)',
          fontWeight: 900,
          lineHeight: '1.15',
          letterSpacing: '-0.03em',
          marginBottom: '24px',
          color: '#ffffff'
        }}>
          Stop Losing Marks to Silly Errors.{' '}
          <span style={{
            background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 50%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Engineered for Maximum Score Growth.
          </span>
        </h1>

        <p style={{
          fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
          color: 'var(--text-secondary)',
          maxWidth: '820px',
          margin: '0 auto 40px auto',
          lineHeight: '1.6',
          fontWeight: 400
        }}>
          AIRGATE isn't just a question bank. It is an intelligent practice accelerator that audits your solving speed, plugs negative marking leaks (-0.33 / -0.66), and trains you under exact 3-hour exam pressure.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/practice')}
            style={{ padding: '15px 36px', fontSize: '1.05rem', fontWeight: 800, borderRadius: '12px', boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)' }}
          >
            Start Free Practice Arena <FiArrowRight style={{ marginLeft: '6px' }} />
          </button>
          
          <button 
            className="btn btn-outline"
            onClick={() => {
              setQuizState({
                currentStep: 0,
                score: 0,
                selectedOption: null,
                isCompleted: false
              });
              setActiveModal('mockQuiz');
            }}
            style={{ padding: '15px 32px', fontSize: '1.05rem', borderRadius: '12px', fontWeight: 700, borderColor: '#38bdf8', color: '#38bdf8' }}
          >
            🎯 Take a Mock Test Now
          </button>
        </div>

        {/* Real-time Proof Numbers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          maxWidth: '900px',
          margin: '70px auto 0 auto',
          padding: '24px',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(10px)'
        }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8' }}>100%</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Verified PYQs & Dual-AI Verifications</div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#a855f7' }}>11 / 11</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>GATE Core Subjects Active</div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981' }}>0.01s</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Instant Formula & Solution Parsing</div>
          </div>
        </div>

        {/* 🚀 UPCOMING EXAMS & BRANCHES BADGE */}
        <div style={{
          marginTop: '48px',
          padding: '20px 28px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          maxWidth: '820px',
          margin: '40px auto 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              🚀 EXPANDING ROADMAP
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
              GATE Data Science & AI (DA) + ECE/EE Engines
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Full question banks, AI generators, and syllabus mocks for DA & allied branches coming soon!
            </div>
          </div>
          <span style={{
            padding: '6px 14px',
            borderRadius: '20px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            fontSize: '0.8rem',
            fontWeight: 800,
            whiteSpace: 'nowrap'
          }}>
            ⏳ COMING SOON
          </span>
        </div>
      </section>

      {/* CORE RESULT ACCELERATORS */}
      <section style={{
        padding: '90px 24px',
        backgroundColor: 'rgba(3, 4, 8, 0.8)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        position: 'relative',
        zIndex: 5
      }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 900, color: '#fff', marginBottom: '16px' }}>
            How AIRGATE Transforms Your Preparation Into Top Performance
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '700px', margin: '0 auto', fontSize: '1.05rem', lineHeight: '1.6' }}>
            Every tool inside AIRGATE is engineered with one objective: **maximizing your final GATE score on exam day**.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '28px',
          maxWidth: '1240px',
          margin: '0 auto'
        }}>
          
          {/* Helper 1: Negative Marking Leakage Guard */}
          <div style={cardStyle}>
            <div style={iconBoxStyle('#ef4444')}>
              <FiShield size={24} color="#fff" />
            </div>
            <h3 style={cardTitleStyle}>1. Plug Negative Marking Leakage</h3>
            <div style={whyTagStyle}>Why it matters</div>
            <p style={cardBodyStyle}>
              In GATE, losing 5-8 marks due to careless MCQ errors can drop your rank by 2,000 positions.
            </p>
            <div style={howTagStyle}>How AIRGATE Solves It</div>
            <p style={cardBodyStyle}>
              Our <strong>Prep Analyst</strong> monitors your accuracy ratio and flags impulsive guesses (under 45s). It alerts you to negative mark leakage so you build bulletproof confidence before clicking submit.
            </p>
          </div>

          {/* Helper 2: 3-Hour Exam Stamina & Pressure Training */}
          <div style={cardStyle}>
            <div style={iconBoxStyle('#6366f1')}>
              <FiClock size={24} color="#fff" />
            </div>
            <h3 style={cardTitleStyle}>2. Build 3-Hour Exam Stamina</h3>
            <div style={whyTagStyle}>Why it matters</div>
            <p style={cardBodyStyle}>
              Solving questions in isolation is easy. Managing time across 65 questions (100 marks) under ticking clock pressure is where most students collapse.
            </p>
            <div style={howTagStyle}>How AIRGATE Solves It</div>
            <p style={cardBodyStyle}>
              Our <strong>Mock Test Arena</strong> replicates the exact GATE exam weightage (15M Aptitude, 14M Math, 71M Core). Screen lock, countdown timers, and full scorecards condition your brain for peak performance.
            </p>
          </div>

          {/* Helper 3: Elimination of Option-Guessing Habits (NAT Mastery) */}
          <div style={cardStyle}>
            <div style={iconBoxStyle('#10b981')}>
              <FiCode size={24} color="#fff" />
            </div>
            <h3 style={cardTitleStyle}>3. Master NAT (Numerical) Questions</h3>
            <div style={whyTagStyle}>Why it matters</div>
            <p style={cardBodyStyle}>
              Numerical Answer Type (NAT) questions carry zero options — you either calculate the exact value or get zero.
            </p>
            <div style={howTagStyle}>How AIRGATE Solves It</div>
            <p style={cardBodyStyle}>
              AIRGATE provides dedicated NAT input fields with strict decimal and range validation, training you to re-check your steps and eliminate arithmetic mistakes.
            </p>
          </div>

          {/* Helper 4: Fresh High-Yield Conceptual Practice */}
          <div style={cardStyle}>
            <div style={iconBoxStyle('#38bdf8')}>
              <FiZap size={24} color="#fff" />
            </div>
            <h3 style={cardTitleStyle}>4. Fresh High-Yield Conceptual Practice</h3>
            <div style={whyTagStyle}>Why it matters</div>
            <p style={cardBodyStyle}>
              Relying solely on old memorized PYQs creates false confidence when unseen conceptual questions appear on exam day.
            </p>
            <div style={howTagStyle}>How AIRGATE Solves It</div>
            <p style={cardBodyStyle}>
              AIRGATE delivers a continuous feed of <strong>fresh, topic-balanced conceptual questions</strong> engineered strictly to GATE standards, helping you master core principles and tackle any novel problem pattern effortlessly.
            </p>
          </div>

          {/* Helper 5: AI Tutor Instant Doubt Clearance */}
          <div style={cardStyle}>
            <div style={iconBoxStyle('#a855f7')}>
              <FiCpu size={24} color="#fff" />
            </div>
            <h3 style={cardTitleStyle}>5. Instant Step-by-Step Doubt Resolution</h3>
            <div style={whyTagStyle}>Why it matters</div>
            <p style={cardBodyStyle}>
              Getting stuck on a single difficult problem for hours destroys your daily study momentum.
            </p>
            <div style={howTagStyle}>How AIRGATE Solves It</div>
            <p style={cardBodyStyle}>
              Click <strong>Ask AI Tutor</strong> under any question to get structured KaTeX mathematical derivations, matrix traces, and concept explanations in seconds.
            </p>
          </div>

          {/* Helper 6: Community Verification & Solution Comparison */}
          <div style={cardStyle}>
            <div style={iconBoxStyle('#f59e0b')}>
              <FiBookOpen size={24} color="#fff" />
            </div>
            <h3 style={cardTitleStyle}>6. Multi-Method Solution Comparison</h3>
            <div style={whyTagStyle}>Why it matters</div>
            <p style={cardBodyStyle}>
              Textbook solutions are often lengthy. Finding short-cut formulas saves critical seconds during exam time.
            </p>
            <div style={howTagStyle}>How AIRGATE Solves It</div>
            <p style={cardBodyStyle}>
              Compare community-submitted explanations, upvote the fastest shortcuts, or contribute your own solution methods to master every problem from multiple angles.
            </p>
          </div>

        </div>
      </section>

      {/* Call to Action CTA */}
      <section style={{
        padding: '80px 24px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
        borderTop: '1px solid rgba(99, 102, 241, 0.2)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
        position: 'relative',
        zIndex: 5
      }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#fff', marginBottom: '16px' }}>
          Ready to Claim Your Top GATE Rank?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 36px auto' }}>
          Join thousands of serious GATE aspirants practicing daily with AIRGATE.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/register')}
          style={{ padding: '16px 40px', fontSize: '1.1rem', fontWeight: 800, borderRadius: '12px', boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)' }}
        >
          Create Free Account & Start Solving <FiArrowRight style={{ marginLeft: '8px' }} />
        </button>
      </section>

      {/* Footer with Legal & Contact Modals */}
      <footer style={{
        padding: '50px 40px 30px 40px',
        backgroundColor: '#030407',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        color: 'var(--text-muted)',
        fontSize: '0.88rem',
        position: 'relative',
        zIndex: 5
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>AIRGATE Platform</div>
            <div>Gateway to All India Rank — GATE Examination Suite</div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <Link to="/privacy" style={footerLinkStyle}>Privacy Policy</Link>
            <Link to="/terms" style={footerLinkStyle}>Terms of Service</Link>
            <Link to="/contact" style={footerLinkStyle}>Contact Us</Link>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '24px', textAlign: 'center', fontSize: '0.8rem' }}>
          © 2026 AIRGATE Platform. All rights reserved.
        </div>
      </footer>

      {/* ── LEGAL & CONTACT MODALS ────────────────────────────────────────── */}
      {activeModal && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                {activeModal === 'privacy' && '🔒 Privacy Policy'}
                {activeModal === 'terms' && '📜 Terms & Conditions'}
                {activeModal === 'contact' && '📬 Contact Support Team'}
              </h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto', fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              {activeModal === 'privacy' && (
                <div>
                  <p><strong>Effective Date: 2026</strong></p>
                  <p>At AIRGATE, we value your privacy and security. This Privacy Policy outlines how we collect and safeguard your data:</p>
                  <h4>1. Data Collection</h4>
                  <p>We collect essential account details (Username, Email) and practice analytics (solve history, mock scores, timing metrics) to generate your Prep Analyst insights.</p>
                  <h4>2. Security</h4>
                  <p>All passwords are encrypted using industry-standard BCrypt hashing. Payment transactions are processed via PCI-DSS compliant gateways (Razorpay).</p>
                  <h4>3. Data Sharing</h4>
                  <p>We never sell or rent your personal information to third parties.</p>
                </div>
              )}

              {activeModal === 'terms' && (
                <div>
                  <p><strong>Effective Date: 2026</strong></p>
                  <p>By using the AIRGATE Platform, you agree to the following terms:</p>
                  <h4>1. Usage & Content</h4>
                  <p>All PYQ content, AI-generated questions, and solution material are protected. Practice materials are for individual academic preparation only.</p>
                  <h4>2. Subscription & Refunds</h4>
                  <p>Aspirant Pro subscriptions unlock unlimited mock attempts and advanced AI analytics. Subscription access is granted instantly upon successful payment verification.</p>
                </div>
              )}

              {activeModal === 'contact' && (
                <div>
                  <p>Need assistance or have feedback for the AIRGATE team? Reach out to us:</p>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', margin: '16px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: '#fff', fontWeight: 600 }}>
                      <FiMail style={{ color: 'var(--color-secondary)' }} /> Email Support: {supportInfo.email}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontWeight: 600 }}>
                      <FiPhone style={{ color: 'var(--color-success)' }} /> Help Line: {supportInfo.phone}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Response Window: Monday to Saturday (9:00 AM – 7:00 PM IST)</p>
                </div>
              )}
              {activeModal === 'mockQuiz' && (
                <div>
                  {!quizState.isCompleted ? (
                    (() => {
                      const qObj = gateQuizQuestions[quizState.currentStep];
                      return (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 800, marginBottom: '12px', textTransform: 'uppercase' }}>
                            <span>Question {quizState.currentStep + 1} of 10</span>
                            <span>Score: {quizState.score} / {quizState.currentStep}</span>
                          </div>

                          {/* Progress bar */}
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginBottom: '20px', overflow: 'hidden' }}>
                            <div style={{ width: `${((quizState.currentStep + 1) / 10) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #a855f7)', transition: 'width 0.3s' }} />
                          </div>

                          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: '20px', lineHeight: '1.5' }}>
                            {qObj.question}
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                            {qObj.options.map((opt, idx) => {
                              const isSelected = quizState.selectedOption === idx;
                              const isCorrect = idx === qObj.correct;
                              let border = '1px solid var(--border-color)';
                              let bg = 'rgba(255,255,255,0.03)';
                              
                              if (quizState.selectedOption !== null) {
                                if (isCorrect) {
                                  border = '1px solid #10b981';
                                  bg = 'rgba(16, 185, 129, 0.15)';
                                } else if (isSelected) {
                                  border = '1px solid #ef4444';
                                  bg = 'rgba(239, 68, 68, 0.15)';
                                }
                              }

                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if (quizState.selectedOption !== null) return;
                                    const isRight = idx === qObj.correct;
                                    setQuizState(prev => ({
                                      ...prev,
                                      selectedOption: idx,
                                      score: isRight ? prev.score + 1 : prev.score
                                    }));
                                  }}
                                  style={{
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    border,
                                    background: bg,
                                    color: '#fff',
                                    textAlign: 'left',
                                    fontSize: '0.9rem',
                                    cursor: quizState.selectedOption !== null ? 'default' : 'pointer',
                                    fontWeight: isSelected ? 700 : 500,
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          {quizState.selectedOption !== null && (
                            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', marginBottom: '20px', fontSize: '0.85rem', color: '#e0f2fe' }}>
                              💡 <strong>Explanation:</strong> {qObj.explanation}
                            </div>
                          )}

                          {quizState.selectedOption !== null && (
                            <button
                              className="btn btn-primary"
                              onClick={() => {
                                if (quizState.currentStep < 9) {
                                  setQuizState(prev => ({
                                    ...prev,
                                    currentStep: prev.currentStep + 1,
                                    selectedOption: null
                                  }));
                                } else {
                                  setQuizState(prev => ({ ...prev, isCompleted: true }));
                                }
                              }}
                              style={{ width: '100%', padding: '12px', fontWeight: 800 }}
                            >
                              {quizState.currentStep < 9 ? 'Next Question ➔' : 'See Final Score 🎉'}
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
                      <h4 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>
                        GATE Readiness Score: {quizState.score} / 10
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '24px' }}>
                        {quizState.score >= 8 ? 'Outstanding! You have strong GATE pattern & syllabus awareness.' : 'Good Start! Practice on AIRGATE will plug your exam pattern awareness gaps.'}
                      </p>

                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setActiveModal(null);
                            navigate('/simulator');
                          }}
                          style={{ padding: '12px 24px', fontWeight: 800 }}
                        >
                          Launch 65-Q Simulator Arena ➔
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button className="btn btn-outline" onClick={() => setActiveModal(null)} style={{ padding: '8px 20px', borderRadius: '8px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Custom Component Styles
const cardStyle = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '20px',
  padding: '32px',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
  display: 'flex',
  flexDirection: 'column'
};

const iconBoxStyle = (color) => ({
  backgroundColor: color,
  width: '50px',
  height: '50px',
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '20px',
  boxShadow: `0 6px 20px ${color}40`
});

const cardTitleStyle = {
  fontSize: '1.25rem',
  fontWeight: 800,
  color: '#fff',
  marginBottom: '16px'
};

const whyTagStyle = {
  fontSize: '0.72rem',
  fontWeight: 800,
  color: '#f87171',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '4px'
};

const howTagStyle = {
  fontSize: '0.72rem',
  fontWeight: 800,
  color: '#38bdf8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginTop: '16px',
  marginBottom: '4px'
};

const cardBodyStyle = {
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
  lineHeight: '1.6',
  margin: 0
};

const footerLinkStyle = {
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'color 0.2s ease',
  fontSize: '0.88rem'
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.8)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999,
  padding: '20px'
};

const modalCardStyle = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '20px',
  padding: '28px',
  maxWidth: '560px',
  width: '100%',
  boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
};
