import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../../config/api';
import AuthService from '../../services/authService';
import { 
  FiLayers, FiPlus, FiEdit2, FiTrash2, FiRefreshCw, 
  FiSearch, FiAlertTriangle 
} from 'react-icons/fi';

// Helper component to render nested topic nodes in Admin Panel
const AdminTopicTreeNode = ({ node, subject, allSubjects, topicSearch, onAddSubtopic, onEditTopic, onTransferTopic, onDeleteTopic }) => {
  const matchesSearch = !topicSearch || node.name.toLowerCase().includes(topicSearch.toLowerCase());
  const hasChildren = node.children && node.children.length > 0;

  if (!matchesSearch && !hasChildren) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '10px',
      padding: '12px 16px',
      marginBottom: '8px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 800 }}>•</span>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.92rem' }}>{node.name}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(ID #{node.id})</span>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button 
            onClick={() => onAddSubtopic(node)}
            className="btn btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.74rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <FiPlus size={12} /> Add Subtopic
          </button>

          <button 
            onClick={() => onEditTopic(node)}
            className="btn btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.74rem', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)' }}
            title="Edit Topic Name"
          >
            <FiEdit2 size={12} />
          </button>

          <button 
            onClick={() => onTransferTopic(node)}
            className="btn btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.74rem', color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Transfer Topic to Another Subject"
          >
            <FiRefreshCw size={12} /> Transfer
          </button>

          <button 
            onClick={() => onDeleteTopic(node)}
            className="btn btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.74rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
            title="Delete Topic"
          >
            <FiTrash2 size={12} />
          </button>
        </div>
      </div>

      {hasChildren && (
        <div style={{ marginLeft: '20px', marginTop: '10px', borderLeft: '2px dashed rgba(245,158,11,0.2)', paddingLeft: '14px' }}>
          {node.children.map(child => (
            <AdminTopicTreeNode 
              key={child.id}
              node={child}
              subject={subject}
              allSubjects={allSubjects}
              topicSearch={topicSearch}
              onAddSubtopic={onAddSubtopic}
              onEditTopic={onEditTopic}
              onTransferTopic={onTransferTopic}
              onDeleteTopic={onDeleteTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function AdminSubjectsTab() {
  const [adminSubjects, setAdminSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedAdminSubject, setSelectedAdminSubject] = useState(null);
  const [adminTopicTree, setAdminTopicTree] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [topicSearch, setTopicSearch] = useState('');

  // Modals State
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [reassignSubjectId, setReassignSubjectId] = useState('');

  const [newTopicName, setNewTopicName] = useState('');
  const [parentTopicForNew, setParentTopicForNew] = useState(null);
  const [editingTopic, setEditingTopic] = useState(null);
  const [transferringTopic, setTransferringTopic] = useState(null);
  const [targetSubjectForTransfer, setTargetSubjectForTransfer] = useState('');
  const [deletingTopic, setDeletingTopic] = useState(null);
  const [targetTopicForReassign, setTargetTopicForReassign] = useState('');

  const fetchAdminSubjects = async () => {
    try {
      setSubjectsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects`);
      if (Array.isArray(res.data)) {
        setAdminSubjects(res.data);
        if (res.data.length > 0) {
          setSelectedAdminSubject(prev => {
            if (!prev) {
              fetchAdminTopicTree(res.data[0].id);
              return res.data[0];
            }
            const match = res.data.find(s => s.id === prev.id);
            if (match) return match;
            fetchAdminTopicTree(res.data[0].id);
            return res.data[0];
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch admin subjects", err);
    } finally {
      setSubjectsLoading(false);
    }
  };

  const fetchAdminTopicTree = async (subjId) => {
    if (!subjId) return;
    try {
      setTopicsLoading(true);
      const res = await axios.get(`${API_CONFIG.BASE_URL}/api/subjects/${subjId}/topics`);
      if (Array.isArray(res.data)) {
        setAdminTopicTree(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch admin topic tree", err);
      setAdminTopicTree([]);
    } finally {
      setTopicsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminSubjects();
  }, []);

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    try {
      const res = await axios.post(`${API_CONFIG.BASE_URL}/api/subjects`, {
        name: newSubjectName.trim()
      }, { headers: AuthService.getAuthHeader() });
      if (res.data) {
        setNewSubjectName('');
        fetchAdminSubjects();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create subject.");
    }
  };

  const handleUpdateSubject = async (e) => {
    e.preventDefault();
    if (!editingSubject || !editingSubject.name.trim()) return;
    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/subjects/admin/subjects/${editingSubject.id}`, {
        name: editingSubject.name.trim()
      }, { headers: AuthService.getAuthHeader() });
      setEditingSubject(null);
      fetchAdminSubjects();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update subject.");
    }
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    try {
      let url = `${API_CONFIG.BASE_URL}/api/subjects/admin/subjects/${deletingSubject.id}`;
      if (reassignSubjectId) {
        url += `?targetSubjectId=${reassignSubjectId}`;
      }
      await axios.delete(url, { headers: AuthService.getAuthHeader() });
      setDeletingSubject(null);
      setReassignSubjectId('');
      fetchAdminSubjects();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete subject.");
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!newTopicName.trim() || !selectedAdminSubject) return;
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/subjects/${selectedAdminSubject.id}/topics`, {
        name: newTopicName.trim(),
        parentTopicId: parentTopicForNew ? parentTopicForNew.id : null
      }, { headers: AuthService.getAuthHeader() });
      setNewTopicName('');
      setParentTopicForNew(null);
      fetchAdminTopicTree(selectedAdminSubject.id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create topic.");
    }
  };

  const handleUpdateTopic = async (e) => {
    e.preventDefault();
    if (!editingTopic || !editingTopic.name.trim()) return;
    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/subjects/admin/topics/${editingTopic.id}`, {
        name: editingTopic.name.trim()
      }, { headers: AuthService.getAuthHeader() });
      setEditingTopic(null);
      if (selectedAdminSubject) fetchAdminTopicTree(selectedAdminSubject.id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update topic.");
    }
  };

  const handleTransferTopic = async (e) => {
    e.preventDefault();
    if (!transferringTopic || !targetSubjectForTransfer) return;
    try {
      await axios.put(`${API_CONFIG.BASE_URL}/api/subjects/admin/topics/${transferringTopic.id}/transfer`, {
        targetSubjectId: targetSubjectForTransfer
      }, { headers: AuthService.getAuthHeader() });
      setTransferringTopic(null);
      setTargetSubjectForTransfer('');
      fetchAdminSubjects();
      if (selectedAdminSubject) fetchAdminTopicTree(selectedAdminSubject.id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to transfer topic.");
    }
  };

  const handleDeleteTopic = async () => {
    if (!deletingTopic) return;
    try {
      let url = `${API_CONFIG.BASE_URL}/api/subjects/admin/topics/${deletingTopic.id}`;
      if (targetTopicForReassign) {
        url += `?targetTopicId=${targetTopicForReassign}`;
      }
      await axios.delete(url, { headers: AuthService.getAuthHeader() });
      setDeletingTopic(null);
      setTargetTopicForReassign('');
      if (selectedAdminSubject) fetchAdminTopicTree(selectedAdminSubject.id);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete topic.");
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1300px', margin: '0 auto' }}>
      
      {/* Header Card */}
      <div className="admin-header-card">
        <h2 className="admin-header-title">
          <FiLayers style={{ color: '#f59e0b' }} /> Subjects & Topics Architecture Engine
        </h2>
        <p className="admin-header-desc">
          Create, rename, transfer topics across subjects, and safely manage subject hierarchies with automated question reassignment.
        </p>
      </div>

      {/* Main Grid: Left Subjects List + Right Topic Hierarchy Tree */}
      <div className="admin-grid-subjects">
        
        {/* LEFT COLUMN: Subjects Column */}
        <div className="admin-card">
          <h3 style={{ fontSize: '1.05rem', color: '#fff', margin: '0 0 16px 0', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>📚 All Subjects ({adminSubjects.length})</span>
            <button 
              onClick={fetchAdminSubjects} 
              className="btn btn-outline" 
              style={{ padding: '3px 8px', fontSize: '0.75rem', borderColor: 'var(--border-color)' }}
              title="Refresh subjects"
            >
              <FiRefreshCw size={12} />
            </button>
          </h3>

          {/* Add New Subject Input */}
          <form onSubmit={handleCreateSubject} style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="New Subject Name..." 
              value={newSubjectName} 
              onChange={e => setNewSubjectName(e.target.value)}
              className="admin-input"
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.8rem', background: '#f59e0b', borderColor: '#f59e0b', fontWeight: 700 }}
            >
              <FiPlus size={14} /> Add
            </button>
          </form>

          {/* Subject Search */}
          <div style={{ marginBottom: '14px', position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} size={14} />
            <input 
              type="text" 
              placeholder="Filter subjects..." 
              value={subjectSearch} 
              onChange={e => setSubjectSearch(e.target.value)}
              className="admin-input"
              style={{ paddingLeft: '32px', fontSize: '0.8rem' }}
            />
          </div>

          {/* Subjects List Cards */}
          {subjectsLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading subjects...</div>
          ) : adminSubjects.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No subjects found. Create one above!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
              {adminSubjects
                .filter(s => s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
                .map(subj => {
                  const isSelected = selectedAdminSubject?.id === subj.id;
                  return (
                    <div 
                      key={subj.id}
                      onClick={() => {
                        setSelectedAdminSubject(subj);
                        fetchAdminTopicTree(subj.id);
                      }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSelected ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                        transition: 'all 0.18s ease',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? '#f59e0b' : '#fff', fontSize: '0.9rem' }}>
                          {subj.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          ID: #{subj.id}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => setEditingSubject({ id: subj.id, name: subj.name })}
                          style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', borderRadius: '4px' }}
                          title="Edit Subject Name"
                        >
                          <FiEdit2 size={13} />
                        </button>
                        <button 
                          onClick={() => setDeletingSubject({ id: subj.id, name: subj.name })}
                          style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }}
                          title="Delete Subject"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Topic Hierarchy Tree for Selected Subject */}
        <div className="admin-card" style={{ minHeight: '600px' }}>
          {selectedAdminSubject ? (
            <>
              {/* Subject Header info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Selected Subject Hierarchy
                  </div>
                  <h3 style={{ fontSize: '1.3rem', color: '#fff', margin: '4px 0 0 0', fontWeight: 800 }}>
                    {selectedAdminSubject.name}
                  </h3>
                </div>

                <button 
                  onClick={() => setParentTopicForNew({ id: null, name: selectedAdminSubject.name })}
                  className="btn btn-primary"
                  style={{ padding: '8px 14px', fontSize: '0.82rem', background: '#6366f1', borderColor: '#6366f1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiPlus size={15} /> Add Root Topic
                </button>
              </div>

              {/* Topic Search Bar */}
              <div style={{ marginBottom: '18px', position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-muted)' }} size={15} />
                <input 
                  type="text" 
                  placeholder="Search topics or subtopics in this subject..." 
                  value={topicSearch} 
                  onChange={e => setTopicSearch(e.target.value)}
                  className="admin-input"
                  style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Topic Tree View */}
              {topicsLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading topic hierarchy tree...</div>
              ) : adminTopicTree.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>No topics found for <strong>{selectedAdminSubject.name}</strong>.</p>
                  <button 
                    onClick={() => setParentTopicForNew({ id: null, name: selectedAdminSubject.name })}
                    className="btn btn-outline" 
                    style={{ fontSize: '0.82rem' }}
                  >
                    <FiPlus size={14} /> Create First Topic
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {adminTopicTree.map(topicNode => (
                    <AdminTopicTreeNode 
                      key={topicNode.id} 
                      node={topicNode} 
                      subject={selectedAdminSubject}
                      allSubjects={adminSubjects}
                      topicSearch={topicSearch}
                      onAddSubtopic={(node) => setParentTopicForNew({ id: node.id, name: node.name })}
                      onEditTopic={(node) => setEditingTopic({ id: node.id, name: node.name })}
                      onTransferTopic={(node) => setTransferringTopic({ id: node.id, name: node.name })}
                      onDeleteTopic={(node) => setDeletingTopic({ id: node.id, name: node.name })}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a subject on the left to inspect and manage its topic tree hierarchy.
            </div>
          )}
        </div>

      </div>

      {/* MODALS */}

      {/* EDIT SUBJECT MODAL */}
      {editingSubject && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog" style={{ maxWidth: '420px' }}>
            <h3 style={{ marginTop: 0, color: '#fff', fontSize: '1.1rem' }}>✏️ Rename Subject</h3>
            <form onSubmit={handleUpdateSubject}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Subject Name</label>
                <input 
                  type="text" 
                  value={editingSubject.name} 
                  onChange={e => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  className="admin-input"
                  style={{ fontWeight: 600 }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setEditingSubject(null)} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE SUBJECT MODAL */}
      {deletingSubject && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog" style={{ maxWidth: '480px' }}>
            <h3 style={{ marginTop: 0, color: '#ef4444', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiAlertTriangle /> Delete Subject '{deletingSubject.name}'
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Are you sure you want to delete this subject? You can optionally reassign all questions and topics to another subject below:
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Reassign Questions & Topics To (Optional)</label>
              <select 
                value={reassignSubjectId} 
                onChange={e => setReassignSubjectId(e.target.value)}
                className="admin-select"
              >
                <option value="">-- Delete / Clear References --</option>
                {adminSubjects.filter(s => s.id !== deletingSubject.id).map(s => (
                  <option key={s.id} value={s.id}>Move all to {s.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => { setDeletingSubject(null); setReassignSubjectId(''); }} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Cancel</button>
              <button onClick={handleDeleteSubject} className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444', fontSize: '0.85rem' }}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TOPIC / SUBTOPIC MODAL */}
      {parentTopicForNew !== null && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog" style={{ maxWidth: '440px' }}>
            <h3 style={{ marginTop: 0, color: '#fff', fontSize: '1.1rem' }}>
              ➕ Add New {parentTopicForNew.id ? 'Subtopic' : 'Root Topic'}
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#6366f1', marginBottom: '14px', fontWeight: 600 }}>
              Under: {parentTopicForNew.name}
            </div>
            <form onSubmit={handleCreateTopic}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Topic Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Asymptotic Notations" 
                  value={newTopicName} 
                  onChange={e => setNewTopicName(e.target.value)}
                  className="admin-input"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setParentTopicForNew(null)} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Create Topic</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TOPIC MODAL */}
      {editingTopic && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog" style={{ maxWidth: '420px' }}>
            <h3 style={{ marginTop: 0, color: '#fff', fontSize: '1.1rem' }}>✏️ Rename Topic</h3>
            <form onSubmit={handleUpdateTopic}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Topic Name</label>
                <input 
                  type="text" 
                  value={editingTopic.name} 
                  onChange={e => setEditingTopic({ ...editingTopic, name: e.target.value })}
                  className="admin-input"
                  style={{ fontWeight: 600 }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setEditingTopic(null)} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Save Topic</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER TOPIC TO ANOTHER SUBJECT MODAL */}
      {transferringTopic && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog" style={{ maxWidth: '480px' }}>
            <h3 style={{ marginTop: 0, color: '#38bdf8', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔄 Transfer Topic '{transferringTopic.name}'
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>
              Select the destination Subject below. This topic, all its subtopics, and all associated PYQ questions will be transferred instantly to the new subject!
            </p>
            <form onSubmit={handleTransferTopic}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Target Destination Subject</label>
                <select 
                  value={targetSubjectForTransfer} 
                  onChange={e => setTargetSubjectForTransfer(e.target.value)}
                  className="admin-select"
                  style={{ fontWeight: 600 }}
                  required
                >
                  <option value="">-- Select Destination Subject --</option>
                  {adminSubjects.filter(s => s.id !== selectedAdminSubject?.id).map(s => (
                    <option key={s.id} value={s.id}>Move to {s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => { setTransferringTopic(null); setTargetSubjectForTransfer(''); }} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#38bdf8', borderColor: '#38bdf8', fontSize: '0.85rem', color: '#000', fontWeight: 800 }}>Confirm Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE TOPIC MODAL */}
      {deletingTopic && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-dialog" style={{ maxWidth: '480px' }}>
            <h3 style={{ marginTop: 0, color: '#ef4444', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiAlertTriangle /> Delete Topic '{deletingTopic.name}'
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>
              Are you sure you want to delete this topic and all its subtopics?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={() => { setDeletingTopic(null); setTargetTopicForReassign(''); }} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Cancel</button>
              <button onClick={handleDeleteTopic} className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444', fontSize: '0.85rem' }}>Delete Topic</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
