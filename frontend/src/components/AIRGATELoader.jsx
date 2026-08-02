import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiZap, FiBookOpen } from 'react-icons/fi';
import { formatMathText } from '../utils/mathRenderer';
import API_CONFIG from '../config/api';

const DYNAMIC_GATE_MESSAGES = [
  { category: "Motivation", text: "⚡ AIR 1 is built one question at a time." },
  { category: "Exam Strategy", text: "🎯 Target Top 100 in GATE 2026!" },
  { category: "Algorithms", text: "💡 Master's Theorem: Compare $\\log_b a$ with $k$." },
  { category: "Consistency", text: "🚀 Daily reps create massive GATE ranks." },
  { category: "Exam Trick", text: "🔥 Zero negative marks on NATs—always attempt!" },
  { category: "Operating Systems", text: "🧠 SJF Scheduling = Minimum Average Wait Time." },
  { category: "Mindset", text: "💪 Consistency beats intensity every single day." },
  { category: "DBMS", text: "✨ 3NF with simple keys is automatically BCNF." },
  { category: "Networks", text: "⏳ TCP Slow Start: Window doubles every RTT." },
  { category: "Mindset", text: "🏆 Champions practice until failure is impossible." },
  { category: "Compiler", text: "⚡ LL(1) parsers cannot handle left recursion." },
  { category: "Accuracy", text: "🎯 Focus on accuracy—speed follows naturally." },
  { category: "Digital Logic", text: "🔥 16:1 MUX needs exactly 4 select lines." },
  { category: "CoA", text: "💡 Pipeline Speedup $\\approx$ Number of stages ($k$)." },
  { category: "Strategy", text: "🚀 Turn weak topics into your strongest weapons." },
  { category: "Operating Systems", text: "🧠 Banker's Algorithm = Deadlock Avoidance." },
  { category: "Mindset", text: "⚡ Master the basics; the rank will follow." },
  { category: "MSQ Trick", text: "🎯 Read every option before submitting MSQs." },
  { category: "Motivation", text: "💪 Doubt today, derivation tomorrow, Rank 1 soon." },
  { category: "ToC", text: "🔥 Regular languages are closed under Kleene Star." },
  { category: "Dream High", text: "✨ Push through the struggle—IISc is waiting!" },
  { category: "Compounding", text: "⏳ Hard work compounds just like interest." },
  { category: "Motivation", text: "🏆 Every PYQ solved brings you closer to IIT." },
  { category: "Data Structures", text: "⚡ AVL Tree Height is strictly $< 1.44 \\log_2 n$." },
  { category: "Analysis", text: "🎯 Analyze your mock test mistakes deeply." },
  { category: "CoA", text: "💡 Cache Hit Ratio improves with locality of reference." },
  { category: "Inspiration", text: "🚀 You didn't come this far to only come this far." },
  { category: "Operating Systems", text: "🧠 Page Fault Rate determines Effective Access Time." },
  { category: "Data Structures", text: "⚡ B-Trees keep all leaf nodes at the exact same depth." },
  { category: "Consistency", text: "🎯 Small steps daily yield giant GATE results." },
  { category: "Algorithms", text: "🔥 Dijkstra's algorithm uses non-negative edge weights." },
  { category: "Confidence", text: "💪 Believe in your prep—stay calm under pressure." },
  { category: "Motivation", text: "✨ 1 mark can jump your GATE rank by 500 spots!" },
  { category: "Mindset", text: "⏳ Practice like you're #2, perform like you're #1." },
  { category: "Dream High", text: "🏆 IIT Bombay, IISc, IIT Madras—keep the dream alive!" },
  { category: "Algorithms", text: "⚡ Greedy choice property yields optimal MSTs." },
  { category: "Digital Logic", text: "🎯 Quick tip: 2's complement of 0 is always 0." },
  { category: "Operating Systems", text: "💡 Paging eliminates External Fragmentation completely." },
  { category: "Exam Strategy", text: "🚀 Precision over panic—read questions twice." },
  { category: "Data Structures", text: "🧠 Topological sort works ONLY on DAGs." },
  { category: "Algorithms", text: "⚡ Heapify takes $O(n)$ time, sorting takes $O(n \\log n)$." },
  { category: "Strategy", text: "🎯 Solve 2-mark questions with laser focus." },
  { category: "Drive", text: "🔥 Your competition is resting—keep pushing!" },
  { category: "Motivation", text: "💪 Tough times don't last; tough GATE aspirants do." },
  { category: "CoA", text: "✨ Maximum frequency = $1 / \\text{Clock Period}$." },
  { category: "Exam Strategy", text: "⏳ 100 marks, 65 questions, 3 hours—own it!" },
  { category: "AIRGATE", text: "🏆 AIRGATE is with you on every single step." },
  { category: "Operating Systems", text: "⚡ Semaphore signal() increments value atomically." },
  { category: "Focus", text: "🎯 Keep calm and solve the next question!" },
  { category: "Motivation", text: "🚀 Greatness is earned in silent study hours." }
];

