import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import { formatMathText, getAssetUrl } from '../utils/mathRenderer';

export default function AdminQuestionEditor() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();

  // Form states
  const [text, setText] = useState('');
  const [questionType, setQuestionType] = useState('MCQ');
  const [marks, setMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(-0.33);
  const [year, setYear] = useState(2024);
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [pdfSourceName, setPdfSourceName] = useState('Manual Entry');
  const [pdfSourcePath, setPdfSourcePath] = useState('Manual Entry');
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [tagString, setTagString] = useState('');
  const [aiSuggestedAnswer, setAiSuggestedAnswer] = useState('A');
  const [aiSuggestedExplanation, setAiSuggestedExplanation] = useState('');
  
  // Option inputs
  const [options, setOptions] = useState(['', '', '', '']);

  // Dropdown lists
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Redirect if not authorized
    if (!AuthService.isAdminOrEditor()) {
      navigate('/explore');
      return;
    }

    fetchSubjects();

    if (isEditMode) {
      loadQuestionDetails();
    }
  }, [id]);

  useEffect(() => {
    if (subjectId) {
      fetchTopics(subjectId);
    } else {
      setTopics([]);
    }
  }, [subjectId]);

  const fetchSubjects = async () => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects`);
      setSubjects(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      console.error('Failed to load subjects', e);
      setSubjects([]);
    }
  };

  const fetchTopics = async (subjId) => {
    try {
      // Fetch flat list of topics, filter in React or backend
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects/${subjId}/topics`);
      // Flatten hierarchical topic nodes for selection dropdown
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
    } catch (e) {
      console.error('Failed to load topics', e);
    }
  };

  const loadQuestionDetails = async () => {
    try {
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/questions/${id}`);
      const q = response.data;
      setText(q.text);
      setQuestionType(q.questionType);
      setMarks(q.marks);
      setNegativeMarks(q.negativeMarks);
      setYear(q.year);
      setSubjectId(q.subjectId);
      setTopicId(q.topicId);
      setPdfSourceName(q.pdfSourceName);
      setPdfSourcePath(q.pdfSourcePath || 'Manual Entry');
      setPdfPageNumber(q.pdfPageNumber);
      setAiSuggestedAnswer(q.aiSuggestedAnswer || 'A');
      setAiSuggestedExplanation(q.aiSuggestedExplanation || '');
      
      // Load options
      if (q.options && q.options.length > 0) {
        const sortedOpts = [...q.options].sort((a, b) => a.optionLabel.localeCompare(b.optionLabel));
        setOptions(sortedOpts.map(o => o.optionText));
      } else {
        setOptions(['', '', '', '']);
      }

      // Load tags
      if (q.tags) {
        setTagString(Array.from(q.tags).join(', '));
      }
    } catch (e) {
      setError('Failed to load question details!');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Compile options list
    let finalOptions = [];
    if (questionType !== 'NAT') {
      if (options.some(opt => !opt.trim())) {
        setError('Please fill in all option fields.');
        setLoading(false);
        return;
      }
      finalOptions = options;
    }

    // Compile tags set
    const tags = tagString.split(',')
      .map(t => t.trim())
      .filter(t => t !== '');

    const payload = {
      text,
      questionType,
      marks: parseInt(marks),
      negativeMarks: parseFloat(negativeMarks),
      year: parseInt(year),
      subjectId: parseInt(subjectId),
      topicId: parseInt(topicId),
      pdfSourceName,
      pdfSourcePath,
      pdfPageNumber: parseInt(pdfPageNumber),
      options: finalOptions,
      tags,
      aiSuggestedAnswer,
      aiSuggestedExplanation
    };

    try {
      if (isEditMode) {
        await axios.put(`${API_CONFIG.BASE_URL}/api/questions/${id}`, payload, {
          headers: AuthService.getAuthHeader()
        });
        setSuccess('Question updated successfully!');
      } else {
        await axios.post(`${API_CONFIG.BASE_URL}/api/questions`, payload, {
          headers: AuthService.getAuthHeader()
        });
        setSuccess('Question created successfully!');
        // Clear inputs on create
        setText('');
        setOptions(['', '', '', '']);
        setTagString('');
        setAiSuggestedAnswer('A');
        setAiSuggestedExplanation('');
      }

      setTimeout(() => {
        navigate('/explore');
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit question!');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (idx, value) => {
    const newOptions = [...options];
    newOptions[idx] = value;
    setOptions(newOptions);
  };

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (idx) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== idx);
    setOptions(newOptions);
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

  const handleTypeChange = (e) => {
    const val = e.target.value;
    setQuestionType(val);
    if (val === 'NAT') {
      setNegativeMarks(0.0);
    } else if (val === 'MCQ') {
      setNegativeMarks(marks === 1 ? -0.33 : -0.66);
    } else {
      setNegativeMarks(0.0); // MSQ has no negative marks in GATE
    }
  };

  const handleMarksChange = (e) => {
    const val = parseInt(e.target.value);
    setMarks(val);
    if (questionType === 'MCQ') {
      setNegativeMarks(val === 1 ? -0.33 : -0.66);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px' }}>
        {isEditMode ? 'Edit Question' : 'Add New Question'}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Manually construct and index a competitive exam question
      </p>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--color-error)',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: 'var(--color-success)',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '32px' }}>
        
        <div className="form-group">
          <label className="form-label">Question Text</label>
          <textarea
            className="form-input"
            rows="5"
            style={{ resize: 'vertical' }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type the question content here..."
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Question Type</label>
            <select className="form-select" value={questionType} onChange={handleTypeChange}>
              <option value="MCQ">MCQ (Multiple Choice Question)</option>
              <option value="MSQ">MSQ (Multiple Select Question)</option>
              <option value="NAT">NAT (Numerical Answer Type)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Marks</label>
            <select className="form-select" value={marks} onChange={handleMarksChange}>
              <option value={1}>1 Mark</option>
              <option value={2}>2 Marks</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Negative Marking Value</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              value={negativeMarks}
              onChange={(e) => setNegativeMarks(parseFloat(e.target.value))}
              placeholder="e.g. -0.33"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Exam Year</label>
            <input
              type="number"
              className="form-input"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              placeholder="e.g. 2024"
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <select
              className="form-select"
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}
              required
            >
              <option value="">Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Topic / Subtopic</label>
            <select
              className="form-select"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!subjectId}
              required
            >
              <option value="">Select Topic</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Multiple Choice option fields */}
        {questionType !== 'NAT' && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '12px' }}>
            <div className="form-section-title" style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Question Options</div>
            
            {options.map((opt, idx) => {
              const label = String.fromCharCode(65 + idx);
              const isImage = opt && opt.startsWith('/uploads/');
              return (
                <div key={idx} className="form-group" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginBottom: '16px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontWeight: 'bold', marginBottom: 0 }}>Option {label}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {options.length > 2 && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--color-error)', color: 'var(--color-error)', height: 'auto' }}
                          onClick={() => handleRemoveOption(idx)}
                        >
                          Remove Option
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {isImage ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <img 
                          src={getAssetUrl(opt)} 
                          alt={`Option ${label} Preview`} 
                          style={{ maxHeight: '60px', maxWidth: '120px', objectFit: 'contain', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px' }} 
                        />
                        <button 
                          type="button" 
                          className="btn btn-outline" 
                          style={{ fontSize: '0.75rem', padding: '6px 12px', borderColor: 'var(--color-error)', color: 'var(--color-error)' }} 
                          onClick={() => handleOptionChange(idx, '')}
                        >
                          Delete Option Image
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 1, minWidth: '200px' }}
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Text or equation (e.g. 2^10) for option ${label}`}
                        required
                      />
                    )}

                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input 
                        type="file" 
                        id={`opt-upload-${idx}`} 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => handleOptionImageUpload(idx, e.target.files[0])} 
                      />
                      <label htmlFor={`opt-upload-${idx}`} className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: 0, height: '42px' }}>
                        📷 Upload Image
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              className="btn btn-outline"
              style={{ marginTop: '8px' }}
              onClick={handleAddOption}
            >
              + Add Option
            </button>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '12px' }}>
          <div className="form-group">
            <label className="form-label">Tags (Comma Separated)</label>
            <input
              type="text"
              className="form-input"
              value={tagString}
              onChange={(e) => setTagString(e.target.value)}
              placeholder="e.g. matrix, eigenvalues, linear_algebra"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Source PDF Name</label>
              <input type="text" className="form-input" value={pdfSourceName} onChange={(e) => setPdfSourceName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Source PDF Path</label>
              <input type="text" className="form-input" value={pdfSourcePath} onChange={(e) => setPdfSourcePath(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Page Number</label>
              <input type="number" className="form-input" value={pdfPageNumber} onChange={(e) => setPdfPageNumber(parseInt(e.target.value))} required />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>🔑 Correct Answer & Solution</div>
            
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Correct Answer / Value</label>
              {questionType === 'MCQ' ? (
                <select 
                  className="form-select" 
                  value={aiSuggestedAnswer} 
                  onChange={(e) => setAiSuggestedAnswer(e.target.value)}
                >
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  <option value="C">Option C</option>
                  <option value="D">Option D</option>
                </select>
              ) : (
                <input 
                  type="text" 
                  className="form-input" 
                  value={aiSuggestedAnswer} 
                  onChange={(e) => setAiSuggestedAnswer(e.target.value)}
                  placeholder={questionType === 'MSQ' ? "e.g. A, B" : "e.g. 10 or 4.5 or 10-12"}
                  required
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Suggested Solution / Explanation (Markdown supported)</label>
              <textarea 
                className="form-input" 
                rows="6" 
                value={aiSuggestedExplanation} 
                onChange={(e) => setAiSuggestedExplanation(e.target.value)}
                style={{ fontFamily: 'monospace' }}
                placeholder="Provide step-by-step mathematical reasoning..."
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '32px' }}>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/explore')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
