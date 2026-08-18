import React, { useState, useEffect } from 'react';
import AIRGATELoader from '../AIRGATELoader';

const STAGES = [
  { percent: 20, message: "Connecting to AIRGATE High-Speed Exam Server..." },
  { percent: 50, message: "Assembling GATE CSE 100-Mark Paper (10 GA + 55 Technical)..." },
  { percent: 80, message: "Filtering Unseen & Unsolved Questions for your profile..." },
  { percent: 100, message: "Launching TCS iON Authentic CBT Exam Interface..." }
];

export default function ExamProgressLoader() {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStage(1), 300);
    const timer2 = setTimeout(() => setCurrentStage(2), 700);
    const timer3 = setTimeout(() => setCurrentStage(3), 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const stageInfo = STAGES[currentStage] || STAGES[0];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      backgroundColor: '#131826',
      borderRadius: '24px',
      border: '1px solid #242f47',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
      maxWidth: '600px',
      margin: '40px auto',
      textAlign: 'center'
    }}>
      <AIRGATELoader hideTip />
      
      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '24px', marginBottom: '8px' }}>
        Preparing Your GATE CBT Mock Test
      </h3>
      
      <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '24px', minHeight: '24px', transition: 'all 0.3s ease' }}>
        {stageInfo.message}
      </p>

      {/* Animated Progress Bar */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        height: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '50px',
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          width: `${stageInfo.percent}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #38bdf8 0%, #8b5cf6 50%, #ec4899 100%)',
          borderRadius: '50px',
          transition: 'width 0.4s ease-in-out',
          boxShadow: '0 0 12px rgba(139, 92, 246, 0.6)'
        }} />
      </div>

      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginTop: '12px' }}>
        {stageInfo.percent}% Complete
      </span>
    </div>
  );
}
