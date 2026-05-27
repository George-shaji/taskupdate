import { useState, useMemo } from 'react';

const PRIORITY_ORDER = { 'High': 3, 'Medium': 2, 'Low': 1 };
const CODE_LOCATIONS = ['Local', 'Dev', 'Pre', 'Prod'];
const STATUSES = ['Pending', 'In Progress', 'Blocked', 'Completed'];
const namesMatch = (left, right) => {
  return (left || '').trim().toLowerCase() === (right || '').trim().toLowerCase();
};
const canViewTeam = (user) => ['Manager', 'Supreme'].includes(user?.role);

const isOverdue = (task) => {
  if (!task.dueDate || task.status === 'Completed') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.dueDate) < today;
};

const escapeCsv = (value) => {
  const clean = String(value ?? '').replace(/"/g, '""');
  return `"${clean}"`;
};

export default function TaskList({ tasks, onUpdateTask, onDeleteTask, onSendTaskUpdate, onSendSummary, currentUser }) {
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeSort, setActiveSort] = useState('newest');
  const [teamFilter, setTeamFilter] = useState('All');
  const [sendingWebhookId, setSendingWebhookId] = useState(null);
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  
  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editHeading, setEditHeading] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPriority, setEditPriority] = useState('Medium');
  const [editStatus, setEditStatus] = useState('Pending');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAttachmentUrl, setEditAttachmentUrl] = useState('');

  const startEditing = (task) => {
    setEditingId(task.id);
    setEditProjectName(task.projectName || '');
    setEditHeading(task.heading);
    setEditDetails(task.details);
    setEditTime(task.timeTaken.toString());
    setEditPriority(task.importLevel);
    setEditStatus(task.status || 'Pending');
    setEditDueDate(task.dueDate || '');
    setEditAttachmentUrl(task.attachmentUrl || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = (id) => {
    if (!editProjectName.trim() || !editHeading.trim()) return;
    onUpdateTask({
      id,
      projectName: editProjectName.trim(),
      heading: editHeading.trim(),
      details: editDetails.trim(),
      timeTaken: parseFloat(editTime) || 0,
      importLevel: editPriority,
      status: editStatus,
      dueDate: editDueDate,
      attachmentUrl: editAttachmentUrl.trim(),
      userName: taskAuthorForEdit(id)
    });
    setEditingId(null);
  };

  const taskAuthorForEdit = (id) => {
    return (tasks || []).find(task => task.id === id)?.userName;
  };

  const askCodeLocation = () => {
    const answer = window.prompt('Where is the code? Choose one: Local, Dev, Pre, Prod', 'Prod');
    if (answer === null) return null;

    const normalized = CODE_LOCATIONS.find(location => (
      location.toLowerCase() === answer.trim().toLowerCase()
    ));

    if (!normalized) {
      alert('Please enter one of: Local, Dev, Pre, Prod.');
      return null;
    }

    return normalized;
  };

  const askProjectName = (task) => {
    if ((task.projectName || '').trim()) return task.projectName.trim();

    const answer = window.prompt('Enter project code for this task', '');
    if (answer === null) return null;

    const projectName = answer.trim();
    if (!projectName) {
      alert('Project code is required before sending the task update.');
      return null;
    }

    return projectName;
  };

  const sendTaskUpdate = async (task) => {
    if (!onSendTaskUpdate) return;

    const projectName = askProjectName(task);
    if (!projectName) return;

    const codeLocation = askCodeLocation();
    if (!codeLocation) return;

    setSendingWebhookId(task.id);
    try {
      await onSendTaskUpdate({ ...task, projectName }, codeLocation);
      alert('Task update sent to Google Chat.');
    } catch (error) {
      alert(error.message || 'Failed to send task update.');
    } finally {
      setSendingWebhookId(null);
    }
  };

  const getFormattedDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Build list of team members (unique userName values)
  const teamMembers = useMemo(() => {
    const names = Array.from(new Set((tasks || []).map(t => t.userName || 'System/Legacy'))).filter(Boolean);
    return ['All', ...names];
  }, [tasks]);

  const projectOptions = useMemo(() => {
    const projects = Array.from(new Set((tasks || []).map(t => t.projectName).filter(Boolean))).sort();
    return ['All', ...projects];
  }, [tasks]);

  // RBAC: filter tasks based on role
  const visibleTasks = useMemo(() => {
    let base = tasks || [];
    if (!canViewTeam(currentUser)) {
      base = base.filter(t => namesMatch(t.userName, currentUser.name));
    }
    // Apply team filter (only applicable to Supreme)
    if (teamFilter && teamFilter !== 'All') {
      base = base.filter(t => (t.userName || '') === teamFilter);
    }

    return base;
  }, [tasks, currentUser, teamFilter]);

  // Filter Tasks
  const filteredTasks = visibleTasks.filter(task => {
    const matchesSearch = 
      task.heading.toLowerCase().includes(searchText.toLowerCase()) ||
      (task.projectName || '').toLowerCase().includes(searchText.toLowerCase()) ||
      task.details.toLowerCase().includes(searchText.toLowerCase()) ||
      (task.attachmentUrl || '').toLowerCase().includes(searchText.toLowerCase());
      
    const matchesFilter = 
      activeFilter === 'All' || 
      task.importLevel.toLowerCase() === activeFilter.toLowerCase();

    const matchesStatus = statusFilter === 'All' || (task.status || 'Pending') === statusFilter;
    const matchesProject = projectFilter === 'All' || task.projectName === projectFilter;
    const taskCreated = task.createdAt ? new Date(task.createdAt) : null;
    const matchesFrom = !dateFrom || (taskCreated && taskCreated >= new Date(`${dateFrom}T00:00:00`));
    const matchesTo = !dateTo || (taskCreated && taskCreated <= new Date(`${dateTo}T23:59:59`));
      
    return matchesSearch && matchesFilter && matchesStatus && matchesProject && matchesFrom && matchesTo;
  });

  // Sort Tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (activeSort === 'newest') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (activeSort === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
    if (activeSort === 'longest-time') {
      return (b.timeTaken || 0) - (a.timeTaken || 0);
    }
    if (activeSort === 'shortest-time') {
      return (a.timeTaken || 0) - (b.timeTaken || 0);
    }
    if (activeSort === 'priority') {
      return (PRIORITY_ORDER[b.importLevel] || 0) - (PRIORITY_ORDER[a.importLevel] || 0);
    }
    if (activeSort === 'due-date') {
      return new Date(a.dueDate || '2999-12-31') - new Date(b.dueDate || '2999-12-31');
    }
    return 0;
  });

  const exportCsv = () => {
    const headers = ['Project', 'Task', 'Details', 'Status', 'Priority', 'Hours', 'Owner', 'Due Date', 'Attachment', 'Created At', 'Updated At'];
    const rows = sortedTasks.map(task => [
      task.projectName,
      task.heading,
      task.details,
      task.status || 'Pending',
      task.importLevel,
      task.timeTaken,
      task.userName,
      task.dueDate,
      task.attachmentUrl,
      task.createdAt,
      task.updatedAt
    ]);
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskupdate-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendSummary = async () => {
    if (!onSendSummary) return;
    setIsSendingSummary(true);
    try {
      await onSendSummary(sortedTasks);
      alert('Summary sent to Google Chat.');
    } catch (error) {
      alert(error.message || 'Failed to send summary.');
    } finally {
      setIsSendingSummary(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Filtering and Search Controls Row */}
      <div className="filter-controls-row">
        <div className="search-input-wrapper">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="input-style search-input"
            placeholder="Search updates by keyword..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="filter-tabs">
            {['All', 'High', 'Medium', 'Low'].map(f => (
              <button
                key={f}
                className={`filter-tab ${activeFilter === f ? 'active' : ''} ${activeFilter === f ? f.toLowerCase() : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="sort-select-wrapper">
            <label htmlFor="status-filter">STATUS</label>
            <select
              id="status-filter"
              className="sort-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              {STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>

          <div className="sort-select-wrapper">
            <label htmlFor="project-filter">PROJECT</label>
            <select
              id="project-filter"
              className="sort-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              {projectOptions.map(project => <option key={project} value={project}>{project === 'All' ? 'All Projects' : project}</option>)}
            </select>
          </div>

          <div className="sort-select-wrapper">
            <label htmlFor="task-sort">SORT</label>
            <select
              id="task-sort"
              className="sort-select"
              value={activeSort}
              onChange={(e) => setActiveSort(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">Highest Priority</option>
              <option value="due-date">Due Date</option>
              <option value="longest-time">Longest Duration</option>
              <option value="shortest-time">Shortest Duration</option>
            </select>
          </div>

          {/* Team filter for Supreme users */}
          {canViewTeam(currentUser) && (
            <div className="team-filter">
              <label>Team</label>
              <select className="sort-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
                {teamMembers.map(m => <option key={m} value={m}>{m === 'All' ? 'All Team Members' : m}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="advanced-filter-row">
        <div className="date-filter">
          <label htmlFor="date-from">From</label>
          <input id="date-from" type="date" className="input-style" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="date-filter">
          <label htmlFor="date-to">To</label>
          <input id="date-to" type="date" className="input-style" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button className="btn-secondary compact-action-btn" onClick={exportCsv} disabled={sortedTasks.length === 0}>
          Export CSV
        </button>
        <button className="btn-secondary compact-action-btn" onClick={sendSummary} disabled={sortedTasks.length === 0 || isSendingSummary}>
          {isSendingSummary ? 'Sending...' : 'Send Summary'}
        </button>
      </div>

      {/* Task updates renderer */}
      {sortedTasks.length === 0 ? (
        <div className="glass-card empty-state-container">
          <div className="empty-state-icon">📂</div>
          <h4 className="empty-state-title">No task updates found</h4>
          <p className="empty-state-desc">
            {tasks.length === 0 
              ? "Start logging your accomplishments in the left pane to initialize the database." 
              : "Try adjusting your filters or search keywords to locate stored updates."
            }
          </p>
        </div>
      ) : (
        <div className="tasks-grid">
          {sortedTasks.map(task => {
            const isEditing = editingId === task.id;
            const priorityClass = (task.importLevel || 'Medium').toLowerCase();
            const isAuthor = namesMatch(task.userName, currentUser.name);
            const canEdit = currentUser.role === 'Supreme' || isAuthor;
            const canDelete = currentUser.role === 'Supreme' || isAuthor;
            
            return (
              <div key={task.id} className={`glass-card task-card ${priorityClass}`}>
                
                {isEditing ? (
                  /* INLINE EDIT MODE CONTAINER */
                  <div className="edit-form-wrapper">
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>PROJECT</label>
                      <input
                        type="text"
                        className="input-style"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                        value={editProjectName}
                        onChange={(e) => setEditProjectName(e.target.value)}
                        maxLength={40}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>HEADING</label>
                      <input
                        type="text"
                        className="input-style"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                        value={editHeading}
                        onChange={(e) => setEditHeading(e.target.value)}
                        maxLength={80}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>DETAILS</label>
                      <textarea
                        className="input-style"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem', minHeight: '60px' }}
                        value={editDetails}
                        onChange={(e) => setEditDetails(e.target.value)}
                        maxLength={1000}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem' }}>TIME (HRS)</label>
                        <input
                          type="number"
                          step="0.05"
                          className="input-style"
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem' }}>IMPORTANCE</label>
                        <select
                          className="sort-select"
                          style={{ padding: '0.5rem 0.75rem', height: '100%', fontSize: '0.88rem', borderRadius: '10px' }}
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value)}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem' }}>STATUS</label>
                        <select
                          className="sort-select"
                          style={{ padding: '0.5rem 0.75rem', height: '100%', fontSize: '0.88rem', borderRadius: '10px' }}
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                        >
                          {STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem' }}>DUE DATE</label>
                        <input
                          type="date"
                          className="input-style"
                          style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>ATTACHMENT OR TICKET URL</label>
                      <input
                        type="url"
                        className="input-style"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                        value={editAttachmentUrl}
                        onChange={(e) => setEditAttachmentUrl(e.target.value)}
                      />
                    </div>
                    <div className="edit-actions">
                      <button className="edit-btn-cancel" onClick={cancelEditing}>Cancel</button>
                      <button className="edit-btn-save" onClick={() => saveEdit(task.id)}>Save Update</button>
                    </div>
                  </div>
                ) : (
                  /* STANDARD DISPLAY CONTAINER */
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="task-card-header">
                        <div className="task-heading-stack">
                          {task.projectName && (
                            <span className="project-code-pill">{task.projectName}</span>
                          )}
                          <h4 className="task-title">{task.heading}</h4>
                        </div>
                        <div className="task-meta-pills">
                          <span className={`meta-pill status-${(task.status || 'Pending').toLowerCase().replace(/\s+/g, '-')}`}>{task.status || 'Pending'}</span>
                          {isOverdue(task) && <span className="meta-pill overdue">Overdue</span>}
                          <span className={`meta-pill priority-${priorityClass}`}>{task.importLevel}</span>
                          {task.timeTaken > 0 && (
                            <span className="meta-pill time-spent">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.15rem' }}>
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                              </svg>
                              {task.timeTaken} hr{task.timeTaken !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {task.details && (
                        <p className="task-details">{task.details}</p>
                      )}

                      {(task.dueDate || task.attachmentUrl) && (
                        <div className="task-extra-row">
                          {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                          {task.attachmentUrl && (
                            <a href={task.attachmentUrl} target="_blank" rel="noopener noreferrer">
                              Open Link
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="task-card-footer">
                      <div className="task-timestamp">
                        <span>Logged: {getFormattedDate(task.createdAt)}</span>
                        {task.updatedAt !== task.createdAt && (
                          <span style={{ color: 'var(--color-primary-hover)', fontWeight: '500' }}>
                            Updated: {getFormattedDate(task.updatedAt)}
                          </span>
                        )}
                      </div>
                      
                      <div className="task-actions">
                        {canViewTeam(currentUser) && (
                          <div className="author-label">
                            Logged by: <strong>{task.userName}</strong>
                          </div>
                        )}

                        <button
                          className="action-icon-btn send"
                          onClick={() => sendTaskUpdate(task)}
                          title="Send task update to Google Chat"
                          disabled={sendingWebhookId === task.id}
                        >
                          {sendingWebhookId === task.id ? (
                            <span className="mini-spinner"></span>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m22 2-7 20-4-9-9-4Z"></path>
                              <path d="M22 2 11 13"></path>
                            </svg>
                          )}
                        </button>

                        <button 
                          className="action-icon-btn edit" 
                          onClick={() => canEdit ? startEditing(task) : alert('You can only edit your own updates.')}
                          title="Edit task heading or details"
                          disabled={!canEdit}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path>
                          </svg>
                        </button>
                        <button 
                          className="action-icon-btn delete" 
                          onClick={() => {
                            if (!canDelete) { alert('You can only delete your own updates.'); return; }
                            if (window.confirm("Are you sure you want to delete this task update?")) {
                              onDeleteTask(task.id);
                            }
                          }}
                          title="Delete task from database"
                          disabled={!canDelete}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
                
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
