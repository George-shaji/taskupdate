import { useState } from 'react';

const TIME_PRESETS = [
  { label: '15m', val: 0.25 },
  { label: '30m', val: 0.5 },
  { label: '1h', val: 1 },
  { label: '2h', val: 2 },
  { label: '4h', val: 4 },
  { label: '8h', val: 8 }
];

const PRIORITIES = [
  { label: 'Low', value: 'Low', className: 'low' },
  { label: 'Medium', value: 'Medium', className: 'medium' },
  { label: 'High', value: 'High', className: 'high' }
];

const STATUSES = ['Pending', 'In Progress', 'Blocked', 'Completed'];

export default function TaskForm({ onAddTask, isSubmitting, currentUser }) {
  const [projectName, setProjectName] = useState('');
  const [heading, setHeading] = useState('');
  const [details, setDetails] = useState('');
  const [timeTaken, setTimeTaken] = useState('');
  const [importLevel, setImportLevel] = useState('Medium');
  const [status, setStatus] = useState('Pending');
  const [dueDate, setDueDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!projectName.trim() || !heading.trim()) return;

    // Call state handler and include userName
    onAddTask({
      projectName: projectName.trim(),
      heading: heading.trim(),
      details: details.trim(),
      timeTaken: parseFloat(timeTaken) || 0,
      importLevel,
      status,
      dueDate,
      attachmentUrl: attachmentUrl.trim(),
      userName: currentUser?.name || 'Anonymous'
    });

    // Reset form
    setProjectName('');
    setHeading('');
    setDetails('');
    setTimeTaken('');
    setImportLevel('Medium');
    setStatus('Pending');
    setDueDate('');
    setAttachmentUrl('');
  };

  const selectTimePreset = (val) => {
    setTimeTaken(val.toString());
  };

  return (
    <form className="glass-card task-form-card" onSubmit={handleSubmit}>
      <div>
        <h3 className="form-title">Log Task Update</h3>
        <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '0.2rem' }}>
          Document your progress and sync with the team database.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="task-project">PROJECT NAME *</label>
        <input
          id="task-project"
          type="text"
          className="input-style"
          placeholder="e.g. CRCS072"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          required
          maxLength={40}
        />
      </div>

      <div className="form-group">
        <label htmlFor="task-heading">TASK HEADING *</label>
        <input
          id="task-heading"
          type="text"
          className="input-style"
          placeholder="e.g. Design Glassmorphic Login"
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          required
          maxLength={80}
        />
      </div>

      <div className="form-group">
        <label htmlFor="task-details">DETAILS</label>
        <textarea
          id="task-details"
          className="input-style"
          placeholder="What exactly did you work on or accomplish?"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
        />
        <div style={{ alignSelf: 'flex-end', fontSize: '0.75rem', color: '#475569', marginTop: '0.1rem' }}>
          {details.length}/1000
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="task-time">TIME TAKEN (HOURS)</label>
        <input
          id="task-time"
          type="number"
          step="0.05"
          min="0"
          max="1000"
          className="input-style"
          placeholder="e.g. 1.5"
          value={timeTaken}
          onChange={(e) => setTimeTaken(e.target.value)}
        />
        <div className="time-pills-container">
          {TIME_PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              className={`time-pill-btn ${parseFloat(timeTaken) === preset.val ? 'active' : ''}`}
              onClick={() => selectTimePreset(preset.val)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>IMPORTANCE LEVEL</label>
        <div className="priority-cards-grid">
          {PRIORITIES.map(p => (
            <div
              key={p.value}
              className={`priority-card ${p.className} ${importLevel === p.value ? 'active' : ''}`}
              onClick={() => setImportLevel(p.value)}
            >
              <span className="priority-label">{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="task-status">STATUS</label>
        <select
          id="task-status"
          className="sort-select full-width-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUSES.map(item => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="task-due-date">DUE DATE</label>
        <input
          id="task-due-date"
          type="date"
          className="input-style"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="task-link">ATTACHMENT OR TICKET URL</label>
        <input
          id="task-link"
          type="url"
          className="input-style"
          placeholder="https://..."
          value={attachmentUrl}
          onChange={(e) => setAttachmentUrl(e.target.value)}
          maxLength={300}
        />
      </div>

      <button
        type="submit"
        className="btn-primary"
        style={{ marginTop: '0.5rem' }}
        disabled={!projectName.trim() || !heading.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
            Syncing Task...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Submit & Update
          </>
        )}
      </button>
    </form>
  );
}
