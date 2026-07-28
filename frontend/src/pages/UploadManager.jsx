import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { FiUploadCloud, FiClock, FiCheckCircle, FiLoader, FiAlertTriangle, FiTrash2, FiFileText, FiLayers, FiDatabase, FiAlertCircle } from 'react-icons/fi';

export default function UploadManager() {
  const [file, setFile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!AuthService.isAdminOrEditor()) {
      navigate('/explore');
      return;
    }

    fetchJobs();

    // Adaptive polling: poll every 20s by default when idle
    const interval = setInterval(() => {
      fetchJobs();
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/uploads/jobs`, {
        headers: AuthService.getAuthHeader()
      });
      const data = Array.isArray(response.data) ? response.data : [];
      setJobs(data);

      // If any job is currently processing/parsing, check again in 5s
      const hasActiveJob = data.some(j => j.status === 'PROCESSING' || j.status === 'PARSING' || j.status === 'PENDING' || j.status === 'EXTRACTING');
      if (hasActiveJob) {
        setTimeout(fetchJobs, 5000);
      }
    } catch (e) {
      console.error('Failed to load jobs list', e);
      setJobs([]);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        setError("Only PDF files are supported!");
      }
    }
  };

  const handleUploadSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!file) return;

    setError('');
    setSuccess('');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/uploads`, formData, {
        headers: {
          ...AuthService.getAuthHeader(),
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess('PDF uploaded successfully! Ingestion processing started in background.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchJobs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload PDF!');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (jobId, filename) => {
    setError('');
    setSuccess('');
    const confirmDelete = window.confirm(`Are you sure you want to delete the upload job for "${filename}"?\n\nThis will also delete ALL questions parsed from this PDF (both pending and verified) and cannot be undone.`);
    if (!confirmDelete) return;

    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/api/uploads/jobs/${jobId}`, {
        headers: AuthService.getAuthHeader()
      });
      setSuccess(`Upload job "${filename}" and its associated questions deleted successfully.`);
      fetchJobs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete upload job.');
    }
  };

  const handlePauseJob = async (jobId) => {
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/uploads/jobs/${jobId}/pause`, {}, {
        headers: AuthService.getAuthHeader()
      });
      fetchJobs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to pause job.');
    }
  };

  const handleResumeJob = async (jobId) => {
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/uploads/jobs/${jobId}/resume`, {}, {
        headers: AuthService.getAuthHeader()
      });
      fetchJobs();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resume job.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAUSED':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(239, 149, 0, 0.1)', color: 'var(--color-warning)', border: '1px solid rgba(239, 149, 0, 0.2)', padding: '4px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <FiClock /> Paused
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '4px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <FiCheckCircle /> Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '4px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <FiAlertTriangle /> Failed
          </span>
        );
      case 'PARSING':
      case 'CLASSIFYING':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '4px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <FiLoader className="spin" /> {status}
          </span>
        );
      default:
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '4px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <FiClock /> {status}
          </span>
        );
    }
  };

  // Calculate dynamic stats
  const totalUploads = jobs.length;
  const totalQuestions = jobs.reduce((sum, j) => sum + (j.processedQuestions || 0), 0);
  const totalDuplicates = jobs.reduce((sum, j) => sum + (j.duplicateQuestions || 0), 0);
  const totalFailures = jobs.reduce((sum, j) => sum + (j.failedQuestions || 0), 0);

  return (
    <div style={{ padding: '40px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Header section */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-title)' }}>
          PDF Ingestion Hub
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Upload GATE CSE exam papers to extract, segment, and categorize questions using Groq LLM pipelines.
        </p>
      </div>

      {/* Stats Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: 'var(--color-primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiFileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total PDFs Uploaded</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{totalUploads}</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-secondary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiDatabase size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Questions Parsed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{totalQuestions}</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiLayers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Duplicates Flagged</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{totalDuplicates}</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiAlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Ingestion Failures</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{totalFailures}</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--color-error)',
          padding: '14px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <FiAlertTriangle /> {error}
        </div>
      )}

      {success && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: 'var(--color-success)',
          padding: '14px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <FiCheckCircle /> {success}
        </div>
      )}

      {/* Upload Drag & Drop Area */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: isDragActive ? '2px dashed var(--color-secondary)' : '1px dashed var(--border-color)',
          boxShadow: isDragActive ? '0 0 20px rgba(6, 182, 212, 0.15)' : 'none',
          borderRadius: '20px',
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '40px',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <input 
          ref={fileInputRef}
          id="file-input"
          type="file" 
          accept=".pdf" 
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div style={{
          backgroundColor: 'rgba(139, 92, 246, 0.05)',
          border: '1px solid rgba(139, 92, 246, 0.1)',
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-primary)',
          marginBottom: '16px',
          boxShadow: '0 0 15px rgba(139, 92, 246, 0.05)'
        }}>
          <FiUploadCloud size={32} />
        </div>

        {file ? (
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Selected File:</h4>
            <p style={{ color: 'var(--color-secondary)', fontWeight: 600, fontSize: '0.95rem', marginBottom: '20px' }}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ padding: '8px 20px', fontSize: '0.85rem' }} 
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Clear File
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
                onClick={(e) => { e.stopPropagation(); handleUploadSubmit(); }}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Start parsing PDF'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>Drag & drop your competitive exam PDF here</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>or click to browse local files</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supported formats: PDF (max 15MB)</p>
          </div>
        )}
      </div>

      {/* Upload Jobs Logs list */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-title)' }}>Ingestion Logs</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Track background parser execution states and metrics below.</p>
      </div>

      <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
              <th style={{ padding: '18px 20px' }}>Filename</th>
              <th style={{ padding: '18px 20px' }}>Status</th>
              <th style={{ padding: '18px 20px' }}>Parsed Questions</th>
              <th style={{ padding: '18px 20px' }}>Duplicates</th>
              <th style={{ padding: '18px 20px' }}>Failures</th>
              <th style={{ padding: '18px 20px' }}>Speed</th>
              <th style={{ padding: '18px 20px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  No upload jobs recorded. Start by dropping a PDF file above.
                </td>
              </tr>
            ) : (
              jobs.map(job => (
                <tr key={job.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background-color 0.2s ease' }} className="table-hover-row">
                  <td style={{ padding: '18px 20px', fontWeight: 600, color: '#fff' }}>{job.filename}</td>
                  <td style={{ padding: '18px 20px' }}>{getStatusBadge(job.status)}</td>
                  <td style={{ padding: '18px 20px', fontWeight: 500 }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{job.processedQuestions}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> / {job.totalQuestionsFound || '?'}</span>
                  </td>
                  <td style={{ padding: '18px 20px', color: job.duplicateQuestions > 0 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                    {job.duplicateQuestions}
                  </td>
                  <td style={{ padding: '18px 20px', color: job.failedQuestions > 0 ? 'var(--color-error)' : 'var(--text-muted)', fontWeight: job.failedQuestions > 0 ? 700 : 'normal' }}>
                    {job.failedQuestions}
                  </td>
                  <td style={{ padding: '18px 20px', color: 'var(--text-secondary)' }}>
                    {job.processingTimeMs ? `${(job.processingTimeMs / 1000).toFixed(1)}s` : '-'}
                  </td>
                  <td style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {(job.status === 'PARSING' || job.status === 'CLASSIFYING') && (
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--color-warning)', borderColor: 'rgba(239, 149, 0, 0.3)' }}
                          onClick={() => handlePauseJob(job.id)}
                        >
                          Pause
                        </button>
                      )}
                      {job.status === 'PAUSED' && (
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                          onClick={() => handleResumeJob(job.id)}
                        >
                          Resume
                        </button>
                      )}
                      {job.status === 'COMPLETED' && (
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                          onClick={() => navigate('/admin/review-queue')}
                        >
                          Review Queue
                        </button>
                      )}
                      {AuthService.getCurrentUser()?.role === 'ADMIN' && (
                        <button 
                          className="btn" 
                          style={{ 
                            padding: '8px 10px', 
                            fontSize: '0.8rem', 
                            backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                            color: 'var(--color-error)', 
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleDeleteJob(job.id, job.filename)}
                          title="Delete PDF and associated questions"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