export default function AIRGATELoader({ text, size = "normal" }) {
  const isCompact = size === "small";

  const [tipsList, setTipsList] = useState(DYNAMIC_GATE_MESSAGES);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(() => 
    Math.floor(Math.random() * DYNAMIC_GATE_MESSAGES.length)
  );
  const [fade, setFade] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchLiveTips = async () => {
      try {
        const res = await axios.get(`${API_CONFIG.BASE_URL}/api/tips/active`);
        if (isMounted && res.data && Array.isArray(res.data) && res.data.length > 0) {
          const formatted = res.data.map(t => ({ category: t.category || "Tip", text: t.text }));
          setTipsList(formatted);
          setCurrentMsgIndex(Math.floor(Math.random() * formatted.length));
        }
      } catch (e) {
        // Fallback to static tips
      }
    };
    fetchLiveTips();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!tipsList || tipsList.length <= 1) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentMsgIndex(prev => (prev + 1) % tipsList.length);
        setFade(true);
      }, 200);
    }, 3500);

    return () => clearInterval(interval);
  }, [tipsList]);

  const activeMsg = tipsList[currentMsgIndex] || DYNAMIC_GATE_MESSAGES[0];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isCompact ? '16px' : '40px 20px',
      textAlign: 'center',
      width: '100%',
      maxWidth: '480px',
      margin: '0 auto'
    }}>
      {/* Outer Glow Ring & Logo Loader Container */}
      <div style={{
        position: 'relative',
        width: isCompact ? '48px' : '64px',
        height: isCompact ? '48px' : '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: isCompact ? '10px' : '14px'
      }}>
        {/* Outer Rotating Gradient Ring */}
        <div 
          className="spin-animation"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: 'var(--color-primary, #8b5cf6)',
            borderRightColor: 'var(--color-secondary, #06b6d4)',
            boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)'
          }}
        />

        {/* Inner Pulsing Brand Icon */}
        <div 
          className="airgate-pulse-logo"
          style={{
            width: isCompact ? '32px' : '42px',
            height: isCompact ? '32px' : '42px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(6, 182, 212, 0.3))',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            backdropFilter: 'blur(4px)'
          }}
        >
          <FiZap size={isCompact ? 16 : 22} style={{ color: '#06b6d4' }} />
        </div>
      </div>

      {/* Primary Status Line */}
      {text && (
        <p 
          className="airgate-shimmer-text"
          style={{
            color: 'var(--text-muted, #94a3b8)',
            fontSize: isCompact ? '0.78rem' : '0.85rem',
            fontWeight: 600,
            margin: '0 0 8px 0',
            letterSpacing: '0.02em'
          }}
        >
          {text}
        </p>
      )}

      {/* Dynamic 1-Line GATE Motivation / Micro-Tip Pill */}
      <div style={{
        opacity: fade ? 1 : 0,
        transition: 'opacity 0.25s ease-in-out',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        borderRadius: '20px',
        padding: '6px 14px',
        maxWidth: '100%'
      }}>
        <FiBookOpen style={{ color: '#06b6d4', flexShrink: 0, fontSize: '0.82rem' }} />
        <span style={{ fontSize: isCompact ? '0.78rem' : '0.84rem', color: '#f8fafc', fontWeight: 600, lineHeight: 1.3 }}>
          {formatMathText(activeMsg.text)}
        </span>
      </div>
    </div>
  );
}
