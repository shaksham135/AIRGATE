import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthService from '../services/AuthService';
import API_CONFIG from '../config/api';
import AIRGATELoader from '../components/AIRGATELoader';
import { FiChevronLeft, FiTrash2, FiStar, FiCheckCircle, FiUsers, FiEye, FiClock } from 'react-icons/fi';

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Per-user duration selection for granting premium (default 1 month)
  const [grantDurations, setGrantDurations] = useState({});
  const [inspectUser, setInspectUser] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('solves'); // 'solves', 'bookmarks', 'logins'

  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/users`, {
        headers: AuthService.getAuthHeader()
      });
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to load users:", err);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!AuthService.isAdminOrEditor()) {
      navigate('/explore');
      return;
    }
    fetchUsers();
  }, [navigate, fetchUsers]);

  const handleGrantPremium = async (user) => {
    const duration = grantDurations[user.id] || 1;
    if (user.isPremium) {
      // Revoke
      if (!window.confirm(`Revoke Aspirant Pro from @${user.username}?`)) return;
      try {
        await axios.post(`${API_CONFIG.BASE_URL}/api/admin/users/${user.id}/premium`, {}, {
          headers: AuthService.getAuthHeader()
        });
        fetchUsers();
      } catch (err) {
        alert('Failed: ' + (err.response?.data?.message || err.message));
      }
    } else {
      // Grant with selected duration
      try {
        await axios.post(`${API_CONFIG.BASE_URL}/api/admin/users/${user.id}/premium?duration=${duration}`, {}, {
          headers: AuthService.getAuthHeader()
        });
        fetchUsers();
      } catch (err) {
        alert('Failed: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleToggleBan = async (userId) => {
    try {
      await axios.post(`${API_CONFIG.BASE_URL}/api/admin/users/${userId}/ban`, {}, {
        headers: AuthService.getAuthHeader()
      });
      fetchUsers();
    } catch (err) {
      alert("Failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleInspectUser = async (userId) => {
    try {
      setInspectLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/users/${userId}/details`, {
        headers: AuthService.getAuthHeader()
      });
      setInspectUser(response.data);
      setActiveTab('solves');
    } catch (err) {
      alert("Failed to load user details: " + (err.response?.data?.message || err.message));
    } finally {
      setInspectLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure? All solve logs, bookmarks, and comments of this user will be cleared.")) return;
    try {
      await axios.delete(`${API_CONFIG.BASE_URL}/api/admin/users/${userId}`, {
        headers: AuthService.getAuthHeader()
      });
      fetchUsers();
    } catch (err) {
      alert("Failed: " + (err.response?.data?.message || err.message));
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalAdmins = users.filter(u => u.role === 'ADMIN').length;
  const totalEditors = users.filter(u => u.role === 'EDITOR').length;
  const totalStudents = users.filter(u => u.role === 'STUDENT').length;
  const totalPremium = users.filter(u => u.isPremium).length;
  const totalBanned = users.filter(u => u.isBanned).length;

  return (
    <div style={{ padding: '32px', width: '100%', maxWidth: '1300px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FiUsers style={{ color: '#a855f7' }} /> User Management
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>View, manage, and moderate all registered platform users.</p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate('/admin/panel')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, height: '42px' }}>
          <FiChevronLeft /> Back to Panel
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'Total Users', value: users.length, color: '#38bdf8', icon: '👥' },
          { label: 'Admins', value: totalAdmins, color: '#38bdf8', icon: '🛡️' },
          { label: 'Editors', value: totalEditors, color: '#a855f7', icon: '✏️' },
          { label: 'Students', value: totalStudents, color: '#10b981', icon: '🎓' },
          { label: 'Premium', value: totalPremium, color: '#f59e0b', icon: '👑' },
          { label: 'Banned', value: totalBanned, color: '#ef4444', icon: '🔴' },
        ].map((stat, idx) => (
          <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{stat.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: stat.color, fontFamily: 'var(--font-title)' }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Role Distribution Bar */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>📊 Role Distribution</h3>
        <div style={{ display: 'flex', height: '32px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' }}>
          {users.length > 0 && (
            <>
              <div style={{ width: `${(totalAdmins / users.length) * 100}%`, backgroundColor: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#000', minWidth: totalAdmins > 0 ? '40px' : '0', transition: 'width 0.5s' }}>
                {totalAdmins > 0 && `${totalAdmins} Admin`}
              </div>
              <div style={{ width: `${(totalEditors / users.length) * 100}%`, backgroundColor: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', minWidth: totalEditors > 0 ? '40px' : '0', transition: 'width 0.5s' }}>
                {totalEditors > 0 && `${totalEditors} Editor`}
              </div>
              <div style={{ width: `${(totalStudents / users.length) * 100}%`, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#000', minWidth: totalStudents > 0 ? '40px' : '0', transition: 'width 0.5s' }}>
                {totalStudents > 0 && `${totalStudents} Student`}
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#38bdf8', display: 'inline-block' }}></span> Admin</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#a855f7', display: 'inline-block' }}></span> Editor</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#10b981', display: 'inline-block' }}></span> Student</span>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '24px' }}>
        <input 
          type="text"
          placeholder="🔍 Search by username or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ 
            width: '100%', maxWidth: '400px', padding: '12px 16px', 
            backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', 
            borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.9rem',
            outline: 'none'
          }}
        />
      </div>

      {/* Users Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
        {usersLoading ? (
          <AIRGATELoader text="Loading User Database..." />
        ) : filteredUsers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No users found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '14px 10px' }}>User</th>
                  <th style={{ padding: '14px 10px' }}>Email</th>
                  <th style={{ padding: '14px 10px' }}>Role</th>
                  <th style={{ padding: '14px 10px' }}>Joined</th>
                  <th style={{ padding: '14px 10px', textAlign: 'center' }}>Plan</th>
                  <th style={{ padding: '14px 10px', textAlign: 'center' }}>Expires</th>
                  <th style={{ padding: '14px 10px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '14px 10px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle', opacity: user.isBanned ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                    <td style={{ padding: '16px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>
                          {user.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user.email}</td>
                    <td style={{ padding: '16px 10px' }}>
                      <span style={{ 
                        backgroundColor: user.role === 'ADMIN' ? 'rgba(56,189,248,0.15)' : user.role === 'EDITOR' ? 'rgba(168,85,247,0.15)' : 'rgba(16,185,129,0.15)',
                        color: user.role === 'ADMIN' ? '#38bdf8' : user.role === 'EDITOR' ? '#a855f7' : '#10b981',
                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '16px 10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {!user.isPremium && (
                        <select
                          value={grantDurations[user.id] || 1}
                          onChange={e => setGrantDurations(prev => ({ ...prev, [user.id]: Number(e.target.value) }))}
                          style={{
                            padding: '4px 6px', fontSize: '0.72rem', borderRadius: '6px', marginBottom: '6px',
                            backgroundColor: 'var(--bg-main)', color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)', display: 'block', width: '100%', cursor: 'pointer'
                          }}
                        >
                          <option value={1}>1 Month</option>
                          <option value={3}>3 Months</option>
                          <option value={6}>6 Months</option>
                        </select>
                      )}
                      <button
                        onClick={() => handleGrantPremium(user)}
                        style={{
                          padding: '5px 12px', fontSize: '0.72rem', borderRadius: '6px', width: '100%',
                          border: user.isPremium ? '1px solid #ef4444' : '1px solid var(--color-primary)',
                          backgroundColor: user.isPremium ? 'rgba(239,68,68,0.08)' : 'rgba(139,92,246,0.1)',
                          color: user.isPremium ? '#ef4444' : 'var(--color-primary)',
                          cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s'
                        }}
                      >
                        {user.isPremium ? 'Revoke Pro' : 'Grant Pro'}
                      </button>
                    </td>
                    <td style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {user.premiumExpiresAt
                        ? new Date(user.premiumExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td style={{ padding: '16px 10px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleBan(user.id)}
                        style={{
                          padding: '6px 14px', fontSize: '0.75rem', borderRadius: '8px',
                          border: user.isBanned ? '1px solid #ef4444' : '1px solid var(--border-color)',
                          backgroundColor: user.isBanned ? 'rgba(239,68,68,0.1)' : 'transparent',
                          color: user.isBanned ? '#ef4444' : '#10b981',
                          cursor: 'pointer', fontWeight: 700, transition: 'all 0.2s'
                        }}
                      >
                        {user.isBanned ? '🔴 Banned' : '🟢 Active'}
                      </button>
                    </td>
                    <td style={{ padding: '16px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleInspectUser(user.id)}
                          style={{
                            padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px',
                            border: '1px solid rgba(56,189,248,0.2)', backgroundColor: 'rgba(56,189,248,0.05)',
                            color: '#38bdf8', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                          }}
                          title="Inspect Profile"
                        >
                          <FiEye size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          style={{
                            padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px',
                            border: '1px solid rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.05)',
                            color: '#ef4444', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                          }}
                          title="Permanently delete this user"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Inspect Modal */}
      {inspectUser && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh',
            overflowY: 'auto', padding: '32px', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            {/* Close Button */}
            <button 
              onClick={() => setInspectUser(null)} 
              style={{
                position: 'absolute', top: '20px', right: '20px',
                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                fontSize: '1.5rem', cursor: 'pointer'
              }}
            >
              &times;
            </button>

            {/* Profile Overview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.5rem' }}>
                {inspectUser.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0 }}>@{inspectUser.username}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>{inspectUser.email}</p>
              </div>
            </div>

            {/* Streak & Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>🔥</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{inspectUser.currentStreak} days</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Current Streak</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>👑</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a855f7' }}>{inspectUser.longestStreak} days</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Longest Streak</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>🕒</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
                  {inspectUser.lastSolvedDate ? new Date(inspectUser.lastSolvedDate).toLocaleDateString() : 'Never'}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '4px' }}>Last Solved</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>⚙️</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
                  {inspectUser.lastActiveAt ? new Date(inspectUser.lastActiveAt).toLocaleString() : '—'}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: '4px' }}>Last Active</div>
              </div>
            </div>

            {/* Tabs Header */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
              {[
                { id: 'solves', label: '✅ Solves', icon: <FiCheckCircle /> },
                { id: 'bookmarks', label: '⭐ Bookmarks', icon: <FiStar /> },
                { id: 'logins', label: '🔑 Login History', icon: <FiClock /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '10px 16px', background: 'transparent', border: 'none',
                    borderBottom: activeTab === tab.id ? '2px solid #a855f7' : '2px solid transparent',
                    color: activeTab === tab.id ? '#a855f7' : 'var(--text-secondary)',
                    fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem'
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div style={{ minHeight: '200px' }}>
              {activeTab === 'solves' && (
                <div>
                  {inspectUser.solveHistory?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No solve logs found.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px' }}>Question ID</th>
                            <th style={{ padding: '8px' }}>Subject</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Result</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>Time Taken</th>
                            <th style={{ padding: '8px' }}>Solved At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectUser.solveHistory.map((s, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '10px 8px', fontWeight: 600 }}>#{s.questionId} ({s.questionYear})</td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{s.questionSubject}</td>
                              <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                <span style={{
                                  backgroundColor: s.isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                  color: s.isCorrect ? '#10b981' : '#ef4444',
                                  padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700
                                }}>
                                  {s.isCorrect ? 'Correct' : 'Incorrect'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                {s.solvingTimeSeconds != null ? `${s.solvingTimeSeconds}s` : '—'}
                              </td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>
                                {new Date(s.solvedAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bookmarks' && (
                <div>
                  {inspectUser.bookmarks?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No bookmarked questions.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px' }}>Question ID</th>
                            <th style={{ padding: '8px' }}>Subject</th>
                            <th style={{ padding: '8px' }}>Bookmarked At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectUser.bookmarks.map((b, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '10px 8px', fontWeight: 600 }}>#{b.questionId} ({b.questionYear})</td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{b.questionSubject}</td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>
                                {new Date(b.bookmarkedAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'logins' && (
                <div>
                  {inspectUser.loginHistory?.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No logins recorded.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px' }}>Logged In At</th>
                            <th style={{ padding: '8px' }}>IP Address</th>
                            <th style={{ padding: '8px' }}>Browser</th>
                            <th style={{ padding: '8px' }}>OS</th>
                            <th style={{ padding: '8px' }}>Device</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectUser.loginHistory.map((l, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '10px 8px', fontWeight: 600 }}>{new Date(l.loggedInAt).toLocaleString()}</td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{l.ipAddress || '—'}</td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{l.browser || '—'}</td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{l.operatingSystem || '—'}</td>
                              <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{l.deviceType || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
